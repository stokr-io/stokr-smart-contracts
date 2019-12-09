"use strict";

const SafeMathUser = artifacts.require("./mockups/SafeMathUserMockup.sol");

const {toBN} = web3.utils;
const {expect} = require("chai").use(require("chai-bn")(web3.utils.BN));
const {reject} = require("./helpers/_all");


contract("SafeMath", ([owner]) => {
    let math;

    before("deploy", async () => {
        math = await SafeMathUser.new({from: owner});
    });

    describe("addition", () => {

        it("returns the sum", async () => {
            let x = toBN(2).pow(toBN(255));
            let y = x.div(toBN(3));
            expect(await math.sum(x, y)).to.be.bignumber.equal(x.add(y));
        });

        it("fails upon overflow", async () => {
            let x = toBN(2).pow(toBN(255));
            let y = x;
            await reject.call(math.sum(x, y));
        });
    });

    describe("subtraction", () => {

        it("returns the difference", async () => {
            let x = toBN(2).pow(toBN(255));
            let y = x.div(toBN(3));
            expect(await math.diff(x, y)).to.be.bignumber.equal(x.sub(y));
        });

        it("fails upon underflow", async () => {
            let x = toBN(2).pow(toBN(255));
            let y = x.add(toBN(1));
            await reject.call(math.diff(x, y));
        });
    });

    describe("multiplication", () => {

        it("returns the product", async () => {
            let x = toBN(2).pow(toBN(254));
            let y = toBN(3);
            expect(await math.prod(x, y)).to.be.bignumber.equal(x.mul(y));
        });

        it("returns zero upon zero factor", async () => {
            let x = toBN(0);
            let y = toBN(2).pow(toBN(255));
            expect(await math.prod(x, y)).to.be.bignumber.zero;
        });

        it("fails upon overflow", async () => {
            let x = toBN(2).pow(toBN(254));
            let y = toBN(4);
            await reject.call(math.prod(x, y));
        });
    });

    describe("floor division", () => {

        it("returns the quotient", async () => {
            let x = toBN(2).pow(toBN(255));
            let y = toBN(3);
            expect(await math.quot(x, y)).to.be.bignumber.equal(x.div(y));
        });

        it("fails upon division by zero", async () => {
            let x = toBN(2).pow(toBN(255));
            let y = toBN(0);
            await reject.call(math.quot(x, y));
        });
    });

});

