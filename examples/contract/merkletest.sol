// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TargetChainBridge {
    address public admin;


    // 存储被信任的 Merkle 根
    mapping(bytes32 => bool) public validMerkleRoots;

    // 防止重复执行相同的消息
    mapping(bytes32 => bool) public processedMessages;

    event MerkleRootAdded(bytes32 root);
    event MessageExecuted(bytes32 indexed messageHash, address to, bytes data);
    event MessageSent(address indexed to, bytes data, bytes32 messageHash);

    constructor() {
        admin = msg.sender;
    }

    /// 管理员提交可信的 Merkle 根
    function addMerkleRoot(bytes32 root) external {
        require(msg.sender == admin, "Not authorized");
        validMerkleRoots[root] = true;
        emit MerkleRootAdded(root);
    }

    /// 执行跨链消息
    function executeCrossChainMessage(
        bytes32 merkleRoot,
        bytes32[] calldata merkleProof,
        address to,
        bytes calldata data
    ) external {
       // require(validMerkleRoots[merkleRoot], "Invalid Merkle root");

        bytes32 leaf = keccak256(abi.encodePacked(to, data));
        require(!processedMessages[leaf], "Message already processed");

        // 验证 Merkle 证明
        require(verifyMerkleProof(merkleProof, merkleRoot, leaf), "Invalid proof");

        processedMessages[leaf] = true;

        // 执行目标合约调用
        (bool success, ) = to.call(data);
        require(success, "Call failed");

        emit MessageExecuted(leaf, to, data);
    }

    /// Merkle 验证函数（自实现）
    function verifyMerkleProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash < proofElement) {
                // 当前节点在左侧
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // 当前节点在右侧
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }




    function sendMessage(address to, bytes calldata data) external {
        bytes32 hash = keccak256(abi.encodePacked(to, data));
        emit MessageSent(to, data, hash);
    }
}


