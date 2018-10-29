"use strict";

const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");
const StokrTokenFactory = artifacts.require("./token/StokrTokenFactory.sol");
const StokrCrowdsale = artifacts.require("./crowdsale/StokrCrowdsale.sol");
const StokrCrowdsaleFactory = artifacts.require("./crowdsale/StokrCrowdsaleFactory.sol");
const StokrProjectManager = artifacts.require("./StokrProjectManager.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject, snapshot} = require("./helpers/common");


contract("StokrProjectManager", ([owner,
                                  tokenOwner,
                                  crowdsaleOwner,
                                  profitDepositor,
                                  keyRecoverer,
                                  rateAdmin,
                                  companyWallet,
                                  reserveAccount,
                                  anyone]) => {

    let tokenPrice = new BN(100);  // A token costs one Euro
    let etherRate = new BN(16321);  // Realistic rate is something in [1e5..2e5]

    // Set the cap so that a single investor can easily reach it
    let tokensFor = value => value.mul(etherRate).divToInt(tokenPrice);
    let tokenCapOfPublicSale = tokensFor(money.ether(40));
    let tokenCapOfPrivateSale = tokensFor(money.ether(30));
    let tokenReserve = tokensFor(money.ether(10));
    let tokenGoal = tokensFor(money.ether(8));

    let openingTime = time.now() + time.days(7);
    let closingTime = openingTime + time.days(7);

    let projectManager, whitelist, tokenFactory, crowdsaleFactory;

    it("deploy project manager", async () => {
        projectManager = await StokrProjectManager.new(etherRate, {from: owner});
        projectManager.setRateAdmin(rateAdmin, {from: owner});
    });

    it("deploy whitelist", async () => {
        whitelist = await Whitelist.new({from: owner});
        projectManager.setWhitelist(whitelist.address, {from: owner});
    });

    it("deploy token factory", async () => {
        tokenFactory = await StokrTokenFactory.new(projectManager.address, {from: owner});
        projectManager.setTokenFactory(tokenFactory.address, {from: owner});
    });

    it("deploy crowdsale factory", async () => {
        crowdsaleFactory = await StokrCrowdsaleFactory.new(projectManager.address, {from: owner});
        projectManager.setCrowdsaleFactory(crowdsaleFactory.address, {from: owner});
    });

    it("create a project", async () => {
        await projectManager.createNewProject(
            "Stokr Sample Project",
            "STKR",
            tokenPrice,
            [profitDepositor, keyRecoverer, tokenOwner, crowdsaleOwner],
            [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal, tokenReserve],
            [openingTime, closingTime],
            [companyWallet, reserveAccount],
            {from: owner});
    });

    it("set rate", async () => {
        let newRate = etherRate.plus(1);
        let crowdsale = await StokrCrowdsale.at(await projectManager.activeCrowdsales(0));
        await projectManager.setRate(newRate, {from: rateAdmin});
        expect(await crowdsale.etherRate()).to.be.bignumber.equal(newRate);
    });

});

