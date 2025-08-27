#!/bin/bash

# Stop the anvil nodes
kill $(lsof -ti:8545)
kill $(lsof -ti:9545)