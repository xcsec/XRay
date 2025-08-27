// // SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import {Test, Vm, console} from "forge-std/Test.sol";
import {Constants} from "./Constants.sol";

contract DeployedSetUp is Test {
  uint256 constant notValidForkId = 9999999;
  uint256 forkId = notValidForkId;
  address holographInterfacesDeployed;
  address holographDeployed;
  address holographERC721Deployed;
  address cxipERC721ProxyDeployed;
  address cxipERC721Deployed;
  address erc20MockDeployed;
  address holographBridgeDeployed;
  address holographBridgeProxyDeployed;
  address holographERC20Deployed;
  address holographFactoryDeployed;
  address holographFactoryProxyDeployed;
  address holographGenesisDeployed;
  address holographOperatorDeployed;
  address holographOperatorProxyDeployed;
  address holographRegistryDeployed;
  address holographRegistryProxyDeployed;
  address holographTreasuryDeployed;
  address holographTreasuryProxyDeployed;
  address hTokenDeployed;
  address mockERC721ReceiverDeployed;
  address holographRoyaltiesDeployed;
  address sampleERC20Deployed;
  address sampleERC721Deployed;
  address sampleERC721Deployed2;

  function init(uint256 _forkId) public {
    require(_forkId != notValidForkId, "DeployedSetUp: _forkId cannot be 9999999");
    forkId = _forkId;
  }

  function setUp() public virtual {
    require(forkId != notValidForkId, "DeployedSetUp: you need init first, forkId cannot be 9999999");
    holographInterfacesDeployed = Constants.getHolographInterfaces();
    holographDeployed = Constants.getHolograph();
    holographERC721Deployed = Constants.getHolographERC721();
    if (vm.activeFork() == forkId) cxipERC721ProxyDeployed = Constants.getCxipERC721Proxy_L2();
    else cxipERC721ProxyDeployed = Constants.getCxipERC721Proxy();
    cxipERC721Deployed = Constants.getCxipERC721();
    erc20MockDeployed = Constants.getERC20Mock();
    holographBridgeDeployed = Constants.getHolographBridge();
    holographBridgeProxyDeployed = Constants.getHolographBridgeProxy();
    holographERC20Deployed = Constants.getHolographERC20();
    holographFactoryDeployed = Constants.getHolographFactory();
    holographFactoryProxyDeployed = Constants.getHolographFactoryProxy();
    holographGenesisDeployed = Constants.getHolographGenesis();
    holographOperatorDeployed = Constants.getHolographOperator();
    holographOperatorProxyDeployed = Constants.getHolographOperatorProxy();
    holographRegistryDeployed = Constants.getHolographRegistry();
    holographRegistryProxyDeployed = Constants.getHolographRegistryProxy();
    holographTreasuryDeployed = Constants.getHolographTreasury();
    holographTreasuryProxyDeployed = Constants.getHolographTreasuryProxy();
    hTokenDeployed = Constants.getHToken();
    mockERC721ReceiverDeployed = Constants.getMockERC721Receiver();
    holographRoyaltiesDeployed = Constants.getHolographRoyalties();
    if (vm.activeFork() == forkId) sampleERC20Deployed = Constants.getSampleERC20_L2();
    else sampleERC20Deployed = Constants.getSampleERC20();
    if (vm.activeFork() == forkId) sampleERC721Deployed = Constants.getSampleERC721_L2();
    else sampleERC721Deployed = Constants.getSampleERC721();
  }
}
