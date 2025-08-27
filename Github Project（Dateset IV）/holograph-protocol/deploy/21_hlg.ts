declare var global: any;
import path from 'path';

import fs from 'fs';
import Web3 from 'web3';
import { BigNumber, BigNumberish, BytesLike, ContractFactory, Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  LeanHardhatRuntimeEnvironment,
  Signature,
  hreSplit,
  zeroAddress,
  StrictECDSA,
  generateErc20Config,
  generateInitCode,
  genesisDeriveFutureAddress,
  remove0x,
  txParams,
  getDeployer,
} from '../scripts/utils/helpers';
import { MultisigAwareTx } from '../scripts/utils/multisig-aware-tx';
import { HolographERC20Event, ConfigureEvents, AllEventsEnabled } from '../scripts/utils/events';
import { NetworkType, Network, networks } from '@holographxyz/networks';
import { Environment, getEnvironment } from '@holographxyz/environment';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();

  const web3 = new Web3();
  const salt = hre.deploymentSalt;
  const network = networks[hre.networkName];
  const environment: Environment = getEnvironment();
  const chainId = '0x' + network.holographId.toString(16).padStart(8, '0');

  const holograph = await hre.ethers.getContract('Holograph', deployerAddress);
  let hlgTokenAddress = await holograph.getUtilityToken();
  const operatorAddress = await holograph.getOperator();

  const holographFactoryProxy = await hre.ethers.getContract('HolographFactoryProxy', deployerAddress);
  const holographFactory = ((await hre.ethers.getContract('HolographFactory', deployerAddress)) as Contract).attach(
    holographFactoryProxy.address
  );

  const holographRegistryProxy = await hre.ethers.getContract('HolographRegistryProxy', deployerAddress);
  const holographRegistry = ((await hre.ethers.getContract('HolographRegistry', deployerAddress)) as Contract).attach(
    holographRegistryProxy.address
  );

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

  // If environment is develop or localhost use the signers deployerAddress (the hardcoded version is only for testnet and mainnet envs)
  if (environment === Environment.develop || environment === Environment.localhost) {
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
    holographFactoryProxy.address,
    erc20ConfigHash,
    hre.ethers.utils.keccak256(holographerBytecode)
  );
  console.log('the future "HolographUtilityToken" address is', futureHlgAddress);

  let hlgDeployedCode: string = await hre.provider.send('eth_getCode', [futureHlgAddress, 'latest']);
  console.log('hlgTokenAddress', hlgTokenAddress);
  console.log('futureHlgAddress', futureHlgAddress);
  if (hlgDeployedCode === '0x' || hlgDeployedCode === '' || hlgTokenAddress !== futureHlgAddress) {
    console.log(`HLG token not deployed at ${futureHlgAddress} on chain ${chainId}!`);
    console.log(`Need to deploy "HLG" for chain: ${chainId}`);

    const sig = await deployer.signer.signMessage(erc20ConfigHashBytes);
    const signature: Signature = StrictECDSA({
      r: '0x' + sig.substring(2, 66),
      s: '0x' + sig.substring(66, 130),
      v: '0x' + sig.substring(130, 132),
    } as Signature);
    const factoryWithSigner = holographFactory.connect(deployer.signer);
    const deployTx = await factoryWithSigner.deployHolographableContract(erc20Config, signature, deployerAddress, {
      ...(await txParams({
        hre,
        from: deployerAddress,
        to: holographFactory,
        data: holographFactory.populateTransaction.deployHolographableContract(erc20Config, signature, deployerAddress),
      })),
    });
    const deployResult = await deployTx.wait();
    let eventIndex: number = 0;
    let eventFound: boolean = false;
    for (let i = 0, l = deployResult.events.length; i < l; i++) {
      let e = deployResult.events[i];
      if (e.event === 'BridgeableContractDeployed') {
        eventFound = true;
        eventIndex = i;
        break;
      }
    }
    if (!eventFound) {
      throw new Error('BridgeableContractDeployed event not fired');
    }
    hlgTokenAddress = deployResult.events[eventIndex].args[0];
    if (hlgTokenAddress !== futureHlgAddress) {
      throw new Error(
        `Seems like hlgTokenAddress ${hlgTokenAddress} and futureHlgAddress ${futureHlgAddress} do not match!`
      );
    }
    console.log('Deployed "HLG" at:', await holograph.getUtilityToken());
  } else {
    console.log('Reusing "HLG" at:', hlgTokenAddress);
  }

  const holographUtilityTokenAddress = await holograph.getUtilityToken();
  console.log(`Checking the Holograph contract reference for HolographUtilityToken `);
  if ((await holograph.getUtilityToken()) !== hlgTokenAddress) {
    console.log(
      `Current HolographUtilityToken: ${holographUtilityTokenAddress} does not match future HLG: ${hlgTokenAddress}`
    );
    console.log(`Setting HolographUtilityToken to: ${hlgTokenAddress}`);
    const setHTokenTx = await MultisigAwareTx(
      hre,
      'Holograph',
      holograph,
      await holograph.populateTransaction.setUtilityToken(hlgTokenAddress, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: holograph,
          data: holograph.populateTransaction.setUtilityToken(hlgTokenAddress),
        })),
      })
    );
    const receipt = await setHTokenTx.wait();
    console.log(
      `HolographUtilityToken set to: ${await holograph.getUtilityToken()} at tx hash: ${receipt.transactionHash}`
    );
  } else {
    console.log(`HolographUtilityToken: ${holographUtilityTokenAddress} matches future HLG: ${hlgTokenAddress}`);
  }

  console.log('Checking HolographRegistry UtilityToken reference');
  if ((await holographRegistry.getUtilityToken()) !== hlgTokenAddress) {
    const setHTokenTx2 = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setUtilityToken(hlgTokenAddress, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setUtilityToken(hlgTokenAddress),
        })),
      })
    );
    const receipt = await setHTokenTx2.wait();
    console.log(
      `HolographRegistry UtilityToken set to: ${await holographRegistry.getUtilityToken()} at tx hash: ${
        receipt.transactionHash
      }`
    );
  }

  console.log('Checking HolographOperator HLG balance');
  if (currentNetworkType == NetworkType.testnet || currentNetworkType == NetworkType.local) {
    if (environment !== Environment.mainnet && environment !== Environment.testnet) {
      const hlgContract = (await hre.ethers.getContract('HolographERC20', deployerAddress)).attach(hlgTokenAddress);
      const operatorBalance = await hlgContract.balanceOf(operatorAddress);

      if (operatorBalance.isZero()) {
        console.log('HolographOperator has no HLG');

        // Check the hlgContract's balance before attempting to send
        const hlgContractBalance = await hlgContract.balanceOf(deployerAddress);
        const amountToSend = BigNumber.from('1000000000000000000000000'); // 1,000,000 HLG

        if (hlgContractBalance.lt(amountToSend)) {
          console.log('Deployer has insufficient HLG balance in the hlgContract to send to HolographOperator.');
          return; // Exit if there's not enough balance
        }

        console.log('Sending 1,000,000 HLG to HolographOperator');
        const transferTx = await MultisigAwareTx(
          hre,
          'HolographUtilityToken',
          hlgContract,
          await hlgContract.populateTransaction.transfer(operatorAddress, amountToSend, {
            ...(await txParams({
              hre,
              from: deployerAddress,
              to: hlgContract,
              gasLimit: (
                await hre.ethers.provider.estimateGas(
                  await hlgContract.populateTransaction.transfer(operatorAddress, amountToSend)
                )
              ).mul(BigNumber.from('2')),
            })),
          })
        );
        const receipt = await transferTx.wait();
        console.log(
          `Sent 1,000,000 HLG to HolographOperator at tx hash: ${receipt.transactionHash} from ${deployerAddress}`
        );
      }
    }
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['HLG', 'HolographUtilityToken'];
func.dependencies = ['HolographGenesis', 'DeploySources', 'DeployERC20', 'RegisterTemplates'];
