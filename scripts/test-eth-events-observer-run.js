"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const Token = artifacts.require("./SampleToken.sol");
const Sale = artifacts.require("./StokrCrowdsale.sol");

const addresses = require("./addresses.json");

const BN = web3.BigNumber;
const choose = list => list[Math.trunc(list.length * Math.random())];
const sleep = secs => new Promise(resolve => setTimeout(resolve, 1000 * secs));

let owner;
let investors;
let whitelist;
let tokens;
let sales;

const loadAddresses = async () => {
    console.log("addresses");
    owner = addresses.accounts.owner;
    //await web3.personal.unlockAccount(owner, "", 0);
    console.log(`- owner at ${owner}`);
    investors = addresses.accounts.investors;
    for (let i = 0; i < investors.length; ++i) {
        let investor = investors[i];
        //await web3.personal.unlockAccount(investor, "", 0);
        console.log(`- investor at ${investor}`);
    }
    whitelist = Whitelist.at(addresses.contracts.Whitelist[0]);
    console.log(`- whitelist at ${whitelist.address}`);
    tokens = [];
    for (let i = 0; i < addresses.contracts.StokrToken.length; ++i) {
        let address = addresses.contracts.StokrToken[i];
        let token = await Token.at(address);
        tokens.push(token);
        console.log(`- token ${await token.symbol()} at ${token.address}`);
    }
    sales = [];
    for (let i = 0; i < addresses.contracts.StokrCrowdsale.length; ++i) {
        let address = addresses.contracts.StokrCrowdsale[i];
        let sale = await Sale.at(address);
        let token = await Token.at(await sale.token());
        sales.push(await Sale.at(address));
        console.log(`- sale for ${await token.symbol()} at ${sale.address}`);
    }
};

const doSomething = async () => {
    if (Math.random() < 0.1) {
        let token = choose(tokens);
        let profits = choose([1, 2, 3, 4, 5]);
        await token.depositProfit({from: owner, value: profits * 1e18});
        console.log(`- profits of ${profits} ether deposited at ${await token.symbol()}`);
    }
    if (Math.random() < 0.1) {
        let token = choose(tokens);
        let investor = choose(investors);
        await token.withdrawProfitShare({from: investor});
        console.log(`- ${investor} withdrew profit share from ${await token.symbol()}`);
    }
    if (Math.random() < 0.1) {
        let investor = choose(investors);
        if (await whitelist.isWhitelisted(investor)) {
            await whitelist.removeFromWhitelist([investor], {from: owner});
            console.log(`- ${investor} removed from whitelist`);
        }
    }
    if (Math.random() < 0.5) {
        let investor = choose(investors);
        if (!await whitelist.isWhitelisted(investor)) {
            await whitelist.addToWhitelist([investor], {from: owner});
            console.log(`- ${investor} added to whitelist`);
        }
    }
    if (Math.random() < 0.8) {
        let token = choose(tokens);
        let sender = choose(investors);
        let recipient = choose(investors);
        let fraction = choose([1/100, 1/50, 1/20, 1/10]);
        let amount = (await token.balanceOf(sender)).mul(fraction).truncated();
        if (await whitelist.isWhitelisted(sender) && await whitelist.isWhitelisted(recipient)) {
            await token.transfer(recipient, amount, {from: sender});
            console.log(`- ${sender} sent ${amount} a${await token.symbol()} to ${recipient}`);
        }
    }
};

const run = async () => {
    await loadAddresses();

    console.log("actions");
    while (true) {
        await sleep(20);
        await doSomething();
    }
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

