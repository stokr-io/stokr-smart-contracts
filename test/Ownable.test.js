"use strict";

const Ownable = artifacts.require("./ownership/Ownable.sol");


const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject, snapshot, logGas} = require("./helpers/common");


contract("Ownable", ([owner, anyone]) => {
    let ownable;

    before("deploy", async () => {
        ownable = await Ownable.new({from: owner});
    });

    describe("deployment", () => {

        it("sets owner to deployer", async () => {
            expect(await ownable.owner()).to.be.bignumber.equal(owner);
        });
    });

    describe("ownership transfer", async () => {

        it("by anyone but owner is forbidden", async () => {
            let reason = await reject.call(ownable.transferOwnership(anyone, {from: anyone}));
            expect(reason).to.be.equal("restricted to owner");
        });

        it("to zero is forbidden", async () => {
            let reason = await reject.call(ownable.transferOwnership(0x0, {from: owner}));
            expect(reason).to.be.equal("new owner is zero");
        });

        it("to owner again is possible but doesn't get logged", async () => {
            let tx = await ownable.transferOwnership(owner, {from: owner});
            let log = tx.logs.find(log => log.event === "OwnershipTransferred");
            expect(log).to.not.exist;
            expect(await ownable.owner()).to.be.bignumber.equal(owner);
        });

        it("to anyone is possible and gets logged", async () => {
            let tx = await ownable.transferOwnership(anyone, {from: owner});
            let log = tx.logs.find(log => log.event === "OwnershipTransferred");
            expect(log).to.exist;
            expect(log.args.previousOwner).to.be.bignumber.equal(owner);
            expect(log.args.newOwner).to.be.bignumber.equal(anyone);
            expect(await ownable.owner()).to.be.bignumber.equal(anyone);
        });
    });

});
