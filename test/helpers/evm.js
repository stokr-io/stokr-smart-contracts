"use strict";

const time = require("./time");


// EVM related helper functions for testing smart contracts via truffle
// G. Baecker, Tecneos UG, 2019

// Create an EVM snapshot and return its id
const createSnapshot = web3 =>
    new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {jsonrpc: "2.0", method: "evm_snapshot", id: time.now() + 1},
            (error, result) => {
                if (error) { reject(error); }
                else { resolve(result.result); }
            });
        });

// Revert to EVM state just before snapshot with the given id was created
const revertSnapshot = (web3, id) =>
    new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {jsonrpc: "2.0", method: "evm_revert", params: [id], id: time.now() + 1},
            (error, result) => {
                if (error) { reject(error); }
                else { resolve(result); }
            });
        });


const evm = web3 => ({

    // Current block timestamp
    now:
        async () => (await web3.eth.getBlock("pending")).timestamp,

    // Snapshot object creation
    snapshot:
        async () => {
            let id = await createSnapshot(web3);

            return {
                // Revert to EVM state just before this is snapshot was created
                // This snapshot object becomes invalid
                revert: () => revertSnapshot(web3, id),

                // Restore EVM state when this snapshot was created
                // This snapshot object is still valid
                restore: async () => {
                    await revertSnapshot(web3, id);
                    id = await createSnapshot(web3);
                },
            };
        },

});


module.exports = evm;

