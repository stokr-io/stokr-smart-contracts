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


const tokenReservePerMill = new BN(200);  // Add 20% of sold tokens to reserve account
const tokenPrice = new BN(100);  // A token costs one Euro
const etherRate = new BN(16321);  // Realistic rate is something in [1e5..2e5]

const tokensFor = value => value.times(etherRate).divToInt(tokenPrice);

const tokenCapOfPublicSale = tokensFor(ether(40));
const tokenCapOfPrivateSale = tokensFor(ether(30));
const tokenPurchaseMinimum = tokensFor(ether(1));
const tokenGoal = tokensFor(ether(8));

const openingTime = now() + days(7);
const closingTime = openingTime + days(7);


let projectManager, whitelist, tokenFactory, crowdsaleFactory;


const deployProjectManager = async owner => {
    let rateAdmin = owner;
    console.log("Deploy new Project Manager");
    projectManager = await StokrProjectManager.new(etherRate, {from: owner});
    console.log("==> at", projectManager.address);
    projectManager.setRateAdmin(rateAdmin, {from: owner});
};


const deployWhitelist = async owner => {
    console.log("Deploy new Whitelist");
    whitelist = await Whitelist.new({from: owner});
    console.log("==> at", whitelist.address);
    projectManager.setWhitelist(whitelist.address, {from: owner});
};


const deployTokenFactory = async owner => {
    console.log("Deploy new Token Factory");
    tokenFactory = await StokrTokenFactory.new(projectManager.address, {from: owner});
    console.log("==> at", tokenFactory.address);
    projectManager.setTokenFactory(tokenFactory.address, {from: owner});
};


const deployCrowdsaleFactory = async owner => {
    console.log("Deploy new Crowdsale Factory");
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
            [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal,
             tokenPurchaseMinimum, tokenReservePerMill],
            [openingTime, closingTime],
            [companyWallet, reserveAccount],
            {from: owner});
    let project = await projectManager.projects(0);
    console.log("==> Token at", project[2]);
    console.log("==> Crowdsale at", project[3]);
};


const checkProject = async () => {
    let [name, whitelistAddress, tokenAddress, saleAddress] = await projectManager.projects(0);
    let whitelist = await Whitelist.at(whitelistAddress);
    let token = await StokrToken.at(tokenAddress);
    let sale = await StokrCrowdsale.at(saleAddress);

    let logAttributes = async contract => {
        for (let name of contract.abi
                                 .filter(node => node.type === "function"
                                              && node.constant
                                              && node.inputs.length == 0)
                                 .map(method => method.name)
                                 .sort()) {
            console.log(`    ${name}`, (await contract[name]()).toString());
        }
    };

    console.log("Project #0", name);
    await logAttributes(projectManager);
    console.log("==> Whitelist at ", whitelist.address);
    await logAttributes(whitelist);
    console.log("==> Token at", token.address);
    await logAttributes(token);
    console.log("==> Crowdsale at", sale.address);
    await logAttributes(sale);
};


const run = async () => {
    let owner = await web3.eth.accounts[0];
    console.log("Owner is", owner);
    await deployProjectManager(owner);
    await deployWhitelist(owner);
    await deployTokenFactory(owner);
    await deployCrowdsaleFactory(owner);
    await createNewProject(owner);
    await checkProject();
};


module.exports = callback =>
    (async () => {
        try {
            await run();
            callback();
        }
        catch (error) {
            callback(error);
        }
    })();

