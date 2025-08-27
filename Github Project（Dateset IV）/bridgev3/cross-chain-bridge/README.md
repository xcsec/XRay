# cross-chain-bridge
This repository contains cross chain bridge codes used for UNVT markets deployed across different networks

Univaults Governance Cross-Chain Bridges

This repository contains smart contracts and related code for Univaukts cross-chain bridge executors. This is intended to extend UNVT Governance on Ethereum to other networks. This repository currently contains contracts to support bridging from Binance Smart Chain to Ethereum but will be adding AVAX, SOL, FANTOM, DOT, CARDANO and KCC.

The core contract is the BridgeExecutorBase, an abstract contract that contains the logic to facilitate the queueing, delay, and execution of sets of actions on downstream networks. This base contract needs to be extended with the functionality required for cross-chain transactions on a specific downstream network.

The BridgeExecutorBase contract is implemented to facilitate the execution of arbitrary actions after governance approval on Ethereum. Once the Ethereum proposal is executed, a cross-chain transaction can queue sets of actions for execution on the downstream chain. Once queued, these actions cannot be executed until a certain delay has passed, though a specified (potentially zero) guardian address has the power to cancel the execution of these actions. If the delay period passes and the actions are not cancelled, the actions can be executed during the grace period time window by anyone on the downstream chain.

The BridgeExecutorBase is abstract and intentionally leaves the _queue function internal. This requires another contract to extend the BridgeExecutorBase to handle network specific logic, cross-chain transaction validation, and permissioning, prior to calling the internal _queue function.

The L2BridgeExecutor abstract contract extends BridgeExecutorBase in order to make it ready for Layer 2 networks. It stores the address of the Ethereum Governance Executor on the Ethereum network, so each inheriting L2 implementation is aware of the address it should accept transactions from.

Audits

The full Audits for the bridges deployed on 8n consecutive chains will be carried out by Certik after the last chain bridge is deployed and along with the rest of the ecosystem.
