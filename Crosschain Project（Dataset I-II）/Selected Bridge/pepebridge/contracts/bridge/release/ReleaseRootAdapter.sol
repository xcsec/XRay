// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./IRelease.sol";
import "../RootAdapter.sol";

contract ReleaseRootAdapter is RootAdapter, IRelease {
    function releaseTokens(
        uint16 executionChainId_,
        string calldata token_,
        uint256 amount_,
        string calldata recipient_,
        uint256 gaslessClaimReward_,
        string calldata referrer_,
        uint256 referrerFee_
    ) external override whenInitialized whenNotPaused whenAllowed(msg.sender) {
        IRelease(adapters[executionChainId_]).releaseTokens(
            executionChainId_,
            token_,
            amount_,
            recipient_,
            gaslessClaimReward_,
            referrer_,
            referrerFee_
        );
    }
}
