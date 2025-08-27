declare var global: any;
import path from 'path';

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
import { Contract } from 'ethers';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();

  // Salt is used for deterministic address generation
  const salt = hre.deploymentSalt;

  // Deploy DropsMetadataRenderer source contract
  const futureDropsMetadataRendererAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'DropsMetadataRenderer',
    generateInitCode([], [])
  );
  console.log('the future "DropsMetadataRenderer" address is', futureDropsMetadataRendererAddress);
  let dropsMetadataRendererDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureDropsMetadataRendererAddress,
    'latest',
  ]);
  if (dropsMetadataRendererDeployedCode === '0x' || dropsMetadataRendererDeployedCode === '') {
    console.log('"DropsMetadataRenderer" bytecode not found, need to deploy"');
    let dropsMetadataRenderer = await genesisDeployHelper(
      hre,
      salt,
      'DropsMetadataRenderer',
      generateInitCode([], []),
      futureDropsMetadataRendererAddress
    );
  } else {
    console.log('"DropsMetadataRenderer" is already deployed.');
  }

  // Deploy DropsMetadataRendererProxy source contract
  const futureDropsMetadataRendererProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'DropsMetadataRendererProxy',
    generateInitCode(['address', 'bytes'], [futureDropsMetadataRendererAddress, generateInitCode([], [])])
  );
  let dropsMetadataRendererProxy = (await hre.ethers.getContractAt(
    'DropsMetadataRendererProxy',
    futureDropsMetadataRendererProxyAddress,
    deployerAddress
  )) as Contract;
  console.log('the future "DropsMetadataRendererProxy" address is', futureDropsMetadataRendererProxyAddress);
  let dropsMetadataRendererProxyDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureDropsMetadataRendererProxyAddress,
    'latest',
  ]);
  if (dropsMetadataRendererProxyDeployedCode === '0x' || dropsMetadataRendererProxyDeployedCode === '') {
    console.log('"DropsMetadataRendererProxy" bytecode not found, need to deploy"');
    dropsMetadataRendererProxy = await genesisDeployHelper(
      hre,
      salt,
      'DropsMetadataRendererProxy',
      generateInitCode(['address', 'bytes'], [futureDropsMetadataRendererAddress, generateInitCode([], [])]),
      futureDropsMetadataRendererProxyAddress
    );
  } else {
    console.log('"DropsMetadataRendererProxy" is already deployed.');
    console.log('Checking "DropsMetadataRendererProxy" source.');
    if (
      (await dropsMetadataRendererProxy.getDropsMetadataRenderer()).toLowerCase() !=
      futureDropsMetadataRendererAddress.toLowerCase()
    ) {
      console.log('Need to set "DropsMetadataRendererProxy" source.');
      const setDropsMetadataRendererTx = await MultisigAwareTx(
        hre,
        'DropsMetadataRendererProxy',
        dropsMetadataRendererProxy,
        await dropsMetadataRendererProxy.populateTransaction.setDropsMetadataRenderer(
          futureDropsMetadataRendererAddress,
          {
            ...(await txParams({
              hre,
              from: deployerAddress,
              to: dropsMetadataRendererProxy,
              data: await dropsMetadataRendererProxy.populateTransaction.setDropsMetadataRenderer(
                futureDropsMetadataRendererAddress
              ),
            })),
          }
        )
      );
      console.log('Transaction hash:', setDropsMetadataRendererTx.hash);
      await setDropsMetadataRendererTx.wait();
      console.log(
        `Registered "DropsMetadataRenderer" to: ${await dropsMetadataRendererProxy.getDropsMetadataRenderer()}`
      );
    } else {
      console.log('"DropsMetadataRendererProxy" source is correct.');
    }
  }

  // Deploy EditionsMetadataRenderer source contract
  const futureEditionsMetadataRendererAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'EditionsMetadataRenderer',
    generateInitCode([], [])
  );
  console.log('the future "EditionsMetadataRenderer" address is', futureEditionsMetadataRendererAddress);
  let editionsMetadataRendererDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureEditionsMetadataRendererAddress,
    'latest',
  ]);
  if (editionsMetadataRendererDeployedCode === '0x' || editionsMetadataRendererDeployedCode === '') {
    console.log('"EditionsMetadataRenderer" bytecode not found, need to deploy"');
    let editionsMetadataRenderer = await genesisDeployHelper(
      hre,
      salt,
      'EditionsMetadataRenderer',
      generateInitCode([], []),
      futureEditionsMetadataRendererAddress
    );
  } else {
    console.log('"EditionsMetadataRenderer" is already deployed.');
  }

  // Deploy EditionsMetadataRendererProxy source contract
  const futureEditionsMetadataRendererProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'EditionsMetadataRendererProxy',
    generateInitCode(['address', 'bytes'], [futureEditionsMetadataRendererAddress, generateInitCode([], [])])
  );
  let editionsMetadataRendererProxy = (await hre.ethers.getContractAt(
    'EditionsMetadataRendererProxy',
    futureEditionsMetadataRendererProxyAddress,
    deployerAddress
  )) as Contract;
  console.log('the future "EditionsMetadataRendererProxy" address is', futureEditionsMetadataRendererProxyAddress);
  let editionsMetadataRendererProxyDeployedCode: string = await hre.provider.send('eth_getCode', [
    futureEditionsMetadataRendererProxyAddress,
    'latest',
  ]);
  if (editionsMetadataRendererProxyDeployedCode === '0x' || editionsMetadataRendererProxyDeployedCode === '') {
    console.log('"EditionsMetadataRendererProxy" bytecode not found, need to deploy"');
    editionsMetadataRendererProxy = await genesisDeployHelper(
      hre,
      salt,
      'EditionsMetadataRendererProxy',
      generateInitCode(['address', 'bytes'], [futureEditionsMetadataRendererAddress, generateInitCode([], [])]),
      futureEditionsMetadataRendererProxyAddress
    );
  } else {
    console.log('"EditionsMetadataRendererProxy" is already deployed.');
    console.log('Checking "EditionsMetadataRendererProxy" source.');
    if (
      (await editionsMetadataRendererProxy.getEditionsMetadataRenderer()).toLowerCase() !=
      futureEditionsMetadataRendererAddress.toLowerCase()
    ) {
      console.log('Need to set "EditionsMetadataRendererProxy" source.');
      const setEditionsMetadataRendererTx = await MultisigAwareTx(
        hre,
        'EditionsMetadataRendererProxy',
        editionsMetadataRendererProxy,
        await editionsMetadataRendererProxy.populateTransaction.setEditionsMetadataRenderer(
          futureEditionsMetadataRendererAddress,
          {
            ...(await txParams({
              hre,
              from: deployerAddress,
              to: editionsMetadataRendererProxy,
              data: await editionsMetadataRendererProxy.populateTransaction.setEditionsMetadataRenderer(
                futureEditionsMetadataRendererAddress
              ),
            })),
          }
        )
      );
      console.log('Transaction hash:', setEditionsMetadataRendererTx.hash);
      await setEditionsMetadataRendererTx.wait();
      console.log(
        `Registered "EditionsMetadataRenderer" to: ${await editionsMetadataRendererProxy.getEditionsMetadataRenderer()}`
      );
    } else {
      console.log('"EditionsMetadataRendererProxy" source is correct.');
    }
  }

  // Deploy the HolographDropERC721 custom contract source
  const HolographDropERC721InitCode = generateInitCode(
    [
      'tuple(address,address,address,address,uint64,uint16,bool,tuple(uint104,uint32,uint64,uint64,uint64,uint64,bytes32),address,bytes)',
    ],
    [
      [
        zeroAddress, // holographERC721TransferHelper
        zeroAddress, // marketFilterAddress (opensea)
        deployerAddress, // initialOwner
        deployerAddress, // fundsRecipient
        0, // 1000 editions
        1000, // 10% royalty
        false, // enableOpenSeaRoyaltyRegistry
        [0, 0, 0, 0, 0, 0, '0x' + '00'.repeat(32)], // salesConfig
        futureEditionsMetadataRendererProxyAddress, // metadataRenderer
        generateInitCode(['string', 'string', 'string'], ['decscription', 'imageURI', 'animationURI']), // metadataRendererInit
      ],
    ]
  );
  const futureHolographDropERC721Address = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographDropERC721',
    HolographDropERC721InitCode
  );
  console.log('the future "HolographDropERC721" address is', futureHolographDropERC721Address);

  let HolographDropERC721DeployedCode: string = await hre.provider.send('eth_getCode', [
    futureHolographDropERC721Address,
    'latest',
  ]);

  if (HolographDropERC721DeployedCode === '0x' || HolographDropERC721DeployedCode === '') {
    console.log('"HolographDropERC721" bytecode not found, need to deploy"');
    let HolographDropERC721 = await genesisDeployHelper(
      hre,
      salt,
      'HolographDropERC721',
      HolographDropERC721InitCode,
      futureHolographDropERC721Address
    );
  } else {
    console.log('"HolographDropERC721" is already deployed.');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['DropsMetadataRenderer', 'EditionsMetadataRenderer', 'HolographDropERC721'];
func.dependencies = ['HolographGenesis', 'DeploySources'];
