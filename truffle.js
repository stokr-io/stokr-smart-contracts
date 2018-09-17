module.exports = {

    networks: {
        // Local (ephemeral) testrpc/ganache network
        development: {
            network_id: "*",
            host: "localhost",
            port: 8545,
        },

        // Local (persistent) PoA test network
        o34testnet: {
            network_id: "*",
            host: "192.168.42.36",
            port: 8545,
            gas: 8000000,
        },

        // Rinkeby test network
        rinkeby: {
            network_id: 4,
            host: "localhost",
            port: 8545,
            gas: 4612388,
        },
    },

    mocha: {
        reporter: "eth-gas-reporter",
    },

    coverage: {
        network_id: "*",
        host: "localhost",
        port: 8555,
        gas: 0xfffffffffff,
        gasPrice: 0x01,
    },

};
