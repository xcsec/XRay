// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {ICreate3Factory} from "src/Create3Factory.sol";
import {LayerZeroSwap_ScrollSepolia} from "src/XChainBridge_ScrollSepolia.sol";

contract DeployScrollSepolia is Script {
    LayerZeroSwap_ScrollSepolia internal layerZeroSwap_ScrollSepolia;

    function run() external {
        
        // Using the envUint cheatcode we can read some env variables
        uint256 PrivateKey = vm.envUint("PRIVATE_KEY");
        // Anything within the broadcast cheatcodes is executed on-chain
        vm.startBroadcast(PrivateKey);
        layerZeroSwap_ScrollSepolia = new LayerZeroSwap_ScrollSepolia(0x6098e96a28E02f27B1e6BD381f870F1C8Bd169d3, 
                                                                      0x59F1ec1f10bD7eD9B938431086bC1D9e233ECf41);
        vm.stopBroadcast();
    }
}