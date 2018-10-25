module.exports = {

    networks: {
        // Ephemeral testrpc/ganache network (local machine)
        development: {
            network_id: "*",
            host: "localhost",
            port: 8545,
            gas: 8000000,
        },

        // Persistent Parity PoA test network (Berlin O34 office LAN)
        o34testnet: {
            network_id: "*",
            host: "192.168.42.36",
            port: 8545,
            gas: 8000000,
        },

        // Persistent Geth PoA test network (Virtual Server in internet)
        vpstestnet: {
            network_id: "*",
            host: "88.198.129.41",
            port: 24036,
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
