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
    const defaultParams = () => {
        let tokenPrice = new BN("100");  // A token costs one Euro
        let etherRate = new BN("16321");  // Realistic rate is something in [1e5..2e5]

        // Set the caps so that a single investor can easily reach them
        let tokenCapOfPublicSale = money.ether(30).mul(etherRate).divToInt(tokenPrice);  // ~30 ETH
        let tokenCapOfPrivateSale = tokenCapOfPublicSale.divToInt(2);  // ~15 ETH
        let tokenGoal = tokenCapOfPublicSale.divToInt(6);  // ~5 ETH
        let tokenReserve = tokenCapOfPublicSale.divToInt(10);  // ~3 ETH

        return {
            tokenCapOfPublicSale,
            tokenCapOfPrivateSale,
            tokenGoal,
            tokenPrice,
            etherRate,
            rateAdmin,
            openingTime: time.now() + time.days(1),
            closingTime: time.now() + time.days(2),
            companyWallet,
            tokenReserve,
            reserveAccount
        };
    };

    // Helper function: deploy StokrCrowdsale (and Whitelist and StokrToken if necessary)
    const deploySale = async changedParams => {
        let deployParams = defaultParams();

        if (changedParams !== undefined) {
            for (let name in changedParams) {
                deployParams[name] = changedParams[name];
            }
        }
        if (!("token" in deployParams)) {
            let whitelist = await Whitelist.new({from: owner});
            await whitelist.addAdmin(owner, {from: owner});
            await whitelist.addToWhitelist([companyWallet, reserveAccount, investor1, investor2],
                                           {from: owner});
            deployParams.token = (await StokrToken.new("Sample Stokr Token",
                                                       "STOKR",
                                                       whitelist.address,
                                                       random.address(),
                                                       random.address(),
                                                       {from: owner})).address;
        }

        return StokrCrowdsale.new(deployParams.token,
                                  deployParams.tokenCapOfPublicSale,
                                  deployParams.tokenCapOfPrivateSale,
                                  deployParams.tokenGoal,
                                  deployParams.tokenPrice,
                                  deployParams.etherRate,
                                  deployParams.rateAdmin,
                                  deployParams.openingTime,
                                  deployParams.closingTime,
                                  deployParams.companyWallet,
                                  deployParams.tokenReserve,
                                  deployParams.reserveAccount,
                                  {from: owner});
    };

    // Helper function to get the wei value of a given token amount
    const valueOf = async (sale, amount) => {
        return amount.times(await sale.tokenPrice()).divToInt(await sale.etherRate());
    };

    // Helper function to get the minimum investment wei value to get at least one token
    const valueOf1 = async sale => {
        return (await sale.etherRate()).divToInt(await sale.tokenPrice());
    }

    let initialState;

    before("save inital state", async () => {
        initialState = await snapshot.new();
    });

    after("revert inital state", async () => {
        await initialState.revert();
    });

    context("deployment", () => {

        describe("with invalid parameters", () => {

            it("fails if token address is zero", async () => {
                let reason = await reject.deploy(deploySale({token: 0x0}));
                expect(reason).to.be.equal("token address is zero");
            });

            it("fails if another sale is already minting the token", async () => {
                let sale = await deploySale();
                let token = await StokrToken.at(await sale.token());
                await token.setMinter(sale.address, {from: owner});
                let reason = await reject.deploy(deploySale({token: token.address}));
                expect(reason).to.be.equal("token has another minter");
            });

            it("fails if token cap of public sale is zero", async () => {
                let reason = await reject.deploy(deploySale({tokenCapOfPublicSale: 0}));
                expect(reason).to.be.equal("cap of public sale is zero");
            });

            it("fails if token cap of private sale is zero", async () => {
                let reason = await reject.deploy(deploySale({tokenCapOfPrivateSale: 0}));
                expect(reason).to.be.equal("cap of private sale is zero");
            });

            it("fails if token goal is not reachable", async () => {
                let {tokenCapOfPublicSale, tokenCapOfPrivateSale} = defaultParams();
                let tokenGoal = tokenCapOfPublicSale.plus(tokenCapOfPrivateSale).plus(1);
                let reason = await reject.deploy(deploySale({tokenGoal}));
                expect(reason).to.be.equal("goal is not attainable");
            });

            it("fails if token price is zero", async () => {
                let reason = await reject.deploy(deploySale({tokenPrice: 0}));
                expect(reason).to.be.equal("token price is zero");
            });

            it("fails if ether rate is zero", async () => {
                let reason = await reject.deploy(deploySale({etherRate: 0}));
                expect(reason).to.be.equal("ether price is zero");
            });

            it("fails if rate admin address is zero", async () => {
                let reason = await reject.deploy(deploySale({rateAdmin: 0x0}));
                expect(reason).to.be.equal("rate admin is zero");
            });

            it("fails if opening time is in the past", async () => {
                let openingTime = time.now() - time.mins(1);
                let reason = await reject.deploy(deploySale({openingTime}));
                expect(reason).to.be.equal("opening lies in the past");
            });

            it("fails if closing time is before opening time", async () => {
                let openingTime = defaultParams().openingTime;
                let closingTime = openingTime - time.secs(1);
                let reason = await reject.deploy(deploySale({openingTime, closingTime}));
                expect(reason).to.be.equal("closing lies before opening");
            });

            it("fails if company wallet address is zero", async () => {
                let reason = await reject.deploy(deploySale({companyWallet: 0x0}));
                expect(reason).to.be.equal("company wallet is zero");
            });

            it("fails if reserve account address is zero", async () => {
                let reason = await reject.deploy(deploySale({reserveAccount: 0x0}));
                expect(reason).to.be.equal("reserve account is zero");
            });

            it("fails if sum of token pools overflows", async () => {
                let tokenCapOfPublicSale = (new BN(2)).pow(255);
                let tokenCapOfPrivateSale = tokenCapOfPublicSale.minus(1);
                await reject.deploy(deploySale({tokenCapOfPublicSale,
                                                tokenCapOfPrivateSale,
                                                tokenReserve: 1}));
            });
        });

        describe("with valid parameters", () => {
            let params = defaultParams();
            let sale;

            it("succeeds", async () => {
                params.token = (await StokrToken.new("Name",
                                                     "SYM",
                                                     random.address(),
                                                     random.address(),
                                                     random.address(),
                                                     {from: owner})).address;
                params.tokenGoal = params.tokenCapOfPublicSale.divToInt(10);
                sale = await deploySale(params);
                expect(await web3.eth.getCode(sale.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await sale.owner()).to.be.bignumber.equal(owner);
            });

            it("sets correct token address", async () => {
                expect(await sale.token()).to.be.bignumber.equal(params.token);
            });

            it("sets correct token cap of public sale", async () => {
                expect(await sale.tokenCapOfPublicSale())
                    .to.be.bignumber.equal(params.tokenCapOfPublicSale);
            });

            it("sets correct token cap of private sale", async () => {
                expect(await sale.tokenCapOfPrivateSale())
                    .to.be.bignumber.equal(params.tokenCapOfPrivateSale);
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

            it("correctly calculates remaining tokens for public sale", async () => {
                expect(await sale.tokenRemainingForPublicSale())
                    .to.be.bignumber.equal(params.tokenCapOfPublicSale);
            });

            it("correctly calculates remaining tokens for private sale", async () => {
                expect(await sale.tokenRemainingForPrivateSale())
                    .to.be.bignumber.equal(params.tokenCapOfPrivateSale);
            });

            it("correctly calculates that zero tokens were sold", async () => {
                expect(await sale.tokenSold()).to.be.bignumber.zero;
            });

            it("correctly calculates remaining sale time", async () => {
                let timeRemaining = params.closingTime - time.now();
                expect(await sale.timeRemaining())
                    .to.be.bignumber.least(params.closingTime - params.openingTime);
            });
        });
    });

    context("before sale opening", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy and save state", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            startState = await snapshot.new();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("sale state", () => {

            it("remaining time is at least as long as sale period", async () => {
                let openingTime = await sale.openingTime();
                let closingTime = await sale.closingTime();
                expect(await sale.timeRemaining()).to.be.bignumber.least(closingTime.minus(openingTime));
            });

            it("is not open", async () => {
                expect(await sale.isOpen()).to.be.false;
            });

            it("has not closed", async () => {
                expect(await sale.hasClosed()).to.be.false;
            });

            it("has not been finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("rate admin change", () => {

            it("is forbidden by anyone but owner", async () => {
                let reason = await reject.call(sale.setRateAdmin(random.address(), {from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(sale.setRateAdmin(0x0, {from: owner}));
                expect(reason).to.be.equal("new rate admin is zero");
            });

            it("is possible", async () => {
                let newAdmin = random.address();
                await sale.setRateAdmin(newAdmin, {from: owner});
                expect(await sale.rateAdmin()).to.be.bignumber.equal(newAdmin);
            });

            it("gets logged", async () => {
                let oldAdmin = await sale.rateAdmin();
                let newAdmin = random.address();
                let tx = await sale.setRateAdmin(newAdmin, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "RateAdminChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldAdmin);
                expect(entry.args.current).to.be.bignumber.equal(newAdmin);
            });

            it("doesn't get logged if value remains unchanged", async () => {
                let admin = await sale.rateAdmin();
                let tx = await sale.setRateAdmin(admin, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "RateAdminChange");
                expect(entry).to.not.exist;
            });
        });

        describe("rate change", () => {

            it("by owner not being rate admin is forbidden", async () => {
                let reason = await reject.call(sale.setRate((await sale.etherRate()).plus(1), {from: owner}));
                expect(reason).to.be.equal("restricted to rate admin");
            });

            it("by anyone but rate admin is forbidden", async () => {
                let reason = await reject.call(sale.setRate((await sale.etherRate()).plus(1), {from: anyone}));
                expect(reason).to.be.equal("restricted to rate admin");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(sale.setRate(0, {from: rateAdmin}));
                expect(reason).to.be.equal("rate change too big");
            });

            it("lowering by an order of magnitude is forbidden", async () => {
                let reason = await reject.call(sale.setRate((await sale.etherRate()).divToInt(10),
                                                          {from: rateAdmin}));
                expect(reason).to.be.equal("rate change too big");
            });

            it("raising by an order of magnitude is forbidden", async () => {
                let reason = await reject.call(sale.setRate((await sale.etherRate()).times(10),
                                                          {from: rateAdmin}));
                expect(reason).to.be.equal("rate change too big");
            });

            it("is possible", async () => {
                let newRate = (await sale.etherRate()).times(2).plus(1);
                await sale.setRate(newRate, {from: rateAdmin});
                expect(await sale.etherRate()).to.be.bignumber.equal(newRate);
            });

            it("gets logged", async () => {
                let oldRate = await sale.etherRate();
                let newRate = oldRate.times(2).plus(1);
                let tx = await sale.setRate(newRate, {from: rateAdmin});
                let entry = tx.logs.find(entry => entry.event === "RateChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldRate);
                expect(entry.args.current).to.be.bignumber.equal(newRate);
            });

            it("doesn't get logged if value remains unchanged", async () => {
                let rate = await sale.etherRate();
                let tx = await sale.setRate(rate, {from: rateAdmin});
                let entry = tx.logs.find(entry => entry.event === "RateChange");
                expect(entry).to.not.exist;
            });
        });

        describe("token distribution", () => {
            [
                {
                    name: "public sale",
                    tokenCap: "tokenCapOfPublicSale",
                    tokenRemaining: "tokenRemainingForPublicSale",
                    distributeTokens: "distributeTokensViaPublicSale",
                }, {
                    name: "private sale",
                    tokenCap: "tokenCapOfPrivateSale",
                    tokenRemaining: "tokenRemainingForPrivateSale",
                    distributeTokens: "distributeTokensViaPrivateSale",
                }
            ].forEach(fns => {

                it(`via ${fns.name} by anyone but owner is forbidden`, async () => {
                    let reason = await reject.call(
                        sale[fns.distributeTokens]([investor1], [1], {from: anyone}));
                    expect(reason).to.be.equal("restricted to owner");
                });

                it(`via ${fns.name} of more than remaining tokens is forbidden`, async () => {
                    let reason = await reject.call(
                        sale[fns.distributeTokens]([investor1, investor2],
                                                   [await sale[fns.tokenRemaining](), 1],
                                                   {from: owner}));
                    expect(reason).to.be.equal("not enough tokens available");
                });

                it(`via ${fns.name} with #accounts < #amounts is forbidden`, async () => {
                    let reason = await reject.call(
                        sale[fns.distributeTokens]([investor1, investor2], [1, 2, 3], {from: owner}));
                    expect(reason).to.be.equal("lengths are different");
                });

                it(`via ${fns.name} with #accounts > amounts is forbidden`, async () => {
                    let reason = await reject.call(
                        sale[fns.distributeTokens]([investor1, investor2], [1], {from: owner}));
                    expect(reason).to.be.equal("lengths are different");
                });

                it(`via ${fns.name} is possible`, async () => {
                    let amount1 = (await sale[fns.tokenRemaining]()).divToInt(3);
                    let amount2 = amount1.divToInt(3);
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                });

                it(`via ${fns.name} gets logged`, async () => {
                    let amount = (await sale[fns.tokenRemaining]()).divToInt(3);
                    let tx = await sale[fns.distributeTokens]([investor1],
                                                              [amount],
                                                              {from: owner});
                    let entry = tx.logs.find(entry => entry.event === "TokenDistribution");
                    expect(entry).to.exist;
                    expect(entry.args.beneficiary).to.be.bignumber.equal(investor1);
                    expect(entry.args.amount).to.be.bignumber.equal(amount);
                });

                it(`via ${fns.name} increases recipients' balance`, async () => {
                    let balance1 = await token.balanceOf(investor1);
                    let balance2 = await token.balanceOf(investor2);
                    let amount1 = (await sale[fns.tokenRemaining]()).divToInt(3);
                    let amount2 = amount1.divToInt(3);
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                    expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance1.plus(amount1));
                    expect(await token.balanceOf(investor2)).to.be.bignumber.equal(balance2.plus(amount2));
                });

                it(`via ${fns.name} increases token total supply`, async () => {
                    let supply = await token.totalSupply();
                    let amount1 = (await sale[fns.tokenRemaining]()).divToInt(3);
                    let amount2 = amount1.divToInt(3);
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                    expect(await token.totalSupply())
                        .to.be.bignumber.equal(supply.plus(amount1).plus(amount2));
                });

                it(`via ${fns.name} decreases remaining tokens`, async () => {
                    let remaining = await sale[fns.tokenRemaining]();
                    let amount1 = remaining.divToInt(2);
                    let amount2 = remaining.divToInt(3);
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                    expect(await sale[fns.tokenRemaining]())
                        .to.be.bignumber.equal(remaining.minus(amount1).minus(amount2));
                });

                it(`via ${fns.name} increases sold tokens`, async () => {
                    let sold = await sale.tokenSold();
                    let amount1 = 1500;
                    let amount2 = 2500;
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                    expect(await sale.tokenSold()).to.be.bignumber.equal(sold.plus(amount1).plus(amount2));
                });

                it(`via ${fns.name} may reach goal`, async () => {
                    let amount = (await sale.tokenGoal()).minus(await sale.tokenSold());
                    await sale[fns.distributeTokens]([investor1], [amount], {from: owner});
                    expect(await sale.goalReached()).to.be.true;
                });

                it.skip(`via ${fns.name} to many recipients at once is possible`, async () => {
                    await logGas(sale[fns.distributeTokens]([], [], {from: owner}), "no investors");
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
                            await logGas(sale[fns.distributeTokens](investors, amounts, {from: owner}),
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
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: money.ether(1)}));
                expect(reason).to.be.equal("sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.be.equal("sale has not been finalized");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.be.equal("sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: owner}));
                expect(reason).to.be.equal("sale has not closed");
            });
        });
    });

    context("while sale is open", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.openingTime());
            startState = await snapshot.new();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("sale state", () => {

            it("has a non-zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.above(0);
            });

            it("is open", async () => {
                expect(await sale.isOpen()).to.be.true;
            });

            it("has not closed", async () => {
                expect(await sale.hasClosed()).to.be.false;
            });

            it("has not been finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("rate admin change", () => {

            it("is possible", async () => {
                await sale.setRateAdmin(random.address(), {from: owner});
            });
        });

        describe("rate change", () => {

            it("is possible", async () => {
                await sale.setRate((await sale.etherRate()).plus(1), {from: rateAdmin});
            });
        });

        describe("token distribution", () => {

            it("via public sale is possible", async () => {
                await sale.distributeTokensViaPublicSale([investor1], [1], {from: owner});
            });

            it("via private sale is possible", async () => {
                await sale.distributeTokensViaPrivateSale([investor1], [1], {from: owner});
            });
        });

        describe("token purchase", () => {

            it("by non-whitelisted is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: anyone, value: money.ether(1)}));
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("is possible", async () => {
                let balance = await token.balanceOf(investor1);
                await sale.buyTokens({from: investor1, value: money.ether(1)});
                expect(await token.balanceOf(investor1)).to.be.bignumber.above(balance);
            });

            it("gets logged", async () => {
                let value = money.ether(2);
                let tx = await sale.buyTokens({from: investor1, value: value});
                let entry = tx.logs.find(entry => entry.event === "TokenPurchase");
                expect(entry).to.exist;
                expect(entry.args.buyer).to.be.bignumber.equal(investor1);
                expect(entry.args.value).to.be.bignumber.equal(value);
                expect(entry.args.amount).to.be.bignumber.above(0);
            });

            it("via fallback function is possible", async () => {
                let balance = await token.balanceOf(investor1);
                let options = {from: investor1, to: sale.address, value: money.ether(1)}
                options.gas = await web3.eth.estimateGas(options);
                await web3.eth.sendTransaction(options);
                expect(await token.balanceOf(investor1)).to.be.bignumber.above(balance);
            });

            it("increases investor's balance", async () => {
                let balance = await token.balanceOf(investor1);
                let value = money.ether(2);
                let amount = value.times(await sale.etherRate()).divToInt(await sale.tokenPrice());
                await sale.buyTokens({from: investor1, value});
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance.plus(amount));
            });

            it("decreases investor's wei balance", async () => {
                let asset = await web3.eth.getBalance(investor1);
                let value = money.ether(2);
                await sale.buyTokens({from: investor1, value});
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(asset.minus(value));
            });

            it("increases token total supply", async () => {
                let supply = await token.totalSupply();
                let value = money.ether(2);
                let amount = value.times(await sale.etherRate()).divToInt(await sale.tokenPrice());
                await sale.buyTokens({from: investor1, value});
                expect(await token.totalSupply()).to.be.bignumber.equal(supply.plus(amount));
            });

            it("decreases remaining tokens for public sale", async () => {
                let remaining = await sale.tokenRemainingForPublicSale();
                let value = money.ether(2);
                let amount = value.times(await sale.etherRate()).divToInt(await sale.tokenPrice());
                await sale.buyTokens({from: investor1, value});
                expect(await sale.tokenRemainingForPublicSale())
                    .to.be.bignumber.equal(remaining.minus(amount));
            });

            it("increases tokens sold", async () => {
                let sold = await sale.tokenSold();
                let value = money.ether(2);
                let amount = value.times(await sale.etherRate()).divToInt(await sale.tokenPrice());
                await sale.buyTokens({from: investor1, value});
                expect(await sale.tokenSold()).to.be.bignumber.equal(sold.plus(amount));
            });

            it("exceeding remaining tokens for public sale is forbidden", async () => {
                let remaining = await sale.tokenRemainingForPublicSale();
                let value = (await valueOf(sale, remaining)).plus(await valueOf1(sale));
                let reason = await reject.call(sale.buyTokens({from: investor1, value}));
                expect(reason).to.be.equal("not enough tokens available");
            });

            it("is stored if goal wasn't reached", async () => {
                let amount = (await sale.tokenGoal()).minus(await sale.tokenSold());
                let value = (await valueOf(sale, amount)).divToInt(3);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.investments(investor1)).to.be.bignumber.equal(value);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.investments(investor1)).to.be.bignumber.equal(value.times(2));
            });

            it("is not forwarded if goal wasn't reached", async () => {
                let asset = await web3.eth.getBalance(companyWallet);
                let amount = (await sale.tokenGoal()).minus(await sale.tokenSold());
                let value = (await valueOf(sale, amount)).minus(money.wei(1));
                await sale.buyTokens({from: investor1, value});
                expect(await web3.eth.getBalance(companyWallet)).to.be.bignumber.equal(asset);
            });

            it("may reach goal eventually", async () => {
                let amount = (await sale.tokenGoal()).minus(await sale.tokenSold());
                let value = (await valueOf(sale, amount)).plus(await valueOf1(sale));
                await sale.buyTokens({from: investor1, value});
                expect(await sale.goalReached()).to.be.true;
            });

            it("is forwarded if goal was reached", async () => {
                let amount = (await sale.tokenGoal()).minus(await sale.tokenSold());
                let value = (await valueOf(sale, amount)).plus(await valueOf1(sale));
                await sale.buyTokens({from: investor1, value});
                let asset = web3.eth.getBalance(companyWallet);
                let investment = money.ether(2);
                await sale.buyTokens({from: investor1, value: investment});
                expect(await web3.eth.getBalance(companyWallet))
                    .to.be.bignumber.equal(asset.plus(investment));
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let amount = (await sale.tokenGoal()).minus(await sale.tokenSold());
                let value = (await valueOf(sale, amount)).divToInt(3);
                await sale.buyTokens({from: investor1, value});
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.be.equal("sale has not been finalized");

            });

            it("distribution is forbidden", async () => {
                let amount = (await sale.tokenGoal()).minus(await sale.tokenSold());
                let value = (await valueOf(sale, amount)).divToInt(3);
                await sale.buyTokens({from: investor1, value});
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.be.equal("sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: owner}));
                expect(reason).to.be.equal("sale has not closed");
            })
        });
    });

    context("after sale which missed goal", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.openingTime());
            let value = (await valueOf(sale, await sale.tokenGoal())).divToInt(2);
            await sale.buyTokens({from: investor1, value});
            await sale.buyTokens({from: investor2, value: value.minus(await valueOf1(sale))});
            await time.increaseTo(await sale.closingTime());
            startState = await snapshot.new();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is not open", async () => {
                expect(await sale.isOpen()).to.be.false;
            });

            it("has closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("sold tokens is below goal", async () => {
                expect(await sale.tokenSold()).to.be.bignumber.below(await sale.tokenGoal());
            });

            it("goal was missed", async () => {
                expect(await sale.goalReached()).to.be.false;
            });

            it("has not been finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("rate admin change", () => {

            it("is possible", async () => {
                await sale.setRateAdmin(random.address(), {from: owner});
            });
        });

        describe("rate change", () => {

            it("is possible", async () => {
                await sale.setRate((await sale.etherRate()).plus(1), {from: rateAdmin});
            });
        });

        describe("token distribution", () => {

            it("via public sale is possible", async () => {
                await sale.distributeTokensViaPublicSale([investor1], [1], {from: owner});
            });

            it("via private sale is possible", async () => {
                await sale.distributeTokensViaPrivateSale([investor1], [1], {from: owner});
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: money.ether(1)}));
                expect(reason).to.be.equal("sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.be.equal("sale has not been finalized");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.be.equal("sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("is possible", async () => {
                await sale.finalize({from: owner});
                expect(await sale.isFinalized()).to.be.true;
            });

            it("gets logged", async () => {
                let tx = await sale.finalize({from: owner});
                let entry = tx.logs.find(entry => entry.event === "Finalization");
                expect(entry).to.exist;
            });
        });
    });

    context("after sale which reached goal", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.openingTime());
            let value = (await valueOf(sale, await sale.tokenGoal())).divToInt(2);
            await sale.buyTokens({from: investor1, value});
            await sale.buyTokens({from: investor2, value: value.plus(await valueOf1(sale))});
            await time.increaseTo(await sale.closingTime());
            startState = await snapshot.new();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is not open", async () => {
                expect(await sale.isOpen()).to.be.false;
            });

            it("has closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("sold tokens is at least goal", async () => {
                expect(await sale.tokenSold()).to.be.bignumber.least(await sale.tokenGoal());
            });

            it("goal was reached", async () => {
                expect(await sale.goalReached()).to.be.true;
            });

            it("has not been finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token distribution", () => {

            it("via public sale is possible", async () => {
                await sale.distributeTokensViaPublicSale([investor1], [1], {from: owner});
            });

            it("via private sale is possible", async () => {
                await sale.distributeTokensViaPrivateSale([investor1], [1], {from: owner});
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: money.ether(1)}));
                expect(reason).to.be.equal("sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.be.equal("sale has not been finalized");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.be.equal("sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("is possible", async () => {
                await sale.finalize({from: owner});
                expect(await sale.isFinalized()).to.be.true;
            });

            it("gets logged", async () => {
                let tx = await sale.finalize({from: owner});
                let entry = tx.logs.find(entry => entry.event === "Finalization");
                expect(entry).to.exist;
            });
        });
    });

    context("after finalization of missed goal", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.openingTime());
            let value = (await valueOf(sale, await sale.tokenGoal())).divToInt(2);
            await sale.buyTokens({from: investor1, value});
            await sale.buyTokens({from: investor2, value: value.minus(await valueOf1(sale))});
            await time.increaseTo(await sale.closingTime());
            await sale.finalize({from: owner});
            startState = await snapshot.new();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is not open", async () => {
                expect(await sale.isOpen()).to.be.false;
            });

            it("has closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("sold tokens is below goal", async () => {
                expect(await sale.tokenSold()).to.be.bignumber.below(await sale.tokenGoal());
            });

            it("goal was missed", async () => {
                expect(await sale.goalReached()).to.be.false;
            });

            it("has been finalized", async () => {
                expect(await sale.isFinalized()).to.be.true;
            });
        });

        describe("token contract", () => {

            it("has been destroyed", async () => {
                expect(await web3.eth.getCode(token.address)).to.be.oneOf(["0x", "0x0"]);
            });
        });

        describe("token distribution", () => {

            it("via public sale is forbidden", async () => {
                let reason = await reject.call(sale.distributeTokensViaPublicSale([investor1],
                                                                                [1],
                                                                                {from: owner}));
                expect(reason).to.be.equal("sale has been finalized");
            });

            it("via private sale is forbidden", async () => {
                let reason = await reject.call(sale.distributeTokensViaPrivateSale([investor1],
                                                                                 [1],
                                                                                 {from: owner}));
                expect(reason).to.be.equal("sale has been finalized");
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: money.ether(1)}));
                expect(reason).to.be.equal("sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is possible", async () => {
                await sale.claimRefund({from: investor1});
                await sale.claimRefund({from: investor2});
                await sale.claimRefund({from: anyone});
            });

            it("claiming gets logged", async () => {
                let investment = await sale.investments(investor1);
                let tx = await sale.claimRefund({from: investor1});
                let entry = tx.logs.find(entry => entry.event === "InvestorRefund");
                expect(entry).to.exist;
                expect(entry.args.investor).to.be.bignumber.equal(investor1);
                expect(entry.args.value).to.be.bignumber.equal(investment);
            });

            it("claiming sets investment to zero", async () => {
                await sale.claimRefund({from: investor1});
                expect(await sale.investments(investor1)).to.be.bignumber.zero;
            });

            it("claiming increases investor's balance", async () => {
                let asset = await web3.eth.getBalance(investor1);
                let investment = await sale.investments(investor1);
                let txCostEst = money.finney(10);
                await sale.claimRefund({from: investor1});
                expect(await web3.eth.getBalance(investor1))
                    .to.be.bignumber.above(asset.plus(investment).minus(txCostEst));
            });

            it("distribution by anyone but owner is forbidden", async () => {
                let reason = await reject.call(
                    sale.distributeRefunds([investor1, investor2, anyone], {from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("distribution is possible", async () => {
                await sale.distributeRefunds([investor1, investor2, anyone], {from: owner});
            });

            it("distribution gets logged", async () => {
                let investment = await sale.investments(investor1);
                let tx = await sale.distributeRefunds([investor1], {from: owner});
                let entry = tx.logs.find(entry => entry.event === "InvestorRefund");
                expect(entry).to.exist;
                expect(entry.args.investor).to.be.bignumber.equal(investor1);
                expect(entry.args.value).to.be.bignumber.equal(investment);
            });

            it("distribution sets investment to zero", async () => {
                await sale.distributeRefunds([investor1], {from: owner});
                expect(await sale.investments(investor1)).to.be.bignumber.zero;
            });

            it("distribution increases investor's balance", async () => {
                let asset = await web3.eth.getBalance(investor1);
                let investment = await sale.investments(investor1);
                await sale.distributeRefunds([investor1], {from: owner});
                expect(await web3.eth.getBalance(investor1))
                    .to.be.bignumber.equal(asset.plus(investment));
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: owner}));
                expect(reason).to.be.equal("sale has already been finalized");
            });
        });
    });

    context("after finalization of reached goal", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.openingTime());
            let value = (await valueOf(sale, await sale.tokenGoal())).divToInt(2);
            await sale.buyTokens({from: investor1, value});
            await sale.buyTokens({from: investor2, value: value.plus(await valueOf1(sale))});
            await time.increaseTo(await sale.closingTime());
            await sale.finalize({from: owner});
            startState = await snapshot.new();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is not open", async () => {
                expect(await sale.isOpen()).to.be.false;
            });

            it("has closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("sold tokens is at least goal", async () => {
                expect(await sale.tokenSold()).to.be.bignumber.least(await sale.tokenGoal());
            });

            it("goal was reached", async () => {
                expect(await sale.goalReached()).to.be.true;
            });

            it("has been finalized", async () => {
                expect(await sale.isFinalized()).to.be.true;
            });
        });

        describe("token contract", () => {

            it("has finished minting", async () => {
                expect(await token.mintingFinished()).to.be.true;
            });
        });

        describe("token distribution", () => {

            it("via public sale is forbidden", async () => {
                let reason = await reject.call(sale.distributeTokensViaPublicSale([investor1],
                                                                                [1],
                                                                                {from: owner}));
                expect(reason).to.be.equal("sale has been finalized");
            });

            it("via private sale is forbidden", async () => {
                let reason = await reject.call(sale.distributeTokensViaPrivateSale([investor1],
                                                                                 [1],
                                                                                 {from: owner}));
                expect(reason).to.be.equal("sale has been finalized");
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: money.ether(1)}));
                expect(reason).to.be.equal("sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.be.equal("goal was reached");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.be.equal("goal was reached");
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: owner}));
                expect(reason).to.be.equal("sale has already been finalized");
            });
        });
    });

});

