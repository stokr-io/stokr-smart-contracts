# Test scripts

These scripts are meant to be run on a test network *only*.


## test-eth-events-observer-init

Deploys a set of contracts (whitelist, tokens, sales) and let some investors buy tokens.
Saves addresses of accounts and contracts to `addresses.json`.

Usage example

    truffle exec scripts/test-eth-events-observer-init.js --network o34testnet


## test-eth-events-observer-run

Loads addresses from `addresses.json`.
Runs a test scenario where amongst others investors randomly transfer tokens.

Usage example:

    truffle exec scripts/test-eth-events-observer-run.js --network o34testnet

