"use strict";

const RateSource = artifacts.require("./mockups/RateSourceMockup.sol");
const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");
const StokrCrowdsale = artifacts.require("./crowdsale/StokrCrowdsale.sol");

const {toBN, toWei, toChecksumAddress, randomHex, padLeft} = web3.utils;
const {expect} = require("chai").use(require("chai-bn")(web3.utils.BN));
const {time, reject, evm, bisection} = require("./helpers/_all");

const EVM = evm(web3);
const ZERO_ADDRESS = padLeft("0x0", 160 >> 2);
const randomAddress = () => toChecksumAddress(randomHex(160 >> 3));
const ether = n => toWei(toBN(n), "ether");


contract("StokrCrowdsale", ([owner,
                             companyWallet,
                             reserveAccount,
                             investor1,
                             investor2,
                             anyone]) => {
    const MAX_OFFERING_PERIOD = time.days(183);

    // Helper function: default deployment parameters
    const getDeployParams = async changedParams => {
        let etherRate = toBN(16321);  // Realistic rate is something in [1e5..2e5]
        let tokenPrice = toBN(100);  // A token costs one Euro

        let tokensFor = value => value.mul(etherRate).div(tokenPrice);

        // Set the caps so that a single investor can easily reach them
        let tokenCapOfPublicSale = tokensFor(ether(30));
        let tokenCapOfPrivateSale = tokensFor(ether(20));
        let tokenGoal = tokensFor(ether(10));
        let tokenPurchaseMinimum = tokensFor(ether(1));
        let tokenPurchaseLimit = tokensFor(ether(2));
        let tokenReservePerMill = toBN(200);  // 20%

        let params = {
            etherRate,
            tokenCapOfPublicSale,
            tokenCapOfPrivateSale,
            tokenGoal,
            tokenReservePerMill,
            tokenPurchaseMinimum,
            tokenPurchaseLimit,
            tokenPrice,
            openingTime: toBN(await EVM.now() + time.days(1)),
            closingTime: toBN(await EVM.now() + time.days(7)),
            limitEndTime: toBN(await EVM.now() + time.days(2)),
            companyWallet,
            reserveAccount
        };

        if (changedParams !== undefined) {
            for (let name in changedParams) {
                params[name] = changedParams[name];
            }
        }

        return params;
    };

    // Helper function: deploy StokrCrowdsale (and Whitelist and StokrToken if necessary)
    const deployRateSource = async params => {
        return RateSource.new(params.etherRate, {from: owner});
    };

    const deployToken = async params => {
        let whitelist = await Whitelist.new({from: owner});
        await whitelist.addAdmin(owner, {from: owner});
        await whitelist.addToWhitelist([companyWallet, reserveAccount, investor1, investor2],
                                       {from: owner});

        return StokrToken.new("Sample Stokr Token",
                              "STOKR",
                              whitelist.address,
                              randomAddress(),
                              randomAddress(),
                              randomAddress(),
                              {from: owner});
    }

    const deploySale = async params => {
        if (!("rateSource" in params)) {
            params.rateSource = (await deployRateSource(params)).address;
        }
        if (!("token" in params)) {
            params.token = (await deployToken(params)).address;
        }

        return StokrCrowdsale.new(params.rateSource,
                                  params.token,
                                  params.tokenCapOfPublicSale,
                                  params.tokenCapOfPrivateSale,
                                  params.tokenGoal,
                                  params.tokenPurchaseMinimum,
                                  params.tokenPurchaseLimit,
                                  params.tokenReservePerMill,
                                  params.tokenPrice,
                                  params.openingTime,
                                  params.closingTime,
                                  params.limitEndTime,
                                  params.companyWallet,
                                  params.reserveAccount,
                                  {from: owner});
    };

    // Helper function to get the actual ether rate
    const etherRate = async sale => {
        return await (await RateSource.at(await sale.rateSource())).etherRate();
    };

    // Helper function to get the token amount of a give wei value
    const tokenAmountOf = async (sale, value) => {
        return value.mul(await etherRate(sale)).div(await sale.tokenPrice());
    };

    // Helper function to get the wei value of a given token amount
    const tokenValueOf = async (sale, amount) => {
        return amount.mul(await sale.tokenPrice()).div(await etherRate(sale));
    };

    // Helper function to get the minimum investment wei value to get at least one token
    const valueOf1 = sale => tokenAmountOf(sale, toBN(1));


    let initialState;

    before("save inital state", async () => {
        initialState = await EVM.snapshot();
    });

    after("revert inital state", async () => {
        await initialState.revert();
    });

    context("deployment", () => {

        describe("with invalid parameters", () => {

            it("fails if rate source address is zero", async () => {
                let params = await getDeployParams({rateSource: ZERO_ADDRESS});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Rate source is zero");
            });

            it("fails if token address is zero", async () => {
                let params = await getDeployParams({token: ZERO_ADDRESS});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Token address is zero");
            });

            it("fails if another sale is already minting the token", async () => {
                let sale = await deploySale(await getDeployParams());
                let token = await StokrToken.at(await sale.token());
                await token.setMinter(sale.address, {from: owner});
                let params = await getDeployParams({token: token.address});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Token has another minter");
            });

            it("fails if token cap of public sale is zero", async () => {
                let params = await getDeployParams({tokenCapOfPublicSale: toBN(0)});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Cap of public sale is zero");
            });

            it("fails if token cap of private sale is zero", async () => {
                let params = await getDeployParams({tokenCapOfPrivateSale: toBN(0)});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Cap of private sale is zero");
            });

            it("fails if token goal is not reachable", async () => {
                let params = await getDeployParams();
                params.tokenGoal = params.tokenCapOfPublicSale
                                         .add(params.tokenCapOfPrivateSale)
                                         .add(toBN(1));
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Goal is not attainable");
            });

            it("fails if token purchase minimum exceeds public sale cap", async () => {
                let params = await getDeployParams();
                params.tokenPurchaseMinimum = params.tokenCapOfPublicSale.add(toBN(1));
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Purchase minimum exceeds cap");
            });

            it("fails if token purchase minimum exceeds private sale cap", async () => {
                let params = await getDeployParams();
                params.tokenPurchaseMinimum = params.tokenCapOfPrivateSale.add(toBN(1));
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Purchase minimum exceeds cap");
            });

            it("fails if token price is zero", async () => {
                let params = await getDeployParams({tokenPrice: toBN(0)});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Token price is zero");
            });

            it("fails if opening time is in the past", async () => {
                let params = await getDeployParams({openingTime: time.now() - time.mins(1)});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Opening lies in the past");
            });

            it("fails if closing time is before opening time", async () => {
                let params = await getDeployParams();
                params.closingTime = params.openingTime - time.secs(1);
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Closing lies before opening");
            });

            it("fails if company wallet address is zero", async () => {
                let params = await getDeployParams({companyWallet: ZERO_ADDRESS});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Company wallet is zero");
            });

            it("fails if reserve account address is zero", async () => {
                let params = await getDeployParams({reserveAccount: ZERO_ADDRESS});
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Reserve account is zero");
            });

            it("fails if purchase limit makes it impossible to buy tokens", async () => {
                let params = await getDeployParams();
                params.tokenPurchaseLimit = params.tokenPurchaseMinimum.sub(toBN(1));
                let reason = await reject.deploy(deploySale(params));
                expect(reason).to.equal("Purchase limit is below minimum");
            });

            it("fails if sum of token caps and reserve overflows", async () => {
                let params = await getDeployParams({
                    tokenCapOfPublicSale: toBN(2).pow(toBN(254)),
                    tokenCapOfPrivateSale: toBN(2).pow(toBN(254)),
                    tokenReservePerMill: toBN(2),
                });
                await reject.deploy(deploySale(params));
            });
        });

        describe("with valid parameters", () => {
            let params;
            let sale;

            it("succeeds", async () => {
                params = await getDeployParams();
                sale = await deploySale(params);
                expect(await web3.eth.getCode(sale.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await sale.owner()).to.equal(owner);
            });

            it("sets correct rate source address", async () => {
                expect(await sale.rateSource()).to.equal(params.rateSource);
            });

            it("sets correct token address", async () => {
                expect(await sale.token()).to.equal(params.token);
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

            it("sets correct token purchase minimum", async () => {
                expect(await sale.tokenPurchaseMinimum())
                    .to.be.bignumber.equal(params.tokenPurchaseMinimum);
            });

            it("sets correct token purchase limit", async () => {
                expect(await sale.tokenPurchaseLimit())
                    .to.be.bignumber.equal(params.tokenPurchaseLimit);
            });

            it("sets correct token reserve per mill", async () => {
                expect(await sale.tokenReservePerMill())
                    .to.be.bignumber.equal(params.tokenReservePerMill);
            });

            it("sets correct token price", async () => {
                expect(await sale.tokenPrice()).to.be.bignumber.equal(params.tokenPrice);
            })

            it("sets correct opening time", async () => {
                expect(await sale.openingTime()).to.be.bignumber.equal(params.openingTime);
            });

            it("sets correct closing time", async () => {
                expect(await sale.closingTime()).to.be.bignumber.equal(params.closingTime);
            });

            it("sets correct limit end time", async () => {
                expect(await sale.limitEndTime()).to.be.bignumber.equal(params.limitEndTime);
            });

            it("sets correct company wallet address", async () => {
                expect(await sale.companyWallet()).to.equal(params.companyWallet);
            });

            it("sets correct reserve account address", async () => {
                expect(await sale.reserveAccount()).to.equal(params.reserveAccount);
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
                    .to.be.bignumber.least(toBN(params.closingTime - params.openingTime));
            });

            it("succeeds if purchase limit < minimum, but limit is never applied", async () => {
                params.tokenPurchaseLimit = params.tokenPurchaseMinimum.div(toBN(3));
                params.limitEndTime = params.openingTime;
                await deploySale(params);
            });
        });
    });

    context("before sale opening", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy and save state", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            startState = await EVM.snapshot();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("sale state", () => {

            it("remaining time is at least as long as sale period", async () => {
                let openingTime = await sale.openingTime();
                let closingTime = await sale.closingTime();
                expect(await sale.timeRemaining()).to.be.bignumber.least(closingTime.sub(openingTime));
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

        describe("change of closing time", async () => {

            it("by anyone but owner is forbidden", async () => {
                let closingTime = (await sale.closingTime()).add(toBN(time.mins(1)));
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: anyone}));
                expect(reason).to.equal("Restricted to owner");
            });

            it("to past is forbidden", async () => {
                let closingTime = time.now();
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("ClosingTime not in the future");
            });

            it("to lie before opening is forbidden", async () => {
                let closingTime = await sale.openingTime();
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("New offering is zero");
            });

            it("to be longer than max offering period is forbidden", async () => {
                let closingTime = (await sale.openingTime()).add(toBN(MAX_OFFERING_PERIOD))
                                                            .add(toBN(time.secs(1)));
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("New offering too long");
            });

            it("is possible", async () => {
                let closingTime = (await sale.openingTime()).add(toBN(MAX_OFFERING_PERIOD));
                await sale.changeClosingTime(closingTime, {from: owner});
                expect(await sale.closingTime()).to.be.bignumber.equal(closingTime);
            });

            it("gets logged", async () => {
                let oldClosingTime = await sale.closingTime();
                let newClosingTime = (await sale.openingTime()).add(toBN(time.secs(1)));
                let tx = await sale.changeClosingTime(newClosingTime, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ClosingTimeChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldClosingTime);
                expect(entry.args.current).to.be.bignumber.equal(newClosingTime);
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
                    expect(reason).to.equal("Restricted to owner");
                });

                it(`via ${fns.name} of more than remaining tokens is forbidden`, async () => {
                    let reason = await reject.call(
                        sale[fns.distributeTokens]([investor1, investor2],
                                                   [await sale[fns.tokenRemaining](), 1],
                                                   {from: owner}));
                    expect(reason).to.equal("Not enough tokens available");
                });

                it(`via ${fns.name} with #accounts < #amounts is forbidden`, async () => {
                    let reason = await reject.call(
                        sale[fns.distributeTokens]([investor1, investor2], [1, 2, 3], {from: owner}));
                    expect(reason).to.equal("Lengths are different");
                });

                it(`via ${fns.name} with #accounts > #amounts is forbidden`, async () => {
                    let reason = await reject.call(
                        sale[fns.distributeTokens]([investor1, investor2], [1], {from: owner}));
                    expect(reason).to.equal("Lengths are different");
                });

                it(`via ${fns.name} is possible`, async () => {
                    let amount1 = (await sale[fns.tokenRemaining]()).div(toBN(3));
                    let amount2 = amount1.div(toBN(3));
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                });

                it(`via ${fns.name} gets logged`, async () => {
                    let amount = (await sale[fns.tokenRemaining]()).div(toBN(3));
                    let tx = await sale[fns.distributeTokens]([investor1],
                                                              [amount],
                                                              {from: owner});
                    let entry = tx.logs.find(entry => entry.event === "TokenDistribution");
                    expect(entry).to.exist;
                    expect(entry.args.beneficiary).to.equal(investor1);
                    expect(entry.args.amount).to.be.bignumber.equal(amount);
                });

                it(`via ${fns.name} increases recipients' balance`, async () => {
                    let balance1 = await token.balanceOf(investor1);
                    let balance2 = await token.balanceOf(investor2);
                    let amount1 = (await sale[fns.tokenRemaining]()).div(toBN(3));
                    let amount2 = amount1.div(toBN(3));
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                    expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance1.add(amount1));
                    expect(await token.balanceOf(investor2)).to.be.bignumber.equal(balance2.add(amount2));
                });

                it(`via ${fns.name} increases token total supply`, async () => {
                    let supply = await token.totalSupply();
                    let amount1 = (await sale[fns.tokenRemaining]()).div(toBN(3));
                    let amount2 = amount1.div(toBN(3));
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                    expect(await token.totalSupply())
                        .to.be.bignumber.equal(supply.add(amount1).add(amount2));
                });

                it(`via ${fns.name} decreases remaining tokens`, async () => {
                    let remaining = await sale[fns.tokenRemaining]();
                    let amount1 = remaining.div(toBN(2));
                    let amount2 = remaining.div(toBN(3));
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                    expect(await sale[fns.tokenRemaining]())
                        .to.be.bignumber.equal(remaining.sub(amount1).sub(amount2));
                });

                it(`via ${fns.name} increases sold tokens`, async () => {
                    let sold = await sale.tokenSold();
                    let amount1 = 1500;
                    let amount2 = 2500;
                    await sale[fns.distributeTokens]([investor1, investor2],
                                                     [amount1, amount2],
                                                     {from: owner});
                    expect(await sale.tokenSold())
                        .to.be.bignumber.equal(sold.add(toBN(amount1)).add(toBN(amount2)));
                });

                it(`via ${fns.name} may reach goal`, async () => {
                    let amount = (await sale.tokenGoal()).sub(await sale.tokenSold());
                    await sale[fns.distributeTokens]([investor1], [amount], {from: owner});
                    expect(await sale.goalReached()).to.be.true;
                });
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: ether(1)}));
                expect(reason).to.equal("Sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.equal("Sale has not been finalized");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.equal("Sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: owner}));
                expect(reason).to.equal("Sale has not closed");
            });
        });
    });

    context("while sale is open", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.limitEndTime());
            startState = await EVM.snapshot();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("sale state", () => {

            it("has a non-zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.above(toBN(0));
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

        describe("change of closing time", async () => {

            it("by anyone but owner is forbidden", async () => {
                let closingTime = (await sale.closingTime()).add(toBN(time.mins(1)));
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: anyone}));
                expect(reason).to.equal("Restricted to owner");
            });

            it("to past is forbidden", async () => {
                let closingTime = time.now();
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("ClosingTime not in the future");
            });

            it("to be longer than max offering period is forbidden", async () => {
                let closingTime = (await sale.openingTime()).add(toBN(MAX_OFFERING_PERIOD))
                                                            .add(toBN(time.secs(1)));
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("New offering too long");
            });

            it("is possible", async () => {
                let closingTime = (await sale.openingTime()).add(toBN(MAX_OFFERING_PERIOD));
                await sale.changeClosingTime(closingTime, {from: owner});
                expect(await sale.closingTime()).to.be.bignumber.equal(closingTime);
            });

            it("gets logged", async () => {
                let oldClosingTime = await sale.closingTime();
                let newClosingTime = oldClosingTime.add(toBN(time.secs(1)));
                let tx = await sale.changeClosingTime(newClosingTime, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ClosingTimeChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldClosingTime);
                expect(entry.args.current).to.be.bignumber.equal(newClosingTime);
            });
        });

        describe("token distribution", () => {

            it("via public sale is possible", async () => {
                await sale.distributeTokensViaPublicSale([investor1], [1], {from: owner});
            });

            it("via private sale is possible", async () => {
                await sale.distributeTokensViaPrivateSale([investor1], [1], {from: owner});
            });

            it("via public sale forwards funds if goal was reached", async () => {
                let goal = await sale.tokenGoal();
                await sale.buyTokens({from: investor1, value: ether(1)});
                expect(toBN(await web3.eth.getBalance(sale.address))).to.be.not.bignumber.zero;
                await sale.distributeTokensViaPublicSale([investor1], [goal]);
                expect(toBN(await web3.eth.getBalance(sale.address))).to.be.bignumber.zero;
            });

            it("via private sale forwards funds if goal was reached", async () => {
                let goal = await sale.tokenGoal();
                await sale.buyTokens({from: investor1, value: ether(1)});
                expect(toBN(await web3.eth.getBalance(sale.address))).to.be.not.bignumber.zero;
                await sale.distributeTokensViaPrivateSale([investor1], [goal]);
                expect(toBN(await web3.eth.getBalance(sale.address))).to.be.bignumber.zero;
            });
        });

        describe("token purchase", () => {

            it("by non-whitelisted is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: anyone, value: ether(1)}));
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("below purchase minimum is forbidden", async () => {
                let minimum = await sale.tokenPurchaseMinimum();
                let value = (await tokenValueOf(sale, minimum)).sub(toBN(1));
                let reason = await reject.call(sale.buyTokens({from: investor1, value}));
                expect(reason).to.equal("Investment is too low");
            });

            it("is possible", async () => {
                let balance = await token.balanceOf(investor1);
                await sale.buyTokens({from: investor1, value: ether(1)});
                expect(await token.balanceOf(investor1)).to.be.bignumber.above(balance);
            });

            it("gets logged", async () => {
                let value = ether(2);
                let amount = await tokenAmountOf(sale, value);
                let tx = await sale.buyTokens({from: investor1, value});
                let entry = tx.logs.find(entry => entry.event === "TokenPurchase");
                expect(entry).to.exist;
                expect(entry.args.buyer).to.equal(investor1);
                expect(entry.args.value).to.be.bignumber.equal(value);
                expect(entry.args.amount).to.be.bignumber.equal(amount);
            });

            it("via fallback function is possible", async () => {
                let balance = await token.balanceOf(investor1);
                let options = {from: investor1, to: sale.address, value: ether(1)};
                options.gas = 2 * await web3.eth.estimateGas(options);
                await web3.eth.sendTransaction(options);
                expect(await token.balanceOf(investor1)).to.be.bignumber.above(balance);
            });

            it("via fallback function with data is forbidden", async () => {
                let reason = await reject.tx({
                    from: investor1,
                    to: sale.address,
                    value: ether(1),
                    data: "0x01",
                });
                expect(reason).to.equal("Fallback call with data");
            });

            it("increases investor's balance", async () => {
                let balance = await token.balanceOf(investor1);
                let value = ether(2);
                let amount = await tokenAmountOf(sale, value);
                await sale.buyTokens({from: investor1, value});
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance.add(amount));
            });

            it("decreases investor's wei balance", async () => {
                let asset = await web3.eth.getBalance(investor1);
                let value = ether(2);
                await sale.buyTokens({from: investor1, value});
                expect(toBN(await web3.eth.getBalance(investor1))).to.be.bignumber.most(asset.sub(value));
            });

            it("increases token total supply", async () => {
                let supply = await token.totalSupply();
                let value = ether(2);
                let amount = await tokenAmountOf(sale, value);
                await sale.buyTokens({from: investor1, value});
                expect(await token.totalSupply()).to.be.bignumber.equal(supply.add(amount));
            });

            it("decreases remaining tokens for public sale", async () => {
                let remaining = await sale.tokenRemainingForPublicSale();
                let value = ether(2);
                let amount = await tokenAmountOf(sale, value);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.tokenRemainingForPublicSale())
                    .to.be.bignumber.equal(remaining.sub(amount));
            });

            it("increases tokens sold", async () => {
                let sold = await sale.tokenSold();
                let value = ether(2);
                let amount = await tokenAmountOf(sale, value);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.tokenSold()).to.be.bignumber.equal(sold.add(amount));
            });

            it("exceeding remaining tokens for public sale is forbidden", async () => {
                let remaining = await sale.tokenRemainingForPublicSale();
                let value = (await tokenValueOf(sale, remaining)).add(await valueOf1(sale));
                let reason = await reject.call(sale.buyTokens({from: investor1, value}));
                expect(reason).to.equal("Not enough tokens available");
            });

            it("is stored if goal wasn't reached", async () => {
                let amount = (await sale.tokenGoal()).sub(await sale.tokenSold());
                let value = (await tokenValueOf(sale, amount)).div(toBN(3));
                await sale.buyTokens({from: investor1, value});
                expect(await sale.investments(investor1)).to.be.bignumber.equal(value);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.investments(investor1)).to.be.bignumber.equal(value.mul(toBN(2)));
            });

            it("is not forwarded if goal wasn't reached", async () => {
                let asset = toBN(await web3.eth.getBalance(companyWallet));
                let amount = (await sale.tokenGoal()).sub(await sale.tokenSold());
                let value = (await tokenValueOf(sale, amount)).sub(toBN(1));
                await sale.buyTokens({from: investor1, value});
                expect(toBN(await web3.eth.getBalance(companyWallet))).to.be.bignumber.equal(asset);
            });

            it("may reach goal eventually", async () => {
                let amount = (await sale.tokenGoal()).sub(await sale.tokenSold());
                let value = (await tokenValueOf(sale, amount)).add(await valueOf1(sale));
                await sale.buyTokens({from: investor1, value});
                expect(await sale.goalReached()).to.be.true;
            });

            it("is forwarded if goal was reached", async () => {
                let amount = (await sale.tokenGoal()).sub(await sale.tokenSold());
                let value = (await tokenValueOf(sale, amount)).add(await valueOf1(sale));
                await sale.buyTokens({from: investor1, value});
                let asset = toBN(await web3.eth.getBalance(companyWallet));
                let investment = ether(2);
                await sale.buyTokens({from: investor1, value: investment});
                expect(toBN(await web3.eth.getBalance(companyWallet)))
                    .to.be.bignumber.equal(asset.add(investment));
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let amount = (await sale.tokenGoal()).sub(await sale.tokenSold());
                let value = (await tokenValueOf(sale, amount)).div(toBN(3));
                await sale.buyTokens({from: investor1, value});
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.equal("Sale has not been finalized");

            });

            it("distribution is forbidden", async () => {
                let amount = (await sale.tokenGoal()).sub(await sale.tokenSold());
                let value = (await tokenValueOf(sale, amount)).div(toBN(3));
                await sale.buyTokens({from: investor1, value});
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.equal("Sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: owner}));
                expect(reason).to.equal("Sale has not closed");
            })
        });
    });

    context("while sale is open (edge case: purchases are limited)", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.openingTime());
            startState = await EVM.snapshot();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("token purchase", () => {

            it("up to limit is possible", async () => {
                let value = await tokenValueOf(sale, await sale.tokenPurchaseLimit());
                await sale.buyTokens({from: investor1, value});
            });

            it("beyond limit is forbidden", async () => {
                let maxValue = await tokenValueOf(sale, await sale.tokenPurchaseLimit());
                let value = maxValue.add(await valueOf1(sale));
                let reason = await reject.call(sale.buyTokens({from: investor1, value}));
                expect(reason).to.equal("Purchase limit reached");
            });

            it("increases investor's purchased amount", async () => {
                let purchased = await sale.tokenPurchased(investor1);
                let value = ether(2);
                let amount = await tokenAmountOf(sale, value);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.tokenPurchased(investor1)).to.be.bignumber.equal(purchased.add(amount));
            });
        });
    });

    context("while sale is open (edge case: invalid rate source)", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            let params = await getDeployParams({etherRate: 0});
            sale = await deploySale(params);
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.openingTime());
            startState = await EVM.snapshot();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("token purchase", () => {

            it("is forbidden if rate source delivers zero rate", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: ether(1)}));
                expect(reason).to.equal("Ether rate is zero");
            });
        });
    });

    context("after sale (goal missed)", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.limitEndTime());
            let value = (await tokenValueOf(sale, await sale.tokenGoal())).div(toBN(2));
            await sale.buyTokens({from: investor1, value});
            await sale.buyTokens({from: investor2, value: value.sub(await valueOf1(sale))});
            await time.increaseTo(await sale.closingTime());
            startState = await EVM.snapshot();
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

        describe("change of closing time", async () => {

            it("is forbidden", async () => {
                let closingTime = time.now() + time.mins(1);
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("Sale has already ended");
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
                let reason = await reject.call(sale.buyTokens({from: investor1, value: ether(1)}));
                expect(reason).to.equal("Sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.equal("Sale has not been finalized");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.equal("Sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: anyone}));
                expect(reason).to.equal("Restricted to owner");
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

    context("after sale (goal reached)", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.limitEndTime());
            let value = (await tokenValueOf(sale, await sale.tokenGoal())).div(toBN(2));
            await sale.buyTokens({from: investor1, value});
            await sale.buyTokens({from: investor2, value: value.add(await valueOf1(sale))});
            await time.increaseTo(await sale.closingTime());
            startState = await EVM.snapshot();
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

            it("has zero balance", async () => {
                expect(await web3.eth.getBalance(sale.address)).to.be.zero;
            });
        });

        describe("change of closing time", async () => {

            it("is forbidden", async () => {
                let closingTime = time.now() + time.mins(1);
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("Sale has already ended");
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
                let reason = await reject.call(sale.buyTokens({from: investor1, value: ether(1)}));
                expect(reason).to.equal("Sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.equal("Sale has not been finalized");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.equal("Sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: anyone}));
                expect(reason).to.equal("Restricted to owner");
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

            it("mints the correct amount of reserve tokens", async () => {
                let account = await sale.reserveAccount();
                let balance = await token.balanceOf(account);
                let sold = await sale.tokenSold();
                let perMill = await sale.tokenReservePerMill();
                await sale.finalize({from: owner});
                expect(await token.balanceOf(account)).to.be.bignumber.equal(
                    balance.add(sold.mul(perMill).div(toBN(1000))));
            });
        });
    });

    context("after sale (edge case: token reserve is zero)", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            let params = await getDeployParams({tokenReservePerMill: 0});
            sale = await deploySale(params);
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.limitEndTime());
            let value = (await tokenValueOf(sale, await sale.tokenGoal()));
            await sale.buyTokens({from: investor1, value});
            await time.increaseTo(await sale.closingTime());
            startState = await EVM.snapshot();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        describe("finalization", () => {

            it("doesn't mint reserve tokens", async () => {
                let account = await sale.reserveAccount();
                let balance = await token.balanceOf(account);
                await sale.finalize({from: owner});
                expect(await token.balanceOf(account)).to.be.bignumber.equal(balance);
            });

        });
    });

    context("after sale (reached due to sellout)", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.limitEndTime());
            let value = (await tokenValueOf(sale, await sale.tokenGoal())).div(toBN(2));
            await sale.buyTokens({from: investor1, value});
            let remaining = await sale.tokenRemainingForPublicSale();
            await sale.buyTokens({from: investor2, value: await tokenValueOf(sale,remaining)});
            startState = await EVM.snapshot();
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

            it("has zero balance", async () => {
                expect(await web3.eth.getBalance(sale.address)).to.be.zero;
            });
        });

        describe("change of closing time", async () => {

            it("is forbidden", async () => {
                let closingTime = time.now() + time.mins(1);
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("Sale has already ended");
            });
        });

        describe("token distribution", () => {

            it("via public sale is not possible", async () => {
                let reason = await reject.call(sale.distributeTokensViaPublicSale([investor1], [1], {from: owner}));
                expect(reason).to.equal("Not enough tokens available");
            });

            it("via private sale is possible", async () => {
                await sale.distributeTokensViaPrivateSale([investor1], [1], {from: owner});
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: ether(1)}));
                expect(reason).to.equal("Sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.equal("Sale has not been finalized");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.equal("Sale has not been finalized");
            });
        });

        describe("finalization", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: anyone}));
                expect(reason).to.equal("Restricted to owner");
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

            it("mints the correct amount of reserve tokens", async () => {
                let account = await sale.reserveAccount();
                let balance = await token.balanceOf(account);
                let sold = await sale.tokenSold();
                let perMill = await sale.tokenReservePerMill();
                await sale.finalize({from: owner});
                expect(await token.balanceOf(account)).to.be.bignumber.equal(
                    balance.add(sold.mul(perMill).div(toBN(1000))));
            });
        });
    });

    context("after finalization (goal missed)", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.limitEndTime());
            let value = (await tokenValueOf(sale, await sale.tokenGoal())).div(toBN(2));
            await sale.buyTokens({from: investor1, value});
            await sale.buyTokens({from: investor2, value: value.sub(await valueOf1(sale))});
            await time.increaseTo(await sale.closingTime());
            await sale.finalize({from: owner});
            startState = await EVM.snapshot();
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

        describe("change of closing time", async () => {

            it("is forbidden", async () => {
                let closingTime = time.now() + time.mins(1);
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("Sale has already ended");
            });
        });

        describe("token distribution", () => {

            it("via public sale is forbidden", async () => {
                let reason = await reject.call(sale.distributeTokensViaPublicSale([investor1],
                                                                                  [1],
                                                                                  {from: owner}));
                expect(reason).to.equal("Sale has been finalized");
            });

            it("via private sale is forbidden", async () => {
                let reason = await reject.call(sale.distributeTokensViaPrivateSale([investor1],
                                                                                   [1],
                                                                                   {from: owner}));
                expect(reason).to.equal("Sale has been finalized");
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: ether(1)}));
                expect(reason).to.equal("Sale is not open");
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
                expect(entry.args.investor).to.equal(investor1);
                expect(entry.args.value).to.be.bignumber.equal(investment);
            });

            it("claiming sets investment to zero", async () => {
                await sale.claimRefund({from: investor1});
                expect(await sale.investments(investor1)).to.be.bignumber.zero;
            });

            it("claiming increases investor's balance", async () => {
                let asset = toBN(await web3.eth.getBalance(investor1));
                let investment = await sale.investments(investor1);
                let txCostEst = toWei(toBN(10), "finney");
                await sale.claimRefund({from: investor1});
                expect(toBN(await web3.eth.getBalance(investor1)))
                    .to.be.bignumber.above(asset.add(investment).sub(txCostEst));
            });

            it("distribution is possible", async () => {
                await sale.distributeRefunds([investor1, investor2, anyone], {from: anyone});
            });

            it("distribution gets logged", async () => {
                let investment = await sale.investments(investor1);
                let tx = await sale.distributeRefunds([investor1], {from: anyone});
                let entry = tx.logs.find(entry => entry.event === "InvestorRefund");
                expect(entry).to.exist;
                expect(entry.args.investor).to.equal(investor1);
                expect(entry.args.value).to.be.bignumber.equal(investment);
            });

            it("distribution sets investment to zero", async () => {
                await sale.distributeRefunds([investor1], {from: anyone});
                expect(await sale.investments(investor1)).to.be.bignumber.zero;
            });

            it("distribution increases investor's balance", async () => {
                let asset = toBN(await web3.eth.getBalance(investor1));
                let investment = await sale.investments(investor1);
                await sale.distributeRefunds([investor1], {from: anyone});
                expect(toBN(await web3.eth.getBalance(investor1)))
                    .to.be.bignumber.equal(asset.add(investment));
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: owner}));
                expect(reason).to.equal("Sale has already been finalized");
            });
        });
    });

    context("after finalization (goal reached)", () => {
        let startState;
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo(await sale.limitEndTime());
            let value = (await tokenValueOf(sale, await sale.tokenGoal())).div(toBN(2));
            await sale.buyTokens({from: investor1, value});
            await sale.buyTokens({from: investor2, value: value.add(await valueOf1(sale))});
            await time.increaseTo(await sale.closingTime());
            await sale.finalize({from: owner});
            startState = await EVM.snapshot();
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

            it("has zero balance", async () => {
                expect(await web3.eth.getBalance(sale.address)).to.be.zero;
            });
        });

        describe("token contract", () => {

            it("total supply is fixed", async () => {
                expect(await token.totalSupplyIsFixed()).to.be.true;
            });
        });

        describe("change of closing time", async () => {

            it("is forbidden", async () => {
                let closingTime = time.now() + time.mins(1);
                let reason = await reject.call(sale.changeClosingTime(closingTime, {from: owner}));
                expect(reason).to.equal("Sale has already ended");
            });
        });

        describe("token distribution", () => {

            it("via public sale is forbidden", async () => {
                let reason = await reject.call(sale.distributeTokensViaPublicSale([investor1],
                                                                                  [1],
                                                                                  {from: owner}));
                expect(reason).to.equal("Sale has been finalized");
            });

            it("via private sale is forbidden", async () => {
                let reason = await reject.call(sale.distributeTokensViaPrivateSale([investor1],
                                                                                   [1],
                                                                                   {from: owner}));
                expect(reason).to.equal("Sale has been finalized");
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.buyTokens({from: investor1, value: ether(1)}));
                expect(reason).to.equal("Sale is not open");
            });
        });

        describe("investor refund", () => {

            it("claiming is forbidden", async () => {
                let reason = await reject.call(sale.claimRefund({from: investor1}));
                expect(reason).to.equal("Goal was reached");
            });

            it("distribution is forbidden", async () => {
                let reason = await reject.call(sale.distributeRefunds([investor1], {from: owner}));
                expect(reason).to.equal("Goal was reached");
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(sale.finalize({from: owner}));
                expect(reason).to.equal("Sale has already been finalized");
            });
        });
    });

    describe.skip("transaction costs", () => {
        const CL_CYAN = "\u001b[36m";
        const CL_GRAY = "\u001b[90m";
        const CL_DEFAULT = "\u001b[0m";

        let startState;
        let sale, token, whitelist;

        before("deploy and save state", async () => {
            await initialState.restore();
            sale = await deploySale(await getDeployParams());
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            startState = await EVM.snapshot();
        });

        afterEach("restore start state", async () => {
            await startState.restore();
        });

        [
            {
                name: "public sale",
                distributeTokens: "distributeTokensViaPublicSale",
            }, {
                name: "private sale",
                distributeTokens: "distributeTokensViaPrivateSale",
            }
        ].forEach(fns => {
            it(`of token distribution via ${fns.name} to many investors`, async () => {
                let maximum;
                let count = 0;
                let next = bisection.new(count);
                while (isFinite(count)) {
                    let investors = [];
                    let amounts = [];
                    for (let i = 0; i < count; ++i) {
                        let investor = randomAddress();
                        investors.push(investor);
                        amounts.push(i);
                    }
                    await whitelist.addToWhitelist(investors, {from: owner});
                    let message = `of token distribution via ${fns.name} to ${count} investors: `;
                    try {
                        let tx = await sale[fns.distributeTokens](investors, amounts, {from: owner});
                        maximum = count;
                        message += `${tx.receipt.gasUsed} gas`;
                        count = tx.receipt.gasUsed <= 8000000 ? next(true) : NaN;
                    }
                    catch (error) {
                        message += "failed";
                        count = next(false);
                    }
                    console.log(" ".repeat(6) + `${CL_CYAN}→ ${CL_GRAY}${message}${CL_DEFAULT}`);
                }
                expect(maximum).to.be.above(2);
            });
        });
    });
});

