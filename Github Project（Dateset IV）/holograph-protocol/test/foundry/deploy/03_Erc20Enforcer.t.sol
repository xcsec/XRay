// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {Test, Vm, console} from "forge-std/Test.sol";
import {Constants} from "../utils/Constants.sol";
import {HolographERC20} from "../../../src/enforcer/HolographERC20.sol";
import {SampleERC20} from "../../../src/token/SampleERC20.sol";
import {ERC20Mock} from "../../../src/mock/ERC20Mock.sol";
import {Admin} from "../../../src/abstract/Admin.sol";
import {ERC20} from "../../../src/interface/ERC20.sol";
import {PermitSigUtils} from "../utils/PermitSigUtils.sol";

contract Erc20Enforcer is Test {
  event Transfer(address indexed _from, address indexed _to, uint256 _value);
  event Approval(address indexed _owner, address indexed _spender, uint256 _value);
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  address public constant zeroAddress = address(0x0000000000000000000000000000000000000000);
  uint256 localHostFork;
  string LOCALHOST_RPC_URL = vm.envString("LOCALHOST_RPC_URL");
  HolographERC20 holographERC20;
  SampleERC20 sampleERC20;
  ERC20Mock erc20Mock;
  Admin admin;
  PermitSigUtils permitSigUtils;
  uint16 tokenDecimals = 18;
  uint256 privateKeyDeployer = 0xff22437ccbedfffafa93a9f1da2e8c19c1711052799acf3b58ae5bebb5c6bd7b;
  address deployer = vm.addr(privateKeyDeployer);
  address alice = vm.addr(1);
  address bob = vm.addr(2);
  uint256 initialValue = 1;
  uint256 maxValue = 2 ** 256 - 1;
  uint256 halfValue = 2 ** 128 - 1;
  uint256 halfInverseValue = 115792089237316195423570985008687907852929702298719625575994209400481361428480;
  bytes zeroBytes = bytes(abi.encode("0x0000000000000000000000000000000000000000"));
  bytes32 zeroSignature = bytes32(abi.encode(0x0000000000000000000000000000000000000000000000000000000000000000));
  bytes32 signature = bytes32(abi.encode(0x1111111111111111111111111111111111111111111111111111111111111111));
  bytes32 signature2 = bytes32(abi.encode(0x35353535353535353535353535353535353535353535353535353535353535));
  bytes32 signature3 = bytes32(abi.encode(0x68686868686868686868686868686868686868686868686868686868686868));
  uint256 badDeadLine;
  uint256 goodDeadLine;

  function setUp() public {
    localHostFork = vm.createFork(LOCALHOST_RPC_URL);
    vm.selectFork(localHostFork);
    erc20Mock = ERC20Mock(payable(Constants.getERC20Mock()));
    holographERC20 = HolographERC20(payable(Constants.getSampleERC20()));
    sampleERC20 = SampleERC20(payable(Constants.getSampleERC20()));
    admin = Admin(payable(Constants.getHolographFactoryProxy()));
    badDeadLine = uint256(block.timestamp) - 1;
    goodDeadLine = uint256(block.timestamp);
    permitSigUtils = new PermitSigUtils(holographERC20.DOMAIN_SEPARATOR());
  }

  function buildDomainSeparator(
    string memory name,
    string memory version,
    address contractAddress
  ) public view returns (bytes32) {
    bytes32 nameHash = keccak256(bytes(name));
    bytes32 versionHash = keccak256(bytes(version));
    bytes32 typeHash = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    return
      keccak256(
        abi.encodePacked(
          typeHash,
          nameHash,
          versionHash,
          uint256(block.chainid),
          address(Constants.getHolographERC20())
        )
      );
  }

  function mintToAlice() public {
    vm.prank(deployer);
    sampleERC20.mint(alice, initialValue);
  }

  function mintToDeployer() public {
    vm.prank(deployer);
    sampleERC20.mint(deployer, initialValue);
  }

  function approvalToAlice(uint256 amount) public {
    vm.prank(deployer);
    holographERC20.approve(alice, amount);
  }

  function approvalToBob(uint256 amount) public {
    vm.prank(deployer);
    holographERC20.approve(bob, amount);
  }

  function increaseAllowanceToAlice(uint256 amount) public {
    vm.prank(deployer);
    holographERC20.increaseAllowance(alice, amount);
  }

  function decreaseAllowanceToAlice(uint256 amount) public {
    vm.prank(deployer);
    holographERC20.decreaseAllowance(alice, amount);
  }

  /*
   * INIT INTERFACES
   */

  function testSupportinterface() public {
    bytes4 selector = holographERC20.supportsInterface.selector;
    holographERC20.supportsInterface(selector);
  }

  function testAllowanceInterface() public {
    bytes4 selector = holographERC20.allowance.selector;
    holographERC20.supportsInterface(selector);
  }

  function testApproveInterface() public {
    bytes4 selector = holographERC20.approve.selector;
    holographERC20.supportsInterface(selector);
  }

  function testBalanceOfInterface() public {
    bytes4 selector = holographERC20.balanceOf.selector;
    holographERC20.supportsInterface(selector);
  }

  function testTotalSupplyInterface() public {
    bytes4 selector = holographERC20.totalSupply.selector;
    holographERC20.supportsInterface(selector);
  }

  function testTransferInterface() public {
    bytes4 selector = holographERC20.transfer.selector;
    holographERC20.supportsInterface(selector);
  }

  function testTransferFromInterface() public {
    bytes4 selector = holographERC20.transferFrom.selector;
    holographERC20.supportsInterface(selector);
  }

  function testERC20Interface() public {
    bytes4 computedId = bytes4(
      holographERC20.allowance.selector ^
        holographERC20.approve.selector ^
        holographERC20.balanceOf.selector ^
        holographERC20.totalSupply.selector ^
        holographERC20.transfer.selector ^
        holographERC20.transferFrom.selector
    );
    assertTrue(holographERC20.supportsInterface(computedId));
  }

  function testHolographERC20Interface() public {
    bytes4 computedId = bytes4(
      holographERC20.allowance.selector ^
        holographERC20.approve.selector ^
        holographERC20.balanceOf.selector ^
        holographERC20.totalSupply.selector ^
        holographERC20.transfer.selector ^
        holographERC20.transferFrom.selector
    );
    assertTrue(holographERC20.supportsInterface(computedId));
  }

  function testNameInterface() public {
    bytes4 selector = holographERC20.name.selector;
    holographERC20.supportsInterface(selector);
  }

  function testSymbolInterface() public {
    bytes4 selector = holographERC20.symbol.selector;
    holographERC20.supportsInterface(selector);
  }

  function testDecimalsInterface() public {
    bytes4 selector = holographERC20.decimals.selector;
    holographERC20.supportsInterface(selector);
  }

  function testERC20MetadataInterface() public {
    bytes4 computedId = bytes4(
      holographERC20.name.selector ^ holographERC20.symbol.selector ^ holographERC20.decimals.selector
    );
    assertTrue(holographERC20.supportsInterface(computedId));
  }

  function testBurnInterface() public {
    bytes4 selector = holographERC20.burn.selector;
    holographERC20.supportsInterface(selector);
  }

  function testBurnFromInterface() public {
    bytes4 selector = holographERC20.burnFrom.selector;
    holographERC20.supportsInterface(selector);
  }

  function testERC20BurnInterface() public {
    bytes4 computedId = bytes4(holographERC20.burn.selector ^ holographERC20.burnFrom.selector);
    assertTrue(holographERC20.supportsInterface(computedId));
  }

  function testSafeTransferInterface() public {
    holographERC20.supportsInterface(bytes4(keccak256("safeTransfer(address,uint256)")));
  }

  function testSafeTransferInterfaceDiferentCallTwo() public {
    holographERC20.supportsInterface(bytes4(keccak256("safeTransfer(address,uint256,bytes)")));
  }

  function testSafeTransferInterfaceDiferentCallThree() public {
    holographERC20.supportsInterface(bytes4(keccak256("safeTransfer(address,uint256,uint256)")));
  }

  function testSafeTransferInterfaceDiferentCallFour() public {
    holographERC20.supportsInterface(bytes4(keccak256("safeTransfer(address,address,uint256,bytes)")));
  }

  //TODO review why it fails and fix it
  function testERC20SaferInterface() public {
    vm.skip(true);
    bytes memory safeTransfer = abi.encodeWithSelector(bytes4(keccak256("safeTransfer(address,uint256)")));
    bytes memory safeTransferBytes = abi.encodeWithSelector(bytes4(keccak256("safeTransfer(address,uint256,bytes)")));
    bytes memory safeTransferUint = abi.encodeWithSelector(bytes4(keccak256("safeTransfer(address,uint256,uint256)")));
    bytes memory safeTransferBytesUint = abi.encodeWithSelector(
      bytes4(keccak256("safeTransfer(address,address,uint256,bytes)"))
    );

    bytes4 computedId = bytes4(
      bytes4(safeTransfer) ^ bytes4(safeTransferBytes) ^ bytes4(safeTransferUint) ^ bytes4(safeTransferBytesUint)
    );
    assertTrue(holographERC20.supportsInterface(computedId));
    // holographERC20.supportsInterface(holographERC20.supportsInterface(type(ERC20).interfaceId));
  }

  function testSafePermitInterface() public {
    bytes4 selector = holographERC20.permit.selector;
    holographERC20.supportsInterface(selector);
  }

  function testNoncesInterface() public {
    bytes4 selector = holographERC20.nonces.selector;
    holographERC20.supportsInterface(selector);
  }

  function testDomainSeparatorInterface() public {
    bytes4 selector = holographERC20.DOMAIN_SEPARATOR.selector;
    holographERC20.supportsInterface(selector);
  }

  function testERC20Permit() public {
    bytes4 computedId = bytes4(
      holographERC20.permit.selector ^ holographERC20.nonces.selector ^ holographERC20.DOMAIN_SEPARATOR.selector
    );
    assertTrue(holographERC20.supportsInterface(computedId));
  }

  /*
   * INIT TEST
   */

  function testInitRevert() public {
    bytes memory paramInit = abi.encode("0x0000000000000000000000000000000000000000");
    vm.expectRevert("HOLOGRAPHER: already initialized");
    holographERC20.init(paramInit);
  }

  //TODO make the test
  function testInit() public {
    vm.skip(true);
  }

  /*
   * METADATA TEST
   */

  //TODO change name by network
  function testName() public {
    assertEq(holographERC20.name(), "Sample ERC20 Token (localhost)");
  }

  function testSymbol() public {
    assertEq(holographERC20.symbol(), "SMPL");
  }

  function testDecimals() public {
    assertEq(holographERC20.decimals(), tokenDecimals);
  }

  /*
   * MINT TOKEN TEST
   */

  function testTotalSupply() public {
    assertEq(holographERC20.totalSupply(), 0);
  }

  function testMintEmitEvent() public {
    vm.expectEmit(true, true, false, true);
    emit Transfer(zeroAddress, alice, initialValue);
    mintToAlice();
  }

  function testTotalSupplyInitialValue() public {
    mintToAlice();
    assertEq(holographERC20.totalSupply(), initialValue);
  }

  function testBalanceAliceInitialValue() public {
    mintToAlice();
    assertEq(holographERC20.balanceOf(alice), initialValue);
  }

  /*
   * ERC20 TEST
   *    Tokens Approvals
   */

  function testApprovalRevertZeroAddress() public {
    vm.expectRevert("ERC20: spender is zero address");
    holographERC20.approve(zeroAddress, maxValue);
  }

  function testApporvalEmitEvent() public {
    vm.expectEmit(true, true, false, true);
    emit Approval(deployer, alice, maxValue);
    approvalToAlice(maxValue);
  }

  function testDecreaseAllowanceEmitEvent() public {
    increaseAllowanceToAlice(maxValue);
    vm.expectEmit(true, true, false, true);
    emit Approval(deployer, alice, halfInverseValue);
    decreaseAllowanceToAlice(halfValue);
  }

  function testDecreaseAllowanceBelongToZeroRevert() public {
    increaseAllowanceToAlice(maxValue);
    decreaseAllowanceToAlice(halfValue);
    vm.expectRevert("ERC20: decreased below zero");
    decreaseAllowanceToAlice(maxValue);
  }

  function testIncreaseAllowanceAboveToMaxValueRevert() public {
    increaseAllowanceToAlice(maxValue);
    vm.expectRevert("ERC20: increased above max value");
    increaseAllowanceToAlice(maxValue);
  }

  function testDecreaseAllowanceToZero() public {
    increaseAllowanceToAlice(maxValue);
    vm.expectEmit(true, true, false, true);
    emit Approval(deployer, alice, 0);
    decreaseAllowanceToAlice(maxValue);
  }

  //same testApporvalEmitEvent
  function testIncreaseAllowanceToMaxValue() public {
    vm.expectEmit(true, true, false, true);
    emit Approval(deployer, alice, maxValue);
    increaseAllowanceToAlice(maxValue);
  }

  /*
   * ERC20 TEST
   *    Failed Transfers
   */

  function testTransferNotEnoughTokensRevert() public {
    vm.expectRevert("ERC20: amount exceeds balance");
    holographERC20.transfer(alice, maxValue);
  }

  function testTransferToZeroAddressRevert() public {
    vm.expectRevert("ERC20: recipient is zero address");
    holographERC20.transfer(zeroAddress, maxValue);
  }

  function testTransferFromZeroAddressRevert() public {
    vm.expectRevert("ERC20: amount exceeds allowance");
    vm.prank(deployer);
    holographERC20.transferFrom(zeroAddress, alice, maxValue);
  }

  function testTransferFromNotAprrovalAddressRevert() public {
    vm.expectRevert("ERC20: amount exceeds allowance");
    vm.prank(alice);
    holographERC20.transferFrom(deployer, alice, maxValue);
  }

  function testTransferFromSmallerAprrovalAmountRevert() public {
    approvalToBob(halfValue);
    vm.expectRevert("ERC20: amount exceeds allowance");
    vm.prank(bob);
    holographERC20.transferFrom(deployer, alice, maxValue);
  }

  function testErc20ReceivedNonContractRevert() public {
    vm.expectRevert("ERC20: operator not contract");
    holographERC20.onERC20Received(
      deployer,
      deployer,
      initialValue,
      bytes(abi.encode("0x0000000000000000000000000000000000000000"))
    );
  }

  //TODO see why mock token have balance? remove Fail to the name of the function
  function testErc20ReceivedFakeContractRevert() public {
    vm.skip(true);
    vm.expectRevert("ERC20: balance check failed");
    holographERC20.onERC20Received(
      address(erc20Mock),
      deployer,
      initialValue,
      bytes(abi.encode("0x0000000000000000000000000000000000000000"))
    );
  }

  //TODO see why revert ( amount exceeds balance, need mint and then not fail... ) and not non ERC20Received,  remove Fail to the name of the function
  function testSafeTransferBrokenErc20ReceivedRevert() public {
    vm.skip(true);
    erc20Mock.toggleWorks(false);
    vm.expectRevert("ERC20: non ERC20Receiver");
    vm.prank(deployer);
    holographERC20.safeTransfer(address(erc20Mock), initialValue);
  }

  //TODO see why revert ( amount exceeds balance,need mint and then not fail... ) and not non ERC20Receiver,  remove Fail to the name of the function
  function testSafeTransferBytesBrokenErc20ReceivedRevert() public {
    vm.skip(true);
    erc20Mock.toggleWorks(false);
    vm.expectRevert("ERC20: non ERC20Receiver");
    vm.prank(deployer);
    holographERC20.safeTransfer(
      address(erc20Mock),
      initialValue,
      bytes(abi.encode("0x0000000000000000000000000000000000000000"))
    );
  }

  //TODO see why not revert,  remove Fail to the name of the function
  function testSafeTransferFromBrokenErc20ReceivedRevert() public {
    vm.skip(true);
    vm.prank(deployer);
    sampleERC20.mint(deployer, halfValue);
    erc20Mock.toggleWorks(false);

    approvalToAlice(maxValue);
    vm.expectRevert("ERC20: non ERC20Receiver");
    vm.prank(alice);

    holographERC20.safeTransferFrom(address(deployer), address(erc20Mock), initialValue);
  }

  //TODO see why not revert,  remove Fail to the name of the function
  function testSafeTransferFromBytesBrokenErc20RecivedRevert() public {
    vm.skip(true);
    vm.prank(deployer);
    sampleERC20.mint(deployer, halfValue);
    erc20Mock.toggleWorks(false);

    approvalToAlice(maxValue);
    vm.expectRevert("ERC20: non ERC20Receiver");
    vm.prank(alice);

    holographERC20.safeTransferFrom(address(deployer), address(erc20Mock), initialValue, zeroBytes);
  }

  /*
   * ERC20 TEST
   *    Successful Transfers
   */

  function testTransfer() public {
    mintToDeployer();
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), address(alice), initialValue);
    vm.prank(deployer);
    holographERC20.transfer(address(alice), initialValue);
  }

  function testBalanceOfDeployer() public {
    mintToDeployer();
    vm.prank(deployer);
    holographERC20.transfer(address(alice), initialValue);
    assertEq(holographERC20.balanceOf(deployer), 0);
  }

  function testBalanceOfAlice() public {
    mintToDeployer();
    vm.prank(deployer);
    holographERC20.transfer(address(alice), initialValue);
    assertEq(holographERC20.balanceOf(alice), initialValue);
  }

  function testSafeTransfer() public {
    mintToAlice();
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(alice), address(deployer), initialValue);
    vm.prank(alice);
    holographERC20.safeTransfer(address(deployer), initialValue);
  }

  function testSafeTransferFrom() public {
    mintToDeployer();
    approvalToAlice(initialValue);
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), address(alice), initialValue);
    vm.prank(alice);
    holographERC20.safeTransferFrom(address(deployer), address(alice), initialValue);
  }

  function testBalanceOfDeployerAfterSafeTransferFrom() public {
    testSafeTransferFrom();
    assertEq(holographERC20.balanceOf(deployer), 0);
  }

  function testBalanceOfAliceAfterSafeTransferFrom() public {
    testSafeTransferFrom();
    assertEq(holographERC20.balanceOf(alice), initialValue);
  }

  function testTransferFrom() public {
    mintToDeployer();
    vm.expectEmit(true, true, false, true);
    emit Approval(deployer, alice, initialValue);
    approvalToAlice(initialValue);
    //check allowance alice = 1
    assertEq(holographERC20.allowance(deployer, alice), initialValue);
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), address(alice), initialValue);
    vm.prank(alice);
    holographERC20.transferFrom(address(deployer), address(alice), initialValue);
    //check allowance alice = 0. A separate test should be done to verify the decrease in alowance.
    assertEq(holographERC20.allowance(deployer, alice), 0);
  }

  function testSafeTransferToErc20Reciver() public {
    erc20Mock.toggleWorks(true);
    mintToDeployer();
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), address(erc20Mock), initialValue);
    vm.prank(deployer);
    holographERC20.safeTransfer(address(erc20Mock), initialValue);
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(erc20Mock), address(deployer), initialValue);
    erc20Mock.transferTokens(payable(holographERC20), deployer, initialValue);
  }

  function testSafeTransferWithBytesToErc20Reciver() public {
    erc20Mock.toggleWorks(true);
    mintToDeployer();
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), address(erc20Mock), initialValue);
    vm.prank(deployer);
    holographERC20.safeTransfer(address(erc20Mock), initialValue, zeroBytes);
  }

  function testSafeTransferFromToErc20() public {
    mintToDeployer();
    erc20Mock.toggleWorks(true);
    vm.expectEmit(true, true, false, true);
    emit Approval(deployer, alice, initialValue);
    approvalToAlice(initialValue);
    //check allowance alice = 1
    assertEq(holographERC20.allowance(deployer, alice), initialValue);
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), address(erc20Mock), initialValue);
    vm.prank(alice);
    holographERC20.safeTransferFrom(address(deployer), address(erc20Mock), initialValue);
    //check allowance alice = 0
    assertEq(holographERC20.allowance(deployer, alice), 0);
  }

  function testSafeTransferFromBytesToErc20() public {
    mintToDeployer();
    erc20Mock.toggleWorks(true);
    approvalToAlice(initialValue);
    //check allowance alice = 1
    assertEq(holographERC20.allowance(deployer, alice), initialValue);
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), address(erc20Mock), initialValue);
    vm.prank(alice);
    holographERC20.safeTransferFrom(address(deployer), address(erc20Mock), initialValue, zeroBytes);
    //check allowance alice = 0
    assertEq(holographERC20.allowance(deployer, alice), 0);
  }

  /*
   * ERC20 TEST
   *    Burneable
   */

  function testBurneableExceedsBalanceRevert() public {
    vm.expectRevert("ERC20: amount exceeds balance");
    holographERC20.burn(initialValue);
  }

  function testBurn() public {
    mintToDeployer();
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), zeroAddress, initialValue);
    vm.prank(deployer);
    holographERC20.burn(initialValue);
  }

  function testBurnFromNotApproveRevert() public {
    vm.expectRevert("ERC20: amount exceeds allowance");
    vm.prank(alice);
    holographERC20.burnFrom(deployer, initialValue);
  }

  function testBurnFrom() public {
    mintToDeployer();
    approvalToAlice(initialValue);
    vm.expectEmit(true, true, false, true);
    emit Transfer(address(deployer), zeroAddress, initialValue);
    vm.prank(alice);
    holographERC20.burnFrom(deployer, initialValue);
  }

  /*
   * ERC20 TEST
   *    Permit
   */

  function testCheckDomainSeparator() public {
    // TODO Check
    vm.skip(true);
    assertEq(
      holographERC20.DOMAIN_SEPARATOR(),
      buildDomainSeparator("Sample ERC20 Token", "1", address(holographERC20))
    );
  }

  function testPermitZeroNonce() public {
    assertEq(holographERC20.nonces(alice), 0);
  }

  function testPermitBadDeadLineRevert() public {
    vm.expectRevert("ERC20: expired deadline");
    holographERC20.permit(deployer, alice, initialValue, badDeadLine, uint8(0x00), zeroSignature, zeroSignature);
  }

  function testPermitEmptySignatureRevert() public {
    vm.expectRevert("ERC20: zero address signer");
    holographERC20.permit(deployer, alice, initialValue, goodDeadLine, uint8(0x1b), zeroSignature, zeroSignature);
  }

  //TODO see, for me not work fine, 0x1b always rever for zerdo address
  function testPermitZeroAddressSignatureRevert() public {
    vm.expectRevert("ERC20: zero address signer");
    holographERC20.permit(deployer, alice, initialValue, goodDeadLine, uint8(0x1b), signature, signature);
  }

  function testPermitInvalidSignatureV_ValueRevert() public {
    vm.expectRevert("ERC20: invalid v-value");
    holographERC20.permit(deployer, alice, initialValue, goodDeadLine, uint8(0x04), zeroSignature, zeroSignature);
  }

  function testPermitInvalidSignatureRevert() public {
    vm.expectRevert("ERC20: invalid signature");
    vm.prank(deployer);
    holographERC20.permit(deployer, alice, initialValue, goodDeadLine, uint8(0x1b), signature2, signature3);
  }

  function testValidSignature() public {
    PermitSigUtils.Permit memory permit = PermitSigUtils.Permit({
      owner: deployer,
      spender: alice,
      value: maxValue,
      nonce: holographERC20.nonces(alice),
      deadline: goodDeadLine
    });
    bytes32 digest = permitSigUtils.getTypedDataHash(permit);
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKeyDeployer, digest);
    vm.expectEmit(true, true, false, true);
    emit Approval(deployer, alice, maxValue);
    holographERC20.permit(permit.owner, permit.spender, permit.value, permit.deadline, v, r, s);
  }

  function testPermitAllowance() public {
    testValidSignature();
    assertEq(holographERC20.allowance(deployer, alice), maxValue);
  }

  function testPermitNonces() public {
    testValidSignature();
    assertEq(holographERC20.nonces(deployer), 1);
  }

  /*
   * ERC20 TEST
   *    Ownership tests
   */

  function testOwner() public {
    assertEq(holographERC20.owner(), deployer);
  }

  function testIsOwner() public {
    vm.prank(deployer);
    assertEq(sampleERC20.isOwner(), true);
  }

  function testIsOwnerFalse() public {
    vm.prank(alice);
    assertEq(sampleERC20.isOwner(), false);
  }

  function testErc20GetOwnerProxy() public {
    assertEq(holographERC20.getOwner(), address(admin));
  }

  function testErc20DeployerTransferOwnerRevert() public {
    vm.expectRevert("HOLOGRAPH: owner only function");
    vm.prank(alice);
    holographERC20.setOwner(alice);
  }

  function testErc20DeployerTransferOwner() public {
    bytes memory data = abi.encodeWithSelector(bytes4(keccak256("setOwner(address)")), deployer);
    vm.expectEmit(true, true, false, false);
    emit OwnershipTransferred(address(admin), address(deployer));
    vm.prank(deployer);
    admin.adminCall(address(holographERC20), data);
  }

  function testTransferOwnership() public {
    testErc20DeployerTransferOwner();
    vm.expectEmit(true, true, false, true);
    emit OwnershipTransferred(address(deployer), address(admin));
    vm.prank(deployer);
    holographERC20.setOwner(address(admin));
  }

  /*
   * ERC20 TEST
   *    Admin
   */

  function testErc20Admin() public {
    assertEq(holographERC20.admin(), address(admin));
  }

  function testErc20GetAdmin() public {
    assertEq(holographERC20.getAdmin(), address(admin));
  }

  function testErc20SetAdminRevert() public {
    vm.expectRevert("HOLOGRAPH: admin only function");
    vm.prank(alice);
    holographERC20.setAdmin(address(admin));
  }

  function testErc20DeployerSetAdminByProxy() public {
    bytes memory data = abi.encodeWithSelector(bytes4(keccak256("setAdmin(address)")), deployer);
    vm.prank(deployer);
    admin.adminCall(address(holographERC20), data);
    assertEq(holographERC20.admin(), address(deployer));
  }
}
