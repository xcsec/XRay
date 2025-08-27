// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import {console} from "forge-std/console.sol";

library Utils {
  function stringToBytes32(string memory input) public pure returns (bytes32) {
    require(bytes(input).length <= 32, "Input string must be less than or equal to 32 bytes");

    bytes32 result;
    assembly {
      result := mload(add(input, 32))
    }
    return result >> (8 * (32 - bytes(input).length));
  }
}
