declare var global: any;
import path from 'path';
import Web3 from 'web3';
import { BigNumber, BytesLike } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import {
  Holograph,
  HolographBridge,
  HolographBridgeProxy,
  HolographFactory,
  HolographFactoryProxy,
  HolographOperator,
  HolographOperatorProxy,
  HolographRegistry,
  HolographRegistryProxy,
  HolographTreasury,
  HolographTreasuryProxy,
} from '../typechain-types';
import {
  genesisDeriveFutureAddress,
  genesisDeployHelper,
  generateInitCode,
  zeroAddress,
  hreSplit,
  generateErc20Config,
  txParams,
  getDeployer,
  askQuestion,
} from '../scripts/utils/helpers';
import { MultisigAwareTx } from '../scripts/utils/multisig-aware-tx';
import { reservedNamespaceHashes } from '../scripts/utils/reserved-namespaces';
import { HolographERC20Event, ConfigureEvents } from '../scripts/utils/events';
import { NetworkType, Network, networks } from '@holographxyz/networks';
import { Environment, getEnvironment } from '@holographxyz/environment';

import dotenv from 'dotenv';
dotenv.config();

const GWEI: BigNumber = BigNumber.from('1000000000');
const ZERO: BigNumber = BigNumber.from('0');

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇\n`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();
  const web3 = new Web3();
  const salt = hre.deploymentSalt;

  console.log('Deployer address:', deployerAddress);
  console.log(`Deploying to network: ${hre1.network!.name}`);
  console.log(`The deployment salt is: ${BigNumber.from(salt).toString()}`);
  console.log(`The gas price override is set to: ${process.env.GAS_PRICE_OVERRIDE || 'undefined'} gwei`);
  console.log(`We are in dry run mode? ${process.env.DRY_RUN === 'true'}`);

  if (process.env.SKIP_DEPLOY_CONFIRMATION !== 'true') {
    const answer = await askQuestion(`Continue? (y/n)\n`);
    if (answer !== 'y') {
      console.log(`Exiting...`);
      process.exit();
    }
    console.log(`Continuing...`);
  }

  const futureHolographAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'Holograph',
    generateInitCode(
      ['uint32', 'address', 'address', 'address', 'address', 'address', 'address', 'address', 'address'],
      [
        '0x' + networks[hre.networkName].holographId.toString(16).padStart(8, '0'),
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
      ]
    )
  );
  console.log('the future "Holograph" address is', futureHolographAddress);
  global.__holographAddress = futureHolographAddress.toLowerCase();

  const futureBridgeAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographBridge',
    generateInitCode(['address', 'address', 'address', 'address'], [zeroAddress, zeroAddress, zeroAddress, zeroAddress])
  );
  console.log('the future "HolographBridge" address is', futureBridgeAddress);

  const futureBridgeProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographBridgeProxy',
    generateInitCode(
      ['address', 'bytes'],
      [
        zeroAddress,
        generateInitCode(
          ['address', 'address', 'address', 'address', 'address'],
          [zeroAddress, zeroAddress, zeroAddress, zeroAddress, zeroAddress]
        ),
      ]
    )
  );
  console.log('the future "HolographBridgeProxy" address is', futureBridgeProxyAddress);

  const futureFactoryAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographFactory',
    generateInitCode(['address', 'address', 'address'], [zeroAddress, zeroAddress, zeroAddress])
  );
  console.log('the future "HolographFactory" address is', futureFactoryAddress);

  const futureFactoryProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographFactoryProxy',
    generateInitCode(
      ['address', 'bytes'],
      [zeroAddress, generateInitCode(['address', 'address', 'address'], [zeroAddress, zeroAddress, zeroAddress])]
    )
  );
  console.log('the future "HolographFactoryProxy" address is', futureFactoryProxyAddress);
  global.__holographFactoryAddress = futureFactoryProxyAddress.toLowerCase();

  const futureOperatorAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographOperator',
    generateInitCode(
      ['address', 'address', 'address', 'address', 'address', 'uint256'],
      [zeroAddress, zeroAddress, zeroAddress, zeroAddress, zeroAddress, '0x' + '00'.repeat(32)]
    )
  );
  console.log('the future "HolographOperator" address is', futureOperatorAddress);

  const futureOperatorProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographOperatorProxy',
    generateInitCode(
      ['address', 'bytes'],
      [
        zeroAddress,
        generateInitCode(
          ['address', 'address', 'address', 'address', 'address', 'uint256'],
          [zeroAddress, zeroAddress, zeroAddress, zeroAddress, zeroAddress, '0x' + '00'.repeat(32)]
        ),
      ]
    )
  );
  console.log('the future "HolographOperatorProxy" address is', futureOperatorProxyAddress);

  const futureRegistryAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographRegistry',
    generateInitCode(['address', 'bytes32[]'], [zeroAddress, []])
  );
  console.log('the future "HolographRegistry" address is', futureRegistryAddress);

  const futureRegistryProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographRegistryProxy',
    generateInitCode(['address', 'bytes'], [zeroAddress, generateInitCode(['address', 'bytes32[]'], [zeroAddress, []])])
  );
  console.log('the future "HolographRegistryProxy" address is', futureRegistryProxyAddress);

  const futureTreasuryAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographTreasury',
    generateInitCode(['address', 'address', 'address', 'address'], [zeroAddress, zeroAddress, zeroAddress, zeroAddress])
  );
  console.log('the future "HolographTreasury" address is', futureTreasuryAddress);

  const futureTreasuryProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographTreasuryProxy',
    generateInitCode(
      ['address', 'bytes'],
      [
        zeroAddress,
        generateInitCode(
          ['address', 'address', 'address', 'address'],
          [zeroAddress, zeroAddress, zeroAddress, zeroAddress]
        ),
      ]
    )
  );
  console.log('the future "HolographTreasuryProxy" address is', futureTreasuryProxyAddress);

  const futureHolographInterfacesAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographInterfaces',
    generateInitCode(['address'], [zeroAddress])
  );
  console.log('the future "HolographInterfaces" address is', futureHolographInterfacesAddress);

  const futureRoyaltiesAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographRoyalties',
    generateInitCode(['uint256'], ['0x' + '00'.repeat(32)])
  );
  console.log('the future "HolographRoyalties" address is', futureRoyaltiesAddress);

  const network = networks[hre.networkName];

  const environment: Environment = getEnvironment();

  let tokenAmount: BigNumber = BigNumber.from('100000000');
  let targetChain: BigNumber = BigNumber.from('0');
  let tokenRecipient: string = deployerAddress;

  // Future Holograph Utility Token
  const currentNetworkType: NetworkType = network.type;
  let primaryNetwork: Network | undefined; // Initialize primaryNetwork variable
  if (currentNetworkType === NetworkType.local) {
    // ten billion tokens minted per network on local testnet (LOCAL ENV)
    tokenAmount = BigNumber.from('10' + '000' + '000' + '000' + '000000000000000000');
    primaryNetwork = networks.localhost;
  } else if (currentNetworkType === NetworkType.testnet) {
    if (environment === Environment.develop) {
      // one hundred million tokens minted on ethereum on testnet sepolia (DEVELOP ENV)
      primaryNetwork = networks.ethereumTestnetSepolia;
      tokenAmount = BigNumber.from('100' + '000' + '000' + '000000000000000000');
      targetChain = BigNumber.from(networks.ethereumTestnetSepolia.chain);
      tokenRecipient = deployerAddress;
    }
    if (environment === Environment.testnet) {
      // ten billion tokens minted on ethereum on testnet sepolia (TESTNET ENV)
      primaryNetwork = networks.ethereumTestnetSepolia;
      tokenAmount = BigNumber.from('10' + '000' + '000' + '000' + '000000000000000000');
      targetChain = BigNumber.from(networks.ethereumTestnetSepolia.chain);
      tokenRecipient = networks.ethereumTestnetSepolia.protocolMultisig!;
    }
  } else if (currentNetworkType === NetworkType.mainnet) {
    /**
     * 🚨🚨🚨 MAINNET 🚨🚨🚨
     */
    // ten billion tokens minted on ethereum on mainnet
    tokenAmount = BigNumber.from('10' + '000' + '000' + '000' + '000000000000000000');
    // target chain is restricted to ethereum, to prevent the minting of tokens on other chains
    targetChain = BigNumber.from(networks.ethereum.chain);
    // protocol multisig is the recipient
    // This is the hardcoded Gnosis Safe address of Holograph Research
    tokenRecipient = '0x0a7aa3d5855272Df5B2677C7F0E5161ae77D5260'; // networks.ethereum.protocolMultisig V2;
    primaryNetwork = networks.ethereum;
  } else {
    throw new Error('cannot identity current NetworkType');
  }

  // Extra check to ensure primaryNetwork is set
  if (primaryNetwork === undefined || !primaryNetwork) {
    throw new Error('primaryNetwork not set');
  }

  // NOTICE: At the moment the HLG contract's address is reliant on the deployerAddress which prevents multiple approved deployers from deploying the same address. This is a temporary solution until the HLG contract is upgraded to allow any deployerAddress to be used.
  // NOTE: Use hardcoded version of deployerAddress from Ledger hardware only for testnet and mainnet envs
  // If environment is develop use the signers deployerAddress
  let erc20DeployerAddress = '0xBB566182f35B9E5Ae04dB02a5450CC156d2f89c1'; // Ledger deployerAddress

  // If environment is develop use the signers deployerAddress (the hardcoded version is only for testnet and mainnet envs)
  if (environment === Environment.develop) {
    console.log(`Using deployerAddress from signer ${deployerAddress}`);
    erc20DeployerAddress = deployerAddress;
  }

  let { erc20Config, erc20ConfigHash, erc20ConfigHashBytes } = await generateErc20Config(
    primaryNetwork,
    erc20DeployerAddress, // TODO: Upgrade the HLG contract so that any deployerAddress can be used
    'HolographUtilityToken',
    'Holograph Utility Token',
    'HLG',
    'Holograph Utility Token',
    '1',
    18,
    ConfigureEvents([]),
    generateInitCode(
      ['address', 'uint256', 'uint256', 'address'],
      [erc20DeployerAddress, tokenAmount.toHexString(), targetChain.toHexString(), tokenRecipient] // TODO: Upgrade the HLG contract so that any deployerAddress can be used
    ),
    salt
  );

  const holographerBytecode: BytesLike = (await hre.ethers.getContractFactory('Holographer')).bytecode;
  const futureHlgAddress = hre.ethers.utils.getCreate2Address(
    futureFactoryProxyAddress,
    erc20ConfigHash,
    hre.ethers.utils.keccak256(holographerBytecode)
  );
  console.log('the future "HolographUtilityToken" address is', futureHlgAddress);

  const dryRun = process.env.DRY_RUN;
  if (dryRun && dryRun === 'true') {
    console.log('Dry run complete, exiting.');
    process.exit();
  }

  // Holograph
  let holographDeployedCode: string = await hre.provider.send('eth_getCode', [futureHolographAddress, 'latest']);
  if (holographDeployedCode === '0x' || holographDeployedCode === '') {
    console.log('"Holograph" bytecode not found, need to deploy"');
    let holograph = await genesisDeployHelper(
      hre,
      salt,
      'Holograph',
      generateInitCode(
        ['uint32', 'address', 'address', 'address', 'address', 'address', 'address', 'address'],
        [
          '0x' + networks[hre.networkName].holographId.toString(16).padStart(8, '0'),
          futureBridgeProxyAddress,
          futureFactoryProxyAddress,
          futureHolographInterfacesAddress,
          futureOperatorProxyAddress,
          futureRegistryProxyAddress,
          futureTreasuryProxyAddress,
          futureHlgAddress,
        ]
      ),
      futureHolographAddress
    );
  } else {
    console.log('"Holograph" is already deployed. Checking configs.');
    let holograph = (await hre.ethers.getContractAt('Holograph', futureHolographAddress, deployerAddress)) as Holograph;
    if ((await holograph.getBridge()) !== futureBridgeProxyAddress) {
      console.log(`Updating Bridge reference to ${futureBridgeProxyAddress}`);
      let tx = await MultisigAwareTx(
        hre,
        'Holograph',
        holograph,
        await holograph.populateTransaction.setBridge(futureBridgeProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.populateTransaction.setBridge(futureBridgeProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
      console.log(`Bridge reference updated to ${futureBridgeProxyAddress} at block ${receipt.transactionHash}`);
    }
    if ((await holograph.getFactory()) !== futureFactoryProxyAddress) {
      console.log(`Updating Factory reference to ${futureFactoryProxyAddress}`);
      let tx = await MultisigAwareTx(
        hre,
        'Holograph',
        holograph,
        await holograph.populateTransaction.setFactory(futureFactoryProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.setFactory(futureFactoryProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holograph.getInterfaces()) !== futureHolographInterfacesAddress) {
      console.log('Updating HolographInterfaces reference');
      let tx = await MultisigAwareTx(
        hre,
        'Holograph',
        holograph,
        await holograph.populateTransaction.setInterfaces(futureHolographInterfacesAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.populateTransaction.setInterfaces(futureHolographInterfacesAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holograph.getOperator()) !== futureOperatorProxyAddress) {
      console.log('Updating Operator reference');
      let tx = await MultisigAwareTx(
        hre,
        'Holograph',
        holograph,
        await holograph.populateTransaction.setOperator(futureOperatorProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.populateTransaction.setOperator(futureOperatorProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holograph.getRegistry()) !== futureRegistryProxyAddress) {
      console.log('Updating Registry reference');
      let tx = await MultisigAwareTx(
        hre,
        'Holograph',
        holograph,
        await holograph.populateTransaction.setRegistry(futureRegistryProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.populateTransaction.setRegistry(futureRegistryProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holograph.getTreasury()) !== futureTreasuryProxyAddress) {
      console.log('Updating Treasury reference');
      let tx = await MultisigAwareTx(
        hre,
        'Holograph',
        holograph,
        await holograph.populateTransaction.setTreasury(futureTreasuryProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.populateTransaction.setTreasury(futureTreasuryProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }

    const holographUtilityTokenAddress = await holograph.getUtilityToken();
    if (holographUtilityTokenAddress !== futureHlgAddress) {
      console.log(
        `The current HolographUtilityToken: ${holographUtilityTokenAddress} does not match future HLG: ${futureHlgAddress}`
      );
      let tx = await MultisigAwareTx(
        hre,
        'Holograph',
        holograph,
        await holograph.populateTransaction.setUtilityToken(futureHlgAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.populateTransaction.setUtilityToken(futureHlgAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    } else {
      console.log(
        `The current HolographUtilityToken: ${holographUtilityTokenAddress} matches future HLG: ${futureHlgAddress}`
      );
    }
  }

  // HolographBridge
  let bridgeDeployedCode: string = await hre.provider.send('eth_getCode', [futureBridgeAddress, 'latest']);
  if (bridgeDeployedCode === '0x' || bridgeDeployedCode === '') {
    console.log('"HolographBridge" bytecode not found, need to deploy"');
    let holographBridge = await genesisDeployHelper(
      hre,
      salt,
      'HolographBridge',
      generateInitCode(
        ['address', 'address', 'address', 'address'],
        [zeroAddress, zeroAddress, zeroAddress, zeroAddress]
      ),
      futureBridgeAddress
    );
  } else {
    console.log('"HolographBridge" is already deployed.');
  }

  // HolographBridgeProxy
  let bridgeProxyDeployedCode: string = await hre.provider.send('eth_getCode', [futureBridgeProxyAddress, 'latest']);
  if (bridgeProxyDeployedCode === '0x' || bridgeProxyDeployedCode === '') {
    console.log('"HolographBridgeProxy" bytecode not found, need to deploy"');
    let holographBridgeProxy = await genesisDeployHelper(
      hre,
      salt,
      'HolographBridgeProxy',
      generateInitCode(
        ['address', 'bytes'],
        [
          futureBridgeAddress,
          generateInitCode(
            ['address', 'address', 'address', 'address'],
            [futureFactoryProxyAddress, futureHolographAddress, futureOperatorProxyAddress, futureRegistryProxyAddress]
          ),
        ]
      ),
      futureBridgeProxyAddress
    );
  } else {
    console.log('"HolographBridgeProxy" is already deployed. Checking configs.');
    let holographBridgeProxy = (await hre.ethers.getContractAt(
      'HolographBridgeProxy',
      futureBridgeProxyAddress,
      deployerAddress
    )) as HolographBridgeProxy;
    let holographBridge = (await hre.ethers.getContractAt(
      'HolographBridge',
      futureBridgeProxyAddress,
      deployerAddress
    )) as HolographBridge;
    if ((await holographBridgeProxy.getBridge()) !== futureBridgeAddress) {
      console.log('Updating Bridge reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographBridgeProxy',
        holographBridgeProxy,
        await holographBridgeProxy.populateTransaction.setBridge(futureBridgeAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographBridgeProxy,
            data: holographBridgeProxy.populateTransaction.setBridge(futureBridgeAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographBridge.getFactory()) !== futureFactoryProxyAddress) {
      console.log('Updating Factory reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographBridge',
        holographBridge,
        await holographBridge.populateTransaction.setFactory(futureFactoryProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographBridge,
            data: holographBridge.populateTransaction.setFactory(futureFactoryProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographBridge.getHolograph()) !== futureHolographAddress) {
      console.log('Updating Holograph reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographBridge',
        holographBridge,
        await holographBridge.populateTransaction.setHolograph(futureHolographAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographBridge,
            data: holographBridge.populateTransaction.setHolograph(futureHolographAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographBridge.getOperator()) !== futureOperatorProxyAddress) {
      console.log('Updating Operator reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographBridge',
        holographBridge,
        await holographBridge.populateTransaction.setOperator(futureOperatorProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographBridge,
            data: holographBridge.populateTransaction.setOperator(futureOperatorProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographBridge.getRegistry()) !== futureRegistryProxyAddress) {
      console.log('Updating Registry reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographBridge',
        holographBridge,
        await holographBridge.populateTransaction.setRegistry(futureRegistryProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographBridge,
            data: holographBridge.populateTransaction.setRegistry(futureRegistryProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
  }

  // HolographFactory
  let factoryDeployedCode: string = await hre.provider.send('eth_getCode', [futureFactoryAddress, 'latest']);
  if (factoryDeployedCode === '0x' || factoryDeployedCode === '') {
    console.log('"HolographFactory" bytecode not found, need to deploy"');
    let holographFactory = await genesisDeployHelper(
      hre,
      salt,
      'HolographFactory',
      generateInitCode(['address', 'address', 'address'], [zeroAddress, zeroAddress, zeroAddress]),
      futureFactoryAddress
    );
  } else {
    console.log('"HolographFactory" is already deployed.');
  }

  // HolographFactoryProxy
  let factoryProxyDeployedCode: string = await hre.provider.send('eth_getCode', [futureFactoryProxyAddress, 'latest']);
  if (factoryProxyDeployedCode === '0x' || factoryProxyDeployedCode === '') {
    console.log('"HolographFactoryProxy" bytecode not found, need to deploy"');
    let holographFactoryProxy = await genesisDeployHelper(
      hre,
      salt,
      'HolographFactoryProxy',
      generateInitCode(
        ['address', 'bytes'],
        [
          futureFactoryAddress,
          generateInitCode(
            ['address', 'address'],
            [
              futureHolographAddress, // Holograph
              futureRegistryProxyAddress, // HolographRegistry
            ]
          ),
        ]
      ),
      futureFactoryProxyAddress
    );
  } else {
    console.log('"HolographFactoryProxy" is already deployed. Checking configs.');
    let holographFactoryProxy = (await hre.ethers.getContractAt(
      'HolographFactoryProxy',
      futureFactoryProxyAddress,
      deployerAddress
    )) as HolographFactoryProxy;
    let holographFactory = (await hre.ethers.getContractAt(
      'HolographFactory',
      futureFactoryProxyAddress,
      deployerAddress
    )) as HolographFactory;
    if ((await holographFactoryProxy.getFactory()) !== futureFactoryAddress) {
      console.log('Updating Factory reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographFactoryProxy',
        holographFactoryProxy,
        await holographFactoryProxy.populateTransaction.setFactory(futureFactoryAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographFactoryProxy,
            data: holographFactoryProxy.populateTransaction.setFactory(futureFactoryAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographFactory.getHolograph()) !== futureHolographAddress) {
      console.log('Updating Holograph reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographFactory',
        holographFactory,
        await holographFactory.populateTransaction.setHolograph(futureHolographAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographFactory,
            data: holographFactory.populateTransaction.setHolograph(futureHolographAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographFactory.getRegistry()) !== futureRegistryProxyAddress) {
      console.log('Updating Registry reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographFactory',
        holographFactory,
        await holographFactory.populateTransaction.setRegistry(futureRegistryProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographFactory,
            data: holographFactory.populateTransaction.setRegistry(futureRegistryProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
  }

  // HolographOperator
  let operatorDeployedCode: string = await hre.provider.send('eth_getCode', [futureOperatorAddress, 'latest']);
  if (operatorDeployedCode === '0x' || operatorDeployedCode === '') {
    console.log('"HolographOperator" bytecode not found, need to deploy"');
    let holographOperator = await genesisDeployHelper(
      hre,
      salt,
      'HolographOperator',
      generateInitCode(
        ['address', 'address', 'address', 'address', 'address', 'uint256'],
        [zeroAddress, zeroAddress, zeroAddress, zeroAddress, zeroAddress, '0x' + '00'.repeat(32)]
      ),
      futureOperatorAddress
    );
  } else {
    console.log('"HolographOperator" is already deployed.');
  }

  // HolographOperatorProxy
  let operatorProxyDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureOperatorProxyAddress,
    'latest',
  ]);
  if (operatorProxyDeployedCode === '0x' || operatorProxyDeployedCode === '') {
    console.log('"HolographOperatorProxy" bytecode not found, need to deploy"');
    let holographOperatorProxy = await genesisDeployHelper(
      hre,
      salt,
      'HolographOperatorProxy',
      generateInitCode(
        ['address', 'bytes'],
        [
          futureOperatorAddress,
          generateInitCode(
            ['address', 'address', 'address', 'address', 'address', 'uint256'],
            [
              futureBridgeProxyAddress,
              futureHolographAddress,
              futureHolographInterfacesAddress,
              futureRegistryProxyAddress,
              futureHlgAddress,
              GWEI.toHexString(),
            ]
          ),
        ]
      ),
      futureOperatorProxyAddress
    );
  } else {
    console.log('"HolographOperatorProxy" is already deployed. Checking configs.');
    let holographOperatorProxy = (await hre.ethers.getContractAt(
      'HolographOperatorProxy',
      futureOperatorProxyAddress,
      deployerAddress
    )) as HolographOperatorProxy;
    let holographOperator = (await hre.ethers.getContractAt(
      'HolographOperator',
      futureOperatorProxyAddress,
      deployerAddress
    )) as HolographOperator;
    if ((await holographOperatorProxy.getOperator()) !== futureOperatorAddress) {
      console.log('Updating Operator reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographOperatorProxy',
        holographOperatorProxy,
        await holographOperatorProxy.populateTransaction.setOperator(futureOperatorAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographOperatorProxy,
            data: holographOperatorProxy.populateTransaction.setOperator(futureOperatorAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographOperator.getBridge()) !== futureBridgeProxyAddress) {
      console.log('Updating Bridge reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographOperator',
        holographOperator,
        await holographOperator.populateTransaction.setBridge(futureBridgeProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographOperator,
            data: holographOperator.populateTransaction.setBridge(futureBridgeProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographOperator.getHolograph()) !== futureHolographAddress) {
      console.log('Updating Holograph reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographOperator',
        holographOperator,
        await holographOperator.populateTransaction.setHolograph(futureHolographAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographOperator,
            data: holographOperator.populateTransaction.setHolograph(futureHolographAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographOperator.getInterfaces()) !== futureHolographInterfacesAddress) {
      console.log('Updating HolographInterfaces reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographOperator',
        holographOperator,
        await holographOperator.populateTransaction.setInterfaces(futureHolographInterfacesAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographOperator,
            data: holographOperator.populateTransaction.setInterfaces(futureHolographInterfacesAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographOperator.getRegistry()) !== futureRegistryProxyAddress) {
      console.log('Updating Registry reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographOperator',
        holographOperator,
        await holographOperator.populateTransaction.setRegistry(futureRegistryProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographOperator,
            data: holographOperator.populateTransaction.setRegistry(futureRegistryProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographOperator.getUtilityToken()) !== futureHlgAddress) {
      console.log('Updating UtilityToken reference for HolographOperator');
      let tx = await MultisigAwareTx(
        hre,
        'HolographOperator',
        holographOperator,
        await holographOperator.populateTransaction.setUtilityToken(futureHlgAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographOperator,
            data: holographOperator.populateTransaction.setUtilityToken(futureHlgAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if (!BigNumber.from(await holographOperator.getMinGasPrice()).eq(GWEI)) {
      console.log('Updating MinGasPrice reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographOperator',
        holographOperator,
        await holographOperator.populateTransaction.setMinGasPrice(GWEI.toHexString(), {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographOperator,
            data: holographOperator.populateTransaction.setMinGasPrice(GWEI.toHexString()),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
  }

  // HolographRegistry
  let registryDeployedCode: string = await hre.provider.send('eth_getCode', [futureRegistryAddress, 'latest']);
  if (registryDeployedCode === '0x' || registryDeployedCode === '') {
    console.log('"HolographRegistry" bytecode not found, need to deploy"');
    let holographRegistry = await genesisDeployHelper(
      hre,
      salt,
      'HolographRegistry',
      generateInitCode(['address', 'bytes32[]'], [zeroAddress, []]),
      futureRegistryAddress
    );
  } else {
    console.log('"HolographRegistry" is already deployed.');
  }

  // HolographRegistryProxy
  let registryProxyDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureRegistryProxyAddress,
    'latest',
  ]);
  if (registryProxyDeployedCode === '0x' || registryProxyDeployedCode === '') {
    console.log('"HolographRegistryProxy" bytecode not found, need to deploy"');
    let holographRegistryProxy = await genesisDeployHelper(
      hre,
      salt,
      'HolographRegistryProxy',
      generateInitCode(
        ['address', 'bytes'],
        [
          futureRegistryAddress,
          generateInitCode(['address', 'bytes32[]'], [futureHolographAddress, reservedNamespaceHashes]),
        ]
      ),
      futureRegistryProxyAddress
    );
    let holographRegistry = (await hre.ethers.getContractAt(
      'HolographRegistry',
      futureRegistryProxyAddress,
      deployerAddress
    )) as HolographRegistry;
    if ((await holographRegistry.getUtilityToken()) !== futureHlgAddress) {
      console.log('Updating UtilityToken reference for HolographRegistry');
      let tx = await MultisigAwareTx(
        hre,
        'HolographRegistry',
        holographRegistry,
        await holographRegistry.populateTransaction.setUtilityToken(futureHlgAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: holographRegistry.populateTransaction.setUtilityToken(futureHlgAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
  } else {
    console.log('"HolographRegistryProxy" is already deployed. Checking configs.');
    let holographRegistryProxy = (await hre.ethers.getContractAt(
      'HolographRegistryProxy',
      futureRegistryProxyAddress,
      deployerAddress
    )) as HolographRegistryProxy;
    let holographRegistry = (await hre.ethers.getContractAt(
      'HolographRegistry',
      futureRegistryProxyAddress,
      deployerAddress
    )) as HolographRegistry;
    if ((await holographRegistryProxy.getRegistry()) !== futureRegistryAddress) {
      console.log('Updating Registry reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographRegistryProxy',
        holographRegistryProxy,
        await holographRegistryProxy.populateTransaction.setRegistry(futureRegistryAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistryProxy,
            data: holographRegistryProxy.populateTransaction.setRegistry(futureRegistryAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographRegistry.getHolograph()) !== futureHolographAddress) {
      console.log('Updating Holograph reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographRegistry',
        holographRegistry,
        await holographRegistry.populateTransaction.setHolograph(futureHolographAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: holographRegistry.populateTransaction.setHolograph(futureHolographAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographRegistry.getUtilityToken()) !== futureHlgAddress) {
      console.log('Updating UtilityToken reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographRegistry',
        holographRegistry,
        await holographRegistry.populateTransaction.setUtilityToken(futureHlgAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: holographRegistry.populateTransaction.setUtilityToken(futureHlgAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
  }

  // HolographTreasury
  let treasuryDeployedCode: string = await hre.provider.send('eth_getCode', [futureTreasuryAddress, 'latest']);
  if (treasuryDeployedCode === '0x' || treasuryDeployedCode === '') {
    console.log('"HolographTreasury" bytecode not found, need to deploy"');
    let holographTreasury = await genesisDeployHelper(
      hre,
      salt,
      'HolographTreasury',
      generateInitCode(
        ['address', 'address', 'address', 'address'],
        [zeroAddress, zeroAddress, zeroAddress, zeroAddress]
      ),
      futureTreasuryAddress
    );
  } else {
    console.log('"HolographTreasury" is already deployed.');
  }

  // HolographTreasuryProxy
  let treasuryProxyDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureTreasuryProxyAddress,
    'latest',
  ]);
  if (treasuryProxyDeployedCode === '0x' || treasuryProxyDeployedCode === '') {
    console.log('"HolographTreasuryProxy" bytecode not found, need to deploy"');
    let holographTreasuryProxy = await genesisDeployHelper(
      hre,
      salt,
      'HolographTreasuryProxy',
      generateInitCode(
        ['address', 'bytes'],
        [
          futureTreasuryAddress,
          generateInitCode(
            ['address', 'address', 'address', 'address'],
            [futureBridgeProxyAddress, futureHolographAddress, futureOperatorProxyAddress, futureRegistryProxyAddress]
          ),
        ]
      ),
      futureTreasuryProxyAddress
    );
  } else {
    console.log('"HolographTreasuryProxy" is already deployed. Checking configs.');
    let holographTreasuryProxy = (await hre.ethers.getContractAt(
      'HolographTreasuryProxy',
      futureTreasuryProxyAddress,
      deployerAddress
    )) as HolographTreasuryProxy;
    let holographTreasury = (await hre.ethers.getContractAt(
      'HolographTreasury',
      futureTreasuryProxyAddress,
      deployerAddress
    )) as HolographTreasury;
    if ((await holographTreasuryProxy.getTreasury()) !== futureTreasuryAddress) {
      console.log('Updating Treasury reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographTreasuryProxy',
        holographTreasuryProxy,
        await holographTreasuryProxy.populateTransaction.setTreasury(futureTreasuryAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographTreasuryProxy,
            data: holographTreasuryProxy.populateTransaction.setTreasury(futureTreasuryAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographTreasury.getBridge()) !== futureBridgeProxyAddress) {
      console.log('Updating Bridge reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographTreasury',
        holographTreasury,
        await holographTreasury.populateTransaction.setBridge(futureBridgeProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographTreasury,
            data: holographTreasury.populateTransaction.setBridge(futureBridgeProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographTreasury.getOperator()) !== futureOperatorProxyAddress) {
      console.log('Updating Operator reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographTreasury',
        holographTreasury,
        await holographTreasury.populateTransaction.setOperator(futureOperatorProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographTreasury,
            data: holographTreasury.populateTransaction.setOperator(futureOperatorProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    if ((await holographTreasury.getRegistry()) !== futureRegistryProxyAddress) {
      console.log('Updating Registry reference');
      let tx = await MultisigAwareTx(
        hre,
        'HolographTreasury',
        holographTreasury,
        await holographTreasury.populateTransaction.setRegistry(futureRegistryProxyAddress, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographTreasury,
            data: holographTreasury.populateTransaction.setRegistry(futureRegistryProxyAddress),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
    }
    // NOTE: $1 is the default mint fee for now.
    //       This can be changed later by the multisig
    //       If the default changes we will need to update this script
    console.log(`Checking Holograph mint fee`);
    const holographMintFee = await holographTreasury.getHolographMintFee();
    console.log(`Current Holograph mint fee is: ${holographMintFee}`);
    if (!holographMintFee.eq(BigNumber.from(1000000))) {
      console.log(`Holograph mint fee is currently set to: ${holographMintFee}`);
      console.log(`Holograph mint fee is not set to 1000000 i.e. $1. Setting Holograph mint fee to 1000000 i.e. $1`);
      let tx = await MultisigAwareTx(
        hre,
        'HolographTreasury',
        holographTreasury,
        await holographTreasury.populateTransaction.setHolographMintFee(BigNumber.from(1000000), {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographTreasury,
            data: holographTreasury.populateTransaction.setHolographMintFee(BigNumber.from(1000000)),
          })),
        } as any)
      );
      const receipt = await tx.wait();
      console.log(`Transaction hash ${receipt.transactionHash}`);
      console.log(`Holograph mint fee is now set to 1000000 i.e. $1 tx hash: ${tx.hash}`);
    } else {
      console.log(`Holograph mint fee is already set to 1000000 i.e. $1`);
    }
  }

  // HolographInterfaces
  let interfacesDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureHolographInterfacesAddress,
    'latest',
  ]);
  if (interfacesDeployedCode === '0x' || interfacesDeployedCode === '') {
    console.log('"HolographInterfaces" bytecode not found, need to deploy"');
    let interfaces = await genesisDeployHelper(
      hre,
      salt,
      'HolographInterfaces',
      generateInitCode(['address'], [deployerAddress]),
      futureHolographInterfacesAddress
    );
    global.__deployedHolographInterfaces = true;
  } else {
    console.log('"HolographInterfaces" is already deployed.');
    global.__deployedHolographInterfaces = false;
  }

  // HolographRoyalties
  let royaltiesDeployedCode: string = await hre.provider.send('eth_getCode', [futureRoyaltiesAddress, 'latest']);
  if (royaltiesDeployedCode === '0x' || royaltiesDeployedCode === '') {
    console.log('"HolographRoyalties" bytecode not found, need to deploy"');
    let royalties = await genesisDeployHelper(
      hre,
      salt,
      'HolographRoyalties',
      generateInitCode(['uint256'], ['0x' + '00'.repeat(32)]),
      futureRoyaltiesAddress
    );
  } else {
    console.log('"HolographRoyalties" is already deployed..');
  }

  console.log(`Finished deploying Holograph source contracts`);
  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = [
  'DeploySources',

  'Holograph',
  'HolographBridge',
  'HolographBridgeProxy',
  'HolographFactory',
  'HolographFactoryProxy',
  'HolographOperator',
  'HolographOperatorProxy',
  'HolographRegistry',
  'HolographRegistryProxy',
  'HolographTreasury',
  'HolographTreasuryProxy',
  'HolographInterfaces',
  'HolographRoyalties',
];
func.dependencies = ['HolographGenesis'];
