declare var global: any;
import path from 'path';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import {
  hreSplit,
  genesisDeployHelper,
  genesisDeriveFutureAddress,
  generateInitCode,
  txParams,
  getDeployer,
} from '../scripts/utils/helpers';
import { ConfigureEvents } from '../scripts/utils/events';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();
  const salt = hre.deploymentSalt;

  const futureGenericAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographGeneric',
    generateInitCode(
      ['uint256', 'bool', 'bytes'],
      [
        ConfigureEvents([]), // eventConfig
        true, // skipInit
        '0x', // initCode
      ]
    )
  );
  console.log('the future "HolographGeneric" address is', futureGenericAddress);

  // HolographGeneric
  let genericDeployedCode: string = await hre.provider.send('eth_getCode', [futureGenericAddress, 'latest']);
  if (genericDeployedCode === '0x' || genericDeployedCode === '') {
    console.log('"HolographGeneric" bytecode not found, need to deploy"');
    let holographGeneric = await genesisDeployHelper(
      hre,
      salt,
      'HolographGeneric',
      generateInitCode(
        ['uint256', 'bool', 'bytes'],
        [
          ConfigureEvents([]), // eventConfig
          true, // skipInit
          '0x', // initCode
        ]
      ),
      futureGenericAddress
    );
  } else {
    console.log('"HolographGeneric" is already deployed.');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['HolographGeneric', 'DeployGeneric'];
func.dependencies = ['HolographGenesis', 'DeploySources'];
