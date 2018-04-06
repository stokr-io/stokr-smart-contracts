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
                             wallet,
                             anyone]) => {

    // Helper function to deploy a Whitelist, a SicosToken, and a SicosCrowdsale.
    const deployWhitelistAndTokenAndCrowdsale = async (startTime, endTime) => {
        const rate = 42;  // 42 tokens per wei
        const cap = currency.ether(10);  // total investments are limited to 10 ether
        let whitelist = await Whitelist.new({from: owner});
        await whitelist.addAdmin(owner, {from: owner});
        await whitelist.addToWhitelist([investor1, investor2], {from: owner});
        let token = await SicosToken.new(whitelist.address, 0xDEADBEEF, 0xCAFEBABE, {from:owner});
        let crowdsale = await SicosCrowdsale.new(token.address, startTime, endTime, rate, cap, wallet,
                                                 {from: owner});
        await token.setMinter(crowdsale.address, {from: owner});
        return [whitelist, token, crowdsale];
    };

    describe("deployment", () => {
        const startTime = now() + duration.days(1);
        const endTime = startTime + duration.days(1);
        const rate = 2525;
        const cap = 252525;
        let token, crowdsale;

        before("requires deployed SicosToken and Whitelist instances", async () => {
            let whitelist = await Whitelist.new({from: owner});
            token = await SicosToken.new(whitelist.address, 0xDEADBEEF, 0xCAFEBABE);
        });

        it("should fail if token address is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(0x0, startTime, endTime, rate, cap, wallet,
                                                  {from: owner}));
        });

        it("should fail if startTime is in the past", async () => {
            let _startTime = now() - duration.mins(1);
            await rejectDeploy(SicosCrowdsale.new(token.address, _startTime, endTime, rate, cap, wallet,
                                                  {from: owner}));
        });

        it("should fail if endTime is before startTime", async () => {
            let _endTime = startTime - duration.secs(1);
            await rejectDeploy(SicosCrowdsale.new(token.address, startTime, _endTime, rate, cap, wallet,
                                                  {from: owner}));
        });

        it("should fail if rate is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(token.address, startTime, endTime, 0, cap, wallet,
                                                  {from: owner}));
        });

        it("should fail if cap is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(token.address, startTime, endTime, rate, 0, wallet,
                                                  {from: owner}));
        });

        it("should fail if wallet address is zero", async () => {
            await rejectDeploy(SicosCrowdsale.new(token.address, startTime, endTime, rate, cap, 0x0,
                                                  {from: owner}));
        });

        it("should succeed", async () => {
            crowdsale = await SicosCrowdsale.new(token.address, startTime, endTime, rate, cap, wallet,
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

        it("sets correct startTime", async () => {
            let openingTime = await crowdsale.openingTime();
            openingTime.should.be.bignumber.equal(startTime);
        });

        it("sets correct endTime", async () => {
            let closingTime = await crowdsale.closingTime();
            closingTime.should.be.bignumber.equal(endTime);
        });

        it("sets correct rate", async () => {
            let _rate = await crowdsale.rate();
            _rate.should.be.bignumber.equal(rate);
        });

        it("sets correct cap", async () => {
            let _cap = await crowdsale.cap();
            _cap.should.be.bignumber.equal(cap);
        });

        it("sets correct wallet address", async () => {
            let _wallet = await crowdsale.wallet();
            _wallet.should.be.bignumber.equal(wallet);
        });

    });

    describe("rate change", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const startTime = now() + duration.days(1);
            const endTime = startTime + duration.days(1);
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(startTime, endTime);
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

    describe("while crowdsale", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const startTime = now() + duration.secs(1);
            const endTime = startTime + duration.days(1);
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(startTime, endTime);
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

        it("token purchase increases wallet wei balance", async () => {
            let weiRaisedBefore = await crowdsale.weiRaised();
            let weiBalanceBefore = await web3.eth.getBalance(wallet);
            let value = currency.ether(2);
            await crowdsale.buyTokens(investor1, {from: investor1, value: value});
            let weiRaisedAfter = await crowdsale.weiRaised();
            let weiBalanceAfter = await web3.eth.getBalance(wallet);
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

    describe("after crowdsale", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const startTime = now() + duration.secs(1);
            const endTime = startTime;
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(startTime, endTime);
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
        })

        it("finalization by anyone is forbidden", async () => {
            await rejectTx(crowdsale.finalize({from: anyone}));
            let isFinalized = await crowdsale.isFinalized();
            isFinalized.should.be.false;
        });

        it("finalization is possible and finishes token minting", async () => {
            let tx = await crowdsale.finalize({from: owner});
            let entry = tx.logs.find(entry => entry.event === "Finalized");
            should.exist(entry);
            let isFinalized = await crowdsale.isFinalized();
            let mintingFinished = await token.mintingFinished()
            isFinalized.should.be.true;
            mintingFinished.should.be.true;
        });

        it("finalization again is forbidden", async () => {
            await rejectTx(crowdsale.finalize({from: owner}));
        });

    });

});

