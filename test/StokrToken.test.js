"use strict";

const ERC20 = artifacts.require("./token/ERC20.sol");
const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");

const {toBN, toWei, toChecksumAddress, randomHex, padLeft} = web3.utils;
const {expect} = require("chai").use(require("chai-bn")(web3.utils.BN));
const {reject, abi, bisection} = require("./helpers/_all");

const ZERO_ADDRESS = padLeft("0x0", 160 >> 2);
const randomAddress = () => toChecksumAddress(randomHex(160 >> 3));
const ether = n => toWei(toBN(n), "ether");


contract("StokrToken", ([owner,
                         minter,
                         profitDepositor,
                         profitDistributor,
                         tokenRecoverer,
                         investor1,
                         investor2,
                         investor3,
                         trustee,
                         anyone]) => {
    const tokenName = "Stokr Token";
    const tokenSymbol = "STOKR";
    const investors = [investor1, investor2, investor3];


    // Helper function to deploy a Whitelist and a StokrToken.
    const deployWhitelistAndToken = async () => {
        // deploy whitelist contract where owner becomes whitelist admin and adds three investors
        let whitelist = await Whitelist.new({from: owner});
        await whitelist.addAdmin(owner, {from: owner});
        await whitelist.addToWhitelist(investors, {from: owner});
        // deploy token contract with tokenRecoverer and minter
        let token = await StokrToken.new(tokenName,
                                         tokenSymbol,
                                         whitelist.address,
                                         profitDepositor,
                                         profitDistributor,
                                         tokenRecoverer,
                                         {from: owner});
        await token.setProfitDistributor(profitDistributor, {from: owner});
        await token.setMinter(minter, {from: owner});
        return [whitelist, token];
    }

    describe("interface", () => {

        it("adheres to ERC20", async () => {
            for (let definition of abi.getMethods(ERC20).values()) {
                let method = abi.findMethod(StokrToken, definition);

                expect(method, `function ${definition.name}`).to.exist;
            }
        });
    });

    // Tests of correct deployment.
    context("deployment", () => {
        let whitelist;

        before("requires a deployed Whitelist instance", async () => {
            whitelist = await Whitelist.new({from: owner});
            expect(await web3.eth.getCode(whitelist.address)).to.be.not.oneOf(["0x", "0x0"]);
        });

        describe("with invalid parameters", () => {

            it("fails if whitelist is zero address", async () => {
                let reason = await reject.deploy(StokrToken.new(tokenName,
                                                                tokenSymbol,
                                                                ZERO_ADDRESS,
                                                                profitDepositor,
                                                                profitDistributor,
                                                                tokenRecoverer,
                                                                {from: owner}));
                expect(reason).to.equal("Whitelist address is zero");
            });

            it("fails if profitDepositor is zero address", async () => {
                let reason = await reject.deploy(StokrToken.new(tokenName,
                                                                tokenSymbol,
                                                                whitelist.address,
                                                                ZERO_ADDRESS,
                                                                profitDistributor,
                                                                tokenRecoverer,
                                                                {from: owner}));
                expect(reason).to.equal("New profit depositor is zero");
            });

            it("fails if profitDistributor is zero address", async () => {
                let reason = await reject.deploy(StokrToken.new(tokenName,
                                                                tokenSymbol,
                                                                whitelist.address,
                                                                profitDepositor,
                                                                ZERO_ADDRESS,
                                                                tokenRecoverer,
                                                                {from: owner}));
                expect(reason).to.equal("New profit distributor is zero");
            });

            it("fails if tokenRecoverer is zero address", async () => {
                let reason = await reject.deploy(StokrToken.new(tokenName,
                                                                tokenSymbol,
                                                                whitelist.address,
                                                                profitDepositor,
                                                                profitDistributor,
                                                                ZERO_ADDRESS,
                                                                {from: owner}));
                expect(reason).to.equal("New token recoverer is zero");
            });
        });

        describe("with valid parameters", () => {
            let token;

            it("succeeds", async () => {
                token = await StokrToken.new(tokenName,
                                             tokenSymbol,
                                             whitelist.address,
                                             profitDepositor,
                                             profitDistributor,
                                             tokenRecoverer,
                                             {from: owner});
                expect(await web3.eth.getCode(token.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await token.owner()).to.equal(owner);
            });

            it("sets correct name", async () => {
                expect(await token.name()).to.equal(tokenName);
            });

            it("sets correct symbol", async () => {
                expect(await token.symbol()).to.equal(tokenSymbol);
            });

            it("sets decimals to 18", async () => {
                expect(await token.decimals()).to.be.bignumber.equal(toBN(18));
            });

            it("sets correct whitelist", async () => {
                expect(await token.whitelist()).to.equal(whitelist.address);
            });

            it("sets correct profitDepositor", async () => {
                expect(await token.profitDepositor()).to.equal(profitDepositor);
            });

            it("sets correct profitDistributor", async () => {
                expect(await token.profitDistributor()).to.equal(profitDistributor);
            });

            it("sets correct tokenRecoverer", async () => {
                expect(await token.tokenRecoverer()).to.equal(tokenRecoverer);
            });

            it("sets minter to zero address", async () => {
                expect(await token.minter()).to.equal(ZERO_ADDRESS);
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
    context("address change", () => {
        let whitelist, token;

        before("deploy contracts", async () => {
            whitelist = await Whitelist.new({from: owner});
            token = await StokrToken.new(tokenName,
                                         tokenSymbol,
                                         whitelist.address,
                                         profitDepositor,
                                         profitDistributor,
                                         tokenRecoverer,
                                         {from: owner});
        });

        describe("of whitelist", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(
                    token.setWhitelist(randomAddress(), {from: anyone}));
                expect(reason).to.equal("Restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(
                    token.setWhitelist(ZERO_ADDRESS, {from: owner}));
                expect(reason).to.equal("Whitelist address is zero");
            });

            it("is possible", async () => {
                let newWhitelist = randomAddress();
                await token.setWhitelist(newWhitelist, {from: owner});
                expect(await token.whitelist()).to.equal(newWhitelist);
            });

            it("gets logged", async () => {
                let oldWhitelist = await token.whitelist();
                let newWhitelist = randomAddress();
                let tx = await token.setWhitelist(newWhitelist, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "WhitelistChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.equal(oldWhitelist);
                expect(entry.args.current).to.equal(newWhitelist);
            });

            it("doesn't get logged if set to same address again", async () => {
                let currentWhitelist = await token.whitelist();
                let tx = await token.setWhitelist(currentWhitelist, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "WhitelistChange");
                expect(entry).to.not.exist;
            });
        });

        describe("of profit depositor", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(
                    token.setProfitDepositor(randomAddress(), {from: anyone}));
                expect(reason).to.equal("Restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(
                    token.setProfitDepositor(ZERO_ADDRESS, {from: owner}));
                expect(reason).to.equal("New profit depositor is zero");
            });

            it("is possible", async () => {
                let newProfitDepositor = randomAddress();
                await token.setProfitDepositor(newProfitDepositor, {from: owner});
                expect(await token.profitDepositor()).to.equal(newProfitDepositor);
            });

            it("gets logged", async () => {
                let oldProfitDepositor = await token.profitDepositor();
                let newProfitDepositor = randomAddress();
                let tx = await token.setProfitDepositor(newProfitDepositor, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ProfitDepositorChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.equal(oldProfitDepositor);
                expect(entry.args.current).to.equal(newProfitDepositor);
            });

            it("doesn't get logged if set to same address again", async () => {
                let profitDepositor = await token.profitDepositor();
                let tx = await token.setProfitDepositor(profitDepositor, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ProfitDepositorChange");
                expect(entry).to.not.exist;
            });
        });

        describe("of profit distributor", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(
                    token.setProfitDistributor(randomAddress(), {from: anyone}));
                expect(reason).to.equal("Restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(
                    token.setProfitDistributor(ZERO_ADDRESS, {from: owner}));
                expect(reason).to.equal("New profit distributor is zero");
            });

            it("is possible", async () => {
                let newProfitDistributor = randomAddress();
                await token.setProfitDistributor(newProfitDistributor, {from: owner});
                expect(await token.profitDistributor()).to.equal(newProfitDistributor);
            });

            it("gets logged", async () => {
                let oldProfitDistributor = await token.profitDistributor();
                let newProfitDistributor = randomAddress();
                let tx = await token.setProfitDistributor(newProfitDistributor, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ProfitDistributorChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.equal(oldProfitDistributor);
                expect(entry.args.current).to.equal(newProfitDistributor);
            });

            it("doesn't get logged if set to same address again", async () => {
                let profitDistributor = await token.profitDistributor();
                let tx = await token.setProfitDistributor(profitDistributor, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ProfitDistributorChange");
                expect(entry).to.not.exist;
            });
        });

        describe("of token recoverer", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(
                    token.setTokenRecoverer(randomAddress(), {from: anyone}));
                expect(reason).to.equal("Restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(
                    token.setTokenRecoverer(ZERO_ADDRESS, {from: owner}));
                expect(reason).to.equal("New token recoverer is zero");
            });

            it("is possible", async () => {
                let newTokenRecoverer = randomAddress();
                await token.setTokenRecoverer(newTokenRecoverer, {from: owner});
                expect(await token.tokenRecoverer()).to.equal(newTokenRecoverer);
            });

            it("gets logged", async () => {
                let oldTokenRecoverer = await token.tokenRecoverer();
                let newTokenRecoverer = randomAddress();
                let tx = await token.setTokenRecoverer(newTokenRecoverer, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "TokenRecovererChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.equal(oldTokenRecoverer);
                expect(entry.args.current).to.equal(newTokenRecoverer);
            });

            it("doesn't get logged if set to same address again", async () => {
                let tokenRecoverer = await token.tokenRecoverer();
                let tx = await token.setTokenRecoverer(tokenRecoverer, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "TokenRecovererChange");
                expect(entry).to.not.exist;
            });
        });

        describe("of minter", () => {

            it("by anyone but owner is forbidden", async () => {
                let reason = await reject.call(
                    token.setMinter(randomAddress(), {from: anyone}));
                expect(reason).to.equal("Restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(
                    token.setMinter(ZERO_ADDRESS, {from: owner}));
                expect(reason).to.equal("Minter is zero");
            });

            it("is possible for the first time", async () => {
                await token.setMinter(minter, {from: owner});
                expect(await token.minter()).to.equal(minter);
            });

            it("is forbidden for the second time", async () => {
                let reason = await reject.call(
                    token.setMinter(randomAddress(), {from: owner}));
                expect(reason).to.equal("Minter has already been set");
            });
        });
    });

    // Tests of minting related functions.
    describe("minting", () => {
        let whitelist, token;

        context("until finish", () => {

            before("deploy contracts", async () => {
                [whitelist, token] = await deployWhitelistAndToken();
            });

            it("by anyone but minter is forbidden", async () => {
                let reason = await reject.call(
                    token.mint(investor1, toBN(1), {from: anyone}));
                expect(reason).to.equal("Restricted to minter");
            });

            it("for non-whitelisted beneficiary is forbidden", async () => {
                let reason = await reject.call(
                    token.mint(anyone, toBN(1), {from: minter}));
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("is possible", async () => {
                await token.mint(investor1, toBN(1000), {from: minter});
            });

            it("gets logged", async () => {
                const amount = toBN(1000);
                let tx = await token.mint(investor1, amount, {from: minter});
                let mintedEntry = tx.logs.find(entry => entry.event === "Minted");
                expect(mintedEntry).to.exist;
                expect(mintedEntry.args.to).to.equal(investor1);
                expect(mintedEntry.args.amount).to.be.bignumber.equal(amount);
                let transferEntry = tx.logs.find(entry => entry.event === "Transfer");
                expect(transferEntry).to.exist;
                expect(transferEntry.args.from).to.equal(ZERO_ADDRESS);
                expect(transferEntry.args.to).to.equal(investor1);
                expect(transferEntry.args.value).to.be.bignumber.equal(amount);
            });

            it("increases totalSupply", async () => {
                const amount = toBN(1000);
                let totalSupply = await token.totalSupply();
                await token.mint(investor1, amount, {from: minter});
                expect(await token.totalSupply())
                    .to.be.bignumber.equal(totalSupply.add(amount));
            });

            it("increases beneficiary's balance", async () => {
                const amount = toBN(1000);
                let balance = await token.balanceOf(investor1);
                await token.mint(investor1, amount, {from: minter});
                expect(await token.balanceOf(investor1))
                    .to.be.bignumber.equal(balance.add(amount));
            });

            it("finishing by anyone but minter is forbidden", async () => {
                let reason = await reject.call(token.finishMinting({from: anyone}));
                expect(reason).to.equal("Restricted to minter");
            });

            it("finishing is possible and gets logged", async () => {
                let tx = await token.finishMinting({from: minter});
                let entry = tx.logs.find(entry => entry.event === "MintFinished");
                expect(entry).to.exist
                expect(await token.totalSupplyIsFixed()).to.be.true;
            });
        });

        context("after finish", () => {

            before("deploy contracts", async () => {
                [whitelist, token] = await deployWhitelistAndToken();
                await token.finishMinting({from: minter});
            });

            it("is forbidden", async () => {
                let reason = await reject.call(
                    token.mint(investor1, toBN(1), {from: minter}));
                expect(reason).to.equal("Total supply has been fixed");
            });

            it("finishing is forbidden", async () => {
                let reason = await reject.call(token.finishMinting({from: minter}));
                expect(reason).to.equal("Total supply has been fixed");
            });
        });
    });

    // Tests of token transfer related functions.
    describe("transfer", () => {
        const [debited, credited] = investors;
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            await token.mint(debited, toBN(1000), {from: minter});
        });

        afterEach("invariant: sum of all token balances equals total supply", async () => {
            let totalSupply = await token.totalSupply();
            let sumOfBalances = toBN(0);
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                let balance = await token.balanceOf(investor);
                sumOfBalances = sumOfBalances.add(balance);
            }
            expect(sumOfBalances).to.be.bignumber.equal(totalSupply);
        });

        context("while minting", () => {

            it("is forbidden", async () => {
                expect(await token.canTransfer(debited, credited, toBN(1))).to.be.false;
                let reason = await reject.call(
                    token.transfer(credited, toBN(1), {from: debited}));
                expect(reason).to.equal("Total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("is forbidden if debited account isn't whitelisted", async () => {
                await whitelist.removeFromWhitelist([debited], {from: owner});
                expect(await token.canTransfer(debited, credited, toBN(1))).to.be.false;
                let reason = await reject.call(
                    token.transfer(credited, toBN(1), {from: debited}));
                await whitelist.addToWhitelist([debited], {from: owner});
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("is forbidden if credited account isn't whitelisted", async () => {
                await whitelist.removeFromWhitelist([credited], {from: owner});
                expect(await token.canTransfer(debited, credited, toBN(1))).to.be.false;
                let reason = await reject.call(
                    token.transfer(credited, toBN(1), {from: debited}));
                await whitelist.addToWhitelist([credited], {from: owner});
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("is forbidden if amount exceed balance", async () => {
                let amount = (await token.balanceOf(debited)).add(toBN(1));
                expect(await token.canTransfer(debited, credited, amount)).to.be.false;
                let reason = await reject.call(
                    token.transfer(credited, amount, {from: debited}));
                expect(reason).to.equal("Amount exceeds balance");
            });

            it("to zero address is forbidden", async () => {
                await whitelist.addToWhitelist([ZERO_ADDRESS], {from: owner});
                expect(await token.canTransfer(debited, ZERO_ADDRESS, toBN(0))).to.be.false;
                let reason = await reject.call(
                    token.transfer(ZERO_ADDRESS, toBN(0), {from: debited}));
                expect(reason).to.equal("Recipient is zero");
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                expect(await token.canTransfer(debited, credited, amount)).to.be.true;
                await token.transfer(credited, amount, {from: debited});
            });

            it("gets logged", async () => {
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                expect(await token.canTransfer(debited, credited, amount)).to.be.true;
                let tx = await token.transfer(credited, amount, {from: debited});
                let entry = tx.logs.find(entry => entry.event === "Transfer");
                expect(entry).to.exist;
                expect(entry.args.from).to.equal(debited);
                expect(entry.args.to).to.equal(credited);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("decreases debited balance", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.div(toBN(2));
                expect(await token.canTransfer(debited, credited, amount)).to.be.true;
                await token.transfer(credited, amount, {from: debited});
                expect(await token.balanceOf(debited))
                    .to.be.bignumber.equal(balance.sub(amount));
            });

            it("increases credited balance", async () => {
                let balance = await token.balanceOf(credited);
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                expect(await token.canTransfer(debited, credited, amount)).to.be.true;
                await token.transfer(credited, amount, {from: debited});
                expect(await token.balanceOf(credited))
                    .to.be.bignumber.equal(balance.add(amount));
            });
        });
    });

    // Tests of token approval related functions.
    describe("approval", () => {
        const approver = investors[0];
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            await token.mint(approver, toBN(1000), {from: minter});
        });

        context("while minting", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(
                    token.approve(trustee, toBN(1), {from: approver}));
                expect(reason).to.equal("Total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            beforeEach("reset allowance", async () => {
                await token.approve(trustee, toBN(0), {from: approver});
            });

            it("is forbidden if approver isn't whitelisted", async () => {
                await whitelist.removeFromWhitelist([approver], {from: owner});
                let reason = await reject.call(
                    token.approve(trustee, toBN(1), {from: approver}));
                await whitelist.addToWhitelist([approver], {from: owner});
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("increasing is forbidden if approver isn't whitelisted", async () => {
                await token.approve(trustee, toBN(1), {from: approver});
                await whitelist.removeFromWhitelist([approver], {from: owner});
                let reason = await reject.call(
                    token.increaseAllowance(trustee, toBN(1), {from: approver}));
                await whitelist.addToWhitelist([approver], {from: owner});
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("decreasing is forbidden if approver isn't whitelisted", async () => {
                await token.approve(trustee, toBN(1), {from: approver});
                await whitelist.removeFromWhitelist([approver], {from: owner});
                let reason = await reject.call(
                    token.decreaseAllowance(trustee, toBN(1), {from: approver}));
                await whitelist.addToWhitelist([approver], {from: owner});
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("increasing is forbidden if allowance overflows", async () => {
                let amount = toBN(2).pow(toBN(256)).sub(toBN(1));
                await token.approve(trustee, amount, {from: approver});
                let reason = await reject.call(
                    token.increaseAllowance(trustee, toBN(1), {from: approver}));
                expect(reason).to.equal("Allowance overflow");
            });

            it("decreasing is forbidden if amount is above allowance", async () => {
                await token.approve(trustee, toBN(1), {from: approver});
                let reason = await reject.call(
                    token.decreaseAllowance(trustee, toBN(2), {from: approver}));
                expect(reason).to.equal("Amount exceeds allowance");
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                await token.approve(trustee, amount, {from: approver});
            });

            it("gets logged", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                let tx = await token.approve(trustee, amount, {from: approver});
                let entry = tx.logs.find(entry => entry.event === "Approval");
                expect(entry).to.exist;
                expect(entry.args.owner).to.equal(approver);
                expect(entry.args.spender).to.equal(trustee);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("sets correct allowance", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                await token.approve(trustee, amount, {from: approver});
                expect(await token.allowance(approver, trustee))
                    .to.be.bignumber.equal(amount);
            });

            it("increasing is possible", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                await token.approve(trustee, amount, {from: approver});
                await token.increaseAllowance(trustee, toBN(1), {from: approver});
            });

            it("increasing gets logged", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                await token.approve(trustee, amount, {from: approver});
                let tx = await token.increaseAllowance(trustee, toBN(1), {from: approver});
                let entry = tx.logs.find(entry => entry.event === "Approval");
                expect(entry).to.exist;
                expect(entry.args.owner).to.equal(approver);
                expect(entry.args.spender).to.equal(trustee);
                expect(entry.args.value).to.be.bignumber.equal(amount.add(toBN(1)));
            });

            it("increasing sets correct allowance", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                await token.approve(trustee, amount, {from: approver});
                await token.increaseAllowance(trustee, toBN(1), {from: approver});
                expect(await token.allowance(approver, trustee))
                    .to.be.bignumber.equal(amount.add(toBN(1)));
            });

            it("decreasing is possible", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                await token.approve(trustee, amount, {from: approver});
                await token.decreaseAllowance(trustee, toBN(1), {from: approver});
            });

            it("decreasing gets logged", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                await token.approve(trustee, amount, {from: approver});
                let tx = await token.decreaseAllowance(trustee, toBN(1), {from: approver});
                let entry = tx.logs.find(entry => entry.event === "Approval");
                expect(entry).to.exist;
                expect(entry.args.owner).to.equal(approver);
                expect(entry.args.spender).to.equal(trustee);
                expect(entry.args.value).to.be.bignumber.equal(amount.sub(toBN(1)));
            });

            it("decreasing sets correct allowance", async () => {
                let amount = (await token.balanceOf(approver)).add(toBN(1));
                await token.approve(trustee, amount, {from: approver});
                await token.decreaseAllowance(trustee, toBN(1), {from: approver});
                expect(await token.allowance(approver, trustee))
                    .to.be.bignumber.equal(amount.sub(toBN(1)));
            });
        });
    });

    // Tests of approved transfer related functions.
    describe("approved transfer", () => {
        const [debited, credited] = investors;
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            await token.mint(debited, toBN(1000), {from: minter});
        });

        afterEach("invariant: sum of all token balances equals total supply", async () => {
            let totalSupply = await token.totalSupply();
            let sumOfBalances = toBN(0);
            for (let i = 0; i < investors.length; ++i) {
                let investor = investors[i];
                let balance = await token.balanceOf(investor);
                sumOfBalances = sumOfBalances.add(balance);
            }
            expect(sumOfBalances).to.be.bignumber.equal(totalSupply);
        });

        context("while minting", () => {

            it("is forbidden", async () => {
                expect(await token.canTransferFrom(trustee, debited, credited, toBN(0)))
                    .to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, toBN(0), {from: trustee}));
                expect(reason).to.equal("Total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            beforeEach("reset allowance", async () => {
                await token.approve(trustee, toBN(0), {from: debited});
            });

            it("is forbidden if debited account isn't whitelisted", async () => {
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                await token.approve(trustee, amount, {from: debited});
                await whitelist.removeFromWhitelist([debited], {from: owner});
                expect(await token.canTransferFrom(trustee, debited, credited, amount))
                    .to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, amount, {from: trustee}));
                await whitelist.addToWhitelist([debited], {from: owner});
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("is forbidden if credited account isn't whitelisted", async () => {
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                await token.approve(trustee, amount, {from: debited});
                await whitelist.removeFromWhitelist([credited], {from: owner});
                expect(await token.canTransferFrom(trustee, debited, credited, amount))
                    .to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, amount, {from: trustee}));
                await whitelist.addToWhitelist([credited], {from: owner});
                expect(reason).to.equal("Address is not whitelisted");
            });

            it("is forbidden if credited account is zero", async () => {
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                await token.approve(trustee, amount, {from: debited});
                await whitelist.addToWhitelist([ZERO_ADDRESS], {from: owner});
                expect(await token.canTransferFrom(trustee, debited, ZERO_ADDRESS, amount))
                    .to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, ZERO_ADDRESS, amount, {from: trustee}));
                expect(reason).to.equal("Recipient is zero");
            });

            it("is forbidden if amount exceeds allowance", async () => {
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount.add(toBN(1))))
                    .to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, amount.add(toBN(1)), {from: trustee}));
                expect(reason).to.equal("Amount exceeds allowance");
            });

            it("is forbidden if amount exceeds balance", async () => {
                let amount = (await token.balanceOf(debited)).add(toBN(1));
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount))
                    .to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, amount, {from: trustee}));
                expect(reason).to.equal("Amount exceeds balance");
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount))
                    .to.be.true;
                let tx = await token.transferFrom(debited, credited, amount, {from: trustee});
                let entry = tx.logs.find(entry => entry.event === "Transfer");
                expect(entry).to.exist;
                expect(entry.args.from).to.equal(debited);
                expect(entry.args.to).to.equal(credited);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("decreases allowance", async () => {
                let allowance = await token.balanceOf(debited);
                await token.approve(trustee, allowance, {from: debited});
                let amount = allowance.div(toBN(3));
                expect(await token.canTransferFrom(trustee, debited, credited, amount))
                    .to.be.true;
                let tx = await token.transferFrom(debited, credited, amount, {from: trustee});
                expect(await token.allowance(debited, trustee))
                    .to.be.bignumber.equal(allowance.sub(amount));
            });

            it("decreases debited balance", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.div(toBN(2));
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount))
                    .to.be.true;
                await token.transferFrom(debited, credited, amount, {from: trustee});
                expect(await token.balanceOf(debited))
                    .to.be.bignumber.equal(balance.sub(amount));
            });

            it("increases credited balance", async () => {
                let balance = await token.balanceOf(credited);
                let amount = (await token.balanceOf(debited)).div(toBN(2));
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount))
                    .to.be.true;
                await token.transferFrom(debited, credited, amount, {from: trustee});
                expect(await token.balanceOf(credited))
                    .to.be.bignumber.equal(balance.add(amount));
            });
        });
    });

    // Tests of profit deposit related functions.
    describe("profit deposit", () => {
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            token.mint(investor1, toBN(1), {from: minter});
        });

        context("while minting", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(
                    token.depositProfit({from: profitDepositor, value: ether(1)}));
                expect(reason).to.equal("Total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("by anyone but profit depositor is forbidden", async () => {
                let reason = await reject.call(
                    token.depositProfit({from: anyone, value: ether(1)}));
                expect(reason).to.equal("Restricted to profit depositor");
            });

            it("by anyone but profit depositor via fallback function is forbidden", async () => {
                let reason = await reject.tx({from: anyone, to: token.address, value: ether(1)});
                expect(reason).to.equal("Restricted to profit depositor");
            });

            it("is possible", async () => {
                await token.depositProfit({from: profitDepositor, value: ether(2)});
            });

            it("gets logged", async () => {
                let value = ether(2);
                let tx = await token.depositProfit({from: profitDepositor, value});
                let entry = tx.logs.find(entry => entry.event === "ProfitDeposit");
                expect(entry).to.exist;
                expect(entry.args.depositor).to.equal(profitDepositor);
                expect(entry.args.amount).to.be.bignumber.equal(value);
            });

            it("via fallback function is possible", async () => {
                let asset = toBN(await web3.eth.getBalance(token.address));
                let value = ether(2);
                await web3.eth.sendTransaction({from: profitDepositor, to: token.address, value});
                expect(toBN(await web3.eth.getBalance(token.address)))
                    .to.be.bignumber.equal(asset.add(value));
            });

            it("via fallback function with data is forbidden", async () => {
                let reason = await reject.tx({from: profitDepositor,
                                              to: token.address, value: ether(2), data: "0x01"});
                expect(reason).to.equal("Fallback call with data");
            });

            it("increases wei balance", async () => {
                let asset = toBN(await web3.eth.getBalance(token.address));
                let value = ether(2);
                await token.depositProfit({from: profitDepositor, value});
                expect(toBN(await web3.eth.getBalance(token.address)))
                    .to.be.bignumber.equal(asset.add(value));
            });

            it("increases totalProfits", async () => {
                let profits = await token.totalProfits();
                let value = ether(2);
                await token.depositProfit({from: profitDepositor, value});
                expect(await token.totalProfits())
                    .to.be.bignumber.equal(profits.add(value));
            });

            it("via fallback function increases totalProfits", async () => {
                let profits = await token.totalProfits();
                let value = ether(2);
                let tx = await web3.eth.sendTransaction({from: profitDepositor,
                                                         to: token.address,
                                                         value});
                expect(await token.totalProfits())
                    .to.be.bignumber.equal(profits.add(value));
            });
        });
    });

    // Tests of profit deposit related functions.
    describe("profit deposit (edge case: no tokens minted)", () => {
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("is forbidden if no tokens were minted", async () => {
                let reason = await reject.call(
                    token.depositProfit({from: profitDepositor, value: ether(1)}));
                expect(reason).to.equal("Total supply is zero");
            });
        });
    });

    // Tests of profit sharing related functions.
    describe("profit share", () => {
        let whitelist, token;

        // Helper function to read an account.
        const getAccount = async (address) => {
            let {balance, lastTotalProfits, profitShare} = await token.accounts(address);
            return {balance, lastTotalProfits, profitShare};
        };

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            // mint some tokens for the benefit of investors
            // Note: in order to make the tests working correctly, ensure that in
            //       all test scenarios the individual tokens share is a finite
            //       binary fraction of total token supply.
            await token.mint(investor1, toBN(4000), {from: minter});  // 1/2
            await token.mint(investor2, toBN(3000), {from: minter});  // 3/8
            await token.mint(investor3, toBN(1000), {from: minter});  // 1/8
        });

        afterEach("invariant: sum of individual profits equals token wei balance", async () => {
            let asset = toBN(await web3.eth.getBalance(token.address));
            let shares = toBN(0);
            for (let investor of investors.values()) {
                shares = shares.add(await token.profitShareOwing(investor));
            }
            expect(shares).to.be.bignumber.equal(asset);
        });

        context("while minting", () => {

            it("is not calculated", async () => {
                for (let investor of investors.values()) {
                    expect(await token.profitShareOwing(investor)).to.be.bignumber.zero;
                }
            });

            it("updating is forbidden", async () => {
                for (let investor of investors.values()) {
                    let reason = await reject.call(token.updateProfitShare(investor));
                    expect(reason).to.equal("Total supply may change");
                }
            });

            it("withdrawal is forbidden", async () => {
                for (let investor of investors.values()) {
                    let reason = await reject.call(token.withdrawProfitShare({from: investor}));
                    expect(reason).to.equal("Total supply may change");
                }
            });

            it("withdrawal to third party is forbidden", async () => {
                let beneficiary = randomAddress();
                for (let investor of investors.values()) {
                    let reason = await reject.call(
                        token.withdrawProfitShareTo(beneficiary, {from: investor}));
                    expect(reason).to.equal("Total supply may change");
                }
            });

            it("withdrawal for many is forbidden", async () => {
                let reason = await reject.call(
                    token.withdrawProfitShares(investors, {from: profitDistributor}));
                expect(reason).to.equal("Total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("is correctly calculated as share of investors' token balances", async () => {
                let supply = await token.totalSupply();
                let profits = await token.totalProfits();
                for (let investor of investors.values()) {
                    let balance = await token.balanceOf(investor);
                    let owing = await token.profitShareOwing(investor);
                    let share = (await getAccount(investor)).profitShare;
                    // Prerequisite: no individual profit share was disbursed before
                    // Use equivalence:
                    //      (profitShareOwing - profitShare) / totalProfits == balance / totalSupply
                    // <=>  (profitShareOwing - profitShare) * totalSupply  == balance * totalProfits
                    expect(owing.sub(share).mul(supply))
                        .to.be.bignumber.equal(balance.mul(profits));
                }
            });

            it("is correctly disbursed to investors", async () => {
                let profits = await token.totalProfits();
                for (let investor of investors.values()) {
                    let account = await getAccount(investor);
                    let owing = await token.profitShareOwing(investor);
                    let tx = await token.updateProfitShare(investor, {from: anyone});
                    let entry = tx.logs.find(entry => entry.event === "ProfitShareUpdate");
                    expect(entry).to.exist;
                    expect(entry.args.investor).to.equal(investor);
                    expect(entry.args.amount).to.be.bignumber.equal(owing);
                    expect((await getAccount(investor)).lastTotalProfits)
                        .to.be.bignumber.equal(profits);
                    expect((await getAccount(investor)).profitShare)
                        .to.be.bignumber.equal(account.profitShare.add(owing));
                }
            });

            it("is correctly calculated after some more profit was deposited", async () => {
                await token.depositProfit({from: profitDepositor, value: ether(8)});
                let supply = await token.totalSupply();
                let profits = await token.totalProfits();
                for (let investor of investors.values()) {
                    let balance = await token.balanceOf(investor);
                    let owing = await token.profitShareOwing(investor);
                    // Prerequiste: no tokens were transferred before
                    // Use equivalence:
                    //      profitShareOwing / totalProfits == balance / totalSupply
                    // <=>  profitShareOwing * totalSupply  == balance * totalProfits
                    expect(owing.mul(supply)).to.be.bignumber.equal(balance.mul(profits));
                }
            });

            it("is correctly calculated after some tokens transfer and profit deposit", async () => {
                let supply = await token.totalSupply();
                let value = ether(4);
                await token.transfer(investor2, toBN(2000), {from: investor1});
                let balance1 = await token.balanceOf(investor1);
                let balance2 = await token.balanceOf(investor2);
                await token.depositProfit({from: profitDepositor, value});
                let owing1 = await token.profitShareOwing(investor1);
                let owing2 = await token.profitShareOwing(investor2);
                let share1 = (await getAccount(investor1)).profitShare;
                let share2 = (await getAccount(investor2)).profitShare;
                // Use equivalence:
                //      (profitShareOwing - profitShare) / additionalProfit == balance / totalSupply
                // <=>  (profitShareOwing - profitShare) * totalSupply      == balance * additionalProfits
                expect(owing1.sub(share1).mul(supply))
                    .to.be.bignumber.equal(balance1.mul(value));
                expect(owing2.sub(share2).mul(supply))
                    .to.be.bignumber.equal(balance2.mul(value));
            });

            it("can be withdrawn", async () => {
                let owing = await token.profitShareOwing(investor1);
                let asset = toBN(await web3.eth.getBalance(token.address));
                let tx = await token.withdrawProfitShare({from: investor1});
                let entry = tx.logs.find(entry => entry.event === "ProfitShareWithdrawal");
                expect(entry).to.exist;
                expect(entry.args.investor).to.equal(investor1);
                expect(entry.args.beneficiary).to.equal(investor1);
                expect(entry.args.amount).to.be.bignumber.equal(owing);
                expect((await getAccount(investor1)).profitShare)
                    .to.be.bignumber.zero;
                expect(toBN(await web3.eth.getBalance(token.address)))
                    .to.be.bignumber.equal(asset.sub(owing));
            });

            it("of zero can be withdrawn by anyone", async () => {
                await token.depositProfit({from: profitDepositor, value: ether(2)});
                let asset = toBN(await web3.eth.getBalance(token.address));
                let tx = await token.withdrawProfitShare({from: anyone});
                let entry = tx.logs.find(entry => entry.event === "ProfitShareWithdrawal");
                expect(entry).to.exist;
                expect(entry.args.investor).to.equal(anyone);
                expect(entry.args.beneficiary).to.equal(anyone);
                expect(entry.args.amount).to.be.bignumber.zero;
                expect(toBN(await web3.eth.getBalance(token.address)))
                    .to.be.bignumber.equal(asset);
            });

            it("can be withdrawn to third party", async () => {
                let beneficiary = anyone;
                let owing = await token.profitShareOwing(investor2);
                let asset = toBN(await web3.eth.getBalance(beneficiary));
                let tx = await token.withdrawProfitShareTo(beneficiary, {from: investor2});
                let entry = tx.logs.find(entry => entry.event === "ProfitShareWithdrawal");
                expect(entry).to.exist;
                expect(entry.args.investor).to.equal(investor2);
                expect(entry.args.beneficiary).to.equal(beneficiary);
                expect(entry.args.amount).to.be.bignumber.equal(owing);
                expect((await getAccount(investor2)).profitShare)
                    .to.be.bignumber.zero;
                expect(toBN(await web3.eth.getBalance(beneficiary)))
                    .to.be.bignumber.equal(asset.add(owing));
            });

            it("withdrawal to many by anyone is forbidden", async () => {
                let reason = await reject.call(token.withdrawProfitShares(investors, {from: anyone}));
                expect(reason).to.equal("Restricted to profit distributor");
            });

            it("can be withdrawn for many", async () => {
                let owing = await token.profitShareOwing(investor3);
                let asset = toBN(await web3.eth.getBalance(investor3));
                let tx = await token.withdrawProfitShares(investors, {from: profitDistributor});
                let entries = tx.logs.filter(entry => entry.event === "ProfitShareWithdrawal");
                expect(entries).to.have.lengthOf(investors.length);
                let entry = entries.find(entry => entry.args.investor === investor3);
                expect(entry).to.exist;
                expect(entry.args.beneficiary).to.equal(investor3);
                expect((await getAccount(investor3)).profitShare)
                    .to.be.bignumber.zero;
                expect(toBN(await web3.eth.getBalance(investor3)))
                    .to.be.bignumber.equal(asset.add(owing));
            });
        });
    });


    // Tests of token recovery related functions.
    describe("token recovery", () => {
        let whitelist, token, totalSupply;

        // Helper function to read an account.
        const getAccount = async (address) => {
            let {balance, lastTotalProfits, profitShare} = await token.accounts(address);
            return {balance, lastTotalProfits, profitShare};
        };

        before("deploy contracts and add investors", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            // mint some tokens for the benefit of first two investors
            await token.mint(investor1, toBN(1000), {from: minter});
            await token.mint(investor2, toBN(2000), {from: minter});
            totalSupply = toBN(1000 + 2000);
            await token.finishMinting({from: minter});
            // deposit profits and disburse them to first two investors
            await token.depositProfit({from: profitDepositor, value: ether(1)});
            await token.updateProfitShare(investor1);
            await token.updateProfitShare(investor2);
        });

        afterEach("invariant: total token supply doesn't change", async () => {
            expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
        });

        it("is forbidden by anyone other than token recoverer", async () => {
            let reason = await reject.call(
                token.recoverToken(investor2, investor3, {from: anyone}));
            expect(reason).to.equal("Restricted to token recoverer");
        });

        it("is forbidden if new address isn't whitelisted", async () => {
            await whitelist.removeFromWhitelist([investor3], {from: owner});
            let reason = await reject.call(
                token.recoverToken(investor2, investor3, {from: tokenRecoverer}));
            await whitelist.addToWhitelist([investor3], {from: owner});
            expect(reason).to.equal("Address is not whitelisted");
        });

        it("is forbidden if new address is an already used account", async () => {
            let reason = await reject.call(
                token.recoverToken(investor1, investor2, {from: tokenRecoverer}));
            expect(reason).to.equal("New address exists already");
        });

        it("is possible", async () => {
            let account = await getAccount(investor2);
            await token.recoverToken(investor2, investor3, {from: tokenRecoverer});
            let oldAccount = await getAccount(investor2);
            expect(oldAccount.balance).to.be.bignumber.zero;
            expect(oldAccount.lastTotalProfits).to.be.bignumber.zero;
            expect(oldAccount.profitShare).to.be.bignumber.zero;
            let newAccount = await getAccount(investor3);
            expect(newAccount.balance).to.be.bignumber.equal(account.balance);
            expect(newAccount.lastTotalProfits).to.be.bignumber.equal(account.lastTotalProfits);
            expect(newAccount.profitShare).to.be.bignumber.equal(account.profitShare);
        });

        it("gets logged", async () => {
            let tx = await token.recoverToken(investor3, investor2, {from: tokenRecoverer});
            let entry = tx.logs.find(entry => entry.event === "TokenRecovery");
            expect(entry).to.exist;
            expect(entry.args.oldAddress).to.equal(investor3);
            expect(entry.args.newAddress).to.equal(investor2);
        });
    });

    describe("destruction", () => {
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
        });

        it("by anyone but minter is forbidden", async () => {
            let reason = await reject.call(token.destruct({from: anyone}));
            expect(reason).to.equal("Restricted to minter");
        });

        it("transfers ether balance to owner and gets logged", async () => {
            let value = ether(2);
            await token.mint(investor1, toBN(1), {from: minter});
            await token.finishMinting({from: minter});
            await token.depositProfit({value, from: profitDepositor});
            let balance = toBN(await web3.eth.getBalance(owner));
            let tx = await token.destruct({from: minter});
            let entry = tx.logs.find(entry => entry.event === "TokenDestroyed");
            expect(entry).to.exist;
            expect(toBN(await web3.eth.getBalance(owner)))
                .to.be.bignumber.equal(balance.add(value));
        });
    });

    describe("transaction costs", () => {
        const CL_CYAN = "\u001b[36m";
        const CL_GRAY = "\u001b[90m";
        const CL_DEFAULT = "\u001b[0m";

        it("of profit withdrawal for many investors", async () => {
            let maximum;
            let count = 0;
            let next = bisection.new(count);
            while (isFinite(count)) {
                let [whitelist, token] = await deployWhitelistAndToken();
                let investors = [];
                for (let i = 0; i < count; ++i) {
                    let investor = randomAddress();
                    investors.push(investor);
                    await whitelist.addToWhitelist([investor], {from: owner});
                    await token.mint(investor, toBN(1000), {from: minter});
                }
                await token.finishMinting({from: minter});
                if (count > 0) {
                    await token.depositProfit({from: profitDepositor, value: ether(1)});
                }
                let message = `of profit withdrawal for ${count} investors: `;
                try {
                    let tx = await token.withdrawProfitShares(investors, {from: profitDistributor});
                    maximum = count;
                    message += `${tx.receipt.gasUsed} gas`;
                    count = tx.receipt.gasUsed <= 8000000 ? next(true) : NaN;
                }
                catch (error) {
                    message += "failed";
                    count = next(false);
                }
                console.log(" ".repeat(6) + `${CL_CYAN}→ ${CL_GRAY}${message}${CL_DEFAULT}`);
            }
            expect(maximum).to.be.above(2);
        });
    });

});

