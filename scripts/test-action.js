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


const run = async () => {
    let owner = await web3.eth.accounts[0];
    let projectManager = await StokrProjectManager.at("0x87a02197a0555bE7194fCdFC1197C8c6b4CF2F16");
    let whitelist = await Whitelist.at(await projectManager.currentWhitelist());

    let $ = console.log;
    $("removeAdmin");
    await whitelist.removeAdmin(owner, {from: owner});
    $("addAdmin");
    await whitelist.addAdmin(owner, {from: owner});
    $("done");
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

