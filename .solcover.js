"use strict";

module.exports = {
    port: 8555,
    norpc: false,
    testrpcOptions: "",
    testCommand: "truffle test",
    copyPackages: ["zeppelin-solidity"],
    skipFiles: ["Migrations.sol", "KeyRecoverer.sol", "SampleToken.sol"],
    dir: ".",
    buildDirPath: "/build/contracts",
};

