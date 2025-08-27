// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../../utils.sol";
import "../caller/IWavesCaller.sol";
import "../Adapter.sol";
import "./IRelease.sol";

contract WavesReleaseAdapter is Adapter, IRelease {
    IWavesCaller public protocolCaller;
    string public coinExecutionContract;
    string public tokenExecutionContract;

    function init(
        address admin_,
        address protocolCaller_,
        address rootAdapter_,
        string calldata coinExecutionContract_,
        string calldata tokenExecutionContract_
    ) external whenNotInitialized {
        require(admin_ != address(0), "zero address");
        require(protocolCaller_ != address(0), "zero address");
        require(rootAdapter_ != address(0), "zero address");
        admin = admin_;
        pauser = admin_;
        protocolCaller = IWavesCaller(protocolCaller_);
        rootAdapter = rootAdapter_;
        coinExecutionContract = coinExecutionContract_;
        tokenExecutionContract = tokenExecutionContract_;
        isInited = true;
    }

    function releaseTokens(
        uint16 executionChainId_,
        string calldata token_,
        uint256 amount_,
        string calldata recipient_,
        uint256 gaslessReward_,
        string calldata referrer_,
        uint256 referrerFee_
    ) external override whenInitialized whenNotPaused onlyRootAdapter {
        // keccak256(abi.encodePacked("")) = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        if (
            keccak256(abi.encodePacked(token_)) ==
            0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        ) {
            string[] memory args = new string[](6);
            args[0] = ""; // require empty string (see WavesCaller CIP)
            args[1] = Utils.U256ToDecString(amount_);
            args[2] = recipient_;
            args[3] = Utils.U256ToDecString(gaslessReward_);
            args[4] = referrer_;
            args[5] = Utils.U256ToDecString(referrerFee_);
            protocolCaller.call(
                executionChainId_,
                coinExecutionContract,
                "releaseTokens",
                args
            );
        } else {
            string[] memory args = new string[](7);
            args[0] = ""; // require empty string (see WavesCaller CIP)
            args[1] = token_;
            args[2] = Utils.U256ToDecString(amount_);
            args[3] = recipient_;
            args[4] = Utils.U256ToDecString(gaslessReward_);
            args[5] = referrer_;
            args[6] = Utils.U256ToDecString(referrerFee_);
            protocolCaller.call(
                executionChainId_,
                tokenExecutionContract,
                "releaseTokens",
                args
            );
        }
    }
}
