// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@solmate/utils/CREATE3.sol";

contract Create3Factory {
    event LogDeployed(address deployed, address sender, bytes32 salt);

    function deploy(bytes32 salt, bytes memory bytecode, uint256 value) public returns (address deployed) {
        deployed = CREATE3.deploy(salt, bytecode, value);
        emit LogDeployed(deployed, msg.sender, salt);
    }

    function getDeployed(bytes32 salt) public view returns (address) {
        return CREATE3.getDeployed(salt);
    }
}

interface ICreate3Factory {

    function deploy(bytes32 salt, bytes memory bytecode, uint256 value) external returns (address deployed);

    function getDeployed(bytes32 salt) external view returns (address);
}

