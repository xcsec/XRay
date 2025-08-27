// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import {Test} from "forge-std/Test.sol";

import {DropMockBase} from "./DropMockBase.sol";
import {DropsMetadataRenderer} from "../../../src/drops/metadata/DropsMetadataRenderer.sol";

contract DropsMetadataRendererTest is Test {
  address public constant mediaContract = address(123456);
  DropsMetadataRenderer public renderer;

  function setUp() public {
    renderer = new DropsMetadataRenderer();
  }

  function test_SetupInitializes() public {
    vm.startPrank(address(0x12));
    bytes memory initData = abi.encode("http://uri.base/", "http://uri.base/contract.json");
    renderer.initializeWithData(initData);
    assertEq(renderer.tokenURI(12), "http://uri.base/12");
    assertEq(renderer.contractURI(), "http://uri.base/contract.json");
    vm.stopPrank();
    vm.prank(address(0x14));
    vm.expectRevert();
    renderer.tokenURI(12);
    vm.expectRevert();
    renderer.contractURI();
  }

  function test_UninitalizesReverts() public {
    vm.prank(address(0x12));
    vm.expectRevert();
    renderer.tokenURI(12);
    vm.expectRevert();
    renderer.contractURI();
  }

  function test_UpdateURIsFromContract() public {
    vm.startPrank(address(0x12));
    bytes memory initData = abi.encode("http://uri.base/", "http://uri.base/contract.json");
    renderer.initializeWithData(initData);
    assertEq(renderer.tokenURI(12), "http://uri.base/12");
    assertEq(renderer.contractURI(), "http://uri.base/contract.json");
    renderer.updateMetadataBase(address(0x12), "http://uri.base.new/", "http://uri.base.new/contract.json");
    assertEq(renderer.tokenURI(12), "http://uri.base.new/12");
    assertEq(renderer.contractURI(), "http://uri.base.new/contract.json");
  }

  function test_UpdateURIsFromAdmin() public {
    DropMockBase base = new DropMockBase();
    base.setIsAdmin(address(0x123), true);
    vm.startPrank(address(base));
    bytes memory initData = abi.encode("http://uri.base/", "http://uri.base/contract.json");
    renderer.initializeWithData(initData);
    assertEq(renderer.tokenURI(8), "http://uri.base/8");
    assertEq(renderer.contractURI(), "http://uri.base/contract.json");
    vm.stopPrank();
    vm.prank(address(0x123));
    renderer.updateMetadataBase(address(base), "http://uri.base.new/", "http://uri.base.new/contract.json");
    vm.prank(address(base));
    assertEq(renderer.tokenURI(5), "http://uri.base.new/5");
    vm.prank(address(base));
    assertEq(renderer.contractURI(), "http://uri.base.new/contract.json");
  }
}
