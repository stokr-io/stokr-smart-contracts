"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const SicosToken = artifacts.require("./SicosToken.sol");
const SicosCrowdsale = artifacts.require("./SicosCrowdsale.sol");

const { expect } = require("chai");
const { should } = require("./helpers/utils");
const { rejectDeploy, rejectTx, now, sleep, duration, currency } = require("./helpers/tecneos");


contract("SicosCrowdsale", ([owner,
                             investor1,
                             investor2,
                             teamAccount,
                             wallet,
                             anyone]) => {

    // Helper function to deploy a Whitelist, a SicosToken, and a SicosCrowdsale.
    const deployWhitelistAndTokenAndCrowdsale = async (openingTime, closingTime) => {
        const goal = currency.ether(8);
        const rate = 42;  // 42 tokens per wei
        const cap = currency.ether(10);  // total investments are limited to 10 ether
        const teamShare = 2525;
        let whitelist = await Whitelist.new({from: owner});
        await whitelist.addAdmin(owner, {from: owner});
        await whitelist.addToWhitelist([investor1, investor2], {from: owner});
        let token = await SicosToken.new(whitelist.address, 0xDEADBEEF, 0xCAFEBABE, {from:owner});
        let crowdsale = await SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                 goal, rate, cap, teamShare, wallet,
                                                 {from: owner});
        await token.setMinter(crowdsale.address, {from: owner});
        return [whitelist, token, crowdsale];
    };

    describe("deployment", () => {
        const openingTime = now() + duration.days(1);
        const closingTime = openingTime + duration.days(1);
        const goal = 252525;
        const rate = 2525;
        const cap = 123456;
        const teamShare = 42;
        let token, crowdsale;

        before("requires deployed SicosToken and Whitelist instances", async () => {
            let whitelist = await Whitelist.new({from: owner});
            token = await SicosToken.new(whitelist.address, 0xDEADBEEF, 0xCAFEBABE);
        });

        it("should fail if token address is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(0x0, openingTime, closingTime,
                                                  goal, rate, cap, teamShare, wallet,
                                                  {from: owner}));
        });

        it("should fail if openingTime is in the past", async () => {
            let _openingTime = now() - duration.mins(1);
            await rejectDeploy(SicosCrowdsale.new(token.address, _openingTime, closingTime,
                                                  goal, rate, cap, teamShare, wallet,
                                                  {from: owner}));
        });

        it("should fail if closingTime is before openingTime", async () => {
            let _closingTime = openingTime - duration.secs(1);
            await rejectDeploy(SicosCrowdsale.new(token.address, openingTime, _closingTime,
                                                  goal, rate, cap, teamShare, wallet,
                                                  {from: owner}));
        });

        it("should fail if goal is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                  0, rate, cap, teamShare, wallet,
                                                  {from: owner}));
        });

        it("should fail if rate is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                  goal, 0, cap, teamShare, wallet,
                                                  {from: owner}));
        });

        it("should fail if cap is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                  goal, rate, 0, teamShare, wallet,
                                                  {from: owner}));
        });

        it("should fail if wallet address is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                  goal, rate, cap, teamShare, 0x0,
                                                  {from: owner}));
        });

        it("should succeed", async () => {
            crowdsale = await SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                 goal, rate, cap, teamShare, wallet,
                                                 {from: owner});
            let code = await web3.eth.getCode(crowdsale.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("sets correct owner", async () => {
            let _owner = await crowdsale.owner();
            _owner.should.be.bignumber.equal(owner);
        });

        it("sets correct token address", async () => {
            let tokenAddress = await crowdsale.token();
            tokenAddress.should.be.bignumber.equal(token.address);
        });

        it("sets correct openingTime", async () => {
            let openingTime = await crowdsale.openingTime();
            openingTime.should.be.bignumber.equal(openingTime);
        });

        it("sets correct closingTime", async () => {
            let closingTime = await crowdsale.closingTime();
            closingTime.should.be.bignumber.equal(closingTime);
        });

        it("sets correct goal", async () => {
            let _goal = await crowdsale.goal();
            _goal.should.be.bignumber.equal(goal);
        });

        it("sets correct rate", async () => {
            let _rate = await crowdsale.rate();
            _rate.should.be.bignumber.equal(rate);
        });

        it("sets correct cap", async () => {
            let _cap = await crowdsale.cap();
            _cap.should.be.bignumber.equal(cap);
        });

        it("sets correct team share", async () => {
            let _teamShare = await crowdsale.teamShare();
            _teamShare.should.be.bignumber.equal(teamShare);
        });

        it("sets correct wallet address", async () => {
            let _wallet = await crowdsale.wallet();
            _wallet.should.be.bignumber.equal(wallet);
        });

    });

    describe("rate change", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const openingTime = now() + duration.days(1);
            const closingTime = openingTime + duration.days(1);
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(openingTime, closingTime);
        });

        it("by anyone is forbidden", async () => {
            let rateBefore = await crowdsale.rate();
            await rejectTx(crowdsale.setRate(rateBefore.times(2), {from: anyone}));
            let rateAfter = await crowdsale.rate();
            rateAfter.should.be.bignumber.equal(rateBefore);
        });

        it("to zero is forbidden", async () => {
            let rateBefore = await crowdsale.rate();
            await rejectTx(crowdsale.setRate(0, {from: owner}));
            let rateAfter = await crowdsale.rate();
            rateAfter.should.be.bignumber.equal(rateBefore);
        });

        it("is possible", async () => {
            let rateBefore = await crowdsale.rate();
            let newRate = rateBefore.times(2);
            let tx = await crowdsale.setRate(newRate, {from: owner});
            let entry = tx.logs.find(entry => entry.event == "RateChanged");
            should.exist(entry);
            entry.args.oldRate.should.be.bignumber.equal(rateBefore);
            entry.args.newRate.should.be.bignumber.equal(newRate);
            let rateAfter = await crowdsale.rate();
            rateAfter.should.be.bignumber.equal(newRate);
        });

    });

    describe("team account change", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const openingTime = now() + duration.days(1);
            const closingTime = openingTime + duration.days(1);
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(openingTime, closingTime);
        });

        it("by anyone is forbidden", async () => {
            let teamAccountBefore = await crowdsale.teamAccount();
            await rejectTx(crowdsale.setTeamAccount(anyone, {from: anyone}));
            let teamAccountAfter = await crowdsale.teamAccount();
            teamAccountAfter.should.be.bignumber.equal(teamAccountBefore);
        });

        it("to zero is forbidden", async () => {
            let teamAccountBefore = await crowdsale.teamAccount();
            await rejectTx(crowdsale.setTeamAccount(0x0, {from: owner}));
            let teamAccountAfter = await crowdsale.teamAccount();
            teamAccountAfter.should.be.bignumber.equal(teamAccountBefore);
        });

        it("is possible", async () => {
            let teamAccountBefore = await crowdsale.teamAccount();
            await crowdsale.setTeamAccount(anyone, {from: owner});
            let teamAccountAfter = await crowdsale.teamAccount();
            teamAccountAfter.should.be.bignumber.equal(anyone);
        });

    });

    describe("while crowdsale is open", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const openingTime = now() + duration.secs(1);
            const closingTime = openingTime + duration.days(1);
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(openingTime, closingTime);
            await sleep(duration.secs(2));
            let rate = await crowdsale.rate();
            await crowdsale.setRate(rate, {from: owner});  // Trigger a neutral transaction
        });

        it("token purchase is forbidden for non-whitelisted", async () => {
            let totalSupplyBefore = await token.totalSupply();
            await rejectTx(crowdsale.buyTokens(anyone, {from: anyone, value: currency.wei(1)}));
            let totalSupplyAfter = await token.totalSupply();
            totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore);
        });

        it("token purchase for the benefit of someone else is forbidden", async () => {
            let totalSupplyBefore = await token.totalSupply();
            await rejectTx(crowdsale.buyTokens(investor2, {from: investor1, value: currency.wei(1)}));
            let totalSupplyAfter = await token.totalSupply();
            totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore);
        });

        it("token purchase is possible", async () => {
            let rate = await crowdsale.rate();
            let totalSupplyBefore = await token.totalSupply();
            let balanceBefore = await token.balanceOf(investor1);
            let value = currency.ether(4);
            let tx = await crowdsale.buyTokens(investor1, {from: investor1, value: value});
            let entry = tx.logs.find(entry => entry.event === "TokenPurchase");
            should.exist(entry);
            entry.args.purchaser.should.be.bignumber.equal(investor1);
            entry.args.beneficiary.should.be.bignumber.equal(investor1);
            entry.args.value.should.be.bignumber.equal(value);
            entry.args.amount.should.be.bignumber.equal(value.times(rate));
            let totalSupplyAfter = await token.totalSupply();
            let balanceAfter = await token.balanceOf(investor1);
            totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.plus(value.times(rate)));
            balanceAfter.should.be.bignumber.equal(balanceBefore.plus(value.times(rate)));
        });

        it("token purchase increases vault wei balance", async () => {
            let vault = await crowdsale.vault();
            let weiRaisedBefore = await crowdsale.weiRaised();
            let weiBalanceBefore = await web3.eth.getBalance(vault);
            let value = currency.ether(2);
            await crowdsale.buyTokens(investor1, {from: investor1, value: value});
            let weiRaisedAfter = await crowdsale.weiRaised();
            let weiBalanceAfter = await web3.eth.getBalance(vault);
            weiRaisedAfter.should.be.bignumber.equal(weiRaisedBefore.plus(value));
            weiBalanceAfter.should.be.bignumber.equal(weiBalanceBefore.plus(value));
        });

        it("token purchase exceeding cap is forbidden", async () => {
            let cap = await crowdsale.cap();
            let weiRaisedBefore = await crowdsale.weiRaised();
            let value = cap.minus(weiRaisedBefore).plus(currency.wei(1));
            await rejectTx(crowdsale.buyTokens(investor1, {from: investor1, value: value}));
            let weiRaisedAfter = await crowdsale.weiRaised();
            weiRaisedAfter.should.be.bignumber.equal(weiRaisedBefore);
        });

        it("finalization is forbidden", async () => {
            await rejectTx(crowdsale.finalize({from: owner}));
            let isFinalized = await crowdsale.isFinalized();
            isFinalized.should.be.false;
        });

    });

    describe("after crowdsale was closed", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const openingTime = now() + duration.secs(1);
            const closingTime = openingTime;
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(openingTime, closingTime);
            await sleep(duration.secs(2));
            let rate = await crowdsale.rate();
            await crowdsale.setRate(rate, {from: owner});  // Trigger a neutral transaction
        });

        it("it is closed but not finalized and token minting hasn't finished", async () => {
            let hasClosed = await crowdsale.hasClosed();
            let isFinalized = await crowdsale.isFinalized();
            let mintingFinished = await token.mintingFinished();
            hasClosed.should.be.true;
            isFinalized.should.be.false;
            mintingFinished.should.be.false;
        });

        it("token purchases are forbidden", async () => {
            let balanceBefore = await token.balanceOf(investor1);
            await rejectTx(crowdsale.buyTokens(investor1, {from: investor1, value: currency.wei(1)}));
            let balanceAfter = await token.balanceOf(investor1);
            balanceAfter.should.be.bignumber.equal(balanceBefore);
        });

        it("finalization is forbidden if no team account was set", async () => {
            await rejectTx(crowdsale.finalize({from: owner}));
            let isFinalized = await crowdsale.isFinalized();
            isFinalized.should.be.false;
        });

        it("finalization by anyone is forbidden", async () => {
            await crowdsale.setTeamAccount(teamAccount, {from: owner});
            await rejectTx(crowdsale.finalize({from: anyone}));
            let isFinalized = await crowdsale.isFinalized();
            isFinalized.should.be.false;
        });

        it("finalization is forbidden if team account wasn't whitelisted", async () => {
            await rejectTx(crowdsale.finalize({from: owner}));
            let isFinalized = await crowdsale.isFinalized();
            isFinalized.should.be.false;
        });

        it("finalization is possible", async () => {
            await whitelist.addToWhitelist([teamAccount], {from: owner});
            let tx = await crowdsale.finalize({from: owner});
            let entry = tx.logs.find(entry => entry.event === "Finalized");
            should.exist(entry);
            let isFinalized = await crowdsale.isFinalized();
            isFinalized.should.be.true;
        });

        it("finalization mints team share", async () => {
            let teamShare = await crowdsale.teamShare();
            let teamBalance = await token.balanceOf(teamAccount);
            teamBalance.should.be.bignumber.equal(teamShare);
        });

        it("finalization finshes token minting", async () => {
            let mintingFinished = await token.mintingFinished();
            mintingFinished.should.be.true;
        });

        it("finalization again is forbidden", async () => {
            await rejectTx(crowdsale.finalize({from: owner}));
        });

    });

});

