// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./AbstractBridge.sol";
import "./release/IRelease.sol";
import "../ERC20/ERC20Wrapped.sol";
import "../Mutex.sol";

contract WrappedERC20Bridge is AbstractBridge, Mutex {
    uint8 constant DECIMALS = 6;

    mapping(uint128 => mapping(address => BindingInfo)) public bindings;
    mapping(address => uint256) public fees;
    mapping(address => uint256) public balances;

    event BurnTokens(
        uint16 feeChainId,
        address token,
        uint256 amount,
        string recipient,
        uint256 gaslessReward,
        string referrer,
        uint256 referrerFee,
        uint256 fee
    );

    event MintTokens(
        address token,
        uint256 amount,
        address recipient,
        uint256 gaslessReward,
        address caller
    );

    event Fee(
        uint16 feeChainId,
        address token,
        uint256 amount,
        string recipient
    );

    function burnTokens(
        address token_,
        uint256 amount_,
        uint16 executionChainId_,
        string calldata recipient_,
        string calldata referrer_,
        uint256 gaslessReward_
    ) external mutex whenNotPaused whenInitialized {
        require(token_ != address(0), "unavaliable token");
        require(chains[executionChainId_], "execution chain is disable");

        require(
            bindings[executionChainId_][token_].enabled,
            "token is disabled"
        );
        require(
            amount_ >= bindings[executionChainId_][token_].minAmount,
            "less than min amount"
        );
        uint256 fee = calculateFee_(executionChainId_, token_, amount_);
        require(amount_ > fee, "fee more than amount");
        unchecked {
            amount_ = amount_ - fee;
        }
        require(amount_ > gaslessReward_, "gassless reward more than amount");
        uint256 referrerFee = (fee *
            referrersFeeInPercent[executionChainId_][referrer_]) /
            PERCENT_FACTOR;
        fees[token_] += fee - referrerFee;
        balances[token_] -= amount_ + referrerFee;

        uint256 divider = 10**(IERC20(token_).decimals() - DECIMALS);
        emit BurnTokens(
            executionChainId_,
            token_,
            amount_,
            recipient_,
            gaslessReward_,
            referrer_,
            referrerFee,
            fee - referrerFee
        );

        IRelease(adapter).releaseTokens(
            executionChainId_,
            bindings[executionChainId_][token_].executionAsset,
            amount_ / divider,
            recipient_,
            gaslessReward_ / divider,
            referrer_,
            referrerFee / divider
        );

        ERC20Wrapped(token_).burnFrom(msg.sender, amount_ + fee);
    }

    function calculateFee_(
        uint16 executionChainId_,
        address token_,
        uint256 amount_
    ) internal view returns (uint256) {
        uint128 percent = amount_ >
            bindings[executionChainId_][token_].thresholdFee
            ? bindings[executionChainId_][token_].afterPercentFee
            : bindings[executionChainId_][token_].beforePercentFee;

        return
            bindings[executionChainId_][token_].minFee +
            (amount_ * percent) /
            PERCENT_FACTOR;
    }

    function mintTokens(
        bytes32 callerContract_,
        address token_,
        address payable recipient_,
        uint256 amount_,
        uint256 gaslessReward_
    ) external mutex whenNotPaused whenInitialized onlyExecutor {
        require(token_ != address(0), "zero address");
        require(callerContract == callerContract_, "only caller contract");

        uint256 divider = 10**(IERC20(token_).decimals() - DECIMALS);
        amount_ *= divider;
        gaslessReward_ *= divider;
        balances[token_] += amount_;

        // slither-disable-start tx-origin
        emit MintTokens(token_, amount_, recipient_, gaslessReward_, tx.origin);
        if (gaslessReward_ > 0 && recipient_ != tx.origin) {
            ERC20Wrapped(token_).mint(recipient_, amount_ - gaslessReward_);
            ERC20Wrapped(token_).mint(tx.origin, gaslessReward_);
        } else {
            ERC20Wrapped(token_).mint(recipient_, amount_);
        }
        // slither-disable-end tx-origin
    }

    function transferFee(address token_)
        external
        mutex
        whenNotPaused
        whenInitialized
    {
        uint16 feeChainId_ = feeChainId;
        require(chains[feeChainId_], "chain is disable");
        BindingInfo memory binding = bindings[feeChainId_][token_];
        require(binding.enabled, "token is disabled");
        uint256 fee_ = fees[token_];
        require(fee_ >= binding.minAmount, "less than min amount");
        balances[token_] += fee_;
        fees[token_] = 0;
        fee_ /= 10**(ERC20Wrapped(token_).decimals() - DECIMALS);
        string memory feeRecipient_ = feeRecipient;

        emit Fee(feeChainId_, token_, fee_, feeRecipient_);
        IRelease(adapter).releaseTokens(
            feeChainId_,
            binding.executionAsset,
            fee_,
            feeRecipient_,
            0,
            "",
            0
        );
    }

    function updateBindingInfo(
        uint16 executionChainId_,
        address token_,
        string calldata executionAsset_,
        uint256 minAmount_,
        uint256 minFee_,
        uint256 thresholdFee_,
        uint128 beforePercentFee_,
        uint128 afterPercentFee_,
        bool enabled_
    ) external onlyAdmin {
        require(token_ != address(0), "zero address");
        require(
            !enabled_ || IERC20(token_).decimals() >= DECIMALS,
            "invalid token decimals"
        );
        bindings[executionChainId_][token_] = BindingInfo(
            executionAsset_,
            minAmount_,
            minFee_,
            thresholdFee_,
            beforePercentFee_,
            afterPercentFee_,
            enabled_
        );
    }

    receive() external payable {}
}
