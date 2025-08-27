declare var global: any;
import path from 'path';

import { BigNumber, ethers } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DeployFunction, DeployOptions } from '@holographxyz/hardhat-deploy-holographed/types';
import {
  hreSplit,
  txParams,
  genesisDeployHelper,
  generateInitCode,
  genesisDeriveFutureAddress,
  zeroAddress,
  getDeployer,
} from '../scripts/utils/helpers';
import { MultisigAwareTx } from '../scripts/utils/multisig-aware-tx';
import { NetworkType, networks } from '@holographxyz/networks';
import { Environment, getEnvironment } from '@holographxyz/environment';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();
  const network = networks[hre.networkName];
  const environment: Environment = getEnvironment();
  const currentNetworkType: NetworkType = network.type;

  // Salt is used for deterministic address generation
  const salt = hre.deploymentSalt;

  // Define a mapping of blockchain network identifiers to their human-readable names
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
    linea: 'Linea',
    lineaTestnetSepolia: 'LineaTestnetSepolia',
    lineaTestnetGoerli: 'LineaTestnetGoerli',
  };

  // Define known development network keys for easier checking
  const knownDevNetworks = new Set(['localhost', 'localhost2', 'hardhat']);

  // Determine if the current environment requires a specific Drops Price Oracle
  let targetDropsPriceOracle;
  if (network.key in definedOracleNames) {
    // Use the specific oracle name based on the network key
    targetDropsPriceOracle = 'DropsPriceOracle' + definedOracleNames[network.key];
  } else if (!knownDevNetworks.has(network.key) && environment !== Environment.mainnet) {
    // If it's an unrecognized network (not in known dev networks and not mainnet), throw an error
    throw new Error('Drops price oracle not created for network yet!');
  } else {
    // For known development networks or mainnet without a specific oracle, use the dummy default
    targetDropsPriceOracle = 'DummyDropsPriceOracle';
  }

  // Asynchronously derive a future address for deploying the network-specific DropsPriceOracle
  const futureDropsPriceOracleAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    targetDropsPriceOracle,
    generateInitCode([], [])
  );
  // Log the future address of the oracle
  console.log('the future "' + targetDropsPriceOracle + '" address is', futureDropsPriceOracleAddress);

  // Check if the oracle contract is already deployed by getting the code at the future address
  let dropsPriceOracleDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureDropsPriceOracleAddress,
    'latest',
  ]);
  // If no code is found at the address, it means the contract has not been deployed
  if (dropsPriceOracleDeployedCode === '0x' || dropsPriceOracleDeployedCode === '') {
    console.log('"' + targetDropsPriceOracle + '" bytecode not found, need to deploy"');
    // Deploy the oracle using a helper function with the provided details
    let dropsPriceOracle = await genesisDeployHelper(
      hre,
      salt,
      targetDropsPriceOracle,
      generateInitCode([], []),
      futureDropsPriceOracleAddress
    );
  } else {
    console.log('"' + targetDropsPriceOracle + '" is already deployed.');
  }

  // Deploy DropsPriceOracleProxy source contract
  const futureDropsPriceOracleProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'DropsPriceOracleProxy',
    generateInitCode([], [])
  );
  console.log('the future "DropsPriceOracleProxy" address is', futureDropsPriceOracleProxyAddress);
  let dropsPriceOracleProxyDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureDropsPriceOracleProxyAddress,
    'latest',
  ]);
  if (dropsPriceOracleProxyDeployedCode === '0x' || dropsPriceOracleProxyDeployedCode === '') {
    console.log('"DropsPriceOracleProxy" bytecode not found, need to deploy"');
    let dropsPriceOracleProxy = await genesisDeployHelper(
      hre,
      salt,
      'DropsPriceOracleProxy',
      generateInitCode(['address', 'bytes'], [futureDropsPriceOracleAddress, generateInitCode([], [])]),
      futureDropsPriceOracleProxyAddress
    );
  } else {
    console.log('"DropsPriceOracleProxy" is already deployed.');
    console.log('Checking for reference to correct "' + targetDropsPriceOracle + '" deployment.');
    // need to check here if source reference is correct
    futureDropsPriceOracleProxyAddress;
    const dropsPriceOracleProxy = await hre.ethers.getContract('DropsPriceOracleProxy', deployerAddress);
    let priceOracleSource = await dropsPriceOracleProxy.getDropsPriceOracle();
    if (priceOracleSource !== futureDropsPriceOracleAddress) {
      console.log('"DropsPriceOracleProxy" references incorrect version of "' + targetDropsPriceOracle + '".');
      const setDropsPriceOracleTx = await MultisigAwareTx(
        hre,
        'DropsPriceOracleProxy',
        dropsPriceOracleProxy,
        await dropsPriceOracleProxy.populateTransaction.setDropsPriceOracle(futureDropsPriceOracleAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: dropsPriceOracleProxy,
            data: dropsPriceOracleProxy.populateTransaction.setDropsPriceOracle(futureDropsPriceOracleAddress),
          })),
        })
      );
      console.log('Transaction hash:', setDropsPriceOracleTx.hash);
      await setDropsPriceOracleTx.wait();
      console.log('"DropsPriceOracleProxy" reference updated.');
    } else {
      console.log('"DropsPriceOracleProxy" references correct version of "' + targetDropsPriceOracle + '".');
    }
  }

  if (network.key === 'mantleTestnet') {
    console.log('Checking token price ratio on mantle testnet');
    const priceOracleContract = (
      (await hre.ethers.getContract('DropsPriceOracleMantleTestnet', deployerAddress)) as Contract
    ).attach(futureDropsPriceOracleProxyAddress);
    if ((await priceOracleContract.getTokenPriceRatio()).eq(BigNumber.from('0'))) {
      console.log('price ratio not set');
      const priceOracleContractTx = await MultisigAwareTx(
        hre,
        'DropsPriceOracleMantleTestnet',
        priceOracleContract,
        await priceOracleContract.populateTransaction.setTokenPriceRatio(BigNumber.from('1000000000000000000'), {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: priceOracleContract,
            data: priceOracleContract.populateTransaction.setTokenPriceRatio(BigNumber.from('1000000000000000000')),
          })),
        })
      );
      console.log('Transaction hash:', priceOracleContractTx.hash);
      await priceOracleContractTx.wait();
    } else {
      console.log('price ratio is set');
    }
  }

  // We manually inject drops price oracle proxy on local deployments
  // this is to accomodate the fact that drops price oracle proxy is hardcoded in the contract
  if (['localhost', 'localhost2', 'hardhat'].includes(network.key)) {
    console.log('Injecting DropsPriceOracleProxy on local deployments');
    // Set it at address in VM
    let acountByteCodeSet: boolean = await hre.provider.send('anvil_setCode', [
      '0xeA7f4C52cbD4CF1036CdCa8B16AcA11f5b09cF6E',
      [
        '0x',
        '6080604052600436106100745760003560e01c80638808abf81161004e578063',
        '8808abf814610190578063bf64a82d146101c4578063f851a440146101d75780',
        '63fc301bd1146101ec5761007b565b80634ddf47d4146100c55780636e9960c3',
        '1461011b578063704b6c02146101705761007b565b3661007b57005b7f26600f',
        '0171e5a2b86874be26285c66444b2a6fa5f62114757214d5e732aded36543660',
        '008037600080366000845af490503d6000803e8080156100be573d6000f35b3d',
        '6000fd5b005b3480156100d157600080fd5b506100e56100e036600461089256',
        '5b61020c565b6040517fffffffff000000000000000000000000000000000000',
        '0000000000000000000090911681526020015b60405180910390f35b34801561',
        '012757600080fd5b507f3f106594dc74eeef980dae234cde8324dc2497b13d27',
        'a0c59e55bd2ca10a07c9545b60405173ffffffffffffffffffffffffffffffff',
        'ffffffff9091168152602001610112565b34801561017c57600080fd5b506100',
        'c361018b366004610937565b610515565b34801561019c57600080fd5b507f26',
        '600f0171e5a2b86874be26285c66444b2a6fa5f62114757214d5e732aded3654',
        '61014b565b6100c36101d236600461095b565b6105ef565b3480156101e35760',
        '0080fd5b5061014b6106c5565b3480156101f857600080fd5b506100c3610207',
        '366004610937565b6106f4565b60006102367f4e5f991bca30eca2d4643aaefa',
        '807e88f96a4a97398933d572a3c0d973004a015490565b156102a2576040517f',
        '08c379a000000000000000000000000000000000000000000000000000000000',
        '815260206004820152601e60248201527f484f4c4f47524150483a20616c7265',
        '61647920696e697469616c697a6564000060448201526064015b604051809103',
        '90fd5b600080838060200190518101906102b99190610a10565b91509150327f',
        '3f106594dc74eeef980dae234cde8324dc2497b13d27a0c59e55bd2ca10a07c9',
        '55817f26600f0171e5a2b86874be26285c66444b2a6fa5f62114757214d5e732',
        'aded36556000808373ffffffffffffffffffffffffffffffffffffffff168360',
        '405160240161032e9190610a9d565b604080517fffffffffffffffffffffffff',
        'ffffffffffffffffffffffffffffffffffffffe0818403018152918152602082',
        '0180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        '167f4ddf47d40000000000000000000000000000000000000000000000000000',
        '0000179052516103af9190610aee565b600060405180830381855af49150503d',
        '80600081146103ea576040519150601f19603f3d011682016040523d82523d60',
        '00602084013e6103ef565b606091505b50915091506000818060200190518101',
        '9061040a9190610b0a565b905082801561045a57507fffffffff000000000000',
        '0000000000000000000000000000000000000000000081167f4ddf47d4000000',
        '00000000000000000000000000000000000000000000000000145b6104c05760',
        '40517f08c379a000000000000000000000000000000000000000000000000000',
        '000000815260206004820152601560248201527f696e697469616c697a617469',
        '6f6e206661696c65640000000000000000000000604482015260640161029956',
        '5b6104e960017f4e5f991bca30eca2d4643aaefa807e88f96a4a97398933d572',
        'a3c0d973004a0155565b507f4ddf47d400000000000000000000000000000000',
        '0000000000000000000000009695505050505050565b7f3f106594dc74eeef98',
        '0dae234cde8324dc2497b13d27a0c59e55bd2ca10a07c95473ffffffffffffff',
        'ffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffff',
        'ffffffff16146105cb576040517f08c379a00000000000000000000000000000',
        '0000000000000000000000000000815260206004820152601e60248201527f48',
        '4f4c4f47524150483a2061646d696e206f6e6c792066756e6374696f6e000060',
        '44820152606401610299565b7f3f106594dc74eeef980dae234cde8324dc2497',
        'b13d27a0c59e55bd2ca10a07c955565b7f3f106594dc74eeef980dae234cde83',
        '24dc2497b13d27a0c59e55bd2ca10a07c95473ffffffffffffffffffffffffff',
        'ffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614',
        '6106a5576040517f08c379a00000000000000000000000000000000000000000',
        '0000000000000000815260206004820152601e60248201527f484f4c4f475241',
        '50483a2061646d696e206f6e6c792066756e6374696f6e000060448201526064',
        '01610299565b808260003760008082600034875af13d6000803e8080156100be',
        '573d6000f35b60006106ef7f3f106594dc74eeef980dae234cde8324dc2497b1',
        '3d27a0c59e55bd2ca10a07c95490565b905090565b7f3f106594dc74eeef980d',
        'ae234cde8324dc2497b13d27a0c59e55bd2ca10a07c95473ffffffffffffffff',
        'ffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffff',
        'ffffff16146107aa576040517f08c379a0000000000000000000000000000000',
        '00000000000000000000000000815260206004820152601e60248201527f484f',
        '4c4f47524150483a2061646d696e206f6e6c792066756e6374696f6e00006044',
        '820152606401610299565b7f26600f0171e5a2b86874be26285c66444b2a6fa5',
        'f62114757214d5e732aded3655565b7f4e487b71000000000000000000000000',
        '00000000000000000000000000000000600052604160045260246000fd5b6040',
        '51601f82017fffffffffffffffffffffffffffffffffffffffffffffffffffff',
        'ffffffffffe016810167ffffffffffffffff8111828210171561084457610844',
        '6107ce565b604052919050565b600067ffffffffffffffff8211156108665761',
        '08666107ce565b50601f017fffffffffffffffffffffffffffffffffffffffff',
        'ffffffffffffffffffffffe01660200190565b6000602082840312156108a457',
        '600080fd5b813567ffffffffffffffff8111156108bb57600080fd5b8201601f',
        '810184136108cc57600080fd5b80356108df6108da8261084c565b6107fd565b',
        '8181528560208385010111156108f457600080fd5b8160208401602083013760',
        '0091810160200191909152949350505050565b73ffffffffffffffffffffffff',
        'ffffffffffffffff8116811461093457600080fd5b50565b6000602082840312',
        '1561094957600080fd5b813561095481610912565b9392505050565b60008060',
        '006040848603121561097057600080fd5b833561097b81610912565b92506020',
        '84013567ffffffffffffffff8082111561099857600080fd5b81860191508660',
        '1f8301126109ac57600080fd5b8135818111156109bb57600080fd5b87602082',
        '85010111156109cd57600080fd5b602083019450809350505050925092509256',
        '5b60005b838110156109fb5781810151838201526020016109e3565b83811115',
        '610a0a576000848401525b50505050565b60008060408385031215610a235760',
        '0080fd5b8251610a2e81610912565b602084015190925067ffffffffffffffff',
        '811115610a4b57600080fd5b8301601f81018513610a5c57600080fd5b805161',
        '0a6a6108da8261084c565b818152866020838501011115610a7f57600080fd5b',
        '610a908260208301602086016109e0565b8093505050509250929050565b6020',
        '815260008251806020840152610abc8160408501602087016109e0565b601f01',
        '7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        'e0169190910160400192915050565b60008251610b008184602087016109e056',
        '5b9190910192915050565b600060208284031215610b1c57600080fd5b81517f',
        'ffffffff00000000000000000000000000000000000000000000000000000000',
        '8116811461095457600080fdfea164736f6c634300080d000a',
      ].join(''),
    ]);
    console.log('DropsPriceOracleProxy code injected successfully');

    console.log(`Setting DropsPriceOracleProxy address in anvil storage at 0xeA7f4C52cbD4CF1036CdCa8B16AcA11f5b09cF6E`);
    let acountStorageSet: boolean = await hre.provider.send('anvil_setStorageAt', [
      '0xeA7f4C52cbD4CF1036CdCa8B16AcA11f5b09cF6E',
      '0x26600f0171e5a2b86874be26285c66444b2a6fa5f62114757214d5e732aded36',
      ethers.utils.hexZeroPad(futureDropsPriceOracleAddress, 32), // must be padded to 32 bytes
    ]);
    console.log('DropsPriceOracleProxy address set in anvil storage successfully');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['DropsPriceOracleProxy', 'DropsPriceOracle'];
func.dependencies = ['HolographGenesis'];
