"use strict";

const KeyRecoverer = artifacts.require("./KeyRecoverer.sol");

const { should, ensuresException } = require("./helpers/utils");
const expect = require("chai").expect;
const { latestTime, duration, increaseTimeTo } = require("./helpers/timer");
const BigNumber = web3.BigNumber;

const { rejectTx } = require("./helpers/tecneos.js");


contract("KeyRecoverer", ([owner, anyone]) => {
    const ZERO_ADDR = "0x0";
    let keyRecoverer = null;

    describe("deployment", () => {

        it("should succeed", async () => {
            keyRecoverer = await Whitelist.new({from: owner});
            let code = await web3.eth.getCode(keyRecoverer.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("sets owner", async () => {
            let owner = await keyRecoverer.owner();
            owner.should.be.bignumber.equal(owner);
        });

    });

});
