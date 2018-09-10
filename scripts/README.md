# Test scripts

These scripts are meant to be run on a test network *only*.
They create a test scenario for the stokr-eth-event-db.


## Test Deploy and Purchase

Purpose:

* deploy a whitelist
* whitelist some investors
* deploy some Stokr tokens
* deploy associated token sales
* investors buy randomly tokens
* finalize sales

Usage:

    truffle exec scripts/test-deploy-and-purchase.js --network o34poa

Copy all addresses and enter them into the next script


## Test Transfer

Purpose

* investors randomly transfer their tokens to each other
* sometimes some profit is distributed
* investors randomly withdraw their share

Usage:

    truffle exec scripts/test-transfer-and-profits.js --network o34poa

The script will run in an endless loop.
Watch out the events database.

