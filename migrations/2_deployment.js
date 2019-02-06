"use strict";

const StokrProjectManager = artifacts.require("StokrProjectManager");
const Whitelist = artifacts.require("whitelist/Whitelist");
const StokrTokenFactory = artifacts.require("token/StokrTokenFactory");
const StokrCrowdsaleFactory = artifacts.require("crowdsale/StokrCrowdsaleFactory");

const INITIAL_ETHER_RATE = 10000;
//const INITIAL_RATE_ADMIN = "0xC0FEBABE";


module.exports = (deployer, network) => deployer.then(async () => {
    let projectManager = await deployer.deploy(StokrProjectManager, INITIAL_ETHER_RATE);

    let whitelist = await deployer.deploy(Whitelist);
    let tokenFactory = await deployer.deploy(StokrTokenFactory);
    let crowdsaleFactory = await deployer.deploy(StokrCrowdsaleFactory);

    await projectManager.setWhitelist(whitelist.address);
    await projectManager.setTokenFactory(tokenFactory.address);
    await projectManager.setCrowdsaleFactory(crowdsaleFactory.address);

    let owner = await projectManager.owner();

    await projectManager.setRateAdmin(owner);
    await whitelist.addAdmin(owner);
});

