// SPDX-License-Identifier: Apache License 2.0
pragma solidity 0.8.20;

import "forge-std/Script.sol";
import {Utils} from "../test/utils/Utils.sol";

interface ICCIPToken {
    function drip(address to) external;
}

contract Faucet is Script, Utils {
    function run(SupportedNetworks network) external {
        uint256 senderPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(senderPrivateKey);
        address senderAddress = vm.addr(senderPrivateKey);

        (address ccipBnm, address ccipLnm) = getDummyTokensFromNetwork(network);

        ICCIPToken(ccipBnm).drip(senderAddress);

        if (network == SupportedNetworks.ETHEREUM_SEPOLIA) {
            ICCIPToken(ccipLnm).drip(senderAddress);
        }

        vm.stopBroadcast();
    }
}
