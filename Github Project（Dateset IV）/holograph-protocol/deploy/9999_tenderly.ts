declare var global: any;
import path from 'path';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import { NetworkType, Networks, networks } from '@holographxyz/networks';
import { Environment, getEnvironment } from '@holographxyz/environment';
import { tenderly } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

function mapFullKeyToShortKey(networks: Networks, fullKey: string) {
  if (networks[fullKey]?.shortKey) {
    return networks[fullKey].shortKey;
  }
  throw new Error(`Network with fullKey '${fullKey}' not found`);
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  if (process.env.TENDERLY_ENABLED === 'true') {
    const currentNetworkType: NetworkType = networks[hre.network.name].type;
    if (currentNetworkType === NetworkType.local) {
      console.log('Not verifying contracts on localhost networks.');
      return;
    }
    const accounts = await hre.ethers.getSigners();
    let deployer: SignerWithAddress = accounts[0];
    let network = networks[hre.network.name];
    const environment: Environment = getEnvironment();
    // const currentNetworkType: NetworkType = network.type;
    const definedOracleNames = {
      avalanche: 'Avalanche',
      avalancheTestnet: 'AvalancheTestnet',
      binanceSmartChain: 'BinanceSmartChain',
      binanceSmartChainTestnet: 'BinanceSmartChainTestnet',
      ethereum: 'Ethereum',
      ethereumTestnetSepolia: 'EthereumTestnetSepolia',
      polygon: 'Polygon',
      polygonTestnet: 'PolygonTestnet',
      optimism: 'Optimism',
      optimismTestnetSepolia: 'OptimismTestnetSepolia',
      arbitrumNova: 'ArbitrumNova',
      arbitrumOne: 'ArbitrumOne',
      arbitrumTestnetSepolia: 'ArbitrumTestnetSepolia',
      zora: 'Zora',
      zoraTestnetSepolia: 'ZoraTestnetSepolia',
      linea: 'Linea',
      lineaTestnetGoerli: 'LineaTestnetGoerli',
      lineaTestnetSepolia: 'LineaTestnetSepolia',
      base: 'base',
      baseTestnetSepolia: 'baseTestnetSepolia',
      mantle: 'Mantle',
      mantleTestnet: 'MantleTestnet',
    };
    let targetDropsPriceOracle = 'DummyDropsPriceOracle';
    if (network.key in definedOracleNames) {
      targetDropsPriceOracle = 'DropsPriceOracle' + definedOracleNames[network.key];
    } else {
      if (
        environment === Environment.mainnet ||
        (network.key !== 'localhost' && network.key !== 'localhost2' && network.key !== 'hardhat')
      ) {
        throw new Error('Drops price oracle not created for network yet!');
      }
    }
    let contracts: string[] = [
      'HolographUtilityToken',
      'hToken',
      'Holograph',
      'HolographBridge',
      'HolographBridgeProxy',
      'Holographer',
      'HolographERC20',
      'HolographERC721',
      'HolographDropERC721',
      'HolographDropERC721Proxy',
      'HolographFactory',
      'HolographFactoryProxy',
      'HolographGeneric',
      'HolographGenesis',
      'HolographOperator',
      'HolographOperatorProxy',
      'HolographRegistry',
      'HolographRegistryProxy',
      'HolographTreasury',
      'HolographTreasuryProxy',
      'HolographInterfaces',
      'HolographRoyalties',
      'CxipERC721',
      'CxipERC721Proxy',
      'Faucet',
      'LayerZeroModule',
      'EditionsMetadataRenderer',
      'EditionsMetadataRendererProxy',
      'OVM_GasPriceOracle',
      'DropsPriceOracleProxy',
      targetDropsPriceOracle,
    ];
    // Tenderly only supports short network names defined in a private object
    // so this converts the full network name to the short name before passing into tenderly to fix the issue
    // with errors thrown when toString is called on a network not defined in the private object
    //
    // Reference to the issue below to open an issue or PR for hardhat-tenderly to fix this
    // Instead of using a private object, it should use the networks object defined in hardhat.config.ts
    // chainId = NETWORK_NAME_CHAIN_ID_MAP[network.toLowerCase()].toString();
    network = mapFullKeyToShortKey(networks, hre.network.name);
    tenderly.env.hardhatArguments.network = network;
    tenderly.env.network.name = network;
    console.log('Verifying contracts on Tenderly...');
    for (let i: number = 0, l: number = contracts.length; i < l; i++) {
      try {
        let contract: string = contracts[i];
        const contractAddress = await (await hre.deployments.get(contract)).address;
        console.log(contract, contractAddress);
        await tenderly.verify({
          address: contractAddress,
          name: contract,
        });
      } catch (error) {
        console.log(`Failed to run tenderly verify -> ${error}`);
      }
    }
  } else {
    console.log('Tenderly is not enabled... skipping tenderly contract verification.');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['Tenderly'];
func.dependencies = [];
