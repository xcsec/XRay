declare var global: any;
import path from 'path';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import {
  LeanHardhatRuntimeEnvironment,
  hreSplit,
  genesisDeployHelper,
  generateInitCode,
  getGasPrice,
  getGasLimit,
  getDeployer,
} from '../scripts/utils/helpers';
import { HolographERC1155Event, ConfigureEvents } from '../scripts/utils/events';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();

  const salt = hre.deploymentSalt;

  // this is purposefully left empty, and is a placeholder for future use

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['DeployERC1155'];
func.dependencies = ['HolographGenesis', 'DeploySources'];
