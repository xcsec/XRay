// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract CrossChainAtomicSwap {
    struct Swap {
        address initiator;
        address recipient;
        address token;
        uint256 amount;
        bytes32 hashlock; // Hash of the secret
        uint256 timelock; // Time after which funds can be reclaimed
        bool completed;
        bool refunded;
    }

    mapping(uint256 => Swap) public swaps;
    uint256 public nextSwapId;

    event SwapInitiated(
        uint256 indexed swapId,
        address indexed initiator,
        address indexed recipient,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );

    event SwapCompleted(uint256 indexed swapId, bytes32 secret);
    event SwapRefunded(uint256 indexed swapId);

    modifier onlyInitiator(uint256 _swapId) {
        require(msg.sender == swaps[_swapId].initiator, "Not swap initiator");
        _;
    }

    modifier onlyRecipient(uint256 _swapId) {
        require(msg.sender == swaps[_swapId].recipient, "Not swap recipient");
        _;
    }

    modifier swapExists(uint256 _swapId) {
        require(swaps[_swapId].initiator != address(0), "Swap does not exist");
        _;
    }

    modifier beforeTimelock(uint256 _swapId) {
        require(block.timestamp < swaps[_swapId].timelock, "Timelock expired");
        _;
    }

    modifier afterTimelock(uint256 _swapId) {
        require(
            block.timestamp >= swaps[_swapId].timelock,
            "Timelock not expired"
        );
        _;
    }

    function initiateSwap(
        address _recipient,
        address _token,
        uint256 _amount,
        bytes32 _hashlock,
        uint256 _timelock
    ) external {
        require(
            swaps[nextSwapId].initiator == address(0),
            "Swap already exists"
        );

        swaps[nextSwapId] = Swap({
            initiator: msg.sender,
            recipient: _recipient,
            token: _token,
            amount: _amount,
            hashlock: _hashlock,
            timelock: _timelock,
            completed: false,
            refunded: false
        });

        nextSwapId++;

        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _amount),
            "Token transfer failed"
        );

        emit SwapInitiated(
            nextSwapId,
            msg.sender,
            _recipient,
            _token,
            _amount,
            _hashlock,
            _timelock
        );
    }

    function isValidateSecret(
        uint256 _swapId,
        bytes32 _secret
    ) external view swapExists(_swapId) returns (bool) {
        Swap memory swap = swaps[_swapId];

        require(!swap.refunded, "Swap already refunded");

        return
            keccak256(abi.encodePacked(_secret, swap.recipient)) ==
            swap.hashlock;
    }

    function completeSwap(
        uint256 _swapId,
        bytes32 _secret
    )
        external
        swapExists(_swapId)
        onlyRecipient(_swapId)
        afterTimelock(_swapId)
    {
        Swap storage swap = swaps[_swapId];
        require(!swap.completed, "Swap already completed");
        require(!swap.refunded, "Swap already refunded");
        require(
            keccak256(abi.encodePacked(_secret, swap.recipient)) ==
                swap.hashlock,
            "Invalid secret"
        );

        swap.completed = true;
        require(
            IERC20(swap.token).transfer(swap.recipient, swap.amount),
            "Token transfer failed"
        );

        emit SwapCompleted(_swapId, _secret);
    }

    function refundSwap(
        uint256 _swapId
    )
        external
        swapExists(_swapId)
        onlyInitiator(_swapId)
        beforeTimelock(_swapId)
    {
        Swap storage swap = swaps[_swapId];
        require(!swap.completed, "Swap already completed");
        require(!swap.refunded, "Swap already refunded");

        swap.refunded = true;
        require(
            IERC20(swap.token).transfer(swap.initiator, swap.amount),
            "Token transfer failed"
        );

        emit SwapRefunded(_swapId);
    }
}
