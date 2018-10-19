"use strict";

const Whitelist = artifacts.require("./whitelist/Whitelist.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {reject} = require("./helpers/common");


contract("Whitelist", ([owner,
                        admin1,
                        admin2,
                        investor1,
                        investor2,
                        investor3,
                        anyone]) => {
    let whitelist = null;

    describe("deployment", () => {

        it("should succeed", async () => {
            whitelist = await Whitelist.new({from: owner});
            expect(await web3.eth.getCode(whitelist.address)).to.be.not.oneOf(["0x", "0x0"]);
        });

        it("sets correct owner", async () => {
            expect(await whitelist.owner()).to.be.bignumber.equal(owner);
        });

    });

    describe("admin", () => {

        it("cannot be added by anyone", async () => {
            await reject.tx(whitelist.addAdmin(admin1, {from: anyone}));
        });

        it("cannot be added if zero", async () => {
            await reject.tx(whitelist.addAdmin(0x0, {from: owner}));
        });

        it("can be added by owner", async () => {
            let tx = await whitelist.addAdmin(admin1, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "AdminAdded");
            expect(entry).to.exist;
            expect(entry.args.admin).to.be.bignumber.equal(admin1);
        });

        it("is an admin after add", async () => {
            expect(await whitelist.admins(admin1)).to.be.true;
        });

        it("isn't logged if added again", async () => {
            let tx = await whitelist.addAdmin(admin1, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "AdminAdded");
            expect(entry).to.not.exist;
        });

        it("cannot be removed by anyone", async () => {
            await reject.tx(whitelist.removeAdmin(admin1, {from: anyone}));
        });

        it("cannot be removed if zero", async () => {
            await reject.tx(whitelist.removeAdmin(0x0, {from: owner}));
        });

        it("can be removed by owner", async () => {
            let tx = await whitelist.removeAdmin(admin1, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "AdminRemoved");
            expect(entry).to.exist;
            expect(entry.args.admin).to.be.bignumber.equal(admin1);
        });

        it("is not an admin after remove", async () => {
            expect(await whitelist.admins(admin1)).to.be.false;
        });

        it("isn't logged if removed again", async () => {
            let tx = await whitelist.removeAdmin(admin1, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "AdminRemoved");
            expect(entry).to.not.exist;
        });
    });

    describe("single investor", () => {

        before("owner adds admins", async () => {
            await whitelist.addAdmin(admin1, {from: owner});
            await whitelist.addAdmin(admin2, {from: owner});
        });

        it("cannot be added by anyone", async () => {
            await reject.tx(whitelist.addToWhitelist([investor1], {from: anyone}));
        });

        it("can be added by admin1", async () => {
            let tx = await whitelist.addToWhitelist([investor1], {from: admin1});
            let entry = tx.logs.find(entry => entry.event === "InvestorAdded");
            expect(entry).to.exist;
            expect(entry.args.admin).to.be.bignumber.equal(admin1);
            expect(entry.args.investor).to.be.bignumber.equal(investor1);
        });

        it("can be added again by admin2 but shouldn't get logged", async () => {
            let tx = await whitelist.addToWhitelist([investor1], {from: admin2});
            let entry = tx.logs.find(entry => entry.event === "InvestorAdded");
            expect(entry).to.not.exist;
        });

        it("is whitelisted after add", async () => {
            expect(await whitelist.isWhitelisted(investor1)).to.be.true;
        });

        it("cannot be removed by anyone", async () => {
            await reject.tx(whitelist.removeFromWhitelist([investor1], {from: anyone}));
        });

        it("can be removed by admin1", async () => {
            let tx = await whitelist.removeFromWhitelist([investor1], {from: admin1});
            let entry = tx.logs.find(entry => entry.event === "InvestorRemoved");
            expect(entry).to.exist;
            expect(entry.args.admin).to.be.bignumber.equal(admin1);
            expect(entry.args.investor).to.be.bignumber.equal(investor1);
        });

        it("can be removed again by admin2 but shouldn't get logged", async () => {
            let tx = await whitelist.removeFromWhitelist([investor1], {from: admin2});
            let entry = tx.logs.find(entry => entry.event === "InvestorRemoved");
            expect(entry).to.not.exist;
        });

        it("is not whitelisted after remove", async () => {
            expect(await whitelist.isWhitelisted([investor1])).to.be.false;
        });

    });

    describe("multiple investors", () => {
        let investors = [investor1, investor2, investor3,
                         investor1, investor2, investor3,
                         investor1, investor2, investor3,
                         0x0, 0x1, 0x2, 0x3, 0x4, 0x5];

        before("owner adds admins", async () => {
            await whitelist.addAdmin(admin1, {from: owner});
            await whitelist.addAdmin(admin2, {from: owner});
        });

        it("cannot be added by anyone", async () => {
            await reject.tx(whitelist.addToWhitelist(investors, {from: anyone}));
            for (let i = 0; i < investors.length; ++i) {
                expect(await whitelist.isWhitelisted(investors[i])).to.be.false;
            }
        });

        it("can be added at once by admin1", async () => {
            let tx = await whitelist.addToWhitelist(investors, {from: admin1});
            for (let i = 0; i < investors.length; ++i) {
                expect(await whitelist.isWhitelisted(investors[i])).to.be.true;
            }
        });

        it("cannot be removed by anyone", async () => {
            await reject.tx(whitelist.removeFromWhitelist(investors, {from: anyone}));
            for (let i = 0; i < investors.length; ++i) {
                expect(await whitelist.isWhitelisted(investors[i])).to.be.true;
            }
        });

        it("can be removed at once by admin2", async () => {
            let tx = await whitelist.removeFromWhitelist(investors, {from: admin2});
            for (let i = 0; i < investors.length; ++i) {
                expect(await whitelist.isWhitelisted(investors[i])).to.be.false;
            }
        });

    });

});

