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
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();
  const currentNetworkType: NetworkType = networks[hre.networkName].type;

  if (currentNetworkType === NetworkType.local) {
    const mockErc20Tokens = await hre.deployments.deploy('ERC20Mock', {
      ...(await txParams({
        hre,
        from: deployerAddress,
        to: '0x0000000000000000000000000000000000000000',
        gasLimit: await hre.ethers.provider.estimateGas(
          (
            await hre.ethers.getContractFactory('ERC20Mock')
          ).getDeployTransaction('Wrapped ETH (MOCK)', 'WETHmock', 18, 'ERC20Mock', '1')
        ),
      })),
      args: ['Wrapped ETH (MOCK)', 'WETHmock', 18, 'ERC20Mock', '1'],
      log: true,
      waitConfirmations: 1,
    } as any);
  } else {
    console.log('Skipping deploy of MockERC20Tokens on non-local network');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['ERC20Mock', 'MockERC720Tokens'];
func.dependencies = ['HolographGenesis'];
