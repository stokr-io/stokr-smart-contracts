#!/usr/bin/env python3

"""Helper script to publish contract data into test database.

To upload the current ABIs:
    python3 publish.py abis

To upload the deployment addresses:
    python3 publish.py addresses
"""

import http.client
import json
import os
import os.path
import sys


DB_ENDPOINT = "88.198.129.43:8080"

base_dir = os.path.dirname(__file__)


def publishAddresses():
    with open(os.path.join(base_dir, "addresses.json")) as file:
        contracts = json.load(file)["contracts"]
    conn = http.client.HTTPConnection(DB_ENDPOINT)
    for contract, addresses in contracts.items():
        print("Publishing addresses of", contract)
        conn.request("PUT", "/addresses/" + contract,
                     body=json.dumps(addresses),
                     headers={"Content-Type": "application/json"})
        resp = conn.getresponse()
        print(resp.status, resp.reason)
        body = resp.read()
        print(body.decode())
    conn.close()
    print()


def publishABIs():
    with open(os.path.join(base_dir, "addresses.json")) as file:
        contracts = json.load(file)["contracts"]
    conn = http.client.HTTPConnection(DB_ENDPOINT)
    for contract in contracts:
        print("Publishing ABI of", contract)
        with open(os.path.join(base_dir,
                               "../build/contracts",
                               contract + ".json")) as file:
            abi = json.load(file)["abi"]
        conn.request("PUT", "/abi/" + contract,
                     body=json.dumps(abi),
                     headers={"Content-Type": "application/json"})
        resp = conn.getresponse()
        print(resp.status, resp.reason)
        body = resp.read()
        print(body.decode())
    conn.close()
    print()


usage_info = f"Usage: {sys.argv[0]} (addresses|abis)"

if len(sys.argv) >= 2:
    if sys.argv[1] == "addresses":
        publishAddresses()
    elif sys.argv[1] == "abis":
        publishABIs()
    else:
        sys.exit(f"Invalid argument. {usage_info}")
else:
    sys.exit(f"Missing argument. {usage_info}")

