declare var global: any;
import fs from 'fs';
import Web3 from 'web3';
import { BigNumberish, BytesLike, ContractFactory, Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  genesisDeriveFutureAddress,
  genesisDeployHelper,
  generateInitCode,
  zeroAddress,
  LeanHardhatRuntimeEnvironment,
  hreSplit,
  generateErc20Config,
  generateErc721Config,
  getHolographedContractHash,
  Signature,
  StrictECDSA,
  txParams,
} from '../scripts/utils/helpers';
import { MultisigAwareTx } from '../scripts/utils/multisig-aware-tx';
import { reservedNamespaces, reservedNamespaceHashes } from '../scripts/utils/reserved-namespaces';
import { HolographERC20Event, ConfigureEvents, AllEventsEnabled } from '../scripts/utils/events';
import { NetworkType, Network, networks } from '@holographxyz/networks';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const accounts = await hre.ethers.getSigners();
  let deployer: SignerWithAddress = accounts[0];

  global.__txNonce = {} as { [key: string]: number };
  global.__txNonce[hre.networkName] = await hre.ethers.provider.getTransactionCount(deployer.address);

  const web3 = new Web3();
  const salt = hre.deploymentSalt;
  const network = networks[hre.networkName];
  const holograph = await hre.ethers.getContract('Holograph', deployer);

  global.__holographAddress = holograph.address.toLowerCase();

  console.log('holograph', holograph.address, 'global.__holographAddress', global.__holographAddress);

  const holographRegistry = (await hre.ethers.getContractAt(
    'HolographRegistry',
    await holograph.getRegistry(),
    deployer
  )) as Contract;

  /* get HolographERC20 source address */
  let erc20SourceNamespaceId = -1;
  for (let i: number = 0, l: number = reservedNamespaces.length; i < l; i++) {
    if (reservedNamespaces[i] == 'HolographERC20') {
      erc20SourceNamespaceId = i;
      break;
    }
  }
  if (erc20SourceNamespaceId < 0) {
    throw new Error('Could not find namespace for "HolographERC20"');
  }
  const holographERC20Address = await holographRegistry.getReservedContractTypeAddress(
    reservedNamespaceHashes[erc20SourceNamespaceId]
  );
  console.log('the "HolographERC20" address is', holographERC20Address);

  /* future TempHtokenFix */
  const futureTempHtokenFixAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'TempHtokenFix',
    await generateInitCode([], [])
  );
  console.log('the future "TempHtokenFix" address is', futureTempHtokenFixAddress);

  /* deploy TempHtokenFix */
  let tempHtokenFixDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureTempHtokenFixAddress,
    'latest',
  ]);
  if (tempHtokenFixDeployedCode == '0x' || tempHtokenFixDeployedCode == '') {
    console.log('"TempHtokenFix" bytecode not found, need to deploy"');
    let tempHtokenFix = await genesisDeployHelper(
      hre,
      salt,
      'TempHtokenFix',
      await generateInitCode([], []),
      futureTempHtokenFixAddress
    );
  } else {
    console.log('"TempHtokenFix" is already deployed.');
  }

  const tx1 = await MultisigAwareTx(
    hre,
    'HolographRegistry',
    holographRegistry,
    await holographRegistry.populateTransaction.setContractTypeAddress(
      reservedNamespaceHashes[erc20SourceNamespaceId],
      futureTempHtokenFixAddress,
      {
        ...(await txParams({
          hre,
          from: deployer,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setContractTypeAddress(
            reservedNamespaceHashes[erc20SourceNamespaceId],
            futureTempHtokenFixAddress
          ),
        })),
      }
    )
  );
  await tx1.wait();

  /* get hToken address */
  const chainId = '0x' + network.holographId.toString(16).padStart(8, '0');
  const hToken = (await hre.ethers.getContractAt(
    'TempHtokenFix',
    await holographRegistry.getHToken(chainId),
    deployer
  )) as Contract;

  /* simulate multisig request */
  console.log(`

🚨🚨🚨 Multisig Transaction 🚨🚨🚨
You will need to make a transaction on your Ethereum multisig at address 0x99102e9bf378ae777e16d5f1d2d8ff89b066c5af
The following transaction needs to be created:

	TempHtokenFix(${await holographRegistry.getHToken(chainId)}).withdraw()

In transaction builder enter the following address: 🔐 ${await holographRegistry.getHToken(chainId)}
Select "Custom data"
Set ETH value to: 0
Use the following payload for Data input field:
	${(await hToken.populateTransaction.withdraw()).data}

`);

  const tx3 = await MultisigAwareTx(
    hre,
    'HolographRegistry',
    holographRegistry,
    await holographRegistry.populateTransaction.setContractTypeAddress(
      reservedNamespaceHashes[erc20SourceNamespaceId],
      holographERC20Address,
      {
        ...(await txParams({
          hre,
          from: deployer,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setContractTypeAddress(
            reservedNamespaceHashes[erc20SourceNamespaceId],
            holographERC20Address
          ),
        })),
      }
    )
  );
  await tx3.wait();

  try {
    await hre1.run('verify:verify', {
      address: futureTempHtokenFixAddress,
      constructorArguments: [],
    });
  } catch (error) {
    console.log(`Failed to verify "TempHtokenFix" -> ${error}`);
  }

  process.exit();
  throw new Error('WHY!?!?');
};

export default func;
func.tags = ['TEMP_HTOKEN_FIX'];
func.dependencies = [];
