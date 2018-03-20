"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const SicosToken = artifacts.require("./SicosToken.sol");

const { should, ensuresException } = require("./helpers/utils");
const expect = require("chai").expect;
const { latestTime, duration, increaseTimeTo } = require("./helpers/timer");
const BigNumber = web3.BigNumber;

const { rejectDeploy, rejectTx, randomAddr } = require("./helpers/tecneos.js");


contract("SicosToken", ([owner,
                         recoverer,
                         investor1,
                         investor2,
                         investor3,
                         disburser,
                         anyone]) => {
    const ZERO_ADDR = "0x0";
    let whitelist;
    let token;

    describe("deployment", () => {

        it("requires a deployed Whitelist instance", async () => {
            whitelist = await Whitelist.new({from: owner});
            let code = await web3.eth.getCode(whitelist.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("should fail if whitelist is zero address", async () => {
            await rejectDeploy(SicosToken.new(ZERO_ADDR, recoverer, {from: owner}));
        });

        it("should fail if keyRecoverer is zero address", async () => {
            await rejectDeploy(SicosToken.new(whitelist.address, ZERO_ADDR, {from: owner}));
        });

        it("should succeed", async () => {
            token = await SicosToken.new(whitelist.address, recoverer, {from: owner});
            let code = await web3.eth.getCode(token.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("sets correct owner", async () => {
            let owner = await token.owner();
            owner.should.be.bignumber.equal(owner);
        });

        it("sets correct whitelist", async () => {
            let whitelistAddr = await token.whitelist();
            whitelistAddr.should.be.bignumber.equal(whitelist.address);
        });

        it("sets correct keyRecoverer", async () => {
            let _keyRecoverer = await token.keyRecoverer();
            _keyRecoverer.should.be.bignumber.equal(keyRecoverer);
        });

    });

    describe("as a Whitelisted", () => {

        it("denies anyone to change whitelist address", async () => {
            let oldWhitelistAddr = await token.whitelist();
            await rejectTx(token.setWhitelist(randomAddr(), {from: anyone}));
            let newWhitelistAddr = await token.whitelist();
            newWhitelistAddr.should.be.bignumber.equal(oldWhitelistAddr);
        });

        it("denies owner to change whitelist address to zero", async () => {
            let oldWhitelistAddr = await token.whitelist();
            await rejectTx(token.setWhitelist(ZERO_ADDR, {from: owner}));
            let newWhitelistAddr = await token.whitelist();
            newWhitelistAddr.should.be.bignumber.equal(oldWhitelistAddr);
        });

        it("allows owner to change whitelist address", async () => {
            await token.setWhitelist(randomAddr(), {from: owner});
            let whitelistAddress = await token.whitelist();
            whitelistAddress.should.not.be.bignumber.equal(whitelist.address);
            let tx = await token.setWhitelist(whitelist.address, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "WhitelistChanged");
            should.exist(entry);
            entry.args.whitelist.should.be.equal(whitelist.address);
            whitelistAddress = await token.whitelist();
            whitelistAddress.should.be.bignumber.equal(whitelist.address);
        });

    });

    describe("as a ProfitShare", () => {
    });

    describe("as a MintableToken", () => {
    });

    describe("as a KeyRecoverable", () => {

    });

});
