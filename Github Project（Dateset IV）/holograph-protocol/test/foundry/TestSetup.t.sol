// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {Vm} from "forge-std/Vm.sol";
import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {Holograph} from "../../src/Holograph.sol";
import {HolographGenesis} from "../../src/HolographGenesis.sol";
import {HolographBridge} from "../../src/HolographBridge.sol";
import {HolographBridgeProxy} from "../../src/proxy/HolographBridgeProxy.sol";
import {HolographFactory} from "../../src/HolographFactory.sol";
import {HolographFactoryProxy} from "../../src/proxy/HolographFactoryProxy.sol";
import {HolographOperator} from "../../src/HolographOperator.sol";
import {HolographOperatorProxy} from "../../src/proxy/HolographOperatorProxy.sol";
import {HolographRegistry} from "../../src/HolographRegistry.sol";
import {HolographRegistryProxy} from "../../src/proxy/HolographRegistryProxy.sol";
import {HolographTreasury} from "../../src/HolographTreasury.sol";
import {HolographTreasuryProxy} from "../../src/proxy/HolographTreasuryProxy.sol";
import {HolographInterfaces} from "../../src/HolographInterfaces.sol";
import {HolographRoyalties} from "../../src/enforcer/HolographRoyalties.sol";

import {HolographERC20} from "../../src/enforcer/HolographERC20.sol";
import {HolographERC721} from "../../src/enforcer/HolographERC721.sol";
import {CxipERC721} from "../../src/token/CxipERC721.sol";
import {LayerZeroModule} from "../../src/module/LayerZeroModule.sol";
import {MockLZEndpoint} from "../../src/mock/MockLZEndpoint.sol";
import {ERC20Mock} from "../../src/mock/ERC20Mock.sol";
import {MockERC721Receiver} from "../../src/mock/MockERC721Receiver.sol";
import {hToken} from "../../src/token/hToken.sol";
import {HolographUtilityToken} from "../../src/token/HolographUtilityToken.sol";
import {SampleERC20} from "../../src/token/SampleERC20.sol";
import {SampleERC721} from "../../src/token/SampleERC721.sol";
import {CxipERC721Proxy} from "../../src/proxy/CxipERC721Proxy.sol";
import {Faucet} from "../../src/faucet/Faucet.sol";

abstract contract TestSetup {
  bytes32 public salt = bytes32(0);
  bytes public chainId = hex"fffffffe";
  bytes public chainId2 = hex"fffffffd";

  Holograph holograph;
  HolographGenesis holographGenesis;
  HolographBridge holographBridge;
  HolographBridgeProxy holographBridgeProxy;
  HolographFactory holographFactory;
  HolographFactoryProxy holographFactoryProxy;
  HolographOperator holographOperator;
  HolographOperatorProxy holographOperatorProxy;
  HolographRegistry holographRegistry;
  HolographRegistryProxy holographRegistryProxy;
  HolographTreasury holographTreasury;
  HolographTreasuryProxy holographTreasuryProxy;
  HolographInterfaces holographInterfaces;
  HolographRoyalties holographRoyalties;

  HolographERC20 holographERC20;
  HolographERC721 holographERC721;
  CxipERC721 cxipERC721;
  LayerZeroModule layerZeroModule;
  MockLZEndpoint mockLZEndpoint;
  ERC20Mock erc20Mock;
  MockERC721Receiver mockERC721Receiver;
  hToken htoken; // hToken is already the name of the contract so we use all lowercase htoken
  HolographUtilityToken holographUtilityToken;
  SampleERC20 sampleERC20;
  SampleERC721 sampleERC721;
  CxipERC721Proxy cxipERC721Proxy;
  Faucet faucet;

  constructor() {
    console.log("Setting up tests...");
  }
}

contract MyContractTest is Test, TestSetup {
  function setUp() public {
    holograph = new Holograph();
    holographGenesis = new HolographGenesis();
    holographBridge = new HolographBridge();
    holographBridgeProxy = new HolographBridgeProxy();
    holographFactory = new HolographFactory();
    holographFactoryProxy = new HolographFactoryProxy();
    holographOperator = new HolographOperator();
    holographOperatorProxy = new HolographOperatorProxy();
    holographRegistry = new HolographRegistry();
    holographRegistryProxy = new HolographRegistryProxy();
    holographTreasury = new HolographTreasury();
    holographTreasuryProxy = new HolographTreasuryProxy();
    holographInterfaces = new HolographInterfaces();
    holographRoyalties = new HolographRoyalties();

    holographERC20 = new HolographERC20();
    holographERC721 = new HolographERC721();
    cxipERC721 = new CxipERC721();
    layerZeroModule = new LayerZeroModule();
    mockLZEndpoint = new MockLZEndpoint();
    erc20Mock = new ERC20Mock("Mock ERC20", "MERC20", 0, "", "");
    mockERC721Receiver = new MockERC721Receiver();
    htoken = new hToken();
    holographUtilityToken = new HolographUtilityToken();
    sampleERC20 = new SampleERC20();
    sampleERC721 = new SampleERC721();
    cxipERC721Proxy = new CxipERC721Proxy();
    faucet = new Faucet();
  }

  function testSetup() public view {
    console.log("Hello, Holograph!");
    console.log("HolographGenesis address: %s", address(holographGenesis));
    console.log("Holograph address: %s", address(holograph));
    console.log("Registry address: %s", address(holographRegistry));
    console.log("Factory address: %s", address(holographFactory));
    console.log("Operator address: %s", address(holographOperator));
    console.log("Treasury address: %s", address(holographTreasury));
    console.log("Bridge address: %s", address(holographBridge));
    console.log("ERC20 address: %s", address(holographERC20));
    console.log("ERC721 address: %s", address(holographERC721));
    console.log("CxipERC721 address: %s", address(cxipERC721));
    console.log("LayerZeroModule address: %s", address(layerZeroModule));
    console.log("MockLZEndpoint address: %s", address(mockLZEndpoint));
    console.log("ERC20Mock address: %s", address(erc20Mock));
    console.log("MockERC721Receiver address: %s", address(mockERC721Receiver));
    console.log("hToken address: %s", address(htoken));
    console.log("HolographUtilityToken address: %s", address(holographUtilityToken));
    console.log("SampleERC20 address: %s", address(sampleERC20));
    console.log("SampleERC721 address: %s", address(sampleERC721));
    console.log("CxipERC721Proxy address: %s", address(cxipERC721Proxy));
    console.log("Faucet address: %s", address(faucet));
  }
}
