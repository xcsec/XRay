declare var global: any;
import path from 'path';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import { NetworkType, networks } from '@holographxyz/networks';
import { Environment, getEnvironment } from '@holographxyz/environment';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  const network = networks[hre.network.name];
  const environment: Environment = getEnvironment();
  const currentNetworkType: NetworkType = network.type;

  // TODO: Goerli testnet should be deprecated and removed once Sepolia is ready
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
    mantle: 'Mantle',
    mantleTestnet: 'MantleTestnet',
    base: 'Base',
    baseTestnetSepolia: 'BaseTestnetSepolia',
    zora: 'Zora',
    zoraTestnetSepolia: 'ZoraTestnetSepolia',
    lineaTestnetGoerli: 'LineaTestnetGoerli',
    lineaTestnetSepolia: 'LineaTestnetSepolia',
    linea: 'Linea',
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

  if (currentNetworkType !== NetworkType.local) {
    let contracts: string[] = [
      'HolographUtilityToken',
      'hToken',
      'hTokenProxy',
      'Holograph',
      'HolographBridge',
      'HolographBridgeProxy',
      'Holographer',
      'HolographERC20',
      'HolographERC721',
      'HolographDropERC721',
      'HolographDropERC721V2',
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
      'LayerZeroModuleProxy',
      'EditionsMetadataRenderer',
      'EditionsMetadataRendererProxy',
      'OVM_GasPriceOracle',
      'DropsPriceOracleProxy',
      'DropsMetadataRenderer',
      'DropsMetadataRendererProxy',
      'EditionsMetadataRenderer',
      'EditionsMetadataRendererProxy',
      targetDropsPriceOracle,
    ];
    for (let i = 0, l = contracts.length; i < l; i++) {
      let contract = contracts[i];
      try {
        let options = {
          address: (await hre.ethers.getContract(contract)).address,
          constructorArguments: [],
        };

        if (contract.includes('DropsPriceOracle') && contract !== 'DropsPriceOracleProxy') {
          const contractFullName = `src/drops/oracle/${contract}.sol:${contract}`;
          options['contract'] = contractFullName;
        }

        await hre.run('verify:verify', options);
      } catch (error) {
        console.log(`Failed to verify "${contract}" -> ${error}`);
      }
    }
  } else {
    console.log('Not verifying contracts on localhost networks.');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};
export default func;
func.tags = ['Verify'];
func.dependencies = [];
