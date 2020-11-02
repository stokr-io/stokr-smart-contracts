"use strict";

const Whitelist = artifacts.require("./whitelist/Whitelist.sol");

const { toBN, toChecksumAddress, randomHex, padLeft } = web3.utils;
const { expect } = require("chai").use(require("chai-bn")(web3.utils.BN));
const { reject, bisection } = require("./helpers/_all");

const ZERO_ADDRESS = padLeft("0x0", 160 >> 2);
const randomAddress = () => toChecksumAddress(randomHex(160 >> 3));

contract(
  "Whitelist",
  ([owner, admin1, admin2, investor1, investor2, investor3, anyone]) => {
    let whitelist = null;

    describe("deployment", () => {
      it("should succeed", async () => {
        whitelist = await Whitelist.new({ from: owner });
        expect(await web3.eth.getCode(whitelist.address)).to.be.not.oneOf([
          "0x",
          "0x0",
        ]);
      });

      it("sets correct owner", async () => {
        expect(await whitelist.owner()).to.equal(owner);
      });
    });

    describe("admin", () => {
      it("cannot be added by anyone", async () => {
        let reason = await reject.call(
          whitelist.addAdmin(admin1, { from: anyone })
        );
        expect(reason).to.be.equal("Restricted to owner");
      });

      it("cannot be added if zero", async () => {
        let reason = await reject.call(
          whitelist.addAdmin(ZERO_ADDRESS, { from: owner })
        );
        expect(reason).to.be.equal("Whitelist admin is zero");
      });

      it("can be added by owner", async () => {
        let tx = await whitelist.addAdmin(admin1, { from: owner });
        let entry = tx.logs.find((entry) => entry.event === "AdminAdded");
        expect(entry).to.exist;
        expect(entry.args.admin).to.equal(admin1);
      });

      it("is an admin after add", async () => {
        expect(await whitelist.admins(admin1)).to.be.true;
      });

      it("isn't logged if added again", async () => {
        let tx = await whitelist.addAdmin(admin1, { from: owner });
        let entry = tx.logs.find((entry) => entry.event === "AdminAdded");
        expect(entry).to.not.exist;
      });

      it("cannot be removed by anyone", async () => {
        let reason = await reject.call(
          whitelist.removeAdmin(admin1, { from: anyone })
        );
        expect(reason).to.equal("Restricted to owner");
      });

      it("cannot be removed if zero", async () => {
        let reason = await reject.call(
          whitelist.removeAdmin(ZERO_ADDRESS, { from: owner })
        );
        expect(reason).to.equal("Whitelist admin is zero");
      });

      it("can be removed by owner", async () => {
        let tx = await whitelist.removeAdmin(admin1, { from: owner });
        let entry = tx.logs.find((entry) => entry.event === "AdminRemoved");
        expect(entry).to.exist;
        expect(entry.args.admin).to.equal(admin1);
      });

      it("is not an admin after remove", async () => {
        expect(await whitelist.admins(admin1)).to.be.false;
      });

      it("isn't logged if removed again", async () => {
        let tx = await whitelist.removeAdmin(admin1, { from: owner });
        let entry = tx.logs.find((entry) => entry.event === "AdminRemoved");
        expect(entry).to.not.exist;
      });
    });

    describe("single investor", () => {
      before("owner adds admins", async () => {
        await whitelist.addAdmin(admin1, { from: owner });
        await whitelist.addAdmin(admin2, { from: owner });
      });

      it("cannot be added by anyone", async () => {
        let reason = await reject.call(
          whitelist.addToWhitelist([investor1], { from: anyone })
        );
        expect(reason).to.equal("Restricted to whitelist admin");
      });

      it("can be added by admin1", async () => {
        let tx = await whitelist.addToWhitelist([investor1], { from: admin1 });
        let entry = tx.logs.find((entry) => entry.event === "InvestorAdded");
        expect(entry).to.exist;
        expect(entry.args.admin).to.equal(admin1);
        expect(entry.args.investor).to.equal(investor1);
      });

      it("can be added again by admin2 but shouldn't get logged", async () => {
        let tx = await whitelist.addToWhitelist([investor1], { from: admin2 });
        let entry = tx.logs.find((entry) => entry.event === "InvestorAdded");
        expect(entry).to.not.exist;
      });

      it("is whitelisted after add", async () => {
        expect(await whitelist.isWhitelisted(investor1)).to.be.true;
      });

      it("cannot be removed by anyone", async () => {
        let reason = await reject.call(
          whitelist.removeFromWhitelist([investor1], { from: anyone })
        );
        expect(reason).to.equal("Restricted to whitelist admin");
      });

      it("can be removed by admin1", async () => {
        let tx = await whitelist.removeFromWhitelist([investor1], {
          from: admin1,
        });
        let entry = tx.logs.find((entry) => entry.event === "InvestorRemoved");
        expect(entry).to.exist;
        expect(entry.args.admin).to.equal(admin1);
        expect(entry.args.investor).to.equal(investor1);
      });

      it("can be removed again by admin2 but shouldn't get logged", async () => {
        let tx = await whitelist.removeFromWhitelist([investor1], {
          from: admin2,
        });
        let entry = tx.logs.find((entry) => entry.event === "InvestorRemoved");
        expect(entry).to.not.exist;
      });

      it("is not whitelisted after remove", async () => {
        expect(await whitelist.isWhitelisted(investor1)).to.be.false;
      });
    });

    describe("multiple investors", () => {
      let investors = [
        investor1,
        investor2,
        investor3,
        investor1,
        investor2,
        investor3,
        randomAddress(),
        randomAddress(),
        randomAddress(),
      ];

      before("owner adds admins", async () => {
        await whitelist.addAdmin(admin1, { from: owner });
        await whitelist.addAdmin(admin2, { from: owner });
      });

      it("cannot be added by anyone", async () => {
        let reason = await reject.call(
          whitelist.addToWhitelist(investors, { from: anyone })
        );
        expect(reason).to.equal("Restricted to whitelist admin");
      });

      it("can be added at once by admin1", async () => {
        let tx = await whitelist.addToWhitelist(investors, { from: admin1 });
        for (let investor of investors.values()) {
          expect(await whitelist.isWhitelisted(investor)).to.be.true;
        }
      });

      it("cannot be removed by anyone", async () => {
        let reason = await reject.call(
          whitelist.removeFromWhitelist(investors, { from: anyone })
        );
        expect(reason).to.equal("Restricted to whitelist admin");
      });

      it("can be removed at once by admin2", async () => {
        let tx = await whitelist.removeFromWhitelist(investors, {
          from: admin2,
        });
        for (let investor of investors.values()) {
          expect(await whitelist.isWhitelisted(investor)).to.be.false;
        }
      });
    });

    describe.skip("transaction costs", () => {
      const CL_CYAN = "\u001b[36m";
      const CL_GRAY = "\u001b[90m";
      const CL_DEFAULT = "\u001b[0m";

      before("owner adds admins", async () => {
        await whitelist.addAdmin(admin1, { from: owner });
      });

      it("of adding many investors", async () => {
        let maximum;
        let count = 0;
        let next = bisection.new(count);
        while (isFinite(count)) {
          let investors = [];
          for (let i = 0; i < count; ++i) {
            investors.push(randomAddress());
          }
          let message = `of adding ${count} investors: `;
          try {
            let tx = await whitelist.addToWhitelist(investors, {
              from: admin1,
            });
            maximum = count;
            message += `${tx.receipt.gasUsed} gas`;
            count = tx.receipt.gasUsed <= 8000000 ? next(true) : NaN;
          } catch (error) {
            message += "failed";
            count = next(false);
          }
          console.log(
            " ".repeat(6) + `${CL_CYAN}→ ${CL_GRAY}${message}${CL_DEFAULT}`
          );
        }
        expect(maximum).to.be.above(2);
      });
    });
  }
);
