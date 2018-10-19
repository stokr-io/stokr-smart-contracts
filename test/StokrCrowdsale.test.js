"use strict";

const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");
const StokrCrowdsale = artifacts.require("./crowdsale/StokrCrowdsale.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject, snapshot, logGas} = require("./helpers/common");


contract("StokrCrowdsale", ([owner,
                             rateAdmin,
                             companyWallet,
                             reserveAccount,
                             investor1,
                             investor2,
                             anyone]) => {

    // Helper function: default deployment parameters
    const defaultParams = () => ({
        tokenCap: new BN("100e18"),
        tokenGoal: new BN("20e18"),
        tokenPrice: new BN("100"),
        etherRate: new BN("16384"),
        rateAdmin,
        openingTime: time.now() + time.mins(1),
        closingTime: time.now() + time.mins(2),
        companyWallet,
        tokenReserve: new BN("2e18"),
        reserveAccount
    });

    // Helper function: deploy StokrCrowdsale (and Whitelist and StokrToken if necessary)
    const deploySale = async params => {
        let $ = defaultParams();

        if (params !== undefined) {
            for (let name in params) {
                $[name] = params[name];
            }
        }
        if (!("token" in $)) {
            let whitelist = await Whitelist.new({from: owner});
            await whitelist.addAdmin(owner, {from: owner});
            await whitelist.addToWhitelist([investor1, investor2], {from: owner});
            $.token = (await StokrToken.new("Sample Stokr Token",
                                            "STOKR",
                                            whitelist.address,
                                            random.address(),
                                            random.address(),
                                            {from: owner})).address;
        }

        return StokrCrowdsale.new($.token,
                                  $.tokenCap,
                                  $.tokenGoal,
                                  $.tokenPrice,
                                  $.etherRate,
                                  $.rateAdmin,
                                  $.openingTime,
                                  $.closingTime,
                                  $.companyWallet,
                                  $.tokenReserve,
                                  $.reserveAccount,
                                  {from: owner});
    };

    let initialState;

    before("save inital state", async () => {
        initialState = await snapshot.new();
    });

    after("revert inital state", async () => {
        await initialState.revert();
    });

    describe("deployment", () => {

        context("with invalid parameters", () => {

            it("fails if token address is zero", async () => {
                await reject.deploy(deploySale({token: 0x0}));
            });

            it("fails if another sale is already minting the token", async () => {
                let token = await (await deploySale()).token();
                await reject.deploy(deploySale({token: token.address}));
            });

            it("fails if token cap is zero", async () => {
                await reject.deploy(deploySale({tokenCap: 0}));
            });

            it("fails if token goal is not reachable", async () => {
                let {tokenCap, tokenReserve} = defaultParams();
                let tokenGoal = tokenCap.minus(tokenReserve).plus(1);
                await reject.deploy(deploySale({tokenGoal}));
            });

            it("fails if token price is zero", async () => {
                await reject.deploy(deploySale({tokenPrice: 0}));
            });

            it("fails if ether rate is zero", async () => {
                await reject.deploy(deploySale({etherRate: 0}));
            });

            it("fails if rate admin address is zero", async () => {
                await reject.deploy(deploySale({rateAdmin: 0x0}));
            });

            it("fails if opening time is in the past", async () => {
                let openingTime = time.now() - time.mins(1);
                await reject.deploy(deploySale({openingTime}));
            });

            it("fails if closing time is before opening time", async () => {
                let openingTime = defaultParams().openingTime;
                let closingTime = openingTime - time.secs(1);
                await reject.deploy(deploySale({openingTime, closingTime}));
            });

            it("fails if company wallet address is zero", async () => {
                await reject.deploy(deploySale({companyWallet: 0x0}));
            });

            it("fails if token reserve exceeds cap", async () => {
                let tokenCap = defaultParams().tokenCap;
                await reject.deploy(deploySale({tokenReserve: tokenCap.plus(1)}));
            });

            it("fails if reserve account address is zero", async () => {
                await reject.deploy(deploySale({reserveAccount: 0x0}));
            });
        });

        context("with valid parameters", () => {
            let params = defaultParams();
            let sale;

            it("succeeds", async () => {
                params.token = (await StokrToken.new("",
                                                     "",
                                                     random.address(),
                                                     random.address(),
                                                     random.address(),
                                                     {from: owner})).address;
                sale = await deploySale(params);
                expect(await web3.eth.getCode(sale.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await sale.owner()).to.be.bignumber.equal(owner);
            });

            it("sets correct token address", async () => {
                expect(await sale.token()).to.be.bignumber.equal(params.token);
            });

            it("sets correct token cap", async () => {
                expect(await sale.tokenCap()).to.be.bignumber.equal(params.tokenCap);
            });

            it("sets correct token goal", async () => {
                expect(await sale.tokenGoal()).to.be.bignumber.equal(params.tokenGoal);
            });

            it("sets correct token price", async () => {
                expect(await sale.tokenPrice()).to.be.bignumber.equal(params.tokenPrice);
            })

            it("sets correct ether rate", async () => {
                expect(await sale.etherRate()).to.be.bignumber.equal(params.etherRate);
            });

            it("sets correct rate admin address", async () => {
                expect(await sale.rateAdmin()).to.be.bignumber.equal(params.rateAdmin);
            });

            it("sets correct opening time", async () => {
                expect(await sale.openingTime()).to.be.bignumber.equal(params.openingTime);
            });

            it("sets correct closing time", async () => {
                expect(await sale.closingTime()).to.be.bignumber.equal(params.closingTime);
            });

            it("sets correct company wallet address", async () => {
                expect(await sale.companyWallet()).to.be.bignumber.equal(params.companyWallet);
            });

            it("sets correct token reserve", async () => {
                expect(await sale.tokenReserve()).to.be.bignumber.equal(params.tokenReserve);
            });

            it("sets correct reserve account address", async () => {
                expect(await sale.reserveAccount()).to.be.bignumber.equal(params.reserveAccount);
            });

            it("correctly calculates remaining tokens for sale", async () => {
                let tokenRemaining = params.tokenCap.minus(params.tokenReserve);
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(tokenRemaining);
            });

            it.skip("correctly calculates remaining sale time", async () => {
                let timeRemaining = params.closingTime - time.now();
                expect(await sale.timeRemaining()).to.be.bignumber.equal(timeRemaining);
            });
        });
    });

    describe("rate admin change", () => {

        context("at any time", () => {
            let sale;
            let startState;

            before("deploy and save state", async () => {
                await initialState.restore();
                sale = await deploySale();
                startState = await snapshot.new();
            });

            afterEach("restore start state", async () => {
                await startState.restore();
            });

            it("is forbidden by anyone but owner", async () => {
                let rateAdmin = await sale.rateAdmin();
                await reject.tx(sale.setRateAdmin(random.address(), {from: anyone}));
                expect(await sale.rateAdmin()).to.be.bignumber.equal(rateAdmin);
            });

            it("to zero is forbidden", async () => {
                let rateAdmin = await sale.rateAdmin();
                await reject.tx(sale.setRateAdmin(0x0, {from: owner}));
                expect(await sale.rateAdmin()).to.be.bignumber.equal(rateAdmin);
            });

            it("is possible", async () => {
                let newRateAdmin = random.address();
                await sale.setRateAdmin(newRateAdmin, {from: owner});
                expect(await sale.rateAdmin()).to.be.bignumber.equal(newRateAdmin);
            });

            it("gets logged", async () => {
                let oldRateAdmin = await sale.rateAdmin();
                let newRateAdmin = random.address();
                let tx = await sale.setRateAdmin(newRateAdmin, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "RateAdminChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldRateAdmin);
                expect(entry.args.current).to.be.bignumber.equal(newRateAdmin);
            });

            it("doesn't get logged if value remains unchanged", async () => {
                let rateAdmin = await sale.rateAdmin();
                let tx = await sale.setRateAdmin(rateAdmin, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "RateAdminChange");
                expect(entry).to.not.exist;
            });
        });
    });

    describe("rate change", () => {

        context("at any time", () => {
            let sale;
            let startState;

            before("deploy and save state", async () => {
                await initialState.restore();
                sale = await deploySale();
                startState = await snapshot.new();
            });

            afterEach("restore start state", async () => {
                await startState.restore();
            });

            it("by owner not being rate admin is forbidden", async () => {
                let etherRate = await sale.etherRate();
                await reject.tx(sale.setRate(etherRate.plus(1), {from: owner}));
                expect(await sale.etherRate()).to.be.bignumber.equal(etherRate);
            });

            it("by anyone but rate admin is forbidden", async () => {
                let etherRate = await sale.etherRate();
                await reject.tx(sale.setRate(etherRate.plus(1), {from: anyone}));
                expect(await sale.etherRate()).to.be.bignumber.equal(etherRate);
            });

            it("to zero is forbidden", async () => {
                let etherRate = await sale.etherRate();
                await reject.tx(sale.setRate(0, {from: rateAdmin}));
                expect(await sale.etherRate()).to.be.bignumber.equal(etherRate);
            });

            it("lowering by an order of magnitude is forbidden", async () => {
                let etherRate = await sale.etherRate();
                await reject.tx(sale.setRate(etherRate.divToInt(10), {from: rateAdmin}));
                expect(await sale.etherRate()).to.be.bignumber.equal(etherRate);
            });

            it("raising by an order of magnitude is forbidden", async () => {
                let etherRate = await sale.etherRate();
                await reject.tx(sale.setRate(etherRate.times(10), {from: rateAdmin}));
                expect(await sale.etherRate()).to.be.bignumber.equal(etherRate);
            });

            it("is possible", async () => {
                let newEtherRate = (await sale.etherRate()).times(2).plus(1);
                await sale.setRate(newEtherRate, {from: rateAdmin});
                expect(await sale.etherRate()).to.be.bignumber.equal(newEtherRate);
            });

            it("gets logged", async () => {
                let oldEtherRate = await sale.etherRate();
                let newEtherRate = oldEtherRate.times(2).plus(1);
                let tx = await sale.setRate(newEtherRate, {from: rateAdmin});
                let entry = tx.logs.find(entry => entry.event === "RateChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldEtherRate);
                expect(entry.args.current).to.be.bignumber.equal(newEtherRate);
            });

            it("doesn't get logged if value remains unchanged", async () => {
                let etherRate = await sale.etherRate();
                let tx = await sale.setRate(etherRate, {from: rateAdmin});
                let entry = tx.logs.find(entry => entry.event === "RateChange");
                expect(entry).to.not.exist;
            });
        });
    });

    describe.only("token distribution", () => {

        context("until finalization", () => {
            let sale, token, whitelist;
            let startState;

            before("deploy and save state", async () => {
                await initialState.restore();
                sale = await deploySale();
                token = await StokrToken.at(await sale.token());
                whitelist = await Whitelist.at(await token.whitelist());
                await token.setMinter(sale, {from: owner});
                startState = await snapshot.new();
            });

            afterEach("restore start state", async () => {
                await startState.restore();
            });

            it("by anyone is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(sale.distributeTokens([investor1], [1], {from: anyone}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("of more than remaining tokens is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(sale.distributeTokens([investor1, investor2],
                                                      [await sale.tokenRemaining(), 1],
                                                      {from: owner}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("with less accounts than amounts given is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(sale.distributeTokens([investor1, investor2], [1, 2, 3], {from: owner}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("with more accounts than amounts given is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(sale.distributeTokens([investor1, investor2], [1], {from: owner}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("is possible", async () => {
                await sale.distributeTokens([investor1, investor2], [amount1, amount2], {from: owner});
            });

            it("gets logged", async () => {
                let amount = (await sale.tokenRemaining()).divToInt(3);
                let tx = await sale.distributeTokens([investor1], [amount], {from: owner});
                let entry = tx.logs.find(entry => entry.event === "TokenDistribution");
                expect(entry).to.exist;
                expect(entry.args.beneficiary).to.be.bignumber.equal(investor1);
                expect(entry.args.amount).to.be.bignumber.equal(amount);
            });

            it("increases recipients' balances", async () => {
                let balance1 = await token.balanceOf(investor1);
                let balance2 = await token.balanceOf(investor2);
                let amount1 = (await sale.tokenRemaining()).divToInt(3);
                let amount2 = amount1.divToInt(3);
                await sale.distributeTokens([investor1, investor2], [amount1, amount2], {from: owner});
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance1.plus(amount1));
                expect(await token.balanceOf(investor2)).to.be.bignumber.equal(balance2.plus(amount2));
            });

            it("increases token total supply", async () => {
                let totalSupply = await token.totalSupply();
                let amount1 = (await sale.tokenRemaining()).divToInt(3);
                let amount2 = amount1.divToInt(3);
                await sale.distributeTokens([investor1, investor2], [amount1, amount2], {from: owner});
                expect(await token.totalSupply())
                    .to.be.bignumber.equal(totalSupply.plus(amount1).plus(amount2));
            });

            it("decreases remaining tokens", async () => {
                let remaining = await sale.tokenRemaining();
                let amount1 = (await sale.tokenRemaining()).divToInt(3);
                let amount2 = amount1.divToInt(3);
                await sale.distributeTokens([investor1, investor2], [amount1, amount2], {from: owner});
                expect(await sale.tokenRemaining())
                    .to.be.bignumber.equal(remaining.minus(amount1).minus(amount2));
            });

            it.skip("many recipients at once is possible", async () => {
                await logGas(sale.distributeTokens([], [], {from: owner}), "no investors");
                let nSucc = 0;
                let nFail = -1;
                let nTest = 1;
                while (nTest != nSucc && nTest < 1024) {
                    let investors = [];
                    let amounts = [];
                    for (let i = 0; i < nTest; ++i) {
                        investors.push(random.address());
                        amounts.push(i);
                    }
                    await whitelist.addToWhitelist(investors, {from: owner});
                    let success = true;
                    try {
                        await logGas(sale.distributeTokens(investors, amounts, {from: owner}),
                                     nTest + " investors");
                    }
                    catch (error) {
                        success = false;
                    }
                    if (success) {
                        nSucc = nTest;
                        nTest = nFail < 0 ? 2 * nTest : Math.trunc((nTest + nFail) / 2);
                    }
                    else {
                        nFail = nTest;
                        nTest = Math.trunc((nSucc + nTest) / 2);
                    }
                }
                expect(nSucc).to.be.at.above(2);
            });
        });

        context("after finalization", () => {
            let sale, token, whitelist;
            let startState;

            before("deploy and save state", async () => {
                await initialState.restore();
                sale = await deploySale();
                token = await StokrToken.at(await sale.token());
                whitelist = await Whitelist.at(await token.whitelist());
                await token.setMinter(sale, {from: owner});
                await time.increaseTo(await sale.closingTime());
                await sale.finalize({from: owner});
                startState = await snapshot.new();
            });

            afterEach("restore start state", async () => {
                await startState.restore();
            });

            it("is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(sale.distributeTokens([investor1], [1], {from: owner}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });
        });
    });

    describe("before sale opens", () => {
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
        });

        describe("sale state", () => {

            it("has a non-zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.above(0);
            });

            it("is not closed", async () => {
                expect(await sale.hasClosed()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await sale.setTeamAccount(reserveAccount, {from: owner});
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });
        });
    });

    describe("while sale is open", () => {
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
        });

        describe("sale state", () => {

            it("has a non-zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.above(0);
            });

            it("is not closed", async () => {
                expect(await sale.hasClosed()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token purchase", () => {

            it("by non-whitelisted is forbidden", async () => {
                let balance = await token.balanceOf(anyone);
                await reject.tx(sale.buyTokens(anyone, {from: anyone, value: money.ether(1)}));
                expect(await token.balanceOf(anyone)).to.be.bignumber.equal(balance);
            });

            it("for the benefit of someone else is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor2, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });

            it("is possible", async () => {
                let value = money.ether(2);
                let tx = await sale.buyTokens(investor1, {from: investor1, value: value});
                let entry = tx.logs.find(entry => entry.event === "TokenPurchase");
                expect(entry).to.exist;
                expect(entry.args.purchaser).to.be.bignumber.equal(investor1);
                expect(entry.args.beneficiary).to.be.bignumber.equal(investor1);
                expect(entry.args.value).to.be.bignumber.equal(value);
                expect(entry.args.amount).to.be.bignumber.equal(value.times(await sale.rate()));
            });

            it("gets credited as potential refunds", async () => {
            });

            it("increases investor's balance", async () => {
                let balance = await token.balanceOf(investor1);
                let value = money.ether(2);
                let amount = value.times(await sale.rate());
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance.plus(amount));
            });

            it("decreases investor's wei balance", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                let value = money.ether(2);
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(weiBalance.minus(value));
            });

            it("increases token total supply", async () => {
                let totalSupply = await token.totalSupply();
                let value = money.ether(2);
                let amount = value.times(await sale.rate());
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(amount));
            });

            it("decreases remaining tokens", async () => {
                let remaining = await sale.tokenRemaining();
                let value = money.ether(2);
                let amount = value.times(await sale.rate());
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(remaining.minus(amount));
            });

            it("increases wei raised", async () => {
                let weiRaised = await sale.weiRaised();
                let value = money.ether(2);
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await sale.weiRaised()).to.be.bignumber.equal(weiRaised.plus(value));
            });

            it("exceeding remaining is forbidden", async () => {
                let remaining = await sale.tokenRemaining();
                let value = remaining.divToInt(await sale.rate()).plus(money.wei(1));
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value}));
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(remaining);
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await sale.setTeamAccount(reserveAccount, {from: owner});
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });
        });
    });

    describe("after sale goal was missed", () => {
        let sale, token, whitelist, investment;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            investment = (await sale.tokenGoal()).divToInt(await sale.rate()).minus(money.wei(1));
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
            await sale.buyTokens(investor1, {from: investor1, value: investment});
            await time.increaseTo((await sale.closingTime()).plus(time.secs(1)));
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("goal was missed", async () => {
                expect(await sale.goalReached()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });

            it("refund is forbidden", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                await reject.tx(sale.claimRefund({from: investor1}));
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(weiBalance);
            });
        });

        describe("finalization", () => {

            it("by anyone is forbidden", async () => {
                await reject.tx(sale.finalize({from: anyone}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("is possible", async () => {
                let tx = await sale.finalize({from: owner});
                let entry = tx.logs.find(entry => entry.event === "Finalized");
                expect(entry).to.exist;
                expect(await sale.isFinalized()).to.be.true;
            });
        });
    });

    describe("after sale goal was reached", () => {
        let sale, token, whitelist, investment;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            investment = (await sale.tokenGoal()).divToInt(await sale.rate()).plus(money.wei(1));
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
            await sale.buyTokens(investor1, {from: investor1, value: investment});
            await time.increaseTo((await sale.closingTime()).plus(time.secs(1)));
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("goal was reached", async () => {
                expect(await sale.goalReached()).to.be.true;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });

            it("refund is forbidden", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                await reject.tx(sale.claimRefund({from: investor1}));
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(weiBalance);
            });
        });

        describe("finalization", () => {

            it("without team account is forbidden", async () => {
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("without team account being whitelisted is forbidden", async () => {
                await sale.setTeamAccount(reserveAccount, {from: owner});
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("by anyone is forbidden", async () => {
                await whitelist.addToWhitelist([reserveAccount], {from: owner});
                await reject.tx(sale.finalize({from: anyone}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("is possible", async () => {
                let tx = await sale.finalize({from: owner});
                let entry = tx.logs.find(entry => entry.event === "Finalized");
                expect(entry).to.exist;
                expect(await sale.isFinalized()).to.be.true;
            });
        });
    });

    describe("after finalization if goal was missed", () => {
        let sale, token, whitelist, investment;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            investment = (await sale.tokenGoal()).divToInt(await sale.rate()).minus(money.wei(1));
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
            await sale.buyTokens(investor1, {from: investor1, value: investment});
            await time.increaseTo((await sale.closingTime()).plus(time.secs(1)));
            await sale.finalize({from: owner});
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("goal was missed", async () => {
                expect(await sale.goalReached()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.true;
            });
        });

        describe("token contract", () => {

            it("is destroyed", async () => {
                expect(await web3.eth.getCode(token.address)).to.be.oneOf(["0x", "0x0"]);
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
            });

            it("refund is possible", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                await sale.claimRefund({from: investor1});
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.above(weiBalance);
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await reject.tx(sale.finalize({from: owner}));
            });
        });
    });

    describe("after finalization if goal was reached", () => {
        let sale, token, whitelist, investment;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            investment = (await sale.tokenGoal()).divToInt(await sale.rate()).plus(money.wei(1));
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
            await sale.buyTokens(investor1, {from: investor1, value: investment});
            await time.increaseTo((await sale.closingTime()).plus(time.secs(1)));
            await whitelist.addToWhitelist([reserveAccount], {from: owner});
            await sale.setTeamAccount(reserveAccount, {from: owner});
            await sale.finalize({from: owner});
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("goal was reached", async () => {
                expect(await sale.goalReached()).to.be.true;
            });

            it("is finalized", async () => {
                expect(await sale.isFinalized()).to.be.true;
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });

            it("refund is forbidden", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                await reject.tx(sale.claimRefund({from: investor1}));
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(weiBalance);
            });
        });

        describe("team account", () => {

            it("received team share", async () => {
                expect(await token.balanceOf(reserveAccount)).to.be.bignumber.equal(await sale.tokenReserve());
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await reject.tx(sale.finalize({from: owner}));
            });
        });
    });

});

