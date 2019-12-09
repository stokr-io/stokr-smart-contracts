"use strict";


// Time related helper functions for testing smart contracts via truffle
// G. Baecker, Tecneos UG, 2019
const time = {

    now: () => Date.now() / 1000 | 0,

    // Shortcut to create a timestamp from an ISO string
    from: str => (new Date(str)).getTime() / 1000 | 0,

    // Asynchronous sleep
    sleep: secs => new Promise(resolve => setTimeout(resolve, 1000 * secs)),

    // Convenience functions to improve readability when handling durations
    secs: n => n,
    mins: n => n * time.secs(60),
    hours: n => n * time.mins(60),
    days: n => n * time.hours(24),
    weeks: n => n * time.days(7),
    years: n => n * time.days(365),

    // Increase block timestamp by a given duration
    increaseBy: secs =>
        new Promise((resolve, reject) => {
            web3.currentProvider.send({
                    jsonrpc: "2.0",
                    method: "evm_increaseTime",
                    params: [secs],
                    id: time.now()
                },
                error => {
                    if (error) {
                        reject(error);
                    } else {
                        web3.currentProvider.send({
                                jsonrpc: "2.0",
                                method: "evm_mine",
                                id: time.now() + 1
                            },
                            (error, result) => {
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(result);
                                }
                            });
                    }
                });
        }),

    /* Once web3 is cleaned up...
    increaseBy: async secs => {
        await web3.eth.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [secs],
            id: time.now(),
        });
        await web3.eth.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: time.now() + 1,
        });
    },
    */

    // Increase block timestamp to a given time
    increaseTo: t => time.increaseBy(t - time.now()),

};


module.exports = time;

