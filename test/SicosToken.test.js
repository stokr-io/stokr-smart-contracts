"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const KeyRecoverer = artifacts.require("./KeyRecoverer.sol");
const SicosToken = artifacts.require("./SicosToken.sol");
const SicosCrowdsale = artifacts.require("./SicosCrowdsale.sol");

const { should, ensuresException } = require("./helpers/utils");
const expect = require("chai").expect;
const { latestTime, duration, increaseTimeTo } = require("./helpers/timer");

const BigNumber = web3.BigNumber;

contract("SicosToken", ([owner, wlAdmin1, wlAdmin2, investor1, investor2, investor3, someone]) => {


});
