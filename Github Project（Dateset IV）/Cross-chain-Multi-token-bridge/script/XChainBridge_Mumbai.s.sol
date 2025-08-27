// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {ICreate3Factory} from "src/Create3Factory.sol";
import {LayerZeroSwap_Mumbai} from "src/XChainBridge_Mumbai.sol";

contract DeployMumbai is Script {
    LayerZeroSwap_Mumbai internal layerZeroSwap_Mumbai;

    function run() external {
        
        // Using the envUint cheatcode we can read some env variables
        uint256 PrivateKey = vm.envUint("PRIVATE_KEY");
        // Anything within the broadcast cheatcodes is executed on-chain
        vm.startBroadcast(PrivateKey);
        layerZeroSwap_Mumbai = new LayerZeroSwap_Mumbai(0xf69186dfBa60DdB133E91E9A4B5673624293d8F8, 
                                                        0x7d7356bF6Ee5CDeC22B216581E48eCC700D0497A, 
                                                        0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada);
        vm.stopBroadcast();
    }
}