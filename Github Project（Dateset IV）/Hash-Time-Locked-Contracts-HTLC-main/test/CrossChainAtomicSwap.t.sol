// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/CrossChainAtomicSwap.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CrossChainAtomicSwapTest is Test {
    CrossChainAtomicSwap public swapContract;
    IERC20 public token;
    address public initiator = address(0x1);
    address public recipient = address(0x2);
    uint256 public amount = 1000 ether;
    bytes32 public hashlock;
    bytes32 public secret;
    uint256 public timelock = block.timestamp + 1 days;

    function setUp() public {
        // Deploy mock token and the swap contract
        token = IERC20(address(new MockERC20("MOCK TOKEN", "MOCK")));
        swapContract = new CrossChainAtomicSwap();

        // Mint tokens for the initiator and approve the swap contract
        vm.prank(initiator);
        MockERC20(address(token)).mint(initiator, amount);
        vm.prank(initiator);
        token.approve(address(swapContract), amount);

        // Set up the hashlock and secret
        secret = keccak256(abi.encodePacked("super_secret"));
        hashlock = keccak256(abi.encodePacked(secret, recipient));
    }

    function testInitiateSwap() public {
        vm.prank(initiator);
        swapContract.initiateSwap(
            recipient,
            address(token),
            amount,
            hashlock,
            timelock
        );

        (
            address _initiator,
            address _recipient,
            address _token,
            uint256 _amount,
            bytes32 _hashlock,
            uint256 _timelock,
            bool completed,
            bool refunded
        ) = swapContract.swaps(0);

        assertEq(_initiator, initiator);
        assertEq(_recipient, recipient);
        assertEq(_token, address(token));
        assertEq(_amount, amount);
        assertEq(_hashlock, hashlock);
        assertEq(_timelock, timelock);
        assertFalse(completed);
        assertFalse(refunded);
    }

    function testCompleteSwap() public {
        // Initiate the swap
        vm.prank(initiator);
        swapContract.initiateSwap(
            recipient,
            address(token),
            amount,
            hashlock,
            timelock
        );

        // Fast forward time to after the timelock
        vm.warp(block.timestamp + 1 days);

        // Complete the swap
        vm.prank(recipient);
        swapContract.completeSwap(0, secret);

        (, , , , , , bool completed, ) = swapContract.swaps(0);

        assertTrue(completed);
        assertEq(token.balanceOf(recipient), amount);
    }

    function testRefundSwap() public {
        // Initiate the swap
        vm.prank(initiator);
        swapContract.initiateSwap(
            recipient,
            address(token),
            amount,
            hashlock,
            timelock
        );

        // Fast forward time to before the timelock
        vm.warp(block.timestamp + 1 hours);

        // Refund the swap
        vm.prank(initiator);
        swapContract.refundSwap(0);

        (, , , , , , , bool refunded) = swapContract.swaps(0);

        assertTrue(refunded);
        assertEq(token.balanceOf(initiator), amount);
    }
}

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
