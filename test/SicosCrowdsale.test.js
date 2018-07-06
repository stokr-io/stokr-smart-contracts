"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const SicosToken = artifacts.require("./SicosToken.sol");
const SicosCrowdsale = artifacts.require("./SicosCrowdsale.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {reject, time, money} = require("./helpers/common");


contract("SicosCrowdsale", ([owner,
                             investor1,
                             investor2,
                             teamAccount,
                             wallet,
                             anyone]) => {

    // Helper function to deploy a Whitelist, a SicosToken, and a SicosCrowdsale.
    const deployWhitelistAndTokenAndCrowdsale = async (openingTime, closingTime) => {
        const goal = money.ether(8);
        const rate = 42;  // 42 tokens per wei
        const cap = money.ether(10);  // total investments are limited to 10 ether
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
        const openingTime = time.now() + time.days(1);
        const closingTime = openingTime + time.days(1);
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
            await reject.deploy(SicosCrowdsale.new(0x0, openingTime, closingTime,
                                                   goal, rate, cap, teamShare, wallet,
                                                   {from: owner}));
        });

        it("should fail if openingTime is in the past", async () => {
            let _openingTime = time.now() - time.mins(1);
            await reject.deploy(SicosCrowdsale.new(token.address, _openingTime, closingTime,
                                                   goal, rate, cap, teamShare, wallet,
                                                   {from: owner}));
        });

        it("should fail if closingTime is before openingTime", async () => {
            let _closingTime = openingTime - time.secs(1);
            await reject.deploy(SicosCrowdsale.new(token.address, openingTime, _closingTime,
                                                   goal, rate, cap, teamShare, wallet,
                                                   {from: owner}));
        });

        it("should fail if goal is zero", async () => {
            await reject.deploy(SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                   0, rate, cap, teamShare, wallet,
                                                   {from: owner}));
        });

        it("should fail if rate is zero", async () => {
            await reject.deploy(SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                   goal, 0, cap, teamShare, wallet,
                                                   {from: owner}));
        });

        it("should fail if cap is zero", async () => {
            await reject.deploy(SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                   goal, rate, 0, teamShare, wallet,
                                                   {from: owner}));
        });

        it("should fail if wallet address is zero", async () => {
            await reject.deploy(SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                   goal, rate, cap, teamShare, 0x0,
                                                   {from: owner}));
        });

        it("should succeed", async () => {
            crowdsale = await SicosCrowdsale.new(token.address, openingTime, closingTime,
                                                 goal, rate, cap, teamShare, wallet,
                                                 {from: owner});
            expect(await web3.eth.getCode(crowdsale.address)).to.be.not.oneOf(["0x", "0x0"]);
        });

        it("sets correct owner", async () => {
            expect(await crowdsale.owner()).to.be.bignumber.equal(owner);
        });

        it("sets correct token address", async () => {
            expect(await crowdsale.token()).to.be.bignumber.equal(token.address);
        });

        it("sets correct openingTime", async () => {
            expect(await crowdsale.openingTime()).to.be.bignumber.equal(openingTime);
        });

        it("sets correct closingTime", async () => {
            expect(await crowdsale.closingTime()).to.be.bignumber.equal(closingTime);
        });

        it("sets correct goal", async () => {
            expect(await crowdsale.goal()).to.be.bignumber.equal(goal);
        });

        it("sets correct rate", async () => {
            expect(await crowdsale.rate()).to.be.bignumber.equal(rate);
        });

        it("sets correct cap", async () => {
            expect(await crowdsale.cap()).to.be.bignumber.equal(cap);
        });

        it("sets correct team share", async () => {
            expect(await crowdsale.teamShare()).to.be.bignumber.equal(teamShare);
        });

        it("sets correct wallet address", async () => {
            expect(await crowdsale.wallet()).to.be.bignumber.equal(wallet);
        });

    });

    describe("rate change", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const openingTime = time.now() + time.days(1);
            const closingTime = openingTime + time.days(1);
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(openingTime, closingTime);
        });

        it("by anyone is forbidden", async () => {
            let rate = await crowdsale.rate();
            await reject.tx(crowdsale.setRate(rate.times(2), {from: anyone}));
            expect(await crowdsale.rate()).to.be.bignumber.equal(rate);
        });

        it("to zero is forbidden", async () => {
            let rate = await crowdsale.rate();
            await reject.tx(crowdsale.setRate(0, {from: owner}));
            expect(await crowdsale.rate()).to.be.bignumber.equal(rate);
        });

        it("is possible", async () => {
            let rate = await crowdsale.rate();
            let newRate = rate.times(2);
            let tx = await crowdsale.setRate(newRate, {from: owner});
            let entry = tx.logs.find(entry => entry.event == "RateChanged");
            expect(entry).to.exist;
            expect(entry.args.oldRate).to.be.bignumber.equal(rate);
            expect(entry.args.newRate).to.be.bignumber.equal(newRate);
            expect(await crowdsale.rate()).to.be.bignumber.equal(newRate);
        });

    });

    describe("team account change", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const openingTime = time.now() + time.days(1);
            const closingTime = openingTime + time.days(1);
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(openingTime, closingTime);
        });

        it("by anyone is forbidden", async () => {
            let teamAccount = await crowdsale.teamAccount();
            await reject.tx(crowdsale.setTeamAccount(anyone, {from: anyone}));
            expect(await crowdsale.teamAccount()).to.be.bignumber.equal(teamAccount);
        });

        it("to zero is forbidden", async () => {
            let teamAccount = await crowdsale.teamAccount();
            await reject.tx(crowdsale.setTeamAccount(0x0, {from: owner}));
            expect(await crowdsale.teamAccount()).to.be.bignumber.equal(teamAccount);
        });

        it("is possible", async () => {
            let teamAccount = await crowdsale.teamAccount();
            await crowdsale.setTeamAccount(anyone, {from: owner});
            expect(await crowdsale.teamAccount()).to.be.bignumber.equal(anyone);
        });

    });

    describe("while crowdsale is open", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const openingTime = time.now() + time.secs(1);
            const closingTime = openingTime + time.days(1);
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(openingTime, closingTime);
            await time.sleep(time.secs(2));
            let rate = await crowdsale.rate();
            await crowdsale.setRate(rate, {from: owner});  // Trigger a neutral transaction
        });

        it("token purchase is forbidden for non-whitelisted", async () => {
            let totalSupply = await token.totalSupply();
            await reject.tx(crowdsale.buyTokens(anyone, {from: anyone, value: money.wei(1)}));
            expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
        });

        it("token purchase for the benefit of someone else is forbidden", async () => {
            let totalSupply = await token.totalSupply();
            await reject.tx(crowdsale.buyTokens(investor2, {from: investor1, value: money.wei(1)}));
            expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
        });

        it("token purchase is possible", async () => {
            let rate = await crowdsale.rate();
            let totalSupply = await token.totalSupply();
            let balance = await token.balanceOf(investor1);
            let value = money.ether(4);
            let tx = await crowdsale.buyTokens(investor1, {from: investor1, value: value});
            let entry = tx.logs.find(entry => entry.event === "TokenPurchase");
            expect(entry).to.exist;
            expect(entry.args.purchaser).to.be.bignumber.equal(investor1);
            expect(entry.args.beneficiary).to.be.bignumber.equal(investor1);
            expect(entry.args.value).to.be.bignumber.equal(value);
            expect(entry.args.amount).to.be.bignumber.equal(value.times(rate));
            expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(value.times(rate)));
            expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance.plus(value.times(rate)));
        });

        it("token purchase increases vault wei balance", async () => {
            let vault = await crowdsale.vault();
            let weiRaised = await crowdsale.weiRaised();
            let weiBalance = await web3.eth.getBalance(vault);
            let value = money.ether(2);
            await crowdsale.buyTokens(investor1, {from: investor1, value: value});
            expect(await crowdsale.weiRaised()).to.be.bignumber.equal(weiRaised.plus(value));
            expect(await web3.eth.getBalance(vault)).to.be.bignumber.equal(weiBalance.plus(value));
        });

        it("token purchase exceeding cap is forbidden", async () => {
            let cap = await crowdsale.cap();
            let weiRaised = await crowdsale.weiRaised();
            let value = cap.minus(weiRaised).plus(money.wei(1));
            await reject.tx(crowdsale.buyTokens(investor1, {from: investor1, value: value}));
            expect(await crowdsale.weiRaised()).to.be.bignumber.equal(weiRaised);
        });

        it("finalization is forbidden", async () => {
            await reject.tx(crowdsale.finalize({from: owner}));
            expect(await crowdsale.isFinalized()).to.be.false;
        });

    });

    describe("after crowdsale was closed", () => {
        let whitelist, token, crowdsale;

        before("deployment", async () => {
            const openingTime = time.now() + time.secs(1);
            const closingTime = openingTime;
            [whitelist, token, crowdsale] = await deployWhitelistAndTokenAndCrowdsale(openingTime, closingTime);
            await time.sleep(time.secs(2));
            let rate = await crowdsale.rate();
            await crowdsale.setRate(rate, {from: owner});  // Trigger a neutral transaction
        });

        it("it is closed but not finalized and token minting hasn't finished", async () => {
            expect(await crowdsale.hasClosed()).to.be.true;
            expect(await crowdsale.isFinalized()).to.be.false;
            expect(await token.mintingFinished()).to.be.false;
        });

        it("token purchases are forbidden", async () => {
            let balance = await token.balanceOf(investor1);
            await reject.tx(crowdsale.buyTokens(investor1, {from: investor1, value: money.wei(1)}));
            expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
        });

        it("finalization is forbidden if no team account was set", async () => {
            await reject.tx(crowdsale.finalize({from: owner}));
            expect(await crowdsale.isFinalized()).to.be.false;
        });

        it("finalization by anyone is forbidden", async () => {
            await crowdsale.setTeamAccount(teamAccount, {from: owner});
            await reject.tx(crowdsale.finalize({from: anyone}));
            expect(await crowdsale.isFinalized()).to.be.false;
        });

        it("finalization is forbidden if team account wasn't whitelisted", async () => {
            await reject.tx(crowdsale.finalize({from: owner}));
            expect(await crowdsale.isFinalized()).to.be.false;
        });

        it("finalization is possible", async () => {
            await whitelist.addToWhitelist([teamAccount], {from: owner});
            let tx = await crowdsale.finalize({from: owner});
            let entry = tx.logs.find(entry => entry.event === "Finalized");
            expect(entry).to.exist;
            expect(await crowdsale.isFinalized()).to.be.true;
        });

        it("finalization mints team share", async () => {
            expect(await token.balanceOf(teamAccount)).to.be.bignumber.equal(await crowdsale.teamShare());
        });

        it("finalization finshes token minting", async () => {
            expect(await token.mintingFinished()).to.be.true;
        });

        it("finalization again is forbidden", async () => {
            await reject.tx(crowdsale.finalize({from: owner}));
        });

    });

});

