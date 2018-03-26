"use strict";

const SicosCrowdsale = artifacts.require("./SicosCrowdsale.sol");

const { expect } = require("chai");
const { should } = require("./helpers/utils");
const { rejectTx } = require("./helpers/tecneos");


contract("SicosCrowdsale", ([owner, anyone]) => {
    let crowdsale;

    describe("deployment", () => {

        it("should succeed", async () => {
            crowdsale = await SicosCrowdsale.new({from: owner});
            let code = await web3.eth.getCode(crowdsale.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("sets correct owner", async () => {
            let _owner = await crowdsale.owner();
            _owner.should.be.bignumber.equal(owner);
        });

    });

});

