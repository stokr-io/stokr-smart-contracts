"use strict";

const Ownable = artifacts.require("./ownership/Ownable.sol");

const {toBN, padLeft} = web3.utils;
const {expect} = require("chai").use(require("chai-bn")(web3.utils.BN));
const {reject} = require("./helpers/_all");

const ZERO_ADDRESS = padLeft("0x0", 160 >> 2);


contract("Ownable", ([owner, newOwner, anyone]) => {
    let ownable;

    beforeEach("deploy", async () => {
        ownable = await Ownable.new({from: owner});
    });

    describe("deployment", () => {

        it("sets owner to deployer", async () => {
            expect(await ownable.owner()).to.be.equal(owner);
        });
    });

    describe("safe ownership transfer", async () => {

        it("by anyone but owner is forbidden", async () => {
            let reason = await reject.call(
                ownable.transferOwnership(anyone, {from: anyone}));
            expect(reason).to.equal("Restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(
                ownable.transferOwnership(ZERO_ADDRESS, {from: owner}));
            expect(reason).to.equal("New owner is zero");
        });

        it("is postponed", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            expect(await ownable.owner()).to.equal(owner);
        });

        it("saves the new owner", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            expect(await ownable.newOwner()).to.equal(newOwner);
        });

        it("claiming by anone is forbidden", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            let reason = await reject.call(ownable.claimOwnership({from: anyone}));
            expect(reason).to.equal("Restricted to new owner");
        });

        it("claiming by old owner is forbidden", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            let reason = await reject.call(ownable.claimOwnership({from: owner}));
            expect(reason).to.equal("Restricted to new owner");
        });

        it("becomes effective by claiming", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            await ownable.claimOwnership({from: newOwner});
            expect(await ownable.owner()).to.equal(newOwner);
        });

        it("resets pending owner after transfer", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            await ownable.claimOwnership({from: newOwner});
            expect(await ownable.newOwner()).to.equal(ZERO_ADDRESS);
        });

        it("gets logged when claimed", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            let tx = await ownable.claimOwnership({from: newOwner});
            let log = tx.logs.find(log => log.event === "OwnershipTransferred");
            expect(log).to.exist;
            expect(log.args.previousOwner).to.equal(owner);
            expect(log.args.newOwner).to.equal(newOwner);
        });

        it("can be corrected before claiming", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            await ownable.transferOwnership(owner, {from: owner});
            let reason = await reject.call(ownable.claimOwnership({from: newOwner}));
            expect(reason).to.be.equal("Restricted to new owner");
            expect(await ownable.owner()).to.equal(owner);
        });

        it("doesn't get logged if claimed after correction", async () => {
            await ownable.transferOwnership(newOwner, {from: owner});
            await ownable.transferOwnership(owner, {from: owner});
            let tx = await ownable.claimOwnership({from: owner});
            let log = tx.logs.find(log => log.event === "OwnershipTransferred");
            expect(log).to.not.exist;
        });
    });

    describe("unsafe ownership transfer", async () => {

        it("by anyone but owner is forbidden", async () => {
            let reason = await reject.call(
                ownable.transferOwnershipUnsafe(anyone, {from: anyone}));
            expect(reason).to.equal("Restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(
                ownable.transferOwnershipUnsafe(ZERO_ADDRESS, {from: owner}));
            expect(reason).to.equal("New owner is zero");
        });

        it("becomes effective immediately", async () => {
            await ownable.transferOwnershipUnsafe(newOwner, {from: owner});
            expect(await ownable.owner()).to.equal(newOwner);
        });

        it("resets pending owner after transfer", async () => {
            await ownable.transferOwnership(anyone, {from: owner});
            await ownable.transferOwnershipUnsafe(newOwner, {from: owner});
            expect(await ownable.newOwner()).to.equal(ZERO_ADDRESS);
        });

        it("gets logged", async () => {
            let tx = await ownable.transferOwnershipUnsafe(newOwner, {from: owner});
            let log = tx.logs.find(log => log.event === "OwnershipTransferred");
            expect(log).to.exist;
            expect(log.args.previousOwner).to.equal(owner);
            expect(log.args.newOwner).to.equal(newOwner);
        });

        it("to owner again doesn't get logged", async () => {
            let tx = await ownable.transferOwnershipUnsafe(owner, {from: owner});
            let log = tx.logs.find(log => log.event === "OwnershipTransferred");
            expect(log).to.not.exist;
            expect(await ownable.owner()).to.equal(owner);
        });
    });

});
