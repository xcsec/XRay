#!/bin/bash
pushd $(dirname $0)/..

mkdir -p artifacts

set -e
.downloads/solc-0.8.20 $(cat src/solidity/files_to_compile.txt) --allow-paths .=., --optimize --optimize-runs 200 --overwrite --combined-json abi,bin -o artifacts
scripts/extract_artifacts.py
set +e

popd
