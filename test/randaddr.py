#!/usr/bin/env python3

import random

for i in range(100):
    print("0x{:040x}".format(random.randrange(2**160)))
