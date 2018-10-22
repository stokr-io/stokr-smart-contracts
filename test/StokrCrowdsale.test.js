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

        // Set the cap so that a single investor can easily reach it
        let tokenCapOfPublicSale = money.ether(25).mul(etherRate).divToInt(tokenPrice);
        let tokenCapOfPrivateSale = tokenCapOfPublicSale.divToInt(2);
        let tokenReserve = tokenCapOfPublicSale.divToInt(10);

        return {
            tokenCapOfPublicSale,
            tokenCapOfPrivateSale,
            tokenGoal: 0,
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
                await reject.deploy(deploySale({token: 0x0}));
            });

            it("fails if another sale is already minting the token", async () => {
                let token = await (await deploySale()).token();
                await reject.deploy(deploySale({token: token.address}));
            });

            it("fails if token cap of public sale is zero", async () => {
                await reject.deploy(deploySale({tokenCapOfPublicSale: 0}));
            });

            it("fails if token cap of private sale is zero", async () => {
                await reject.deploy(deploySale({tokenCapOfPrivateSale: 0}));
            });

            it("fails if token goal is not reachable", async () => {
                let {tokenCapOfPublicSale, tokenCapOfPrivateSale} = defaultParams();
                let tokenGoal = tokenCapOfPublicSale.plus(tokenCapOfPrivateSale).plus(1);
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

            it("fails if reserve account address is zero", async () => {
                await reject.deploy(deploySale({reserveAccount: 0x0}));
            });

            it.skip("fails if sum of token pools overflows", async () => {
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
                params.token = (await StokrToken.new("",
                                                     "",
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
                expect(await sale.tokenCapOfPublicSale())
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

            it.skip("correctly calculates remaining sale time", async () => {
                let timeRemaining = params.closingTime - time.now();
                expect(await sale.timeRemaining()).to.be.bignumber.equal(timeRemaining);
            });
        });
    });

    context.only("before sale opening", () => {
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

            it("is not closed", async () => {
                expect(await sale.hasClosed()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("rate admin change", () => {

            it("is forbidden by anyone but owner", async () => {
                let admin = await sale.rateAdmin();
                await reject.tx(sale.setRateAdmin(random.address(), {from: anyone}));
                expect(await sale.rateAdmin()).to.be.bignumber.equal(admin);
            });

            it("to zero is forbidden", async () => {
                let admin = await sale.rateAdmin();
                await reject.tx(sale.setRateAdmin(0x0, {from: owner}));
                expect(await sale.rateAdmin()).to.be.bignumber.equal(admin);
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
                let rate = await sale.etherRate();
                await reject.tx(sale.setRate(rate.plus(1), {from: owner}));
                expect(await sale.etherRate()).to.be.bignumber.equal(rate);
            });

            it("by anyone but rate admin is forbidden", async () => {
                let rate = await sale.etherRate();
                await reject.tx(sale.setRate(rate.plus(1), {from: anyone}));
                expect(await sale.etherRate()).to.be.bignumber.equal(rate);
            });

            it("to zero is forbidden", async () => {
                let rate = await sale.etherRate();
                await reject.tx(sale.setRate(0, {from: rateAdmin}));
                expect(await sale.etherRate()).to.be.bignumber.equal(rate);
            });

            it("lowering by an order of magnitude is forbidden", async () => {
                let rate = await sale.etherRate();
                await reject.tx(sale.setRate(rate.divToInt(10), {from: rateAdmin}));
                expect(await sale.etherRate()).to.be.bignumber.equal(rate);
            });

            it("raising by an order of magnitude is forbidden", async () => {
                let rate = await sale.etherRate();
                await reject.tx(sale.setRate(rate.times(10), {from: rateAdmin}));
                expect(await sale.etherRate()).to.be.bignumber.equal(rate);
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
                    distributeToken: "distributeTokensViaPublicSale"
                },
                {
                    name: "private sale",
                    tokenCap: "tokenCapOfPublicSale",
                    tokenRemaining: "tokenRemainingForPublicSale",
                    distributeToken: "distributeTokensViaPublicSale"
                },


            ["public sale", "private sale"].forEach(saleKind => {

                let saleFns = async sale =>
                    saleKind === "public sale"
                    ? {
                        tokenCap: sale.tokenCapOfPublicSale
                        tokenRemaining: sale.tokenRemainingForPublicSale
                        distributeTokens: sale.
                            : sale.tokenCapOfPrivateSale;

                let tokenRemainingFn =
                    sale => saleKind === "public sale"
                            ? sale.tokenRemainingForPublicSale
                            : sale.distributeTokensViaPublicSale;

                let distributeTokensFn =
                    sale => saleKind === "public sale"
                    tokenCap: sale.tokenCapOfPrivateSale,
                    tokenRemaining: sale.tokenRemainingForPrivateSale,
                    distributeTokens: sale.distributeTokensViaPrivateSale,
                }

            ].forEach(saleKind => {

                it(`via ${saleKind.name} by anyone is forbidden`, async () => {
                    let supply = await token.totalSupply();
                    await reject.tx(saleKind.distributeTokens([investor1], [1], {from: anyone}));
                    expect(await token.totalSupply()).to.be.bignumber.equal(supply);
                });

                it(`via ${saleKind.name} of more than remaining tokens is forbidden`, async () => {
                    let supply = await token.totalSupply();
                    await reject.tx(saleKind.distributeTokens([investor1, investor2],
                                                              [await saleKind.tokenRemaining(), 1],
                                                              {from: owner}));
                    expect(await token.totalSupply()).to.be.bignumber.equal(supply);
                });

                it(`via ${saleKind.name} with #accounts < #amounts is forbidden`, async () => {
                    let supply = await token.totalSupply();
                    await reject.tx(saleKind.distributeTokens([investor1, investor2],
                                                              [1, 2, 3],
                                                              {from: owner}));
                    expect(await token.totalSupply()).to.be.bignumber.equal(supply);
                });

                it(`via ${saleKind.name} with #accounts > amounts is forbidden`, async () => {
                    let supply = await token.totalSupply();
                    await reject.tx(saleKind.distributeTokens([investor1, investor2],
                                                              [1],
                                                              {from: owner}));
                    expect(await token.totalSupply()).to.be.bignumber.equal(supply);
                });

                it(`via ${saleKind.name} is possible`, async () => {
                    let amount1 = (await saleKind.tokenRemaining()).divToInt(3);
                    let amount2 = amount1.divToInt(3);
                    await saleKind.distributeTokens([investor1, investor2],
                                                    [amount1, amount2],
                                                    {from: owner});
                });

                it(`via ${saleKind.name} gets logged`, async () => {
                    let amount = (await saleKind.tokenRemaining()).divToInt(3);
                    let tx = await saleKind.distributeTokens([investor1],
                                                             [amount],
                                                             {from: owner});
                    let entry = tx.logs.find(entry => entry.event === "TokenDistribution");
                    expect(entry).to.exist;
                    expect(entry.args.beneficiary).to.be.bignumber.equal(investor1);
                    expect(entry.args.amount).to.be.bignumber.equal(amount);
                });

                it(`via ${saleKind.name} increases recipients' balance`, async () => {
                    let balance1 = await token.balanceOf(investor1);
                    let balance2 = await token.balanceOf(investor2);
                    let amount1 = (await saleKind.tokenRemaining()).divToInt(3);
                    let amount2 = amount1.divToInt(3);
                    await saleKind.distributeTokens([investor1, investor2],
                                                    [amount1, amount2],
                                                    {from: owner});
                    expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance1.plus(amount1));
                    expect(await token.balanceOf(investor2)).to.be.bignumber.equal(balance2.plus(amount2));
                });

                it(`via ${saleKind.name} increases token total supply`, async () => {
                    let supply = await token.totalSupply();
                    let amount1 = (await saleKind.tokenRemaining()).divToInt(3);
                    let amount2 = amount1.divToInt(3);
                    await saleKind.distributeTokens([investor1, investor2],
                                                    [amount1, amount2],
                                                    {from: owner});
                    expect(await token.totalSupply())
                        .to.be.bignumber.equal(supply.plus(amount1).plus(amount2));
                });

                it(`via ${saleKind.name} decreases remaining tokens`, async () => {
                    let remaining = await saleKind.tokenRemaining();
                    let amount1 = remaining.divToInt(2);
                    let amount2 = remaining.divToInt(3);
                    await saleKind.distributeTokens([investor1, investor2],
                                                    [amount1, amount2],
                                                    {from: owner});
                    expect(await saleKind.tokenRemaining())
                        .to.be.bignumber.equal(remaining.minus(amount1).minus(amount2));
                });

                it.skip(`via ${saleKind.name} to many recipients at once is possible`, async () => {
                    await logGas(saleKind.distributeTokens([], [], {from: owner}), "no investors");
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
                            await logGas(saleKind.distributeTokens(investors, amounts, {from: owner}),
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
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens({from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
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

            it("is not closed", async () => {
                expect(await sale.hasClosed()).to.be.false;
            });

            it("is not finalized", async () => {
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

        describe("token dsitribution", () => {

            it("is possible", async () => {
                await sale.distributeTokens([investor1], [1], {from: owner});
            });
        });

        describe("token purchase", () => {

            it("by non-whitelisted is forbidden", async () => {
                let balance = await token.balanceOf(anyone);
                await reject.tx(sale.buyTokens({from: anyone, value: money.ether(1)}));
                expect(await token.balanceOf(anyone)).to.be.bignumber.equal(balance);
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
                await web3.eth.sendTransaction({from: investor1, to: sale.address, value: money.ether(1)});
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

            it("decreases remaining tokens", async () => {
                let remaining = await sale.tokenRemaining();
                let value = money.ether(2);
                let amount = value.times(await sale.etherRate()).divToInt(await sale.tokenPrice());
                await sale.buyTokens({from: investor1, value});
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(remaining.minus(amount));
            });

            it("exceeding remaining is forbidden", async () => {
                let remaining = await sale.tokenRemaining();
                let price = await sale.tokenPrice();
                let rate = await sale.etherRate();
                let value = remaining.mul(price).divToInt(rate).plus(rate.divToInt(price));
                await reject.tx(sale.buyTokens({from: investor1, value}));
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(remaining);
            });

            it("is stored if goal wasn't reached", async () => {
                let value = (await sale.tokenGoal()).minus(await sale.tokenSold())
                                                    .times(await sale.tokenPrice())
                                                    .divToInt(await sale.etherRate())
                                                    .divToInt(3);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.investments(investor1)).to.be.bignumber.equal(value);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.investments(investor1)).to.be.bignumber.equal(value.times(2));
            });

            it("is not forwarded if goal wasn't reached", async () => {
                let weiBalance = web3.eth.getBalance(companyWallet);
                let value = (await sale.tokenGoal()).minus(await sale.tokenSold())
                                                    .times(await sale.tokenPrice())
                                                    .divToInt(await sale.etherRate())
                                                    .minus(money.wei(1));
                await sale.buyTokens({from: investor1, value});
                expect(await web3.eth.getBalance(companyWallet)).to.be.bignumber.equal(weiBalance);
            });

            it("is stored if goal wasn't reached", async () => {
                let value = (await sale.tokenGoal()).minus(await sale.tokenSold())
                                                    .times(await sale.tokenPrice())
                                                    .divToInt(await sale.etherRate());
                await sale.buyTokens({from: investor1, value});
                expect(await sale.investments(investor1)).to.be.bignumber.equal(value);
                await sale.buyTokens({from: investor1, value});
                expect(await sale.investments(investor1)).to.be.bignumber.equal(value.times(2));
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            })
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

        describe("token distribution", () => {

            it("is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(sale.distributeTokens([investor1], [1], {from: owner}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
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

