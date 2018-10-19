"use strict";

const KeyRecoverer = artifacts.require("./recovery/KeyRecoverer.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {reject} = require("./helpers/common");

contract("KeyRecoverer", ([owner, anyone]) => {
    let keyRecoverer;

    describe("deployment", () => {

        it("should succeed", async () => {
            keyRecoverer = await KeyRecoverer.new({from: owner});
            expect(await web3.eth.getCode(keyRecoverer.address)).to.be.not.oneOf(["0x", "0x0"]);
        });

        it("sets correct owner", async () => {
            expect(await keyRecoverer.owner()).to.be.bignumber.equal(owner);
        });

    });

});

