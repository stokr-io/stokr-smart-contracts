"use strict";

const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");
const StokrTokenFactory = artifacts.require("./token/StokrTokenFactory.sol");
const StokrCrowdsale = artifacts.require("./crowdsale/StokrCrowdsale.sol");
const StokrCrowdsaleFactory = artifacts.require("./crowdsale/StokrCrowdsaleFactory.sol");
const StokrProjectManager = artifacts.require("./StokrProjectManager.sol");


const BN = web3.BigNumber;
const now = () => Date.now() / 1000 | 0;
const mins = n => 60 * n;
const hours = n => 60 * mins(n);
const days = n => 24 * hours(n);
const ether = wei => new BN(web3.toWei(wei, "ether"));


const tokenPrice = new BN(100);  // A token costs one Euro
const etherRate = new BN(16321);  // Realistic rate is something in [1e5..2e5]

const tokensFor = value => value.times(etherRate).divToInt(tokenPrice);

const tokenCapOfPublicSale = tokensFor(ether(40));
const tokenCapOfPrivateSale = tokensFor(ether(30));
const tokenReserve = tokensFor(ether(10));
const tokenGoal = tokensFor(ether(8));

const openingTime = now() + days(7);
const closingTime = openingTime + days(7);


let projectManager, whitelist, tokenFactory, crowdsaleFactory;


const deployProjectManager = async owner => {
    let rateAdmin = owner;
    console.log("Deploy New Project Manager");
    projectManager = await StokrProjectManager.new(etherRate, {from: owner});
    console.log("==> at", projectManager.address);
    projectManager.setRateAdmin(rateAdmin, {from: owner});
};


const deployWhitelist = async owner => {
    console.log("Deploy New Whitelist");
    whitelist = await Whitelist.new({from: owner});
    console.log("==> at", whitelist.address);
    projectManager.setWhitelist(whitelist.address, {from: owner});
};


const deployTokenFactory = async owner => {
    console.log("Deploy New Token Factory");
    tokenFactory = await StokrTokenFactory.new(projectManager.address, {from: owner});
    console.log("==> at", tokenFactory.address);
    projectManager.setTokenFactory(tokenFactory.address, {from: owner});
};


const deployCrowdsaleFactory = async owner => {
    console.log("Deploy New Crowdsale Factory");
    crowdsaleFactory = await StokrCrowdsaleFactory.new(projectManager.address, {from: owner});
    console.log("==> at", crowdsaleFactory.address);
    projectManager.setCrowdsaleFactory(crowdsaleFactory.address, {from: owner});
};


const createNewProject = async owner => {
    let profitDepositor = owner;
    let keyRecoverer = owner;
    let tokenOwner = owner;
    let crowdsaleOwner = owner;
    let companyWallet = owner;
    let reserveAccount = owner;
    console.log("Create new Project");
    await projectManager.createNewProject(
            "Stokr Sample Project",
            "STKR",
            tokenPrice,
            [profitDepositor, keyRecoverer, tokenOwner, crowdsaleOwner],
            [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal, tokenReserve],
            [openingTime, closingTime],
            [companyWallet, reserveAccount],
            {from: owner});
    let project = await projectManager.projects(0);
    console.log("==> Token at", project[2]);
    console.log("==> Crowdsale at", project[3]);
};


const run = async () => {
    let owner = await web3.eth.accounts[0];
    console.log("Owner is", owner);
    await deployProjectManager(owner);
    await deployWhitelist(owner);
    await deployTokenFactory(owner);
    await deployCrowdsaleFactory(owner);
    await createNewProject(owner);
};


module.exports = callback => {
    (async () => {
        try {
            await run();
            callback();
        }
        catch (error) {
            callback(error);
        }
    })();
};

