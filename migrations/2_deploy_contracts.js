"use strict";

const Whitelist = artifacts.require("Whitelist");
const Token = artifacts.require("SampleToken");
const Sale = artifacts.require("StokrCrowdsale");


module.exports = function(deployer, network, accounts) {
    let owner = accounts[0];
    let now = Date.now() / 1000 | 0;

    deployer.then(() => {
        console.log("  Deploy Whitelist");
        return Whitelist.new({from: owner});
    }).then(whitelist => {
        console.log("  ==> at address " + whitelist.address);

        console.log("  Deploy Token");
        return Token.new("Sample Stokr Token",
                         "STOKR",
                         whitelist.address,
                         owner,
                         owner,
                         {from: owner});
    }).then(token => {
        console.log("  ==> at address " + token.address);

        console.log("  Deploy Sale");
        return Sale.new(token.address,
                        1000e18,
                        30e18,
                        now + 30,
                        now + 24 * 60 * 60,
                        20,
                        0,
                        owner,
                        {from: owner});
    }).then(sale => {
        console.log("  ==> at address " + sale.address);
    });
};

