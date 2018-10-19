"use strict";

const Whitelist = artifacts.require("whitelist/Whitelist");
const Token = artifacts.require("token/StokrToken");
const Sale = artifacts.require("crowdsale/StokrCrowdsale");


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
                        100,
                        16384,
                        owner,
                        now + 30,
                        now + 24 * 60 * 60,
                        owner,
                        0,
                        owner,
                        {from: owner});
    }).then(sale => {
        console.log("  ==> at address " + sale.address);
    });
};

