"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const Token = artifacts.require("./SampleToken.sol");
const Sale = artifacts.require("./StokrCrowdsale.sol");

const BN = web3.BigNumber;
const choose = list => list[Math.trunc(list.length * Math.random())];
const sleep = secs => new Promise(resolve => setTimeout(resolve, 1000 * secs));


let whitelist;
let tokens;
let sales;

let owner;
let investors;


const setAccounts = async () => {
    console.log("accounts");
    let accounts = await web3.eth.accounts;
    owner = accounts.shift();
    console.log(`- owner at ${owner}`);
    investors = accounts.slice(0, 5);  // 5 investors
    for (let i = 0; i < investors.length; ++i) {
        let investor = investors[i];
        console.log(`- investor #${i} at ${investor}`);
    }
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
    for (let t = 0; t < number; ++t) {
        let token = await Token.new(`Sample Token ${t}`,
                                    `TOK${t}`,
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
    for (let t = 0; t < tokens.length; ++t) {
        let token = tokens[t];
        let now = Date.now() / 1000 | 0;
        let sale = await Sale.new(token.address,  // token address
                                  new BN("100e18"),  // token cap
                                  new BN("3e18"),  // token goal
                                  now + 2,  // opening time
                                  now + 10,  // closing time
                                  2,  // token per ether rate
                                  0,  // team token share
                                  owner,  // wallet
                                  {from: owner});
        await token.setMinter(sale.address, {from: owner});
        await sale.setTeamAccount(owner, {from: owner});
        sales.push(sale);
        console.log(`- sale for ${await token.symbol()} at ${sale.address}`);
    }
};

const purchaseTokens = async () => {
    console.log("purchase tokens");
    for (let s = 0; s < sales.length; ++s) {
        let sale = sales[s];
        let token = await Token.at(await sale.token());
        for (let i = 0; i < investors.length; ++i) {
            let investor = investors[i];
            let ethValue = choose([0, 1, 2, 3, 4]);
            if (ethValue > 0) {
                await sale.buyTokens(investor, {from: investor, value: ethValue * 1e18});
            }
            console.log(`- ${investor} bought ${await token.symbol()} for ${ethValue} ether`);
        }
    }
};

const finalizeSales = async () => {
    console.log("finalize sales");
    for (let s = 0; s < sales.length; ++s) {
        let sale = sales[s];
        let token = await Token.at(await sale.token());
        await sale.finalize({from: owner});
        console.log(`- sale for ${await token.symbol()}`);
    }
};

const distributeTokens = async () => {
    console.log("distribute tokens");
    for (let t = 0; t < tokens.length; ++t) {
        let token = tokens[t];
        await token.setMinter(owner, {from: owner});
        for (let i = 0; i < investors.length; ++i) {
            let investor = investors[i];
            let amount = choose([0, 2, 4, 6, 8]);
            if (amount > 0) {
                await token.mint(investor, amount * 1e18, {from: owner});
            }
            console.log(`- ${investor} got ${amount} ${await token.symbol()}`);
        }
        await token.finishMinting({from: owner});
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
    await setAccounts();
    await deployWhitelist();
    await deployTokens(3);  // 3 tokens

    if (false) {
        await deploySales();

        console.log("wait 5 secs...");
        await sleep(5);  // until sale opened
        await purchaseTokens();

        console.log("wait 5 secs...");
        await sleep(5);  // until sale closed
        await finalizeSales();
    }
    else {
        await distributeTokens();
    }

    console.log("action");
    while (true) {
        await sleep(4);
        await doSomething();
    }
}

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

