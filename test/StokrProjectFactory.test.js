"use strict";

const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");
const StokrCrowdsale = artifacts.require("./crowdsale/StokrCrowdsale.sol");
const StokrProjectFactory = artifacts.require("./StokrProjectFactory.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject, snapshot} = require("./helpers/common");


contract("StokrCrowdsale", ([owner,
                             profitDepositor,
                             keyRecoverer,
                             rateAdmin,
                             companyWallet,
                             reserveAccount,
                             anyone]) => {

    let tokenPrice = new BN("100");  // A token costs one Euro
    let etherRate = new BN("16321");  // Realistic rate is something in [1e5..2e5]

    // Set the cap so that a single investor can easily reach it
    let tokenCapOfPublicSale = money.ether(25).mul(etherRate).divToInt(tokenPrice);
    let tokenCapOfPrivateSale = tokenCapOfPublicSale.divToInt(2);
    let tokenReserve = tokenCapOfPublicSale.divToInt(10);
    let tokenGoal = tokenCapOfPublicSale.divToInt(20);

    let openingTime = time.now() + time.days(7);
    let closingTime = openingTime + time.days(7);

    let whitelist, factory;

    it("deploy whitelist", async () => {
        whitelist = await Whitelist.new({from: owner});
    });

    it("deploy factory", async () => {
        factory = await StokrProjectFactory.new(whitelist.address, {from: owner});
    });

    it("create a project", async () => {
        await time.increaseBy(time.days(1));

        await factory.createNewProject();

        /*
        await factory.createNewProject(
            "Stokr Sample Project",
            "STKR",
            [profitDepositor, keyRecoverer, rateAdmin],
            tokenGoal,
            [tokenCapOfPublicSale, tokenCapOfPrivateSale],
            tokenPrice,
            etherRate,
            [openingTime, closingTime],
            [companyWallet, reserveAccount],
            tokenReserve,
            {from: owner});
        */
    });

});

