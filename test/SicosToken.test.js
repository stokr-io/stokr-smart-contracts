"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const SicosToken = artifacts.require("./SicosToken.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {reject, money} = require("./helpers/common");


contract("SicosToken", ([owner,
                         minter,
                         profitDepositor,
                         keyRecoverer,
                         investor1,
                         investor2,
                         investor3,
                         trustee,
                         anyone]) => {
    const investors = [investor1, investor2, investor3];

    // Helper function to deploy a Whitelist and a SicosToken.
    const deployWhitelistAndToken = async () => {
        // deploy whitelist contract where owner becomes whitelist admin and adds three investors
        let whitelist = await Whitelist.new({from: owner});
        await whitelist.addAdmin(owner, {from: owner});
        await whitelist.addToWhitelist(investors, {from: owner});
        // deploy token contract with keyRecoverer and minter
        let token = await SicosToken.new(whitelist.address,
                                         profitDepositor,
                                         keyRecoverer,
                                         {from: owner});
        await token.setMinter(minter, {from: owner});
        return [whitelist, token];
    }

    // Tests of correct deployment.
    describe("deployment", () => {
        let whitelist;
        let token;

        before("requires a deployed Whitelist instance", async () => {
            whitelist = await Whitelist.new({from: owner});
            expect(await web3.eth.getCode(whitelist.address)).to.be.not.oneOf(["0x", "0x0"]);
        });

        it("should fail if whitelist is zero address", async () => {
            await reject.deploy(SicosToken.new(0x0, profitDepositor, keyRecoverer, {from: owner}));
        });

        it("should fail if profitDepositor is zero address", async () => {
            await reject.deploy(SicosToken.new(whitelist.address, 0x0, keyRecoverer, {from: owner}));
        });

        it("should fail if keyRecoverer is zero address", async () => {
            await reject.deploy(SicosToken.new(whitelist.address, profitDepositor, 0x0, {from: owner}));
        });

        it("should succeed", async () => {
            token = await SicosToken.new(whitelist.address,
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

    // Tests of address changing related functions.
    describe("set addresses", () => {
        let whitelist;
        let token;

        before("deploy contracts", async () => {
            whitelist = await Whitelist.new({from: owner});
            token = await SicosToken.new(whitelist.address,
                                         profitDepositor,
                                         keyRecoverer,
                                         {from: owner});
        });

        it("denies anyone to change whitelist", async () => {
            await reject.tx(token.setWhitelist(0xDEADBEEF, {from: anyone}));
            expect(await token.whitelist()).to.be.bignumber.equal(whitelist.address);
        });

        it("denies owner to change whitelist to zero", async () => {
            await reject.tx(token.setWhitelist(0x0, {from: owner}));
            expect(await token.whitelist()).to.be.bignumber.equal(whitelist.address);
        });

        it("allows owner to change whitelist", async () => {
            let tx = await token.setWhitelist(0xDEADBEEF, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "WhitelistChanged");
            expect(entry).to.exist;
            expect(entry.args.newWhitelist).to.be.bignumber.equal(0xDEADBEEF);
            expect(await token.whitelist()).to.be.bignumber.equal(0xDEADBEEF);
        });

        it("denies anyone to change profitDepositor", async () => {
            await reject.tx(token.setProfitDepositor(0xDEADBEEF, {from: anyone}));
            expect(await token.profitDepositor()).to.be.bignumber.equal(profitDepositor);
        });

        it("denies owner to change profitDepositor to zero", async () => {
            await reject.tx(token.setProfitDepositor(0x0, {from: owner}));
            expect(await token.profitDepositor()).to.be.bignumber.equal(profitDepositor);
        });

        it("allows owner to change profitDepositor", async () => {
            let tx = await token.setProfitDepositor(0xDEADBEEF, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "ProfitDepositorChanged");
            expect(entry).to.exist;
            expect(entry.args.newProfitDepositor).to.be.bignumber.equal(0xDEADBEEF);
            expect(await token.profitDepositor()).to.be.bignumber.equal(0xDEADBEEF);
        });

        it("denies anyone to change keyRecoverer", async () => {
            await reject.tx(token.setKeyRecoverer(0xDEADBEEF, {from: anyone}));
            expect(await token.keyRecoverer()).to.be.bignumber.equal(keyRecoverer);
        });

        it("denies owner to change keyRecoverer to zero", async () => {
            await reject.tx(token.setKeyRecoverer(0x0, {from: owner}));
            expect(await token.keyRecoverer()).to.be.bignumber.equal(keyRecoverer);
        });

        it("allows owner to change keyRecoverer", async () => {
            let tx = await token.setKeyRecoverer(0xDEADBEEF, {from: owner});
            let entry = tx.logs.find(entry => entry.event === "KeyRecovererChanged");
            expect(entry).to.exist;
            expect(entry.args.newKeyRecoverer).to.be.bignumber.equal(0xDEADBEEF);
            expect(await token.keyRecoverer()).to.be.bignumber.equal(0xDEADBEEF);
        });

        it("denies anyone to change minter", async () => {
            await reject.tx(token.setMinter(minter, {from: anyone}));
            expect(await token.minter()).to.be.bignumber.zero;
        });

        it("denies owner to change minter to zero", async () => {
            await reject.tx(token.setMinter(0x0, {from: owner}));
            expect(await token.minter()).to.be.bignumber.zero;
        });

        it("allows owner to change minter once", async () => {
            await token.setMinter(minter, {from: owner});
            expect(await token.minter()).to.be.bignumber.equal(minter);
        });

        it("denies owner to change minter twice", async () => {
            await reject.tx(token.setMinter(anyone, {from: owner}));
            expect(await token.minter()).to.be.bignumber.equal(minter);
        });

    });

    // Tests of minting related functions.
    describe("minting", () => {
        let whitelist;
        let token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
        });

        it("is forbidden to anyone other than minter", async () => {
            await reject.tx(token.mint(investor1, 252525, {from: anyone}));
            expect(await token.totalSupply()).to.be.bignumber.zero;
        });

        it("is forbidden if beneficiary wasn't whitelisted before", async () => {
            await reject.tx(token.mint(anyone, 252525, {from: minter}));
            expect(await token.totalSupply()).to.be.bignumber.zero;
        });

        it("is possible", async () => {
            const amount = 1000;
            let tx = await token.mint(investor1, amount, {from: minter});
            let entry1 = tx.logs.find(entry => entry.event === "Minted");
            expect(entry1).to.exist;
            expect(entry1.args.to).to.be.bignumber.equal(investor1);
            expect(entry1.args.amount).to.be.bignumber.equal(amount);
            let entry2 = tx.logs.find(entry => entry.event === "Transfer");
            expect(entry2).to.exist;
            expect(entry2.args.from).to.be.bignumber.zero;
            expect(entry2.args.to).to.be.bignumber.equal(investor1);
            expect(entry2.args.value).to.be.bignumber.equal(amount);
            expect(await token.totalSupply()).to.be.bignumber.equal(amount);
        });

        it("should correctly increase totalSupply", async () => {
            const amount = 2000;
            let totalSupply = await token.totalSupply();
            await token.mint(investor1, amount, {from: minter});
            expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(amount));
        });

        it("should correctly increase beneficiary's balance", async () => {
            const amount = 4000;
            let balance = await token.balanceOf(investor1);
            await token.mint(investor1, amount, {from: minter});
            expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance.plus(amount));
        });

        it("finishing is forbidden for anyone other than minter", async () => {
            await reject.tx(token.finishMinting({from: anyone}));
            expect(await token.mintingFinished()).to.be.false;
        });

        it("finishing is possible once", async () => {
            let tx = await token.finishMinting({from: minter});
            let entry = tx.logs.find(entry => entry.event === "MintFinished");
            expect(entry).to.exist
            expect(await token.mintingFinished()).to.be.true;
        });

        it("finishing again is impossible", async () => {
            await reject.tx(token.finishMinting({from: minter}));
        });

        it("is forbidden after finish", async () => {
            let totalSupply = await token.totalSupply();
            await reject.tx(token.mint(investor1, 252525, {from: minter}));
            expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
        });

    });

    // Tests of token transfer related functions.
    describe("transfer", () => {
        const debited = investor1;
        const credited = investor2;
        let whitelist;
        let token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            await token.mint(debited, 252525, {from: minter});
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

        it("is forbidden while minting", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            await reject.tx(token.transfer(credited, 1, {from: debited}));
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance);
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance);
        });

        it("approval is forbidden while minting", async () => {
            let allowance = await token.allowance(debited, trustee);
            await reject.tx(token.approve(trustee, 1, {from: debited}));
            expect(await token.allowance(debited, trustee)).to.be.bignumber.equal(allowance);
        });

        it("is possible after minting finished", async () => {
            await token.finishMinting({from: minter});
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            let amount = debitedBalance.dividedToIntegerBy(2);
            let tx = await token.transfer(credited, amount, {from: debited});
            let entry = tx.logs.find(entry => entry.event === "Transfer");
            expect(entry).to.exist;
            expect(entry.args.from).to.be.bignumber.equal(debited);
            expect(entry.args.to).to.be.bignumber.equal(credited);
            expect(entry.args.value).to.be.bignumber.equal(amount);
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance.minus(amount));
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance.plus(amount));
        });

        it("is forbidden if debited account isn't whitelisted", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            await whitelist.removeFromWhitelist([debited], {from: owner});
            await reject.tx(token.transfer(credited, 1, {from: debited}));
            await whitelist.addToWhitelist([debited], {from: owner});
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance);
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance);
        });

        it("is forbidden if credited account isn't whitelisted", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            await whitelist.removeFromWhitelist([credited], {from: owner});
            await reject.tx(token.transfer(credited, 1, {from: debited}));
            await whitelist.addToWhitelist([credited], {from: owner});
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance);
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance);
        });

        it("is forbidden if amount exceed balance", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            let amount = debitedBalance.plus(1);
            await reject.tx(token.transfer(credited, amount, {from: debited}));
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance);
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance);
        });

        it("approval is forbidden if approver isn't whitelisted", async () => {
            let allowance = await token.allowance(debited, trustee);
            await whitelist.removeFromWhitelist([debited], {from: owner});
            await reject.tx(token.approve(trustee, 1, {from: debited}));
            await whitelist.addToWhitelist([debited], {from: owner});
            expect(await token.allowance(debited, trustee)).to.be.bignumber.equal(allowance);
        });

        it("approval is possible", async () => {
            let allowance = await token.allowance(debited, trustee);
            let balance = await token.balanceOf(debited);
            let amount = balance.plus(1);
            await token.approve(trustee, 0, {from: debited});
            let tx = await token.approve(trustee, amount, {from: debited});
            let entry = tx.logs.find(entry => entry.event === "Approval");
            expect(entry).to.exist;
            expect(entry.args.owner).to.be.bignumber.equal(debited);
            expect(entry.args.spender).to.be.bignumber.equal(trustee);
            expect(entry.args.value).to.be.bignumber.equal(amount);
            expect(await token.allowance(debited, trustee)).to.be.bignumber.equal(allowance.plus(amount));
        });

        it("approval change is possible if allowance was set to zero before", async () => {
            let allowance = await token.allowance(debited, trustee);
            let amount = allowance.plus(1);
            await token.approve(trustee, 0, {from: debited});
            await token.approve(trustee, amount, {from: debited});
            expect(await token.allowance(debited, trustee)).to.be.bignumber.equal(amount);
        });

        it("by a trustee is forbidden if debited account isn't whitelisted", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            let amount = debitedBalance.dividedToIntegerBy(2);
            await token.approve(trustee, 0, {from: debited});
            await token.approve(trustee, amount, {from: debited});
            await whitelist.removeFromWhitelist([debited], {from: owner});
            await reject.tx(token.transferFrom(debited, credited, amount, {from: trustee}));
            await whitelist.addToWhitelist([debited], {from: owner});
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance);
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance);
        });

        it("by a trustee is forbidden if credited account isn't whitelisted", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            let amount = debitedBalance.dividedToIntegerBy(2);
            await token.approve(trustee, 0, {from: debited});
            await token.approve(trustee, amount, {from: debited});
            await whitelist.removeFromWhitelist([credited], {from: owner});
            await reject.tx(token.transferFrom(debited, credited, amount, {from: trustee}));
            await whitelist.addToWhitelist([credited], {from: owner});
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance);
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance);
        });

        it("by a trustee is forbidden if amount exceeds allowance", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            await token.approve(trustee, 0, {from: debited});
            await token.approve(trustee, 1, {from: debited});
            await reject.tx(token.transferFrom(debited, credited, 2, {from: trustee}));
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance);
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance);
        });

        it("by a trustee is forbidden if amount exceeds balance", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            let amount = debitedBalance.plus(1);
            await token.approve(trustee, 0, {from: debited});
            await token.approve(trustee, amount, {from: debited});
            await reject.tx(token.transferFrom(debited, credited, amount, {from: trustee}));
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance);
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance);
        });

        it("by a trustee is possible", async () => {
            let debitedBalance = await token.balanceOf(debited);
            let creditedBalance = await token.balanceOf(credited);
            let amount = debitedBalance.dividedToIntegerBy(2);
            await token.approve(trustee, 0, {from: debited});
            await token.approve(trustee, amount, {from: debited});
            let tx = await token.transferFrom(debited, credited, amount, {from: trustee});
            let entry = tx.logs.find(entry => entry.event === "Transfer");
            expect(entry).to.exist;
            expect(entry.args.from).to.be.bignumber.equal(debited);
            expect(entry.args.to).to.be.bignumber.equal(credited);
            expect(entry.args.value).to.be.bignumber.equal(amount);
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(debitedBalance.minus(amount));
            expect(await token.balanceOf(credited)).to.be.bignumber.equal(creditedBalance.plus(amount));
        });

        it("by a trustee should decrease allowance", async () => {
            let balance = await token.balanceOf(debited);
            let allowance = balance.dividedToIntegerBy(2);
            let amount = allowance.dividedToIntegerBy(2);
            await token.approve(trustee, 0, {from: debited});
            await token.approve(trustee, allowance, {from: debited});
            await token.transferFrom(debited, credited, amount, {from: trustee});
            expect(await token.allowance(debited, trustee)).to.be.bignumber.equal(allowance.minus(amount));
        });

        it.skip("by an attacking trustee should not exceed maximum of two allowances"
                + " if allowance wasn't set to zero in between", async () => {
            let balance = await token.balanceOf(debited);
            let amount = balance.dividedToIntegerBy(3);
            await token.approve(trustee, 0, {from: debited});
            await token.approve(trustee, amount, {from: debited});
            await token.transferFrom(debited, credited, amount, {from: trustee});
            // investor forgot to set allowance to zero first
            await token.approve(trustee, amount, {from: debited});
            await reject.tx(token.transferFrom(debited, credited, amount, {from: trustee}));
            expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance.minus(amount));
        });

    });

    // Tests of profit sharing related functions.
    describe("profit share", () => {
        let whitelist;
        let token;

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
                    sumOfProfitShares = sumOfProfitShares.plus(account.profitShare).plus(profitShareOwing);
                }
                expect(sumOfProfitShares).to.be.bignumber.equal(weiBalance);
            }
        });

        it("forbids to deposit profit via default function", async () => {
            let weiBalance = await web3.eth.getBalance(token.address);
            await reject.tx(token.send(money.ether(1), {from: anyone}));
            expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(weiBalance);
        });

        it("denies anyone to deposit profit", async () => {
            let weiBalance = await web3.eth.getBalance(token.address);
            await reject.tx(token.depositProfit({from: anyone, value: money.ether(1)}));
            expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(weiBalance);
        });

        it("allows profitDepositor to deposit profit", async () => {
            const weiAmount = money.ether(2);
            let weiBalance = await web3.eth.getBalance(token.address);
            let totalProfits = await token.totalProfits();
            let tx = await token.depositProfit({from: profitDepositor, value: weiAmount});
            let entry = tx.logs.find(entry => entry.event === "ProfitDeposited");
            expect(entry).to.exist;
            expect(entry.args.depositor).to.be.bignumber.equal(profitDepositor);
            expect(entry.args.amount).to.be.bignumber.equal(weiAmount);
            expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(weiBalance.plus(weiAmount));
            expect(await token.totalProfits()).to.be.bignumber.equal(totalProfits.plus(weiAmount));
        });

        it("is not calculated while total supply wasn't fixed", async () => {
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                expect(await token.profitShareOwing(investor)).to.be.bignumber.zero;
            }
        });

        it("is forbidden while total supply wasn't fixed", async () => {
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                await reject.tx(token.updateProfitShare(investor));
                let account = await getAccount(investor);
                expect(account.lastTotalProfits).to.be.bignumber.zero;
                expect(account.profitShare).to.be.bignumber.zero;
            }
        });

        it("is correctly calculated as share of investors' token balances", async () => {
            await token.finishMinting({from: minter});
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
                expect(profitShareOwing.times(totalSupply)).to.be.bignumber.equal(balance.times(totalProfits));
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
                expect((await getAccount(investor)).lastTotalProfits).to.be.bignumber.equal(totalProfits);
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
                let entry = tx.logs.find(entry => entry.event === "ProfitWithdrawal");
                expect(entry).to.exist;
                expect(entry.args.investor).to.be.bignumber.equal(investor);
                expect(entry.args.amount).to.be.bignumber.equal(account.profitShare.plus(profitShareOwing));
                expect((await getAccount(investor)).profitShare).to.be.bignumber.zero
                expect(await web3.eth.getBalance(token.address))
                      .to.be.bignumber.equal(weiBalance.minus(account.profitShare).minus(profitShareOwing));
            }
        });

        it("of zero can be withdrawn by anyone", async () => {
            await token.depositProfit({from: profitDepositor, value: money.ether(2)});
            let weiBalance = await web3.eth.getBalance(token.address);
            let tx = await token.withdrawProfitShare({from: anyone});
            let entry = tx.logs.find(entry => entry.event === "ProfitWithdrawal");
            expect(entry).to.exist;
            expect(entry.args.investor).to.be.bignumber.equal(anyone);
            expect(entry.args.amount).to.be.bignumber.zero;
            expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(weiBalance);
        });

    });

    // Tests of key recovery related functions.
    describe("key recovery", () => {
        let whitelist;
        let token;
        let totalSupply;

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
            expectAccountEquality(await getAccount(investor2), {balance: 0, profitShare: 0, lastTotalProfits: 0});
            expectAccountEquality(await getAccount(investor3), account);
        });

    });

});
