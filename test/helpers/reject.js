"use strict";

// Transaction rejection related helper functions for testing smart
// contracts via truffle
// G. Baecker, Tecneos UG, 2019

const handleReceipt = async receipt => {
    let reason = "unknown";

    if (receipt) {
        // Unfortunately, all cases where seen in the wild
        if (receipt.status === 0
         || receipt.status === "0x"
         || receipt.status === "0x0") {
            return "";  // post-Byzantium rejection
        }

        // Parity neither throws nor delivers a status
        if (receipt.status === null) {
            let tx = await web3.eth.getTransaction(receipt.transactionHash);

            // Heuristic: compare gas provided with gas used
            if (tx.gas == receipt.gasUsed) {
                return "";  // likely a rejection
            }

            reason = "gasUsed < gasSent";
        } else {
            reason = "status = " + receipt.status;
        }
    } else {
        // A missing receipt may indicate a rejection,
        // but we treat it as success to throw the error
        reason = "no receipt";
    }

    throw new Error(`Transaction should have failed but didn't (${reason})`);
};


const handleError = error => {
    let lcMessage = error.message.toLowerCase();

    // Old-style rejection without providing a reason
    if (lcMessage.includes("the contract code couldn't be stored")
        || lcMessage.includes("invalid opcode")
        || lcMessage.includes("invalid jump")) {
        return "";  // old-style rejection without providing a reason
    }

    // Rejection with (possibly) given reason
    let pattern = "vm exception while processing transaction: revert";
    let index = lcMessage.indexOf(pattern);
    if (index >= 0) {
        return error.reason || error.message.slice(index + pattern.length).trim();
    }

    // Throw if the error is not related to the smart contract code
    throw error;
};


const reject = {

    // Execute a single transaction (promise) and throw if
    // it succeeds or any not-transaction-related error occurs.
    tx:
        async options => {
            try {
                let receipt = await web3.eth.sendTransaction(options);

                return await handleReceipt(receipt);
            }
            catch (error) {
                return handleError(error);
            }
        },

    // Deploy a contract and throw if it succeeds or any other
    // not-deployment-related error occurs.
    // Note: ensure deployer has enough funds and sends enough gas
    deploy:
        async promise => {
            try {
                let instance = await promise;
                let receipt = await web3.eth.getTransactionReceipt(instance.transactionHash);

                return await handleReceipt(receipt);
            }
            catch (error) {
                return handleError(error);
            }
        },

    // Execute a call method single transaction (promise) and throw if
    // it succeeds or any not-transaction-related error occurs.
    call:
        async promise => {
            try {
                let tx = await promise;

                return await handleReceipt(tx.receipt);
            }
            catch (error) {
                return handleError(error);
            }
        },

};


module.exports = reject;

