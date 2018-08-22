module.exports = {

    networks: {
        // Local (ephemeral) testrpc/ganache network
        development: {
            network_id: "*",
            host: "localhost",
            port: 8545,
        },

        // Local (persistent) PoA test network
        o34poa: {
            network_id: "*",
            host: "192.168.42.36",
            port: 8545,
        }
    },

    /*
    mocha: {
        reporter: "eth-gas-reporter",
    },
    */

};
