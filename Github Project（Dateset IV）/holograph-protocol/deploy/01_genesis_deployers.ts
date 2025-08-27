declare var global: any;
import { Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DeployFunction, Deployment } from '@holographxyz/hardhat-deploy-holographed/types';
import { LeanHardhatRuntimeEnvironment, getDeployer, hreSplit, txParams } from '../scripts/utils/helpers';
import path from 'path';

// NOTE: Disabled as the genesis code already handles this
const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  // console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);
  // let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  // const deployer = await getDeployer(hre);
  // const deployerAddress = await deployer.signer.getAddress();
  // let holographGenesis: Contract = await hre.ethers.getContract('HolographGenesis', deployer.signer);
  // if (!(await holographGenesis.isApprovedDeployer('TODO'))) {
  //   let tx = await holographGenesis.approveDeployer('TODO', true, {
  //     ...(await txParams({
  //       hre,
  //       from: deployerAddress,
  //       to: holographGenesis,
  //       data: holographGenesis.populateTransaction.approveDeployer('TODO', true),
  //     })),
  //   });
  //   let receipt = await tx.wait();
  // } else {
  //   console.log('Deployer TODO is already approved');
  // }
  // console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['GenesisDeployers'];
func.dependencies = [];
