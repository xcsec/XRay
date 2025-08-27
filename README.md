# XRay: Cross-Chain Bridge Analyzer

**XRay** is a static analyzer based on [*Slither*](https://github.com/crytic/slither), designed to detect security risks in cross-chain bridges.  

---

## Installation

> **Note:** Requires Python ≥ 3.8.  
> If not using one of the [supported compilation frameworks](https://github.com/crytic/crytic-compile), install `solc` (we recommend [solc-select](https://github.com/crytic/solc-select)).

```bash
pip3 install slither-analyzer
git clone git@github.com:seccross/xray.git && cd xray
python3 setup.py install
 ```



## Supported On-chain Bridge Contract Detectors

XRay currently detects the following cross-chain security risks:

- `incorrect-source-message` – Cross-chain event/call triggered without verifying the actual source transfer.  
- `uncheck_hashlock_or_timelock` – Missing enforcement of hashlock/timelock in HTLC-based bridges.  
- `unchecked-off-chain-entity-permission` – Lack of checks on off-chain entities (e.g., validators).  
- `invalid-merkle-proof-verification` – Accepting forged Merkle proofs.  
- `bridged-message-replay` – Failure to prevent replay of previously processed bridged messages.  
- `unlimited-crosschain-message-call` – Arbitrary external calls triggered without recipient constraints.  

## Usage
```bash
SEND_FUNCS=XXX RECEIVE_FUNCS=XXX SEND_EVENT=XXX RECEIVE_EVENT=XXX SEND_CALL=XXX RECEIVE_CALL=XXX \
xray bridge.sol \
--detect incorrect-source-message,uncheck_hashlock_or_timelock,unchecked-off-chain-entity-permission,invalid-merkle-proof-verification,bridged-message-replay,unlimited-crosschain-message-call
```

## Supported Off-chain Parser Function Detection

- `incorrect-source-message` – Analyzes event calls and external calls in cross-chain contracts to identify arguments that may rely on off-chain entities.


## Usage

```bash
SEND_FUNCS=XXX RECEIVE_FUNCS=XXX SEND_EVENT=XXX RECEIVE_EVENT=XXX SEND_CALL=XXX RECEIVE_CALL=XXX \
xray bridge.sol \
--detect risk_event_or_call_parser
```