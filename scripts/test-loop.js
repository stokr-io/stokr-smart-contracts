"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const Token = artifacts.require("./SampleToken.sol");
const Sale = artifacts.require("./StokrCrowdsale.sol");

const BN = web3.BigNumber;
const choose = list => list[Math.trunc(list.length * Math.random())];
const sleep = secs => new Promise(resolve => setTimeout(resolve, 1000 * secs));
const print = console.log;

const INTERVAL = 1;

const investors = [];
const

const createJobQueue = () => {
    const jobs = [];

    const add = (waitChoices, callback) => {
        print("add");
        let countdown = choose(waitChoices) / INTERVAL | 0;

        jobs.push({countdown, callback});
    };

    const run = async () => {
        print("run");
        let index = 0;
        while (index < jobs.length) {
            let job = jobs[index];

            print(`job #${index}: ${job.countdown}`);

            if (--job.countdown >= 0) {
                print("... waiting");
                ++index;
            }
            else {
                print("... running");
                jobs[index] = jobs[jobs.length];
                jobs.pop();
                await job.callback();
            }
        }
    };

    return {add, run};
};

const jobs = createJobQueue();

const print1 = async () => {
    print("EINS");
    jobs.add([1,2,3], print1);
};

const print2 = async () => {
    print("ZWEI");
    jobs.add([3,4,5], print2);
};

const run = async () => {
    jobs.add([0], print1);
    jobs.add([0], print2);
    while (true) {
        await sleep(INTERVAL);
        await jobs.run();
    }
};

module.exports = callback => {
    (async () => {
        try {
            await run();
            callback();
        }
        catch (error) {
            callback(error);
        }
    })();
};

