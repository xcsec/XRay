declare var global: any;
import path from 'path';

import { BigNumber } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import { LeanHardhatRuntimeEnvironment, getDeployer, hreSplit, txParams } from '../scripts/utils/helpers';
import { NetworkType, networks } from '@holographxyz/networks';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre as any);
  const deployerAddress = await deployer.signer.getAddress();

  const currentNetworkType: NetworkType = networks[hre.networkName].type;

  if (currentNetworkType === NetworkType.local) {
    const mockErc721Receiver = await hre.deployments.deploy('MockERC721Receiver', {
      ...(await txParams({
        hre,
        from: deployerAddress,
        to: '0x0000000000000000000000000000000000000000',
        gasLimit: await hre.ethers.provider.estimateGas(
          (await hre.ethers.getContractFactory('MockERC721Receiver')).getDeployTransaction()
        ),
      })),
      args: [],
      log: true,
      waitConfirmations: 1,
    } as any);
  } else {
    console.log('Skipping deploy of MockERC721Receiver on non-local network');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};
export default func;
func.tags = ['MockERC721Receiver'];
func.dependencies = ['HolographGenesis'];
