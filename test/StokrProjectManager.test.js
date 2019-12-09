"use strict";

const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");
const StokrTokenFactory = artifacts.require("./token/StokrTokenFactory.sol");
const StokrCrowdsale = artifacts.require("./crowdsale/StokrCrowdsale.sol");
const StokrCrowdsaleFactory = artifacts.require("./crowdsale/StokrCrowdsaleFactory.sol");
const StokrProjectManager = artifacts.require("./StokrProjectManager.sol");

const {toBN, toWei, toChecksumAddress, randomHex, padLeft} = web3.utils;
const {expect} = require("chai").use(require("chai-bn")(web3.utils.BN));
const {time, reject} = require("./helpers/_all");

const ZERO_ADDRESS = padLeft("0x0", 160 >> 2);
const randomAddress = () => toChecksumAddress(randomHex(160 >> 3));
const ether = n => toWei(toBN(n), "ether");


contract("StokrProjectManager", ([owner,
                                  profitDepositor,
                                  profitDistributor,
                                  tokenRecoverer,
                                  rateAdmin,
                                  companyWallet,
                                  reserveAccount,
                                  anyone]) => {

    let tokenName = "STOKR Test Token";
    let tokenSymbol = "STT";

    let etherRate = toBN(16321);  // Realistic rate is something in [1e5..2e5]
    let tokenPrice = toBN(100);   // A token costs one Euro

    // Set the cap so that a single investor can easily reach it
    let tokensFor = value => value.mul(etherRate).div(tokenPrice);

    let tokenCapOfPublicSale = tokensFor(ether(40));
    let tokenCapOfPrivateSale = tokensFor(ether(30));
    let tokenPurchaseMinimum = tokensFor(ether(1));
    let tokenPurchaseLimit = tokensFor(ether(1));
    let tokenGoal = tokensFor(ether(8));
    let tokenReservePerMill = toBN(200);

    let openingTime = time.now() + time.days(7);
    let closingTime = openingTime + time.days(7);
    let limitEndTime = openingTime + time.days(2);


    describe("Deployment", () => {
        let projectManager;

        it("fails if initial ether rate is zero", async () => {
            let reason = await reject.deploy(StokrProjectManager.new(0, {from: owner}));
            expect(reason).to.equal("Ether rate is zero");
        });

        it("fails if initial ether rate is too high", async () => {
            let rate = (toBN(2)).pow(toBN(256)).div(toBN(10));
            let reason = await reject.deploy(StokrProjectManager.new(rate, {from: owner}));
            expect(reason).to.equal("Ether rate reaches limit");
        });

        it("succeeds", async () => {
            projectManager = await StokrProjectManager.new(etherRate, {from: owner});
        });

        it("sets correct owner", async () => {
            expect(await projectManager.owner()).to.equal(owner);
        });

        it("sets correct ether rate", async () => {
            expect(await projectManager.etherRate()).to.be.bignumber.equal(etherRate);
        });
    });

    describe("Rate admin change", () => {
        let projectManager;

        before("deploy", async () => {
            projectManager = await StokrProjectManager.new(etherRate, {from: owner});
        });

        it("is forbidden by anyone but owner", async () => {
            let reason = await reject.call(projectManager.setRateAdmin(randomAddress(), {from: anyone}));
            expect(reason).to.equal("Restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(projectManager.setRateAdmin(ZERO_ADDRESS, {from: owner}));
            expect(reason).to.equal("New rate admin is zero");
        });

        it("is possible", async () => {
            let newAdmin = randomAddress();
            await projectManager.setRateAdmin(newAdmin, {from: owner});
            expect(await projectManager.rateAdmin()).to.equal(newAdmin);
        });

        it("gets logged", async () => {
            let oldAdmin = await projectManager.rateAdmin();
            let newAdmin = randomAddress();
            let tx = await projectManager.setRateAdmin(newAdmin, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "RateAdminChange");
            expect(entry).to.exist;
            expect(entry.args.previous).to.equal(oldAdmin);
            expect(entry.args.current).to.equal(newAdmin);
        });

        it("doesn't get logged if value remains unchanged", async () => {
            let admin = await projectManager.rateAdmin();
            let tx = await projectManager.setRateAdmin(admin, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "RateAdminChange");
            expect(entry).to.not.exist;
        });
    });

    describe("Rate change", () => {
        let projectManager;

        before("deploy", async () => {
            projectManager = await StokrProjectManager.new(etherRate, {from: owner});
            await projectManager.setRateAdmin(rateAdmin, {from: owner});
        });

        it("by owner not being rate admin is forbidden", async () => {
            let newRate = (await projectManager.etherRate()).add(toBN(1));
            let reason = await reject.call(
                projectManager.setRate(newRate, {from: owner}));
            expect(reason).to.equal("Restricted to rate admin");
        });

        it("by anyone but rate admin is forbidden", async () => {
            let newRate = (await projectManager.etherRate()).add(toBN(1));
            let reason = await reject.call(
                projectManager.setRate(newRate, {from: anyone}));
            expect(reason).to.equal("Restricted to rate admin");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(
                projectManager.setRate(0, {from: rateAdmin}));
            expect(reason).to.equal("Rate change too big");
        });

        it("lowering by an order of magnitude is forbidden", async () => {
            let newRate = (await projectManager.etherRate()).div(toBN(10));
            let reason = await reject.call(
                projectManager.setRate(newRate, {from: rateAdmin}));
            expect(reason).to.equal("Rate change too big");
        });

        it("raising by an order of magnitude is forbidden", async () => {
            let newRate = (await projectManager.etherRate()).mul(toBN(10));
            let reason = await reject.call(
                projectManager.setRate(newRate, {from: rateAdmin}));
            expect(reason).to.equal("Rate change too big");
        });

        it("is possible", async () => {
            let newRate = (await projectManager.etherRate()).mul(toBN(2)).add(toBN(1));
            await projectManager.setRate(newRate, {from: rateAdmin});
            expect(await projectManager.etherRate()).to.be.bignumber.equal(newRate);
        });

        it("gets logged", async () => {
            let oldRate = await projectManager.etherRate();
            let newRate = oldRate.mul(toBN(2)).add(toBN(1));
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

        it("reaching limit is forbidden", async () => {
            let maxRate = (toBN(2)).pow(toBN(256)).div(toBN(10)).sub(toBN(1));
            projectManager = await StokrProjectManager.new(maxRate, {from: owner});
            await projectManager.setRateAdmin(rateAdmin, {from: owner});
            let reason = await reject.call(
                projectManager.setRate(maxRate.add(toBN(1)), {from: rateAdmin}));
            expect(reason).to.equal("New rate reaches limit");
        });
    });

    describe("Whitelist change", () => {
        let projectManager;

        before("deploy", async () => {
            projectManager = await StokrProjectManager.new(etherRate, {from: owner});
        });

        it("by anyone but owner is forbidden", async () => {
            let whitelist = await Whitelist.new({from: owner});
            let reason = await reject.call(
                projectManager.setWhitelist(whitelist.address, {from: anyone}));
            expect(reason).to.equal("Restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(
                projectManager.setWhitelist(ZERO_ADDRESS, {from: owner}));
            expect(reason).to.equal("Whitelist is zero");
        });

        it("is possible", async () => {
            let whitelist = await Whitelist.new({from: owner});
            await projectManager.setWhitelist(whitelist.address, {from: owner});
            expect(await projectManager.currentWhitelist()).to.equal(whitelist.address);
        });
    });

    describe("Token factory change", () => {
        let projectManager;

        before("deploy", async () => {
            projectManager = await StokrProjectManager.new(etherRate, {from: owner});
        });

        it("by anyone but owner is forbidden", async () => {
            let tokenFactory = await StokrTokenFactory.new({from: owner});
            let reason = await reject.call(
                projectManager.setTokenFactory(tokenFactory.address, {from: anyone}));
            expect(reason).to.equal("Restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(
                projectManager.setTokenFactory(ZERO_ADDRESS, {from: owner}));
            expect(reason).to.equal("Token factory is zero");
        });

        it("is possible", async () => {
            let tokenFactory = await StokrTokenFactory.new({from: owner});
            await projectManager.setTokenFactory(tokenFactory.address, {from: owner});
            expect(await projectManager.tokenFactory()).to.equal(tokenFactory.address);
        });
    });

    describe("Crowdsale factory change", () => {
        let projectManager;

        before("deploy", async () => {
            projectManager = await StokrProjectManager.new(etherRate, {from: owner});
        });

        it("by anyone but owner is forbidden", async () => {
            let crowdsaleFactory = await StokrCrowdsaleFactory.new({from: owner});
            let reason = await reject.call(
                projectManager.setCrowdsaleFactory(crowdsaleFactory.address, {from: anyone}));
            expect(reason).to.equal("Restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(
                projectManager.setCrowdsaleFactory(ZERO_ADDRESS, {from: owner}));
            expect(reason).to.equal("Crowdsale factory is zero");
        });

        it("is possible", async () => {
            let crowdsaleFactory = await StokrCrowdsaleFactory.new({from: owner});
            await projectManager.setCrowdsaleFactory(crowdsaleFactory.address, {from: owner});
            expect(await projectManager.crowdsaleFactory()).to.equal(crowdsaleFactory.address);
        });
    });

    describe("Project creation", () => {
        let projectManager;
        const createProject = from => projectManager.createNewProject(
            tokenName,
            tokenSymbol,
            tokenPrice,
            [profitDepositor, profitDistributor, tokenRecoverer],
            [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal,
             tokenPurchaseMinimum, tokenPurchaseLimit, tokenReservePerMill],
            [openingTime, closingTime, limitEndTime],
            [companyWallet, reserveAccount],
            {from});

        before("deploy", async () => {
            projectManager = await StokrProjectManager.new(etherRate, {from: owner});
        });

        it("fails if whitelist wasn't set", async () => {
            let reason = await reject.call(createProject(owner));
            let whitelist = await Whitelist.new({from: owner});
            await projectManager.setWhitelist(whitelist.address, {from: owner});
            expect(reason).to.equal("Whitelist is zero");
        });

        it("fails if token factory wasn't set", async () => {
            let reason = await reject.call(createProject(owner));
            let tokenFactory = await StokrTokenFactory.new({from: owner});
            await projectManager.setTokenFactory(tokenFactory.address, {from: owner});
            expect(reason).to.equal("Token factory is zero");
        });

        it("fails if crowdsale factory wasn't set", async () => {
            let reason = await reject.call(createProject(owner));
            let crowdsaleFactory = await StokrCrowdsaleFactory.new({from: owner});
            await projectManager.setCrowdsaleFactory(crowdsaleFactory.address, {from: owner});
            expect(reason).to.equal("Crowdsale factory is zero");
        });

        it("from anyone but owner is forbidden", async () => {
            let reason = await reject.call(createProject(anyone));
            expect(reason).to.equal("Restricted to owner");
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
            expect(entry.args.whitelist).to.equal(await projectManager.currentWhitelist());
        });

        it("increases the projects count", async () => {
            let projectsCount = await projectManager.projectsCount();
            await createProject(owner);
            expect(await projectManager.projectsCount())
                .to.be.bignumber.equal(projectsCount.add(toBN(1)));
        });

        it("sets correct project name", async () => {
            let index = await projectManager.projectsCount();
            await createProject(owner);
            let name = (await projectManager.projects(index))[0];
            expect(name).to.equal(tokenName);
        });

        it("deploys correct whitelist", async () => {
            let index = await projectManager.projectsCount();
            await createProject(owner);
            let address = (await projectManager.projects(index))[1];
            expect(await web3.eth.getCode(address)).to.be.not.oneOf(["0x", "0x0"]);
            expect(address).to.equal(await projectManager.currentWhitelist());
        });

        it("deploys correct token", async () => {
            let index = await projectManager.projectsCount();
            await createProject(owner);
            let project = await projectManager.projects(index);
            expect(await web3.eth.getCode(project.token)).to.be.not.oneOf(["0x", "0x0"]);
            let token = await StokrToken.at(project.token);
            expect(await token.name()).to.equal(tokenName);
            expect(await token.symbol()).to.equal(tokenSymbol);
            expect(await token.profitDepositor()).to.equal(profitDepositor);
            expect(await token.profitDistributor()).to.equal(profitDistributor);
            expect(await token.tokenRecoverer()).to.equal(tokenRecoverer);
            expect(await token.whitelist()).to.equal(await projectManager.currentWhitelist());
            expect(await token.minter()).to.equal(project.crowdsale);
            expect(await token.owner()).to.equal(owner);
        });

        it("deploys correct crowdsale", async () => {
            let index = await projectManager.projectsCount();
            await createProject(owner);
            let project = await projectManager.projects(index);
            expect(await web3.eth.getCode(project.crowdsale)).to.be.not.oneOf(["0x", "0x0"]);
            let crowdsale = await StokrCrowdsale.at(project.crowdsale);
            expect(await crowdsale.rateSource()).to.equal(projectManager.address);
            expect(await crowdsale.token()).to.equal(project.token);
            expect(await crowdsale.tokenPrice()).to.be.bignumber.equal(tokenPrice);
            expect(await crowdsale.tokenCapOfPublicSale()).to.be.bignumber.equal(tokenCapOfPublicSale);
            expect(await crowdsale.tokenCapOfPrivateSale()).to.be.bignumber.equal(tokenCapOfPrivateSale);
            expect(await crowdsale.tokenGoal()).to.be.bignumber.equal(tokenGoal);
            expect(await crowdsale.tokenPurchaseMinimum()).to.be.bignumber.equal(tokenPurchaseMinimum);
            expect(await crowdsale.tokenPurchaseLimit()).to.be.bignumber.equal(tokenPurchaseLimit);
            expect(await crowdsale.tokenReservePerMill()).to.be.bignumber.equal(tokenReservePerMill);
            expect(await crowdsale.openingTime()).to.be.bignumber.equal(toBN(openingTime));
            expect(await crowdsale.closingTime()).to.be.bignumber.equal(toBN(closingTime));
            expect(await crowdsale.limitEndTime()).to.be.bignumber.equal(toBN(limitEndTime));
            expect(await crowdsale.companyWallet()).to.equal(companyWallet);
            expect(await crowdsale.reserveAccount()).to.equal(reserveAccount);
            expect(await crowdsale.owner()).to.equal(owner);
        });
    });

});
