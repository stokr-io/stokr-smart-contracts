"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const Token = artifacts.require("./SampleToken.sol");
const Sale = artifacts.require("./StokrCrowdsale.sol");

const BN = web3.BigNumber;
const choose = list => list[Math.trunc(list.length * Math.random())];
const sleep = secs => new Promise(resolve => setTimeout(resolve, 1000 * secs));


const deployWhitelist = async (owner, investors) => {
    let whitelist = await Whitelist.new({from: owner});
    await whitelist.addAdmin(owner, {from: owner});
    await whitelist.addToWhitelist([owner], {from: owner});
    await whitelist.addToWhitelist(investors, {from: owner});
    console.log(`deployed whitelist at ${whitelist.address}`);
    return whitelist;
};

const deployTokens = async (owner, whitelist, number) => {
    let tokens = [];
    for (let t = 0; t < number; ++t) {
        let token = await Token.new(`Sample Token ${t}`,
                                    `SAM${t}`,
                                    whitelist.address,
                                    owner,
                                    owner,
                                    {from: owner});
        tokens.push(token);
        console.log(`deployed token ${await token.symbol()}`
                    + ` at ${token.address}`);
    }
    return tokens;
};

const deploySales = async (owner, tokens) => {
    let sales = [];
    for (let t = 0; t < tokens.length; ++t) {
        let token = tokens[t];
        let now = Date.now() / 1000 | 0;
        let sale = await Sale.new(token.address,
                                  new BN("100e18"),
                                  new BN("3e18"),
                                  now + 2,
                                  now + 10,
                                  2,
                                  0,
                                  owner,
                                  {from: owner});
        await token.setMinter(sale.address, {from: owner});
        await sale.setTeamAccount(owner, {from: owner});
        sales.push(sale);
        console.log(`deployed sale for ${await token.symbol()} at ${sale.address}`);
    }
    return sales;
};

const purchaseTokens = async (investors, sales) => {
    for (let s = 0; s < sales.length; ++s) {
        let sale = sales[s];
        let token = await Token.at(await sale.token());
        for (let i = 0; i < investors.length; ++i) {
            let investor = investors[i];
            let ethValue = choose([0, 1, 2, 3, 4]);
            if (ethValue > 0) {
                await sale.buyTokens(investor, {from: investor, value: ethValue * 1e18});
            }
            console.log(`investor ${i} at ${investor}`
                        + ` bought ${await token.symbol()}`
                        + ` for ${ethValue} ether`);
        }
    }
};

const finalizeSales = async (owner, sales) => {
    for (let s = 0; s < sales.length; ++s) {
        let sale = sales[s];
        let token = await Token.at(await sale.token());
        await sale.finalize({from: owner});
        console.log(`finalized sale for ${await token.symbol()}`);
    }
};

const run = async () => {
    let accounts = await web3.eth.accounts;
    let owner = accounts[0];
    let investors = accounts.slice(1, 6);

    let whitelist = await deployWhitelist(owner, investors);
    let tokens = await deployTokens(owner, whitelist, 3);
    let sales = await deploySales(owner, tokens);

    console.log("wait 5 secs...");
    await sleep(5);
    await purchaseTokens(investors, sales);

    console.log("wait 5 secs...");
    await sleep(5);
    await finalizeSales(owner, sales);
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

