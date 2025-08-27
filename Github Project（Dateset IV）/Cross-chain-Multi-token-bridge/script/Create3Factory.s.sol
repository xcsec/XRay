// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {Create3Factory} from "src/Create3Factory.sol";

contract DeployCreate3Factory is Script {
    Create3Factory create3Factory;

    function run() external {
        
        // Using the envUint cheatcode we can read some env variables
        uint256 PrivateKey = vm.envUint("PRIVATE_KEY");

        // Anything within the broadcast cheatcodes is executed on-chain
        vm.startBroadcast(PrivateKey);
        create3Factory = new Create3Factory();
        vm.stopBroadcast();
    }
}