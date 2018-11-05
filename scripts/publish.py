#!/usr/bin/env python3

"""Helper script to publish contract abis into test database.
"""

import json
import os
import os.path
import requests
import sys


DB_ENDPOINT = "http://88.198.129.43:8080/abi/"
CONTRACTS = ["StokrProjectManager",
             "Whitelist",
             "StokrToken",
             "StokrCrowdsale"]

for contract in CONTRACTS:
    with open(os.path.join(os.path.dirname(__file__),
                           "../build/contracts",
                           contract + ".json")) as file:
        abi = json.load(file)["abi"]
    response = requests.put(DB_ENDPOINT + contract, json=abi)
    print(response.status_code)
    print(response.text)

