"use strict";

const Whitelist = artifacts.require("whitelist/Whitelist");
const Token = artifacts.require("token/StokrToken");
const Sale = artifacts.require("crowdsale/StokrCrowdsale");

const now = () => Date.now() / 1000 | 0;
const mins = n => 60 * n;
const hours = n => 60 * mins(n);
const days = n => 24 * hours(n);
const ether = wei => 1e18 * wei;


module.exports = function(deployer, network, accounts) {
    /*
    const owner = accounts[0];
    const profitDepositor = owner;
    const keyRecoverer = owner;
    const rateAdmin = owner;
    const companyWallet = owner;
    const reserveAccount = owner;

    const etherRate = 16384;
    const tokenPrice = 100;  // 1 EUR per token

    const tokensFor = value => value * etherRate / tokenPrice;
    const tokenCapOfPublicSale = tokensFor(ether(30));  // max investment: 30 Ether
    const tokenCapOfPrivateSale = tokensFor(ether(15));  // max investment: 15 Ether
    const tokenGoal = tokensFor(ether(5));  // min investment in both sales: 5 Ether
    const tokenReserve = tokensFor(ether(3));  // reserve tokens worth of 3 Ether

    const openingTime = now() + mins(10);
    const closingTime = openingTime + hours(1);

    deployer.then(() => {
        console.log("  Deploy Whitelist");
        return Whitelist.new({from: owner});

    }).then(whitelist => {
        console.log("  ==> at address " + whitelist.address);

        console.log("  Deploy Token");
        return Token.new("Sample Stokr Token",
                         "STOKR",
                         whitelist.address,
                         profitDepositor,
                         keyRecoverer,
                         {from: owner});
    }).then(token => {
        console.log("  ==> at address " + token.address);

        console.log("  Deploy Sale");
        return Sale.new(token.address,
                        tokenCapOfPublicSale,
                        tokenCapOfPrivateSale,
                        tokenGoal,
                        tokenPrice,
                        etherRate,
                        rateAdmin,
                        openingTime,
                        closingTime,
                        companyWallet,
                        tokenReserve,
                        reserveAccount,
                        {from: owner});
    }).then(sale => {
        console.log("  ==> at address " + sale.address);
    });
    */
};

