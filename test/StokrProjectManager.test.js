"use strict";

const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");
const StokrTokenFactory = artifacts.require("./token/StokrTokenFactory.sol");
const StokrCrowdsale = artifacts.require("./crowdsale/StokrCrowdsale.sol");
const StokrCrowdsaleFactory = artifacts.require("./crowdsale/StokrCrowdsaleFactory.sol");
const StokrProjectManager = artifacts.require("./StokrProjectManager.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject, snapshot} = require("./helpers/common");


contract("StokrProjectManager", ([owner,
                                  tokenOwner,
                                  crowdsaleOwner,
                                  profitDepositor,
                                  keyRecoverer,
                                  rateAdmin,
                                  companyWallet,
                                  reserveAccount,
                                  anyone]) => {

    let tokenName = "STOKR Test Token";
    let tokenSymbol = "STT";

    let etherRate = new BN(16321);  // Realistic rate is something in [1e5..2e5]
    let tokenPrice = new BN(100);  // A token costs one Euro

    // Set the cap so that a single investor can easily reach it
    let tokensFor = value => value.mul(etherRate).divToInt(tokenPrice);

    let tokenCapOfPublicSale = tokensFor(money.ether(40));
    let tokenCapOfPrivateSale = tokensFor(money.ether(30));
    let tokenPurchaseMinimum = tokensFor(money.ether(1));
    let tokenGoal = tokensFor(money.ether(8));
    let tokenReservePerMill = new BN(200);

    let openingTime = time.now() + time.days(7);
    let closingTime = openingTime + time.days(7);

    let projectManager, whitelist, tokenFactory, crowdsaleFactory;


    describe("Deployment", () => {

        it("fails if initial ether rate is zero", async () => {
            let reason = await reject.deploy(StokrProjectManager.new(0x0, {from: owner}));
            expect(reason).to.be.equal("ether rate is zero");
        });

        it("succeeds", async () => {
            projectManager = await StokrProjectManager.new(etherRate, {from: owner});
            await projectManager.setRateAdmin(rateAdmin, {from: owner});
        });

        it("sets correct owner", async () => {
            expect(await projectManager.owner()).to.be.bignumber.equal(owner);
        });

        it("sets correct ether rate", async () => {
            expect(await projectManager.etherRate()).to.be.bignumber.equal(etherRate);
        });
    });

    describe("Rate admin change", () => {

        after("reset rate admin", async () => {
            await projectManager.setRateAdmin(rateAdmin, {from: owner});
        });

        it("is forbidden by anyone but owner", async () => {
            let reason = await reject.call(projectManager.setRateAdmin(random.address(), {from: anyone}));
            expect(reason).to.be.equal("restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(projectManager.setRateAdmin(0x0, {from: owner}));
            expect(reason).to.be.equal("new rate admin is zero");
        });

        it("is possible", async () => {
            let newAdmin = random.address();
            await projectManager.setRateAdmin(newAdmin, {from: owner});
            expect(await projectManager.rateAdmin()).to.be.bignumber.equal(newAdmin);
        });

        it("gets logged", async () => {
            let oldAdmin = await projectManager.rateAdmin();
            let newAdmin = random.address();
            let tx = await projectManager.setRateAdmin(newAdmin, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "RateAdminChange");
            expect(entry).to.exist;
            expect(entry.args.previous).to.be.bignumber.equal(oldAdmin);
            expect(entry.args.current).to.be.bignumber.equal(newAdmin);
        });

        it("doesn't get logged if value remains unchanged", async () => {
            let admin = await projectManager.rateAdmin();
            let tx = await projectManager.setRateAdmin(admin, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "RateAdminChange");
            expect(entry).to.not.exist;
        });
    });

    describe("Rate change", () => {

        after("reset rate", async () => {
            await projectManager.setRate(etherRate, {from: rateAdmin});
        });

        it("by owner not being rate admin is forbidden", async () => {
            let reason = await reject.call(projectManager.setRate((await projectManager.etherRate()).plus(1),
                                                                  {from: owner}));
            expect(reason).to.be.equal("restricted to rate admin");
        });

        it("by anyone but rate admin is forbidden", async () => {
            let reason = await reject.call(projectManager.setRate((await projectManager.etherRate()).plus(1),
                                                                  {from: anyone}));
            expect(reason).to.be.equal("restricted to rate admin");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(projectManager.setRate(0, {from: rateAdmin}));
            expect(reason).to.be.equal("rate change too big");
        });

        it("lowering by an order of magnitude is forbidden", async () => {
            let reason = await reject.call(projectManager.setRate((await projectManager.etherRate()).divToInt(10),
                                                                  {from: rateAdmin}));
            expect(reason).to.be.equal("rate change too big");
        });

        it("raising by an order of magnitude is forbidden", async () => {
            let reason = await reject.call(projectManager.setRate((await projectManager.etherRate()).times(10),
                                                                  {from: rateAdmin}));
            expect(reason).to.be.equal("rate change too big");
        });

        it("is possible", async () => {
            let newRate = (await projectManager.etherRate()).times(2).plus(1);
            await projectManager.setRate(newRate, {from: rateAdmin});
            expect(await projectManager.etherRate()).to.be.bignumber.equal(newRate);
        });

        it("gets logged", async () => {
            let oldRate = await projectManager.etherRate();
            let newRate = oldRate.times(2).plus(1);
            let tx = await projectManager.setRate(newRate, {from: rateAdmin});
            let entry = tx.logs.find(entry => entry.event === "RateChange");
            expect(entry).to.exist;
            expect(entry.args.previous).to.be.bignumber.equal(oldRate);
            expect(entry.args.current).to.be.bignumber.equal(newRate);
        });

        it("doesn't get logged if value remains unchanged", async () => {
            let rate = await projectManager.etherRate();
            let tx = await projectManager.setRate(rate, {from: rateAdmin});
            let entry = tx.logs.find(entry => entry.event === "RateChange");
            expect(entry).to.not.exist;
        });
    });

    describe("Whitelist change", () => {

        after("reset whitelist", async () => {
            whitelist = await Whitelist.new({from: owner});
            await projectManager.setWhitelist(whitelist.address, {from: owner});
        });

        it("by anyone but owner is forbidden", async () => {
            let whitelist = await Whitelist.new({from: owner});
            let reason = await reject.call(projectManager.setWhitelist(whitelist.address, {from: anyone}));
            expect(reason).to.be.equal("restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(projectManager.setWhitelist(0x0, {from: owner}));
            expect(reason).to.be.equal("whitelist is zero");
        });

        it("is possible", async () => {
            let whitelist = await Whitelist.new({from: owner});
            await projectManager.setWhitelist(whitelist.address, {from: owner});
            expect(await projectManager.currentWhitelist()).to.be.bignumber.equal(whitelist.address);
        });
    });

    describe("Token factory change", () => {

        after("reset token factory", async () => {
            tokenFactory = await StokrTokenFactory.new({from: owner});
            await projectManager.setTokenFactory(tokenFactory.address, {from: owner});
        });

        it("by anyone but owner is forbidden", async () => {
            let tokenFactory = await StokrTokenFactory.new({from: owner});
            let reason = await reject.call(projectManager.setTokenFactory(tokenFactory.address,
                                                                          {from: anyone}));
            expect(reason).to.be.equal("restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(projectManager.setTokenFactory(0x0, {from: owner}));
            expect(reason).to.be.equal("token factory is zero");
        });

        it("is possible", async () => {
            let tokenFactory = await StokrTokenFactory.new({from: owner});
            await projectManager.setTokenFactory(tokenFactory.address, {from: owner});
            expect(await projectManager.tokenFactory()).to.be.bignumber.equal(tokenFactory.address);
        });
    });

    describe("Crowdsale factory change", () => {

        after("reset crowdsale factory", async () => {
            crowdsaleFactory = await StokrCrowdsaleFactory.new({from: owner});
            await projectManager.setCrowdsaleFactory(crowdsaleFactory.address, {from: owner});
        });

        it("by anyone but owner is forbidden", async () => {
            let crowdsaleFactory = await StokrCrowdsaleFactory.new({from: owner});
            let reason = await reject.call(projectManager.setCrowdsaleFactory(crowdsaleFactory.address,
                                                                              {from: anyone}));
            expect(reason).to.be.equal("restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(projectManager.setCrowdsaleFactory(0x0, {from: owner}));
            expect(reason).to.be.equal("crowdsale factory is zero");
        });

        it("is possible", async () => {
            let crowdsaleFactory = await StokrCrowdsaleFactory.new({from: owner});
            await projectManager.setCrowdsaleFactory(crowdsaleFactory.address, {from: owner});
            expect(await projectManager.crowdsaleFactory()).to.be.bignumber.equal(crowdsaleFactory.address);
        });
    });

    describe("Project creation", () => {

        const createProject = from => projectManager.createNewProject(
            tokenName,
            tokenSymbol,
            tokenPrice,
            [profitDepositor, keyRecoverer, tokenOwner, crowdsaleOwner],
            [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal,
             tokenPurchaseMinimum, tokenReservePerMill],
            [openingTime, closingTime],
            [companyWallet, reserveAccount],
            {from});

        it("from anyone but owner is forbidden", async () => {
            let reason = await reject.call(createProject(anyone));
            expect(reason).to.be.equal("restricted to owner");
        });

        it("is possible", async () => {
            await createProject(owner);
        });

        it("gets logged", async () => {
            let index = await projectManager.projectsCount();
            let tx = await createProject(owner);
            let entry = tx.logs.find(entry => entry.event === "ProjectCreation");
            expect(entry).to.exist;
            expect(entry.args.index).to.be.bignumber.equal(index);
            expect(entry.args.whitelist).to.be.bignumber.equal(await projectManager.currentWhitelist());
        });

        it("increases the projects count", async () => {
            let projectsCount = await projectManager.projectsCount();
            await createProject(owner);
            expect(await projectManager.projectsCount()).to.be.bignumber.equal(projectsCount.plus(1));
        });

        it("sets correct project name", async () => {
            let index = await projectManager.projectsCount();
            await createProject(owner);
            let name = (await projectManager.projects(index))[0];
            expect(name).to.be.equal(tokenName);
        });

        it("deploys correct whitelist", async () => {
            let index = await projectManager.projectsCount();
            await createProject(owner);
            let address = (await projectManager.projects(index))[1];
            expect(await web3.eth.getCode(address)).to.be.not.oneOf(["0x", "0x0"]);
            expect(address).to.be.bignumber.equal(await projectManager.currentWhitelist());
        });

        it("deploys correct token", async () => {
            let index = await projectManager.projectsCount();
            await createProject(owner);
            let [address, crowdsaleAddress] = (await projectManager.projects(index)).slice(2);
            expect(await web3.eth.getCode(address)).to.be.not.oneOf(["0x", "0x0"]);
            let token = await StokrToken.at(address);
            expect(await token.name()).to.be.equal(tokenName);
            expect(await token.symbol()).to.be.equal(tokenSymbol);
            expect(await token.profitDepositor()).to.be.bignumber.equal(profitDepositor);
            expect(await token.keyRecoverer()).to.be.bignumber.equal(keyRecoverer);
            expect(await token.whitelist()).to.be.bignumber.equal(await projectManager.currentWhitelist());
            expect(await token.minter()).to.be.bignumber.equal(crowdsaleAddress);
            expect(await token.owner()).to.be.bignumber.equal(tokenOwner);
        });

        it("deploys correct crowdsale", async () => {
            let index = await projectManager.projectsCount();
            await createProject(owner);
            let [tokenAddress, address] = (await projectManager.projects(index)).slice(2);
            expect(await web3.eth.getCode(address)).to.be.not.oneOf(["0x", "0x0"]);
            let crowdsale = await StokrCrowdsale.at(address);
            expect(await crowdsale.rateSource()).to.be.bignumber.equal(projectManager.address);
            expect(await crowdsale.token()).to.be.bignumber.equal(tokenAddress);
            expect(await crowdsale.tokenPrice()).to.be.bignumber.equal(tokenPrice);
            expect(await crowdsale.tokenCapOfPublicSale()).to.be.bignumber.equal(tokenCapOfPublicSale);
            expect(await crowdsale.tokenCapOfPrivateSale()).to.be.bignumber.equal(tokenCapOfPrivateSale);
            expect(await crowdsale.tokenGoal()).to.be.bignumber.equal(tokenGoal);
            expect(await crowdsale.tokenPurchaseMinimum()).to.be.bignumber.equal(tokenPurchaseMinimum);
            expect(await crowdsale.tokenReservePerMill()).to.be.bignumber.equal(tokenReservePerMill);
            expect(await crowdsale.openingTime()).to.be.bignumber.equal(openingTime);
            expect(await crowdsale.closingTime()).to.be.bignumber.equal(closingTime);
            expect(await crowdsale.companyWallet()).to.be.bignumber.equal(companyWallet);
            expect(await crowdsale.reserveAccount()).to.be.bignumber.equal(reserveAccount);
            expect(await crowdsale.owner()).to.be.bignumber.equal(crowdsaleOwner);
        });
    });

});

