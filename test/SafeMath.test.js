"use strict";

const SafeMathUser = artifacts.require("./mockups/SafeMathUserMockup.sol");


const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject, snapshot, logGas} = require("./helpers/common");


contract("SafeMath", ([owner]) => {
    let math;

    before("deploy", async () => {
        math = await SafeMathUser.new({from: owner});
    });

    describe("addition", () => {

        it("returns the sum", async () => {
            let x = (new BN(2)).pow(255);
            let y = x.divToInt(3);
            expect(await math.sum(x, y)).to.be.bignumber.equal(x.plus(y));
        });

        it("fails upon overflow", async () => {
            let x = (new BN(2)).pow(255);
            let y = x;
            await reject.call(math.sum(x, y));
        });
    });

    describe("subtraction", () => {

        it("returns the difference", async () => {
            let x = (new BN(2)).pow(255);
            let y = x.divToInt(3);
            expect(await math.diff(x, y)).to.be.bignumber.equal(x.minus(y));
        });

        it("fails upon underflow", async () => {
            let x = (new BN(2)).pow(255);
            let y = x.plus(1);
            await reject.call(math.diff(x, y));
        });
    });

    describe("multiplication", () => {

        it("returns the product", async () => {
            let x = (new BN(2)).pow(254);
            let y = 3;
            expect(await math.prod(x, y)).to.be.bignumber.equal(x.times(y));
        });

        it("returns zero upon zero factor", async () => {
            let x = new BN(0);
            let y = (new BN(2)).pow(255);
            expect(await math.prod(x, y)).to.be.bignumber.zero;
        });

        it("fails upon overflow", async () => {
            let x = (new BN(2)).pow(254);
            let y = 4;
            await reject.call(math.prod(x, y));
        });
    });

    describe("floor division", () => {

        it("returns the quotient", async () => {
            let x = (new BN(2)).pow(255);
            let y = 3;
            expect(await math.quot(x, y)).to.be.bignumber.equal(x.divToInt(y));
        });

        it("fails upon division by zero", async () => {
            let x = (new BN(2)).pow(255);
            let y = 0;
            await reject.call(math.quot(x, y));
        });
    });

});

