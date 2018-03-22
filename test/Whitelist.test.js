"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");

const { should, ensuresException } = require("./helpers/utils");
const expect = require("chai").expect;
const { latestTime, duration, increaseTimeTo } = require("./helpers/timer");
const BigNumber = web3.BigNumber;

const { rejectTx } = require("./helpers/tecneos.js");


contract("Whitelist", ([owner, admin1, admin2, investor1, investor2, investor3, anyone]) => {
    const ZERO_ADDR = "0x0";
    let whitelist = null;

    describe("deployment", () => {

        it("should succeed", async () => {
            whitelist = await Whitelist.new({from: owner});
            let code = await web3.eth.getCode(whitelist.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("sets owner", async () => {
            let owner = await whitelist.owner();
            owner.should.be.bignumber.equal(owner);
        });

    });

    describe("admin", () => {

        it("cannot be added by anyone", async () => {
            await rejectTx(whitelist.addAdmin(admin1, {from: anyone}));
        });

        it("can be added by owner", async () => {
            let tx = await whitelist.addAdmin(admin1, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "AdminAdded");
            assert.strictEqual(entry.args.admin, admin1);
        });

        it("is an admin after add", async () => {
            let isAdmin = await whitelist.admins(admin1);
            assert.isTrue(isAdmin);
        });

        it("cannot be removed by anyone", async () => {
            await rejectTx(whitelist.removeAdmin(admin1, {from: anyone}));
        });

        it("can be removed by owner", async () => {
            let tx = await whitelist.removeAdmin(admin1, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "AdminRemoved");
            assert.strictEqual(entry.args.admin, admin1);
        });

        it("is not an admin after remove", async () => {
            let isAdmin = await whitelist.admins(admin1);
            assert.isFalse(isAdmin);
        });

    });

    describe("single investor", () => {

        before("owner adds admins", async () => {
            await whitelist.addAdmin(admin1, {from: owner});
            await whitelist.addAdmin(admin2, {from: owner});
        });

        it("cannot be added by anyone", async () => {
            await rejectTx(whitelist.addToWhitelist([investor1], {from: anyone}));
        });

        it("can be added by admin1", async () => {
            let tx = await whitelist.addToWhitelist([investor1], {from: admin1});
            let entry = tx.logs.find(entry => entry.event === "InvestorAdded");
            assert.strictEqual(entry.args.admin, admin1);
            assert.strictEqual(entry.args.investor, investor1);
        });

        it("can be added again by admin2", async () => {
            let tx = await whitelist.addToWhitelist([investor1], {from: admin2});
            let entry = tx.logs.find(entry => entry.event === "InvestorAdded");
            assert.strictEqual(entry.args.admin, admin2);
            assert.strictEqual(entry.args.investor, investor1);
        });

        it("is whitelisted after add", async () => {
            let isWhitelisted = await whitelist.isWhitelisted(investor1);
            assert.isTrue(isWhitelisted);
        });

        it("cannot be removed by anyone", async () => {
            await rejectTx(whitelist.removeFromWhitelist([investor1], {from: anyone}));
        });

        it("can be removed by admin1", async () => {
            let tx = await whitelist.removeFromWhitelist([investor1], {from: admin1});
            let entry = tx.logs.find(entry => entry.event === "InvestorRemoved");
            assert.strictEqual(entry.args.admin, admin1);
            assert.strictEqual(entry.args.investor, investor1);
        });

        it("can be removed again by admin2", async () => {
            let tx = await whitelist.removeFromWhitelist([investor1], {from: admin2});
            let entry = tx.logs.find(entry => entry.event === "InvestorRemoved");
            assert.strictEqual(entry.args.admin, admin2);
            assert.strictEqual(entry.args.investor, investor1);
        });

        it("is not whitelisted after remove", async () => {
            let isWhitelisted = await whitelist.isWhitelisted([investor1]);
            assert.isFalse(isWhitelisted);
        });

    });

    describe("multiple investors", () => {
        let investors = [investor1, investor2, investor3,
                         investor1, investor2, investor3,
                         investor1, investor2, investor3,
                         ZERO_ADDR];

        before("owner adds admins", async () => {
            await whitelist.addAdmin(admin1, {from: owner});
            await whitelist.addAdmin(admin2, {from: owner});
        });

        it("cannot be added by anyone", async () => {
            await rejectTx(whitelist.addToWhitelist(investors, {from: anyone}));
            for (let i = 0; i < investors.length; ++i) {
                let isWhitelisted = await whitelist.isWhitelisted(investors[i]);
                assert.isFalse(isWhitelisted);
            }
        });

        it("can be added at once by admin1", async () => {
            let tx = await whitelist.addToWhitelist(investors, {from: admin1});
            for (let i = 0; i < investors.length; ++i) {
                let isWhitelisted = await whitelist.isWhitelisted(investors[i]);
                assert.isTrue(isWhitelisted);
            }
        });

        it("cannot be removed by anyone", async () => {
            await rejectTx(whitelist.removeFromWhitelist(investors, {from: anyone}));
            for (let i = 0; i < investors.length; ++i) {
                let isWhitelisted = await whitelist.isWhitelisted(investors[i]);
                assert.isTrue(isWhitelisted);
            }
        });

        it("can be removed at once by admin2", async () => {
            let tx = await whitelist.removeFromWhitelist(investors, {from: admin2});
            for (let i = 0; i < investors.length; ++i) {
                let isWhitelisted = await whitelist.isWhitelisted(investors[i]);
                assert.isFalse(isWhitelisted);
            }
        });

    });

});
