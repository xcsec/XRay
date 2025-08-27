#!/bin/bash

# ---------------------------------------------------------------------------- #
#                       Run the anvil nodes in background                      #
# ---------------------------------------------------------------------------- #

# Compile the protocol
pnpm clean-compile
# Start the anvil nodes in the background
pnpm anvil &

# ---------------------------------------------------------------------------- #
#          Deploy the protocol when the anvil nodes are up and running         #
# ---------------------------------------------------------------------------- #

# Initialize a status variable to check if the command ran successfully
success=0

while [ $success -eq 0 ]; do
    echo "Fetching chain ids..."
    # Execute curl commands to fetch the anvil chain ids and capture the outputs
    node1=$(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' http://localhost:8545)
    node2=$(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' http://localhost:9545)

    # Check if the curl commands were successful by looking for a successful status code in the responses
    if echo $node1 | grep -q '"result"' && echo $node2 | grep -q '"result"'; then
        success=1
    else
        echo "Waiting for both Anvil nodes to be ready..."
        # Wait for 1 seconds before retrying
        sleep 1
    fi
done

export SKIP_DEPLOY_CONFIRMATION=true
pnpm deploy-x2