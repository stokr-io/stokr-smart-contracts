"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const SicosToken = artifacts.require("./SicosToken.sol");

const { should, ensuresException } = require("./helpers/utils");
const expect = require("chai").expect;
const { latestTime, duration, increaseTimeTo } = require("./helpers/timer");
const BigNumber = web3.BigNumber;

const { rejectDeploy, rejectTx, getBalance, logGas, currency } = require("./helpers/tecneos.js");
const ADDITIONAL_OUTPUTS = true;


contract("SicosToken", ([owner,
                         minter,
                         keyRecoverer,
                         investor1,
                         investor2,
                         investor3,
                         anyone]) => {
    const ZERO_ADDR = "0x0";

    // Helper function to deploy a Whitelist and a SicosToken.
    const deployWhitelistAndToken = async () => {
        // deploy whitelist contract where owner becomes whitelist admin and adds three investors
        let whitelist = await Whitelist.new({from: owner});
        await whitelist.addAdmin(owner, {from: owner});
        await whitelist.addToWhitelist([investor1, investor2, investor3], {from: owner});
        // deploy token contract with keyRecoverer and minter
        let token = await SicosToken.new(whitelist.address, keyRecoverer, {from: owner});
        await token.setMinter(minter, {from: owner});
        return [whitelist, token];
    }

    // Helper function to read an account.
    const getTokenAccount = async (token, address) => {
        let [balance, lastTotalProfits, profitShare] = await token.accounts(address);
        return {balance, lastTotalProfits, profitShare};
    };

    // Helper method for testing (partial) equality of an account.
    const expectTokenAccountEquality = (account, expected) => {
        if (expected.hasOwnProperty("balance"))
            account.balance.should.be.bignumber.equal(expected.balance);
        if (expected.hasOwnProperty("lastTotalProfits"))
            account.lastTotalProfits.should.be.bignumber.equal(expected.lastTotalProfits);
        if (expected.hasOwnProperty("profitShare"))
            account.profitShare.should.be.bignumber.equal(expected.profitShare);
    };

    // Trivial tests of correct deployment.
    describe("deployment", () => {
        let whitelist;
        let token;

        it("requires a deployed Whitelist instance", async () => {
            whitelist = await Whitelist.new({from: owner});
            let code = await web3.eth.getCode(whitelist.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("should fail if whitelist is zero address", async () => {
            await rejectDeploy(SicosToken.new(ZERO_ADDR, keyRecoverer, {from: owner}));
        });

        it("should fail if keyRecoverer is zero address", async () => {
            await rejectDeploy(SicosToken.new(whitelist.address, ZERO_ADDR, {from: owner}));
        });

        it("should succeed", async () => {
            token = await SicosToken.new(whitelist.address, keyRecoverer, {from: owner});
            let code = await web3.eth.getCode(token.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("sets correct owner", async () => {
            let owner = await token.owner();
            owner.should.be.bignumber.equal(owner);
        });

        it("sets correct whitelist", async () => {
            let whitelistAddr = await token.whitelist();
            whitelistAddr.should.be.bignumber.equal(whitelist.address);
        });

        it("sets correct keyRecoverer", async () => {
            let _keyRecoverer = await token.keyRecoverer();
            _keyRecoverer.should.be.bignumber.equal(keyRecoverer);
        });

        it("sets minter to zero address", async () => {
            let _minter = await token.minter();
            _minter.should.be.bignumber.zero;
        });

        it("sets mintingFinshed to false", async () => {
            let mintingFinished = await token.mintingFinished();
            mintingFinished.should.be.false;
        });

        it("sets totalProfits to zero", async () => {
            let totalProfits = await token.totalProfits();
            totalProfits.should.be.bignumber.zero;
        });

        it("sets totalSupply to zero", async () => {
            let totalSupply = await token.totalSupply();
            totalSupply.should.be.bignumber.zero;
        });

    });

    // Trivial tests of address changing related functions.
    describe("accounts setting", () => {
        const initialWhitelistAddress = 0x1,
              initialKeyRecoverer = 0x2;
        let whitelist;
        let token;

        before("deploy with random addresses", async () => {
            whitelist = await Whitelist.new({from: owner});
            token = await SicosToken.new(initialWhitelistAddress, initialKeyRecoverer, {from: owner});
        });

        it("denies anyone to change whitelist", async () => {
            await rejectTx(token.setWhitelist(whitelist.address, {from: anyone}));
            let whitelistAddress = await token.whitelist();
            whitelistAddress.should.be.bignumber.equal(initialWhitelistAddress);
        });

        it("denies owner to change whitelist to zero", async () => {
            await rejectTx(token.setWhitelist(ZERO_ADDR, {from: owner}));
            let whitelistAddress = await token.whitelist();
            whitelistAddress.should.be.bignumber.equal(initialWhitelistAddress);
        });

        it("allows owner to change whitelist", async () => {
            let tx = await token.setWhitelist(whitelist.address, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "WhitelistChanged");
            should.exist(entry);
            entry.args.whitelist.should.be.bignumber.equal(whitelist.address);
            let whitelistAddress = await token.whitelist();
            whitelistAddress.should.be.bignumber.equal(whitelist.address);
        });

        it("denies anyone to change keyRecoverer", async () => {
            await rejectTx(token.setKeyRecoverer(keyRecoverer, {from: anyone}));
            let _keyRecoverer = await token.keyRecoverer();
            _keyRecoverer.should.be.bignumber.equal(initialKeyRecoverer);
        });

        it("denies owner to change keyRecoverer to zero", async () => {
            await rejectTx(token.setKeyRecoverer(ZERO_ADDR, {from: owner}));
            let _keyRecoverer = await token.keyRecoverer();
            _keyRecoverer.should.be.bignumber.equal(initialKeyRecoverer);
        });

        it("allows owner to change keyRecoverer", async () => {
            let tx = await token.setKeyRecoverer(keyRecoverer, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "KeyRecovererChanged");
            should.exist(entry);
            entry.args.newKeyRecoverer.should.be.bignumber.equal(keyRecoverer);
            let _keyRecoverer = await token.keyRecoverer();
            _keyRecoverer.should.be.bignumber.equal(keyRecoverer);
        });

        it("denies anyone to change minter", async () => {
            await rejectTx(token.setMinter(minter, {from: anyone}));
            let _minter = await token.minter();
            _minter.should.be.bignumber.equal(ZERO_ADDR);
        });

        it("denies owner to change minter to zero", async () => {
            await rejectTx(token.setMinter(ZERO_ADDR, {from: owner}));
            let _minter = await token.minter();
            _minter.should.be.bignumber.equal(ZERO_ADDR);
        });

        it("allows owner to change minter once", async () => {
            await token.setMinter(minter, {from: owner});
            let _minter = await token.minter();
            _minter.should.be.bignumber.equal(minter);
        });

        it("denies owner to change minter twice", async () => {
            await rejectTx(token.setMinter(anyone, {from: owner}));
            let _minter = await token.minter();
            _minter.should.be.bignumber.equal(minter);
        });

    });

    // Trivial tests of minting related functions.
    describe("minting", () => {
        let whitelist;
        let token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
        });

        it("is forbidden to anyone other than minter", async () => {
            await rejectTx(token.mint(investor1, 252525, {from: anyone}));
            let totalSupply = await token.totalSupply();
            totalSupply.should.be.bignumber.zero;
        });

        it("is forbidden if beneficiary wasn't whitelisted before", async () => {
            await rejectTx(token.mint(anyone, 252525, {from: minter}));
            let totalSupply = await token.totalSupply();
            totalSupply.should.be.bignumber.zero;
        });

        it("is possible", async () => {
            const amount = 1000;
            let tx = await token.mint(investor1, amount, {from: minter});
            let entry1 = tx.logs.find(entry => entry.event === "Minted");
            should.exist(entry1);
            entry1.args.to.should.be.bignumber.equal(investor1);
            entry1.args.amount.should.be.bignumber.equal(amount);
            let entry2 = tx.logs.find(entry => entry.event === "Transfer");
            should.exist(entry2);
            entry2.args.value.should.be.bignumber.equal(amount);
            let totalSupply = await token.totalSupply();
            totalSupply.should.be.bignumber.equal(amount);
        });

        it("should correctly increase totalSupply", async () => {
            const amount = 2000;
            let totalSupplyBefore = await token.totalSupply();
            await token.mint(investor1, amount, {from: minter});
            let totalSupplyAfter = await token.totalSupply();
            totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.plus(amount));
        });

        it("should correctly increase beneficiary's balance", async () => {
            const amount = 4000;
            let balanceBefore = await token.balanceOf(investor1);
            await token.mint(investor1, amount, {from: minter});
            let balanceAfter = await token.balanceOf(investor1);
            balanceAfter.should.be.bignumber.equal(balanceBefore.plus(amount));
        });

        it("finishing is forbidden for anyone other than minter", async () => {
            await rejectTx(token.finishMinting({from: anyone}));
            let mintingFinished = await token.mintingFinished();
            mintingFinished.should.be.false;
        });

        it("finishing is possible once", async () => {
            let tx = await token.finishMinting({from: minter});
            let entry = tx.logs.find(entry => entry.event === "MintFinished");
            should.exist(entry);
            let mintingFinished = await token.mintingFinished();
            mintingFinished.should.be.true;
        });

        it("finishing again is impossible", async () => {
            await rejectTx(token.finishMinting({from: minter}));
        });

        it("is forbidden after finish", async () => {
            let totalSupplyBefore = await token.totalSupply();
            await rejectTx(token.mint(investor1, 252525, {from: minter}));
            let totalSupplyAfter = await token.totalSupply();
            totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore);
        });

    });

    // Trivial tests of profit sharing related functions.
    describe("profit sharing", () => {
        const investors = [investor1, investor2, investor3];
        let whitelist;
        let token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            // mint some tokens for the benefit of investors
            await token.mint(investor1, 1000, {from: minter});
            await token.mint(investor2, 3000, {from: minter});
        });

        it("forbids to deposit profit via default function", async () => {
            let weiBalanceBefore = await getBalance(token.address);
            await rejectTx(token.send(currency.ether(1), {from: anyone}));
            let weiBalanceAfter = await getBalance(token.address);
            weiBalanceAfter.should.be.bignumber.equal(weiBalanceBefore);
        });

        it("allows anyone to deposit profit", async () => {
            const weiAmount = currency.ether(2);
            let weiBalanceBefore = await getBalance(token.address);
            let totalProfitsBefore = await token.totalProfits();
            let tx = await token.depositProfit({from: anyone, value: weiAmount});
            let entry = tx.logs.find(entry => entry.event === "ProfitDeposited");
            should.exist(entry);
            entry.args.depositor.should.be.bignumber.equal(anyone);
            entry.args.amount.should.be.bignumber.equal(weiAmount);
            let weiBalanceAfter = await getBalance(token.address);
            let totalProfitsAfter = await token.totalProfits();
            weiBalanceAfter.should.be.bignumber.equal(weiBalanceBefore.plus(weiAmount));
            totalProfitsAfter.should.be.bignumber.equal(totalProfitsBefore.plus(weiAmount));
        });

        it("is correctly calculated as share of investors' token balances", async () => {
            let totalSupply = await token.totalSupply();
            let totalProfits = await token.totalProfits();
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                let account = await getTokenAccount(token, investor);
                let profitShareOwing = await token.profitShareOwing(investor);
                if (ADDITIONAL_OUTPUTS) {
                    console.log(" ".repeat(8) + "investor " + investor + ":");
                    console.log(" ".repeat(8) + "  tokens: "
                                + account.balance.toExponential() + " / "
                                + totalSupply.toExponential())
                    console.log(" ".repeat(8) + "  profit: "
                                + account.profitShare.plus(profitShareOwing).toExponential() + " / "
                                + totalProfits.toExponential());
                }
                // Use equivalence:
                //      (profitShare + profitShareOwing) / totalProfits == balance / totalSupply
                // <=>  (profitShare + profitShareOwing) * totalSupply  == balance * totalProfits
                account.profitShare.plus(profitShareOwing).times(totalSupply)
                       .should.be.bignumber.equal(account.balance.times(totalProfits));
            }
        });

        it("is correctly disbursed to investors", async () => {
            let totalProfits = await token.totalProfits();
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                let accountBefore = await getTokenAccount(token, investor);
                let profitShareOwing = await token.profitShareOwing(investor);
                let tx = await logGas(token.updateProfitShare(investor, {from: anyone}));
                let entry = tx.logs.find(entry => entry.event === "ProfitShareUpdated");
                should.exist(entry);
                entry.args.investor.should.be.bignumber.equal(investor);
                entry.args.amount.should.be.bignumber.equal(profitShareOwing);
                let accountAfter = await getTokenAccount(token, investor);
                if (ADDITIONAL_OUTPUTS) {
                    console.log(" ".repeat(8) + "investor " + investor);
                    console.log(" ".repeat(8) + "  profit before: "
                                + accountBefore.profitShare.toExponential());
                    console.log(" ".repeat(8) + "  profit owing: "
                                + profitShareOwing.toExponential());
                    console.log(" ".repeat(8) + "  profit after: "
                                + accountAfter.profitShare.toExponential());
                }
                accountAfter.lastTotalProfits.should.be.bignumber.equal(totalProfits);
                accountAfter.profitShare.should.be.bignumber.equal(
                    accountBefore.profitShare.plus(profitShareOwing));
            }
        });

        it("is correctly calculated a second time", async () => {
            await token.depositProfit({from: anyone, value: currency.ether(8)});
            let totalSupply = await token.totalSupply();
            let totalProfits = await token.totalProfits();
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                let account = await getTokenAccount(token, investor);
                let profitShareOwing = await token.profitShareOwing(investor);
                if (ADDITIONAL_OUTPUTS) {
                    console.log(" ".repeat(8) + "investor " + investor + ":");
                    console.log(" ".repeat(8) + "  tokens: "
                                + account.balance.toExponential() + " / "
                                + totalSupply.toExponential())
                    console.log(" ".repeat(8) + "  profit: "
                                + account.profitShare.plus(profitShareOwing).toExponential() + " / "
                                + totalProfits.toExponential());
                }
                // Use equivalence:
                //      (profitShare + profitShareOwing) / totalProfits == balance / totalSupply
                // <=>  (profitShare + profitShareOwing) * totalSupply  == balance * totalProfits
                account.profitShare.plus(profitShareOwing).times(totalSupply)
                       .should.be.bignumber.equal(account.balance.times(totalProfits));
            }
        });

    });

    // Trivial tests of key recovery related functions.
    describe("key recovery", () => {
        let whitelist;
        let token;
        let totalSupply;

        before("deploy contracts and add investors", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            // mint some tokens for the benefit of first two investors
            await token.mint(investor1, 1000, {from: minter});
            await token.mint(investor2, 2000, {from: minter});
            totalSupply = 1000 + 2000;
            // deposit profits and disburse them to first two investors
            await token.depositProfit({from: anyone, value: currency.ether(1)});
            await token.updateProfitShare(investor1);
            await token.updateProfitShare(investor2);
        });

        afterEach("invariant: total token supply doesn't change", async () => {
            let _totalSupply = await token.totalSupply();
            _totalSupply.should.be.bignumber.equal(totalSupply);
        });

        it("is forbidden by anyone other than keyRecoverer", async () => {
            let account2Before = await getTokenAccount(token, investor2);
            await rejectTx(token.recoverKey(investor2, investor3, {from: anyone}));
            let account2After = await getTokenAccount(token, investor2);
            expectTokenAccountEquality(account2Before, account2After);
            let account3 = await getTokenAccount(token, investor3);
            expectTokenAccountEquality(account3, {balance: 0, profitShare: 0, lastTotalProfits: 0});
        });

        it("is forbidden if oldAddress wasn't whitelisted before", async () => {
            let accountBefore = await getTokenAccount(token, investor3);
            await rejectTx(token.recoverKey(anyone, investor3, {from: keyRecoverer}));
            let accountAfter = await getTokenAccount(token, investor3);
            expectTokenAccountEquality(accountBefore, accountAfter);
        });

        it("is forbidden if newAddress wasn't whitelisted before", async () => {
            let accountBefore = await getTokenAccount(token, investor1);
            await rejectTx(token.recoverKey(investor1, anyone, {from: keyRecoverer}));
            let accountAfter = await getTokenAccount(token, investor1);
            expectTokenAccountEquality(accountBefore, accountAfter);
        });

        it("is forbidden if newAddress is an already used account", async () => {
            let account1Before = await getTokenAccount(token, investor1);
            let account2Before = await getTokenAccount(token, investor2);
            await rejectTx(token.recoverKey(investor1, investor2, {from: keyRecoverer}));
            let account1After = await getTokenAccount(token, investor1);
            let account2After = await getTokenAccount(token, investor2);
            expectTokenAccountEquality(account1Before, account1After);
            expectTokenAccountEquality(account2Before, account2After);
        });

        it("is possible", async () => {
            let oldAccount = await getTokenAccount(token, investor2);
            let tx = await token.recoverKey(investor2, investor3, {from: keyRecoverer});
            let entry = tx.logs.find(entry => entry.event === "KeyRecovered");
            should.exist(entry);
            entry.args.oldAddress.should.be.equal(investor2);
            entry.args.newAddress.should.be.equal(investor3);
            let delAccount = await getTokenAccount(token, investor2);
            let newAccount = await getTokenAccount(token, investor3);
            expectTokenAccountEquality(delAccount, {balance: 0, profitShare: 0, lastTotalProfits: 0});
            expectTokenAccountEquality(newAccount, oldAccount);
        });

    });

});
