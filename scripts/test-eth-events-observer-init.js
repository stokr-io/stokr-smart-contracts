"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const Token = artifacts.require("./SampleToken.sol");
const Sale = artifacts.require("./StokrCrowdsale.sol");

const fs = require("fs");

const BN = web3.BigNumber;
const now = () => Date.now() / 1000 | 0;
const choose = list => list[Math.trunc(list.length * Math.random())];
const sleep = secs => new Promise(resolve => setTimeout(resolve, 1000 * secs));


let whitelist;
let tokens;
let sales;

let owner;
let investors;


const setAccounts = async number => {
    console.log("accounts");
    let accounts = await web3.eth.accounts;
    await web3.personal.unlockAccount(accounts[1], "", 0);
    owner = accounts.shift();
    console.log(`- owner at ${owner}`);
    investors = accounts.slice(0, number);
    investors.forEach(investor =>
        console.log(`- investor at ${investor}`));
};

const deployWhitelist = async () => {
    console.log("deploy whitelist");
    whitelist = await Whitelist.new({from: owner});
    await whitelist.addAdmin(owner, {from: owner});
    await whitelist.addToWhitelist([owner], {from: owner});
    await whitelist.addToWhitelist(investors, {from: owner});
    console.log(`- whitelist at ${whitelist.address}`);
};

const deployTokens = async number => {
    console.log("deploy tokens");
    tokens = [];
    for (let i = 0; i < number; ++i) {
        let token = await Token.new(`Sample Token ${i}`,
                                    `TOK${i}`,
                                    whitelist.address,
                                    owner,
                                    owner,
                                    {from: owner});
        tokens.push(token);
        console.log(`- ${await token.symbol()} at ${token.address}`);
    }
};

const deploySales = async () => {
    console.log("deploy sales");
    sales = [];
    for (let token of tokens.values()) {
        let sale = await Sale.new(token.address,  // token address
                                  new BN("100e18"),  // token cap
                                  new BN("3e18"),  // token goal
                                  now() + 180,  // opening time
                                  now() + 480,  // closing time
                                  12345,  // token per ether rate
                                  0,  // team token share
                                  owner,  // wallet
                                  {from: owner});
        await token.setMinter(sale.address, {from: owner});
        await sale.setTeamAccount(owner, {from: owner});
        sales.push(sale);
        console.log(`- sale for ${await token.symbol()} at ${sale.address}`);
    }
};

const allSalesOpened = async () => {
    console.log("wait until all sales opened...");
    let allOpened = false;
    while (!allOpened) {
        allOpened = true;
        for (let sale of sales.values()) {
            if ((await sale.openingTime()).gt(now())) {
                allOpened = false;
                await sleep(1);
                break;
            }
        }
    }
};

const purchaseTokens = async () => {
    console.log("purchase tokens");
    for (let sale of sales.values()) {
        let token = await Token.at(await sale.token());
        for (let investor of investors.values()) {
            let ethValue = choose([0, 1, 2, 3, 4]);
            if (ethValue > 0) {
                await sale.buyTokens(investor, {from: investor, value: ethValue * 1e18});
            }
            console.log(`- ${investor} bought ${await token.symbol()} for ${ethValue} ether`);
        }
    }
};

const allSalesClosed = async () => {
    console.log("wait until all sales closed...");
    let allClosed = false;
    while (!allClosed) {
        allClosed = true;
        for (let sale of sales.values()) {
            if (!(await sale.hasClosed())) {
                allClosed = false;
                await sleep(1);
                break;
            }
        }
    }
};

const finalizeSales = async () => {
    console.log("finalize sales");
    for (let sale of sales.values()) {
        let token = await Token.at(await sale.token());
        await sale.finalize({from: owner});
        console.log(`- sale for ${await token.symbol()}`);
    }
};

const distributeTokens = async () => {
    console.log("distribute tokens");
    for (let token of tokens.values()) {
        await token.setMinter(owner, {from: owner});
        for (let investor of investors.values()) {
            let amount = choose([0, 2, 4, 6, 8]);
            if (amount > 0) {
                await token.mint(investor, amount * 1e18, {from: owner});
            }
            console.log(`- ${investor} got ${amount} ${await token.symbol()}`);
        }
        await token.finishMinting({from: owner});
    }
};

const saveAddresses = () => {
    let path = `${__dirname}/addresses.json`;
    console.log("save", path);
    let addresses = {
        accounts: {owner, investors},
        contracts: {
            Whitelist: [whitelist.address],
            StokrToken: tokens.map(token => token.address),
            StokrCrowdsale: sales.map(sale => sale.address)
        }
    };
    fs.writeFileSync(path, JSON.stringify(addresses, null, 4));
};

const run = async () => {
    await setAccounts(5);  // 5 investors
    await deployWhitelist();
    await deployTokens(3);  // 3 tokens
    if (true) {
        await deploySales();
        await allSalesOpened();
        await purchaseTokens();
        await allSalesClosed();
        await finalizeSales();
    }
    else {  // in case you're in a hurry
        sales = [];
        await distributeTokens();
    }
    saveAddresses();
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

