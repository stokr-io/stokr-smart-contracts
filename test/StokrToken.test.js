"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const StokrToken = artifacts.require("./StokrToken.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject} = require("./helpers/common");


contract("StokrToken", ([owner,
                         minter,
                         profitDepositor,
                         keyRecoverer,
                         investor1,
                         investor2,
                         investor3,
                         trustee,
                         anyone]) => {
    const investors = [investor1, investor2, investor3];

    // Helper function to deploy a Whitelist and a StokrToken.
    const deployWhitelistAndToken = async () => {
        // deploy whitelist contract where owner becomes whitelist admin and adds three investors
        let whitelist = await Whitelist.new({from: owner});
        await whitelist.addAdmin(owner, {from: owner});
        await whitelist.addToWhitelist(investors, {from: owner});
        // deploy token contract with keyRecoverer and minter
        let token = await StokrToken.new(whitelist.address,
                                         profitDepositor,
                                         keyRecoverer,
                                         {from: owner});
        await token.setMinter(minter, {from: owner});
        return [whitelist, token];
    }

    // Tests of correct deployment.
    describe("deployment", () => {
        let whitelist;

        before("requires a deployed Whitelist instance", async () => {
            whitelist = await Whitelist.new({from: owner});
            expect(await web3.eth.getCode(whitelist.address)).to.be.not.oneOf(["0x", "0x0"]);
        });

        describe("with invalid parameters", () => {

            it("fails if whitelist is zero address", async () => {
                await reject.deploy(StokrToken.new(0x0, profitDepositor, keyRecoverer, {from: owner}));
            });

            it("fails if profitDepositor is zero address", async () => {
                await reject.deploy(StokrToken.new(whitelist.address, 0x0, keyRecoverer, {from: owner}));
            });

            it("fails if keyRecoverer is zero address", async () => {
                await reject.deploy(StokrToken.new(whitelist.address, profitDepositor, 0x0, {from: owner}));
            });
        });

        describe("with valid parameters", () => {
            let token;

            it("succeeds", async () => {
                token = await StokrToken.new(whitelist.address,
                                             profitDepositor,
                                             keyRecoverer,
                                             {from: owner});
                expect(await web3.eth.getCode(token.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await token.owner()).to.be.bignumber.equal(owner);
            });

            it("sets correct whitelist", async () => {
                expect(await token.whitelist()).to.be.bignumber.equal(whitelist.address);
            });

            it("sets correct profitDepositor", async () => {
                expect(await token.profitDepositor()).to.be.bignumber.equal(profitDepositor);
            });

            it("sets correct keyRecoverer", async () => {
                expect(await token.keyRecoverer()).to.be.bignumber.equal(keyRecoverer);
            });

            it("sets minter to zero address", async () => {
                expect(await token.minter()).to.be.bignumber.zero;
            });

            it("sets totalProfits to zero", async () => {
                expect(await token.totalProfits()).to.be.bignumber.zero;
            });

            it("sets totalSupplyIsFixed to false", async () => {
                expect(await token.totalSupplyIsFixed()).to.be.false;
            });

            it("sets totalSupply to zero", async () => {
                expect(await token.totalSupply()).to.be.bignumber.zero;
            });
        });
    });

    // Tests of address changing related functions.
    describe("change address", () => {
        let whitelist, token;

        before("deploy contracts", async () => {
            whitelist = await Whitelist.new({from: owner});
            token = await StokrToken.new(whitelist.address,
                                         profitDepositor,
                                         keyRecoverer,
                                         {from: owner});
        });

        describe("of whitelist", () => {

            it("by anyone but owner is forbidden", async () => {
                await reject.tx(token.setWhitelist(random.address(), {from: anyone}));
                expect(await token.whitelist()).to.be.bignumber.equal(whitelist.address);
            });

            it("to zero is forbidden", async () => {
                await reject.tx(token.setWhitelist(0x0, {from: owner}));
                expect(await token.whitelist()).to.be.bignumber.equal(whitelist.address);
            });

            it("is possible", async () => {
                let newWhitelist = random.address();
                let tx = await token.setWhitelist(newWhitelist, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "WhitelistChanged");
                expect(entry).to.exist;
                expect(entry.args.newWhitelist).to.be.bignumber.equal(newWhitelist);
                expect(await token.whitelist()).to.be.bignumber.equal(newWhitelist);
            });
        });

        describe("of profitDepositor", () => {

            it("by anyone but owner is forbidden", async () => {
                await reject.tx(token.setProfitDepositor(random.address(), {from: anyone}));
                expect(await token.profitDepositor()).to.be.bignumber.equal(profitDepositor);
            });

            it("to zero is forbidden", async () => {
                await reject.tx(token.setProfitDepositor(0x0, {from: owner}));
                expect(await token.profitDepositor()).to.be.bignumber.equal(profitDepositor);
            });

            it("is possible", async () => {
                let newProfitDepositor = random.address();
                let tx = await token.setProfitDepositor(newProfitDepositor, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ProfitDepositorChanged");
                expect(entry).to.exist;
                expect(entry.args.newProfitDepositor).to.be.bignumber.equal(newProfitDepositor);
                expect(await token.profitDepositor()).to.be.bignumber.equal(newProfitDepositor);
            });
        });

        describe("of keyRecoverer", () => {

            it("by anyone but owner is forbidden", async () => {
                await reject.tx(token.setKeyRecoverer(random.address(), {from: anyone}));
                expect(await token.keyRecoverer()).to.be.bignumber.equal(keyRecoverer);
            });

            it("to zero is forbidden", async () => {
                await reject.tx(token.setKeyRecoverer(0x0, {from: owner}));
                expect(await token.keyRecoverer()).to.be.bignumber.equal(keyRecoverer);
            });

            it("is possible", async () => {
                let newKeyRecoverer = random.address();
                let tx = await token.setKeyRecoverer(newKeyRecoverer, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "KeyRecovererChanged");
                expect(entry).to.exist;
                expect(entry.args.newKeyRecoverer).to.be.bignumber.equal(newKeyRecoverer);
                expect(await token.keyRecoverer()).to.be.bignumber.equal(newKeyRecoverer);
            });
        });

        describe("of minter", () => {

            it("by anyone but owner is forbidden", async () => {
                await reject.tx(token.setMinter(random.address(), {from: anyone}));
                expect(await token.minter()).to.be.bignumber.zero;
            });

            it("to zero is forbidden", async () => {
                await reject.tx(token.setMinter(0x0, {from: owner}));
                expect(await token.minter()).to.be.bignumber.zero;
            });

            it("is possible for the first time", async () => {
                await token.setMinter(minter, {from: owner});
                expect(await token.minter()).to.be.bignumber.equal(minter);
            });

            it("is forbidden for the second time", async () => {
                await reject.tx(token.setMinter(random.address(), {from: owner}));
                expect(await token.minter()).to.be.bignumber.equal(minter);
            });
        });
    });

    // Tests of minting related functions.
    describe("minting", () => {
        let whitelist, token;

        describe("until finish", () => {

            before("deploy contracts", async () => {
                [whitelist, token] = await deployWhitelistAndToken();
            });

            it("by anyone but minter is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(token.mint(investor1, 1, {from: anyone}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("for non-whitelisted beneficiary is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(token.mint(anyone, 1, {from: minter}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("is possible", async () => {
                const amount = 1000;
                let tx = await token.mint(investor1, amount, {from: minter});
                let mintedEntry = tx.logs.find(entry => entry.event === "Minted");
                expect(mintedEntry).to.exist;
                expect(mintedEntry.args.to).to.be.bignumber.equal(investor1);
                expect(mintedEntry.args.amount).to.be.bignumber.equal(amount);
                let transferEntry = tx.logs.find(entry => entry.event === "Transfer");
                expect(transferEntry).to.exist;
                expect(transferEntry.args.from).to.be.bignumber.zero;
                expect(transferEntry.args.to).to.be.bignumber.equal(investor1);
                expect(transferEntry.args.value).to.be.bignumber.equal(amount);
            });

            it("increases totalSupply", async () => {
                const amount = 1000;
                let totalSupply = await token.totalSupply();
                await token.mint(investor1, amount, {from: minter});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(amount));
            });

            it("increases beneficiary's balance", async () => {
                const amount = 1000;
                let balance = await token.balanceOf(investor1);
                await token.mint(investor1, amount, {from: minter});
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance.plus(amount));
            });
        });

        describe("finishing", () => {

            before("deploy contracts", async () => {
                [whitelist, token] = await deployWhitelistAndToken();
            });

            it("by anyone but minter is forbidden", async () => {
                await reject.tx(token.finishMinting({from: anyone}));
                expect(await token.mintingFinished()).to.be.false;
            });

            it("is possible for the first time", async () => {
                let tx = await token.finishMinting({from: minter});
                let entry = tx.logs.find(entry => entry.event === "MintFinished");
                expect(entry).to.exist
                expect(await token.mintingFinished()).to.be.true;
            });

            it("is forbidden for the second time", async () => {
                await reject.tx(token.finishMinting({from: minter}));
            });
        });

        describe("after finish", () => {

            before("deploy contracts", async () => {
                [whitelist, token] = await deployWhitelistAndToken();
                await token.finishMinting({from: minter});
            });

            it("is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(token.mint(investor1, 1, {from: minter}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });
        });
    });

    // Tests of token transfer related functions.
    describe("transfer", () => {
        const [debited, credited] = investors;
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            await token.mint(debited, 1000, {from: minter});
        });

        afterEach("invariant: sum of individual token balances equals total supply", async () => {
            let totalSupply = await token.totalSupply();
            let sumOfBalances = new web3.BigNumber(0);
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                let balance = await token.balanceOf(investor);
                sumOfBalances = sumOfBalances.add(balance);
            }
            expect(sumOfBalances).to.be.bignumber.equal(totalSupply);
        });

        describe("while minting", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(debited);
                await reject.tx(token.transfer(credited, 1, {from: debited}));
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });
        });

        describe("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("is forbidden if debited account isn't whitelisted", async () => {
                let balance = await token.balanceOf(debited);
                await whitelist.removeFromWhitelist([debited], {from: owner});
                await reject.tx(token.transfer(credited, 1, {from: debited}));
                await whitelist.addToWhitelist([debited], {from: owner});
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });

            it("is forbidden if credited account isn't whitelisted", async () => {
                let balance = await token.balanceOf(debited);
                await whitelist.removeFromWhitelist([credited], {from: owner});
                await reject.tx(token.transfer(credited, 1, {from: debited}));
                await whitelist.addToWhitelist([credited], {from: owner});
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });

            it("is forbidden if amount exceed balance", async () => {
                let balance = await token.balanceOf(debited);
                await reject.tx(token.transfer(credited, balance.plus(1), {from: debited}));
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });

            it("to zero address is forbidden", async () => {
                let balance = await token.balanceOf(debited);
                await whitelist.addToWhitelist([0x0], {from: owner});
                await reject.tx(token.transfer(0x0, 0, {from: debited}));
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(debited)).dividedToIntegerBy(2);
                let tx = await token.transfer(credited, amount, {from: debited});
                let entry = tx.logs.find(entry => entry.event === "Transfer");
                expect(entry).to.exist;
                expect(entry.args.from).to.be.bignumber.equal(debited);
                expect(entry.args.to).to.be.bignumber.equal(credited);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("decreases debited balance", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.dividedToIntegerBy(2);
                await token.transfer(credited, amount, {from: debited});
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance.minus(amount));
            });

            it("increases credited balance", async () => {
                let balance = await token.balanceOf(credited);
                let amount = (await token.balanceOf(debited)).dividedToIntegerBy(2);
                await token.transfer(credited, amount, {from: debited});
                expect(await token.balanceOf(credited)).to.be.bignumber.equal(balance.plus(amount));
            });
        });
    });

    // Tests of token approval related functions.
    describe("approval", () => {
        const approver = investors[0];
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            await token.mint(approver, 1000, {from: minter});
        });

        describe("while minting", () => {

            it("is forbidden", async () => {
                let allowance = await token.allowance(approver, trustee);
                await reject.tx(token.approve(trustee, 1, {from: approver}));
                expect(await token.allowance(approver, trustee)).to.be.bignumber.equal(allowance);
            });
        });

        describe("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("is forbidden if approver isn't whitelisted", async () => {
                let allowance = await token.allowance(approver, trustee);
                await whitelist.removeFromWhitelist([approver], {from: owner});
                await reject.tx(token.approve(trustee, 1, {from: approver}));
                await whitelist.addToWhitelist([approver], {from: owner});
                expect(await token.allowance(approver, trustee)).to.be.bignumber.equal(allowance);
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                let tx = await token.approve(trustee, amount, {from: approver});
                let entry = tx.logs.find(entry => entry.event === "Approval");
                expect(entry).to.exist;
                expect(entry.args.owner).to.be.bignumber.equal(approver);
                expect(entry.args.spender).to.be.bignumber.equal(trustee);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("sets correct allowance", async () => {
                let amount = (await token.allowance(approver, trustee)).plus(1);
                let tx = await token.approve(trustee, amount, {from: approver});
                expect(await token.allowance(approver, trustee)).to.be.bignumber.equal(amount);
            });

            it.skip("is forbidden if allowance wasn't reset before", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
                await reject.tx(token.approve(trustee, amount.plus(1), {from: approver}));
                expect(await token.allowance(approver, trustee)).to.be.bignumber.equal(amount);
            });
        });
    });

    // Tests of approved transfer related functions.
    describe("approved transfer", () => {
        const [debited, credited] = investors;
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            await token.mint(debited, 1000, {from: minter});
        });

        afterEach("invariant: sum of individual token balances equals total supply", async () => {
            let totalSupply = await token.totalSupply();
            let sumOfBalances = new web3.BigNumber(0);
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                let balance = await token.balanceOf(investor);
                sumOfBalances = sumOfBalances.add(balance);
            }
            expect(sumOfBalances).to.be.bignumber.equal(totalSupply);
        });

        describe("while minting", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(debited);
                await reject.tx(token.transferFrom(debited, credited, 0, {from: trustee}));
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });
        });

        describe("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("is forbidden if debited account isn't whitelisted", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.dividedToIntegerBy(2);
                await token.approve(trustee, 0, {from: debited});
                await token.approve(trustee, amount, {from: debited});
                await whitelist.removeFromWhitelist([debited], {from: owner});
                await reject.tx(token.transferFrom(debited, credited, amount, {from: trustee}));
                await whitelist.addToWhitelist([debited], {from: owner});
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });

            it("is forbidden if credited account isn't whitelisted", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.dividedToIntegerBy(2);
                await token.approve(trustee, 0, {from: debited});
                await token.approve(trustee, amount, {from: debited});
                await whitelist.removeFromWhitelist([credited], {from: owner});
                await reject.tx(token.transferFrom(debited, credited, amount, {from: trustee}));
                await whitelist.addToWhitelist([credited], {from: owner});
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });

            it("is forbidden if amount exceeds allowance", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.dividedToIntegerBy(2);
                await token.approve(trustee, 0, {from: debited});
                await token.approve(trustee, amount, {from: debited});
                await reject.tx(token.transferFrom(debited, credited, amount.plus(1), {from: trustee}));
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });

            it("is forbidden if amount exceeds balance", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.plus(1);
                await token.approve(trustee, 0, {from: debited});
                await token.approve(trustee, amount, {from: debited});
                await reject.tx(token.transferFrom(debited, credited, amount, {from: trustee}));
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance);
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(debited)).dividedToIntegerBy(2);
                await token.approve(trustee, 0, {from: debited});
                await token.approve(trustee, amount, {from: debited});
                let tx = await token.transferFrom(debited, credited, amount, {from: trustee});
                let entry = tx.logs.find(entry => entry.event === "Transfer");
                expect(entry).to.exist;
                expect(entry.args.from).to.be.bignumber.equal(debited);
                expect(entry.args.to).to.be.bignumber.equal(credited);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("decreases debited balance", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.dividedToIntegerBy(2);
                await token.approve(trustee, 0, {from: debited});
                await token.approve(trustee, amount, {from: debited});
                await token.transferFrom(debited, credited, amount, {from: trustee});
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance.minus(amount));
            });

            it("decreases credited balance", async () => {
                let balance = await token.balanceOf(credited);
                let amount = (await token.balanceOf(debited)).dividedToIntegerBy(2);
                await token.approve(trustee, 0, {from: debited});
                await token.approve(trustee, amount, {from: debited});
                await token.transferFrom(debited, credited, amount, {from: trustee});
                expect(await token.balanceOf(credited)).to.be.bignumber.equal(balance.plus(amount));
            });
        });
    });

    // Tests of profit sharing related functions.
    describe("profit share", () => {
        let whitelist, token;

        // Helper function to read an account.
        const getAccount = async (address) => {
            let [balance, lastTotalProfits, profitShare] = await token.accounts(address);
            return {balance, lastTotalProfits, profitShare};
        };

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            // mint some tokens for the benefit of investors
            // Note: in order to make the tests working correctly, ensure that in
            //       all test scenarios the individual tokens share is a finite
            //       binary fraction of total token supply.
            await token.mint(investor1, 4000, {from: minter});  // 1/2
            await token.mint(investor2, 3000, {from: minter});  // 3/8
            await token.mint(investor3, 1000, {from: minter});  // 1/8
        });

        afterEach("invariant: sum of individual profits equals token wei balance", async () => {
            // This invariant doesn't hold while token minting
            let mintingFinished = await token.mintingFinished();
            if (mintingFinished) {
                let weiBalance = await web3.eth.getBalance(token.address);
                let sumOfProfitShares = new web3.BigNumber(0);
                for (let i = 0; i < investors.length; ++i) {
                    let investor = investors[i];
                    let account = await getAccount(investor);
                    let profitShareOwing = await token.profitShareOwing(investor);
                    sumOfProfitShares = sumOfProfitShares.plus(account.profitShare)
                                                         .plus(profitShareOwing);
                }
                expect(sumOfProfitShares).to.be.bignumber.equal(weiBalance);
            }
        });

        describe("depositing", () => {

            it("by anyone but profitDepositor is forbidden", async () => {
                let weiBalance = await web3.eth.getBalance(token.address);
                await reject.tx(token.depositProfit({from: anyone, value: money.ether(1)}));
                expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(weiBalance);
            });

            it("by anyone but profitDepositor via fallback function is forbidden", async () => {
                let weiBalance = await web3.eth.getBalance(token.address);
                try {
                    await web3.eth.sendTransaction(
                        {from: anyone, to: token.address, value: money.ether(1)});
                    throw new Error("Transaction should have failed but didn't");
                }
                catch (error) {
                    if (!error.message.toLowerCase().includes("transaction: revert")) {
                        throw error;
                    }
                }
                expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(weiBalance);
            });

            it("is possible", async () => {
                let weiAmount = money.ether(2);
                let tx = await token.depositProfit({from: profitDepositor, value: weiAmount});
                let entry = tx.logs.find(entry => entry.event === "ProfitDeposited");
                expect(entry).to.exist;
                expect(entry.args.depositor).to.be.bignumber.equal(profitDepositor);
                expect(entry.args.amount).to.be.bignumber.equal(weiAmount);
            });

            it("via fallback function is possible", async () => {
                let weiBalance = await web3.eth.getBalance(token.address);
                let weiAmount = money.ether(2);
                await web3.eth.sendTransaction(
                    {from: profitDepositor, to: token.address, value: weiAmount});
                expect(await web3.eth.getBalance(token.address))
                    .to.be.bignumber.equal(weiBalance.plus(weiAmount));
            });

            it("increases wei balance", async () => {
                let weiBalance = await web3.eth.getBalance(token.address);
                let weiAmount = money.ether(2);
                await token.depositProfit({from: profitDepositor, value: weiAmount});
                expect(await web3.eth.getBalance(token.address))
                    .to.be.bignumber.equal(weiBalance.plus(weiAmount));
            });

            it("increases totalProfits", async () => {
                let totalProfits = await token.totalProfits();
                let weiAmount = money.ether(2);
                await token.depositProfit({from: profitDepositor, value: weiAmount});
                expect(await token.totalProfits()).to.be.bignumber.equal(totalProfits.plus(weiAmount));
            });
        });

        describe("while minting", () => {

            it("is not calculated", async () => {
                for (let i = 0; i < investors.length; ++i) {
                    let investor = investors[i];
                    expect(await token.profitShareOwing(investor)).to.be.bignumber.zero;
                }
            });

            it("updating is forbidden", async () => {
                for (let i = 0; i < investors.length; ++i) {
                    let investor = investors[i];
                    await reject.tx(token.updateProfitShare(investor));
                    let account = await getAccount(investor);
                    expect(account.lastTotalProfits).to.be.bignumber.zero;
                    expect(account.profitShare).to.be.bignumber.zero;
                }
            });
        });

        describe("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("is correctly calculated as share of investors' token balances", async () => {
                let totalSupply = await token.totalSupply();
                let totalProfits = await token.totalProfits();
                for (let i = 0; i < investors.length; ++i) {
                    let investor = investors[i];
                    let balance = await token.balanceOf(investor);
                    let profitShareOwing = await token.profitShareOwing(investor);
                    // Prerequisite: no individual profit share was disbursed before
                    // Use equivalence:
                    //      profitShareOwing / totalProfits == balance / totalSupply
                    // <=>  profitShareOwing * totalSupply  == balance * totalProfits
                    expect(profitShareOwing.times(totalSupply))
                        .to.be.bignumber.equal(balance.times(totalProfits));
                }
            });

            it("is correctly disbursed to investors", async () => {
                let totalProfits = await token.totalProfits();
                for (let i = 0; i < investors.length; ++i) {
                    let investor = investors[i];
                    let account = await getAccount(investor);
                    let profitShareOwing = await token.profitShareOwing(investor);
                    let tx = await token.updateProfitShare(investor, {from: anyone});
                    let entry = tx.logs.find(entry => entry.event === "ProfitShareUpdated");
                    expect(entry).to.exist;
                    expect(entry.args.investor).to.be.bignumber.equal(investor);
                    expect(entry.args.amount).to.be.bignumber.equal(profitShareOwing);
                    expect((await getAccount(investor)).lastTotalProfits)
                        .to.be.bignumber.equal(totalProfits);
                    expect((await getAccount(investor)).profitShare)
                          .to.be.bignumber.equal(account.profitShare.plus(profitShareOwing));
                }
            });

            it("is correctly calculated after some more profit was deposited", async () => {
                await token.depositProfit({from: profitDepositor, value: money.ether(8)});
                let totalSupply = await token.totalSupply();
                let totalProfits = await token.totalProfits();
                for (let i = 0; i < investors.length; ++i) {
                    let investor = investors[i];
                    let account = await getAccount(investor);
                    let profitShareOwing = await token.profitShareOwing(investor);
                    // Prerequiste: no tokens were transferred before
                    // Use equivalence:
                    //      (profitShare + profitShareOwing) / totalProfits == balance / totalSupply
                    // <=>  (profitShare + profitShareOwing) * totalSupply  == balance * totalProfits
                    expect(account.profitShare.plus(profitShareOwing).times(totalSupply))
                          .to.be.bignumber.equal(account.balance.times(totalProfits));
                }
            });

            it("is correctly calculated after some tokens transfer and profit deposit", async () => {
                let totalSupply = await token.totalSupply();
                let additionalProfit = money.ether(4);
                await token.transfer(investor2, 2000, {from: investor1});
                let balance1 = await token.balanceOf(investor1);
                let balance2 = await token.balanceOf(investor2);
                await token.depositProfit({from: profitDepositor, value: additionalProfit});
                // Use equivalence:
                //      profitShareOwing / additionalProfit == balance / totalSupply
                // <=>  profitShareOwing * totalSupply      == balance * additionalProfits
                expect((await token.profitShareOwing(investor1)).times(totalSupply))
                      .to.be.bignumber.equal(balance1.times(additionalProfit));
                expect((await token.profitShareOwing(investor2)).times(totalSupply))
                      .to.be.bignumber.equal(balance2.times(additionalProfit));

            });

            it("can be withdrawn by investors", async () => {
                for (let i = 0; i < investors.length; ++i) {
                    let investor = investors[i];
                    let account = await getAccount(investor);
                    let profitShareOwing = await token.profitShareOwing(investor);
                    let weiBalance = await web3.eth.getBalance(token.address);
                    let tx = await token.withdrawProfitShare({from: investor});
                    let entry = tx.logs.find(entry => entry.event === "ProfitShareWithdrawn");
                    expect(entry).to.exist;
                    expect(entry.args.investor).to.be.bignumber.equal(investor);
                    expect(entry.args.beneficiary).to.be.bignumber.equal(investor);
                    expect(entry.args.amount)
                        .to.be.bignumber.equal(account.profitShare.plus(profitShareOwing));
                    expect((await getAccount(investor)).profitShare).to.be.bignumber.zero
                    expect(await web3.eth.getBalance(token.address))
                        .to.be.bignumber.equal(weiBalance.minus(account.profitShare)
                                                         .minus(profitShareOwing));
                }
            });

            it("of zero can be withdrawn by anyone", async () => {
                await token.depositProfit({from: profitDepositor, value: money.ether(2)});
                let weiBalance = await web3.eth.getBalance(token.address);
                let tx = await token.withdrawProfitShare({from: anyone});
                let entry = tx.logs.find(entry => entry.event === "ProfitShareWithdrawn");
                expect(entry).to.exist;
                expect(entry.args.investor).to.be.bignumber.equal(anyone);
                expect(entry.args.beneficiary).to.be.bignumber.equal(anyone);
                expect(entry.args.amount).to.be.bignumber.zero;
                expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(weiBalance);
            });
        });
    });

    // Tests of key recovery related functions.
    describe("key recovery", () => {
        let whitelist, token, totalSupply;

        // Helper function to read an account.
        const getAccount = async (address) => {
            let [balance, lastTotalProfits, profitShare] = await token.accounts(address);
            return {balance, lastTotalProfits, profitShare};
        };

        // Helper method for testing (partial) equality of an account.
        const expectAccountEquality = (account, expected) => {
            expect(account.balance).to.be.bignumber.equal(expected.balance);
            expect(account.lastTotalProfits).to.be.bignumber.equal(expected.lastTotalProfits);
            expect(account.profitShare).to.be.bignumber.equal(expected.profitShare);
        };

        before("deploy contracts and add investors", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            // mint some tokens for the benefit of first two investors
            await token.mint(investor1, 1000, {from: minter});
            await token.mint(investor2, 2000, {from: minter});
            totalSupply = 1000 + 2000;
            await token.finishMinting({from: minter});
            // deposit profits and disburse them to first two investors
            await token.depositProfit({from: profitDepositor, value: money.ether(1)});
            await token.updateProfitShare(investor1);
            await token.updateProfitShare(investor2);
        });

        afterEach("invariant: total token supply doesn't change", async () => {
            expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
        });

        it("is forbidden by anyone other than keyRecoverer", async () => {
            let account2 = await getAccount(investor2);
            let account3 = await getAccount(investor3);
            await reject.tx(token.recoverKey(investor2, investor3, {from: anyone}));
            expectAccountEquality(await getAccount(investor2), account2);
            expectAccountEquality(await getAccount(investor3), account3);
        });

        it("is forbidden if oldAddress wasn't whitelisted before", async () => {
            let account = await getAccount(investor3);
            await reject.tx(token.recoverKey(anyone, investor3, {from: keyRecoverer}));
            expectAccountEquality(await getAccount(investor3), account);
        });

        it("is forbidden if newAddress wasn't whitelisted before", async () => {
            let account = await getAccount(investor1);
            await reject.tx(token.recoverKey(investor1, anyone, {from: keyRecoverer}));
            expectAccountEquality(await getAccount(investor1), account);
        });

        it("is forbidden if newAddress is an already used account", async () => {
            let account1 = await getAccount(investor1);
            let account2 = await getAccount(investor2);
            await reject.tx(token.recoverKey(investor1, investor2, {from: keyRecoverer}));
            expectAccountEquality(await getAccount(investor1), account1);
            expectAccountEquality(await getAccount(investor2), account2);
        });

        it("is possible", async () => {
            let account = await getAccount(investor2);
            let tx = await token.recoverKey(investor2, investor3, {from: keyRecoverer});
            let entry = tx.logs.find(entry => entry.event === "KeyRecovered");
            expect(entry).to.exist;
            expect(entry.args.oldAddress).to.be.equal(investor2);
            expect(entry.args.newAddress).to.be.equal(investor3);
            expectAccountEquality(await getAccount(investor2),
                {balance: 0, profitShare: 0, lastTotalProfits: 0});
            expectAccountEquality(await getAccount(investor3), account);
        });
    });
});
