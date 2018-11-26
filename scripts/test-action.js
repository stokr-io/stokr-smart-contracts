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
const sleep = secs => new Promise(resolve => setTimeout(resolve, 1000 * secs));


const run = async () => {
    for (;;) {
        let owner = await web3.eth.accounts[0];
        let projectManager = await StokrProjectManager.at("0xADFE51FdD91bea54999160B39B2667080cc873fc");

        let etherRate = await projectManager.etherRate();
        await projectManager.setRate(etherRate.plus(1), {from: owner});

        console.log((await projectManager.activeCrowdsalesCount()).toPrecision());
        console.log((await projectManager.etherRate()).toPrecision());
        await sleep(5);
    }
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

