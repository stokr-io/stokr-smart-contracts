"use strict";

const ERC20 = artifacts.require("./token/ERC20.sol");
const Whitelist = artifacts.require("./whitelist/Whitelist.sol");
const StokrToken = artifacts.require("./token/StokrToken.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject} = require("./helpers/common");


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
        const adheresTo = (node, definition) =>
            node.type === "function" && definition.type === "function"
            && node.name === definition.name
            && node.inputs.length === definition.inputs.length
            && node.inputs.every((param, i) => param.type === definition.inputs[i].type)
            && node.payable === definition.payable
            && node.stateMutability === definition.stateMutability
            && (node.outputs === undefined && definition.outputs === undefined
                || node.outputs.length === definition.outputs.length
                && node.outputs.every((param, i) => param.type === definition.outputs[i].type));

        it("adheres to ERC20", async () => {
            for (let definition of ERC20.abi.filter(node => node.type === "function").values()) {
                let node = StokrToken.abi.find(node => adheresTo(node, definition));

                expect(node,`function ${definition.name}`).to.exist;
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
                                                                0x0,
                                                                profitDepositor,
                                                                profitDistributor,
                                                                tokenRecoverer,
                                                                {from: owner}));
                expect(reason).to.be.equal("whitelist address is zero");
            });

            it("fails if profitDepositor is zero address", async () => {
                let reason = await reject.deploy(StokrToken.new(tokenName,
                                                                tokenSymbol,
                                                                whitelist.address,
                                                                0x0,
                                                                profitDistributor,
                                                                tokenRecoverer,
                                                                {from: owner}));
                expect(reason).to.be.equal("new profit depositor is zero");
            });

            it("fails if profitDistributor is zero address", async () => {
                let reason = await reject.deploy(StokrToken.new(tokenName,
                                                                tokenSymbol,
                                                                whitelist.address,
                                                                profitDepositor,
                                                                0x0,
                                                                tokenRecoverer,
                                                                {from: owner}));
                expect(reason).to.be.equal("new profit distributor is zero");
            });

            it("fails if tokenRecoverer is zero address", async () => {
                let reason = await reject.deploy(StokrToken.new(tokenName,
                                                                tokenSymbol,
                                                                whitelist.address,
                                                                profitDepositor,
                                                                profitDistributor,
                                                                0x0,
                                                                {from: owner}));
                expect(reason).to.be.equal("new token recoverer is zero");
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
                expect(await token.owner()).to.be.bignumber.equal(owner);
            });

            it("sets correct name", async () => {
                expect(await token.name()).to.be.equal(tokenName);
            });

            it("sets correct symbol", async () => {
                expect(await token.symbol()).to.be.equal(tokenSymbol);
            });

            it("sets decimals to 18", async () => {
                expect(await token.decimals()).to.be.bignumber.equal(18);
            });

            it("sets correct whitelist", async () => {
                expect(await token.whitelist()).to.be.bignumber.equal(whitelist.address);
            });

            it("sets correct profitDepositor", async () => {
                expect(await token.profitDepositor()).to.be.bignumber.equal(profitDepositor);
            });

            it("sets correct profitDistributor", async () => {
                expect(await token.profitDistributor()).to.be.bignumber.equal(profitDistributor);
            });

            it("sets correct tokenRecoverer", async () => {
                expect(await token.tokenRecoverer()).to.be.bignumber.equal(tokenRecoverer);
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
                let reason = await reject.call(token.setWhitelist(random.address(), {from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(token.setWhitelist(0x0, {from: owner}));
                expect(reason).to.be.equal("whitelist address is zero");
            });

            it("is possible", async () => {
                let newWhitelist = random.address();
                await token.setWhitelist(newWhitelist, {from: owner});
                expect(await token.whitelist()).to.be.bignumber.equal(newWhitelist);
            });

            it("gets logged", async () => {
                let oldWhitelist = await token.whitelist();
                let newWhitelist = random.address();
                let tx = await token.setWhitelist(newWhitelist, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "WhitelistChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldWhitelist);
                expect(entry.args.current).to.be.bignumber.equal(newWhitelist);
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
                let reason = await reject.call(token.setProfitDepositor(random.address(), {from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(token.setProfitDepositor(0x0, {from: owner}));
                expect(reason).to.be.equal("new profit depositor is zero");
            });

            it("is possible", async () => {
                let newProfitDepositor = random.address();
                await token.setProfitDepositor(newProfitDepositor, {from: owner});
                expect(await token.profitDepositor()).to.be.bignumber.equal(newProfitDepositor);
            });

            it("gets logged", async () => {
                let oldProfitDepositor = await token.profitDepositor();
                let newProfitDepositor = random.address();
                let tx = await token.setProfitDepositor(newProfitDepositor, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ProfitDepositorChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldProfitDepositor);
                expect(entry.args.current).to.be.bignumber.equal(newProfitDepositor);
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
                let reason = await reject.call(token.setProfitDistributor(random.address(), {from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(token.setProfitDistributor(0x0, {from: owner}));
                expect(reason).to.be.equal("new profit distributor is zero");
            });

            it("is possible", async () => {
                let newProfitDistributor = random.address();
                await token.setProfitDistributor(newProfitDistributor, {from: owner});
                expect(await token.profitDistributor()).to.be.bignumber.equal(newProfitDistributor);
            });

            it("gets logged", async () => {
                let oldProfitDistributor = await token.profitDistributor();
                let newProfitDistributor = random.address();
                let tx = await token.setProfitDistributor(newProfitDistributor, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "ProfitDistributorChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldProfitDistributor);
                expect(entry.args.current).to.be.bignumber.equal(newProfitDistributor);
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
                let reason = await reject.call(token.setTokenRecoverer(random.address(), {from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(token.setTokenRecoverer(0x0, {from: owner}));
                expect(reason).to.be.equal("new token recoverer is zero");
            });

            it("is possible", async () => {
                let newTokenRecoverer = random.address();
                await token.setTokenRecoverer(newTokenRecoverer, {from: owner});
                expect(await token.tokenRecoverer()).to.be.bignumber.equal(newTokenRecoverer);
            });

            it("gets logged", async () => {
                let oldTokenRecoverer = await token.tokenRecoverer();
                let newTokenRecoverer = random.address();
                let tx = await token.setTokenRecoverer(newTokenRecoverer, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "TokenRecovererChange");
                expect(entry).to.exist;
                expect(entry.args.previous).to.be.bignumber.equal(oldTokenRecoverer);
                expect(entry.args.current).to.be.bignumber.equal(newTokenRecoverer);
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
                let reason = await reject.call(token.setMinter(random.address(), {from: anyone}));
                expect(reason).to.be.equal("restricted to owner");
            });

            it("to zero is forbidden", async () => {
                let reason = await reject.call(token.setMinter(0x0, {from: owner}));
                expect(reason).to.be.equal("minter is zero");
            });

            it("is possible for the first time", async () => {
                await token.setMinter(minter, {from: owner});
                expect(await token.minter()).to.be.bignumber.equal(minter);
            });

            it("is forbidden for the second time", async () => {
                let reason = await reject.call(token.setMinter(random.address(), {from: owner}));
                expect(reason).to.be.equal("minter has already been set");
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
                let reason = await reject.call(token.mint(investor1, 1, {from: anyone}));
                expect(reason).to.be.equal("restricted to minter");
            });

            it("for non-whitelisted beneficiary is forbidden", async () => {
                let reason = await reject.call(token.mint(anyone, 1, {from: minter}));
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("is possible", async () => {
                await token.mint(investor1, 1000, {from: minter});
            });

            it("gets logged", async () => {
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

            it("finishing by anyone but minter is forbidden", async () => {
                let reason = await reject.call(token.finishMinting({from: anyone}));
                expect(reason).to.be.equal("restricted to minter");
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
                let reason = await reject.call(token.mint(investor1, 1, {from: minter}));
                expect(reason).to.be.equal("total supply has been fixed");
            });

            it("finishing is forbidden", async () => {
                let reason = await reject.call(token.finishMinting({from: minter}));
                expect(reason).to.be.equal("total supply has been fixed");
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

        context("while minting", () => {

            it("is forbidden", async () => {
                expect(await token.canTransfer(debited, credited, 1)).to.be.false;
                let reason = await reject.call(token.transfer(credited, 1, {from: debited}));
                expect(reason).to.be.equal("total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("is forbidden if debited account isn't whitelisted", async () => {
                await whitelist.removeFromWhitelist([debited], {from: owner});
                expect(await token.canTransfer(debited, credited, 1)).to.be.false;
                let reason = await reject.call(token.transfer(credited, 1, {from: debited}));
                await whitelist.addToWhitelist([debited], {from: owner});
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("is forbidden if credited account isn't whitelisted", async () => {
                await whitelist.removeFromWhitelist([credited], {from: owner});
                expect(await token.canTransfer(debited, credited, 1)).to.be.false;
                let reason = await reject.call(token.transfer(credited, 1, {from: debited}));
                await whitelist.addToWhitelist([credited], {from: owner});
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("is forbidden if amount exceed balance", async () => {
                let amount = (await token.balanceOf(debited)).plus(1);
                expect(await token.canTransfer(debited, credited, amount)).to.be.false;
                let reason = await reject.call(token.transfer(credited, amount, {from: debited}));
                expect(reason).to.be.equal("amount exceeds balance");
            });

            it("to zero address is forbidden", async () => {
                await whitelist.addToWhitelist([0x0], {from: owner});
                expect(await token.canTransfer(debited, 0x0, 0)).to.be.false;
                let reason = await reject.call(token.transfer(0x0, 0, {from: debited}));
                expect(reason).to.be.equal("recipient is zero");
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(debited)).divToInt(2);
                expect(await token.canTransfer(debited, credited, amount)).to.be.true;
                await token.transfer(credited, amount, {from: debited});
            });

            it("gets logged", async () => {
                let amount = (await token.balanceOf(debited)).divToInt(2);
                expect(await token.canTransfer(debited, credited, amount)).to.be.true;
                let tx = await token.transfer(credited, amount, {from: debited});
                let entry = tx.logs.find(entry => entry.event === "Transfer");
                expect(entry).to.exist;
                expect(entry.args.from).to.be.bignumber.equal(debited);
                expect(entry.args.to).to.be.bignumber.equal(credited);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("decreases debited balance", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.divToInt(2);
                expect(await token.canTransfer(debited, credited, amount)).to.be.true;
                await token.transfer(credited, amount, {from: debited});
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance.minus(amount));
            });

            it("increases credited balance", async () => {
                let balance = await token.balanceOf(credited);
                let amount = (await token.balanceOf(debited)).divToInt(2);
                expect(await token.canTransfer(debited, credited, amount)).to.be.true;
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

        context("while minting", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(token.approve(trustee, 1, {from: approver}));
                expect(reason).to.be.equal("total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            beforeEach("reset allowance", async () => {
                await token.approve(trustee, 0, {from: approver});
            });

            it("is forbidden if approver isn't whitelisted", async () => {
                await whitelist.removeFromWhitelist([approver], {from: owner});
                let reason = await reject.call(token.approve(trustee, 1, {from: approver}));
                await whitelist.addToWhitelist([approver], {from: owner});
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("increasing is forbidden if approver isn't whitelisted", async () => {
                await token.approve(trustee, 1, {from: approver});
                await whitelist.removeFromWhitelist([approver], {from: owner});
                let reason = await reject.call(token.increaseAllowance(trustee, 1, {from: approver}));
                await whitelist.addToWhitelist([approver], {from: owner});
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("decreasing is forbidden if approver isn't whitelisted", async () => {
                await token.approve(trustee, 1, {from: approver});
                await whitelist.removeFromWhitelist([approver], {from: owner});
                let reason = await reject.call(token.decreaseAllowance(trustee, 1, {from: approver}));
                await whitelist.addToWhitelist([approver], {from: owner});
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("increasing is forbidden if allowance overflows", async () => {
                await token.approve(trustee, (new BN(2)).pow(256).minus(1), {from: approver});
                let reason = await reject.call(token.increaseAllowance(trustee, 1, {from: approver}));
                expect(reason).to.be.equal("allowance overflow");
            });

            it("decreasing is forbidden if amount is above allowance", async () => {
                await token.approve(trustee, 1, {from: approver});
                let reason = await reject.call(token.decreaseAllowance(trustee, 2, {from: approver}));
                expect(reason).to.be.equal("amount exceeds allowance");
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
            });

            it("gets logged", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                let tx = await token.approve(trustee, amount, {from: approver});
                let entry = tx.logs.find(entry => entry.event === "Approval");
                expect(entry).to.exist;
                expect(entry.args.owner).to.be.bignumber.equal(approver);
                expect(entry.args.spender).to.be.bignumber.equal(trustee);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("sets correct allowance", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
                expect(await token.allowance(approver, trustee)).to.be.bignumber.equal(amount);
            });

            it("increasing is possible", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
                await token.increaseAllowance(trustee, 1, {from: approver});
            });

            it("increasing gets logged", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
                let tx = await token.increaseAllowance(trustee, 1, {from: approver});
                let entry = tx.logs.find(entry => entry.event === "Approval");
                expect(entry).to.exist;
                expect(entry.args.owner).to.be.bignumber.equal(approver);
                expect(entry.args.spender).to.be.bignumber.equal(trustee);
                expect(entry.args.value).to.be.bignumber.equal(amount.plus(1));
            });

            it("increasing sets correct allowance", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
                await token.increaseAllowance(trustee, 1, {from: approver});
                expect(await token.allowance(approver, trustee)).to.be.bignumber.equal(amount.plus(1));
            });

            it("decreasing is possible", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
                await token.decreaseAllowance(trustee, 1, {from: approver});
            });

            it("decreasing gets logged", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
                let tx = await token.decreaseAllowance(trustee, 1, {from: approver});
                let entry = tx.logs.find(entry => entry.event === "Approval");
                expect(entry).to.exist;
                expect(entry.args.owner).to.be.bignumber.equal(approver);
                expect(entry.args.spender).to.be.bignumber.equal(trustee);
                expect(entry.args.value).to.be.bignumber.equal(amount.minus(1));
            });

            it("decreasing sets correct allowance", async () => {
                let amount = (await token.balanceOf(approver)).plus(1);
                await token.approve(trustee, amount, {from: approver});
                await token.decreaseAllowance(trustee, 1, {from: approver});
                expect(await token.allowance(approver, trustee)).to.be.bignumber.equal(amount.minus(1));
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

        context("while minting", () => {

            it("is forbidden", async () => {
                expect(await token.canTransferFrom(trustee, debited, credited, 0)).to.be.false;
                let reason = await reject.call(token.transferFrom(debited, credited, 0, {from: trustee}));
                expect(reason).to.be.equal("total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            beforeEach("reset allowance", async () => {
                await token.approve(trustee, 0, {from: debited});
            });

            it("is forbidden if debited account isn't whitelisted", async () => {
                let amount = (await token.balanceOf(debited)).divToInt(2);
                await token.approve(trustee, amount, {from: debited});
                await whitelist.removeFromWhitelist([debited], {from: owner});
                expect(await token.canTransferFrom(trustee, debited, credited, amount)).to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, amount, {from: trustee}));
                await whitelist.addToWhitelist([debited], {from: owner});
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("is forbidden if credited account isn't whitelisted", async () => {
                let amount = (await token.balanceOf(debited)).divToInt(2);
                await token.approve(trustee, amount, {from: debited});
                await whitelist.removeFromWhitelist([credited], {from: owner});
                expect(await token.canTransferFrom(trustee, debited, credited, amount)).to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, amount, {from: trustee}));
                await whitelist.addToWhitelist([credited], {from: owner});
                expect(reason).to.be.equal("address is not whitelisted");
            });

            it("is forbidden if credited account is zero", async () => {
                let amount = (await token.balanceOf(debited)).divToInt(2);
                await token.approve(trustee, amount, {from: debited});
                await whitelist.addToWhitelist([0x0], {from: owner});
                expect(await token.canTransferFrom(trustee, debited, 0x0, amount)).to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, 0x0, amount, {from: trustee}));
                expect(reason).to.be.equal("recipient is zero");
            });

            it("is forbidden if amount exceeds allowance", async () => {
                let amount = (await token.balanceOf(debited)).divToInt(2);
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount.plus(1))).to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, amount.plus(1), {from: trustee}));
                expect(reason).to.be.equal("amount exceeds allowance");
            });

            it("is forbidden if amount exceeds balance", async () => {
                let amount = (await token.balanceOf(debited)).plus(1);
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount)).to.be.false;
                let reason = await reject.call(
                    token.transferFrom(debited, credited, amount, {from: trustee}));
                expect(reason).to.be.equal("amount exceeds balance");
            });

            it("is possible", async () => {
                let amount = (await token.balanceOf(debited)).dividedToIntegerBy(2);
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount)).to.be.true;
                let tx = await token.transferFrom(debited, credited, amount, {from: trustee});
                let entry = tx.logs.find(entry => entry.event === "Transfer");
                expect(entry).to.exist;
                expect(entry.args.from).to.be.bignumber.equal(debited);
                expect(entry.args.to).to.be.bignumber.equal(credited);
                expect(entry.args.value).to.be.bignumber.equal(amount);
            });

            it("decreases allowance", async () => {
                let allowance = await token.balanceOf(debited);
                await token.approve(trustee, allowance, {from: debited});
                let amount = allowance.dividedToIntegerBy(3);
                expect(await token.canTransferFrom(trustee, debited, credited, amount)).to.be.true;
                let tx = await token.transferFrom(debited, credited, amount, {from: trustee});
                expect(await token.allowance(debited, trustee)).to.be.bignumber.equal(allowance.minus(amount));
            });

            it("decreases debited balance", async () => {
                let balance = await token.balanceOf(debited);
                let amount = balance.dividedToIntegerBy(2);
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount)).to.be.true;
                await token.transferFrom(debited, credited, amount, {from: trustee});
                expect(await token.balanceOf(debited)).to.be.bignumber.equal(balance.minus(amount));
            });

            it("increases credited balance", async () => {
                let balance = await token.balanceOf(credited);
                let amount = (await token.balanceOf(debited)).dividedToIntegerBy(2);
                await token.approve(trustee, amount, {from: debited});
                expect(await token.canTransferFrom(trustee, debited, credited, amount)).to.be.true;
                await token.transferFrom(debited, credited, amount, {from: trustee});
                expect(await token.balanceOf(credited)).to.be.bignumber.equal(balance.plus(amount));
            });
        });
    });

    // Tests of profit deposit related functions.
    describe("profit deposit", () => {
        let whitelist, token;

        before("deploy contracts", async () => {
            [whitelist, token] = await deployWhitelistAndToken();
            token.mint(investor1, 1, {from: minter});
        });

        context("while minting", () => {

            it("is forbidden", async () => {
                let reason = await reject.call(token.depositProfit({from: profitDepositor,
                                                                    value: money.ether(1)}));
                expect(reason).to.be.equal("total supply may change");
            });
        });

        context("after minting finished", () => {

            before("finish minting", async () => {
                await token.finishMinting({from: minter});
            });

            it("by anyone but profit depositor is forbidden", async () => {
                let reason = await reject.call(token.depositProfit({from: anyone, value: money.ether(1)}));
                expect(reason).to.be.equal("restricted to profit depositor");
            });

            it("by anyone but profit depositor via fallback function is forbidden", async () => {
                let reason = await reject.tx({from: anyone, to: token.address, value: money.ether(1)});
                expect(reason).to.be.equal("restricted to profit depositor");
            });

            it("is possible", async () => {
                await token.depositProfit({from: profitDepositor, value: money.ether(2)});
            });

            it("gets logged", async () => {
                let value = money.ether(2);
                let tx = await token.depositProfit({from: profitDepositor, value});
                let entry = tx.logs.find(entry => entry.event === "ProfitDeposit");
                expect(entry).to.exist;
                expect(entry.args.depositor).to.be.bignumber.equal(profitDepositor);
                expect(entry.args.amount).to.be.bignumber.equal(value);
            });

            it("via fallback function is possible", async () => {
                let asset = await web3.eth.getBalance(token.address);
                let value = money.ether(2);
                await web3.eth.sendTransaction({from: profitDepositor, to: token.address, value});
                expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(asset.plus(value));
            });

            it("via fallback function with data is forbidden", async () => {
                let reason = await reject.tx({
                    from: profitDepositor,
                    to: token.address,
                    value: money.ether(2),
                    data: "0x01",
                });
                expect(reason).to.be.equal("fallback call with data");
            });

            it("increases wei balance", async () => {
                let asset = await web3.eth.getBalance(token.address);
                let value = money.ether(2);
                await token.depositProfit({from: profitDepositor, value});
                expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(asset.plus(value));
            });

            it("increases totalProfits", async () => {
                let profits = await token.totalProfits();
                let value = money.ether(2);
                await token.depositProfit({from: profitDepositor, value});
                expect(await token.totalProfits()).to.be.bignumber.equal(profits.plus(value));
            });

            it("via fallback function increases totalProfits", async () => {
                let profits = await token.totalProfits();
                let value = money.ether(2);
                let tx = await web3.eth.sendTransaction({from: profitDepositor, to: token.address, value});
                expect(await token.totalProfits()).to.be.bignumber.equal(profits.plus(value));
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
                let reason = await reject.call(token.depositProfit({from: profitDepositor,
                                                                    value: money.ether(1)}));
                expect(reason).to.be.equal("total supply is zero");
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
            let asset = await web3.eth.getBalance(token.address);
            let shares = new web3.BigNumber(0);
            for (let investor of investors.values()) {
                shares = shares.plus(await token.profitShareOwing(investor));
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
                    expect(reason).to.be.equal("total supply may change");
                }
            });

            it("withdrawal is forbidden", async () => {
                for (let investor of investors.values()) {
                    let reason = await reject.call(token.withdrawProfitShare({from: investor}));
                    expect(reason).to.be.equal("total supply may change");
                }
            });

            it("withdrawal to third party is forbidden", async () => {
                let beneficiary = random.address();
                for (let investor of investors.values()) {
                    let reason = await reject.call(
                        token.withdrawProfitShareTo(beneficiary, {from: investor}));
                    expect(reason).to.be.equal("total supply may change");
                }
            });

            it("withdrawal for many is forbidden", async () => {
                let reason = await reject.call(
                    token.withdrawProfitShares(investors, {from: profitDistributor}));
                expect(reason).to.be.equal("total supply may change");
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
                    expect(owing.minus(share).times(supply)).to.be.bignumber.equal(balance.times(profits));
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
                    expect(entry.args.investor).to.be.bignumber.equal(investor);
                    expect(entry.args.amount).to.be.bignumber.equal(owing);
                    expect((await getAccount(investor)).lastTotalProfits).to.be.bignumber.equal(profits);
                    expect((await getAccount(investor)).profitShare)
                        .to.be.bignumber.equal(account.profitShare.plus(owing));
                }
            });

            it("is correctly calculated after some more profit was deposited", async () => {
                await token.depositProfit({from: profitDepositor, value: money.ether(8)});
                let supply = await token.totalSupply();
                let profits = await token.totalProfits();
                for (let investor of investors.values()) {
                    let balance = await token.balanceOf(investor);
                    let owing = await token.profitShareOwing(investor);
                    // Prerequiste: no tokens were transferred before
                    // Use equivalence:
                    //      profitShareOwing / totalProfits == balance / totalSupply
                    // <=>  profitShareOwing * totalSupply  == balance * totalProfits
                    expect(owing.times(supply)).to.be.bignumber.equal(balance.times(profits));
                }
            });

            it("is correctly calculated after some tokens transfer and profit deposit", async () => {
                let supply = await token.totalSupply();
                let value = money.ether(4);
                await token.transfer(investor2, 2000, {from: investor1});
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
                expect(owing1.minus(share1).times(supply)).to.be.bignumber.equal(balance1.times(value));
                expect(owing2.minus(share2).times(supply)).to.be.bignumber.equal(balance2.times(value));
            });

            it("can be withdrawn", async () => {
                let owing = await token.profitShareOwing(investor1);
                let asset = await web3.eth.getBalance(token.address);
                let tx = await token.withdrawProfitShare({from: investor1});
                let entry = tx.logs.find(entry => entry.event === "ProfitShareWithdrawal");
                expect(entry).to.exist;
                expect(entry.args.investor).to.be.bignumber.equal(investor1);
                expect(entry.args.beneficiary).to.be.bignumber.equal(investor1);
                expect(entry.args.amount).to.be.bignumber.equal(owing);
                expect((await getAccount(investor1)).profitShare).to.be.bignumber.zero;
                expect(await web3.eth.getBalance(token.address))
                    .to.be.bignumber.equal(asset.minus(owing));
            });

            it("of zero can be withdrawn by anyone", async () => {
                await token.depositProfit({from: profitDepositor, value: money.ether(2)});
                let asset = await web3.eth.getBalance(token.address);
                let tx = await token.withdrawProfitShare({from: anyone});
                let entry = tx.logs.find(entry => entry.event === "ProfitShareWithdrawal");
                expect(entry).to.exist;
                expect(entry.args.investor).to.be.bignumber.equal(anyone);
                expect(entry.args.beneficiary).to.be.bignumber.equal(anyone);
                expect(entry.args.amount).to.be.bignumber.zero;
                expect(await web3.eth.getBalance(token.address)).to.be.bignumber.equal(asset);
            });

            it("can be withdrawn to third party", async () => {
                let beneficiary = anyone;
                let owing = await token.profitShareOwing(investor2);
                let asset = await web3.eth.getBalance(beneficiary);
                let tx = await token.withdrawProfitShareTo(beneficiary, {from: investor2});
                let entry = tx.logs.find(entry => entry.event === "ProfitShareWithdrawal");
                expect(entry).to.exist;
                expect(entry.args.investor).to.be.bignumber.equal(investor2);
                expect(entry.args.beneficiary).to.be.bignumber.equal(beneficiary);
                expect(entry.args.amount).to.be.bignumber.equal(owing);
                expect((await getAccount(investor2)).profitShare).to.be.bignumber.zero;
                expect(await web3.eth.getBalance(beneficiary)).to.be.bignumber.equal(asset.plus(owing));
            });

            it("withdrawal to many by anyone is forbidden", async () => {
                let reason = await reject.call(token.withdrawProfitShares(investors, {from: anyone}));
                expect(reason).to.be.equal("restricted to profit distributor");
            });

            it("can be withdrawn for many", async () => {
                let owing = await token.profitShareOwing(investor3);
                let asset = await web3.eth.getBalance(investor3);
                let tx = await token.withdrawProfitShares(investors, {from: profitDistributor});
                let entries = tx.logs.filter(entry => entry.event === "ProfitShareWithdrawal");
                expect(entries).to.have.lengthOf(investors.length);
                let entry = entries.find(entry => (new BN(entry.args.investor)).equals(investor3));
                expect(entry).to.exist;
                expect(entry.args.beneficiary).to.be.bignumber.equal(investor3);
                expect((await getAccount(investor3)).profitShare).to.be.bignumber.zero;
                expect(await web3.eth.getBalance(investor3))
                    .to.be.bignumber.equal(asset.plus(owing));
            });
        });
    });


    // Tests of token recovery related functions.
    describe("token recovery", () => {
        let whitelist, token, totalSupply;

        // Helper function to read an account.
        const getAccount = async (address) => {
            let [balance, lastTotalProfits, profitShare] = await token.accounts(address);
            return {balance, lastTotalProfits, profitShare};
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

        it("is forbidden by anyone other than token recoverer", async () => {
            let reason = await reject.call(token.recoverToken(investor2, investor3, {from: anyone}));
            expect(reason).to.be.equal("restricted to token recoverer");
        });

        it("is forbidden if new address isn't whitelisted", async () => {
            await whitelist.removeFromWhitelist([investor3], {from: owner});
            let reason = await reject.call(token.recoverToken(investor2, investor3, {from: tokenRecoverer}));
            await whitelist.addToWhitelist([investor3], {from: owner});
            expect(reason).to.be.equal("address is not whitelisted");
        });

        it("is forbidden if new address is an already used account", async () => {
            let reason = await reject.call(token.recoverToken(investor1, investor2, {from: tokenRecoverer}));
            expect(reason).to.be.equal("new address exists already");
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
            expect(entry.args.oldAddress).to.be.equal(investor3);
            expect(entry.args.newAddress).to.be.equal(investor2);
        });
    });
});
