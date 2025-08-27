declare var global: any;
import path from 'path';

import { BigNumber, Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Holographer, CxipERC721Proxy } from '../typechain-types';
import { getDeployer, hreSplit, txParams } from '../scripts/utils/helpers';
import { NetworkType, networks } from '@holographxyz/networks';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();
  const salt = hre.deploymentSalt;
  const currentNetworkType: NetworkType = networks[hre.networkName].type;

  if (currentNetworkType !== NetworkType.local) {
    const holographer: Contract | null = await hre.ethers.getContractOrNull('Holographer', deployerAddress);
    if (holographer === null) {
      await hre.deployments.deploy('Holographer', {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: '0x0000000000000000000000000000000000000000',
          gasLimit: await hre.ethers.provider.estimateGas(
            (await hre.ethers.getContractFactory('Holographer')).getDeployTransaction()
          ),
        })),
        args: [],
        log: true,
        waitConfirmations: 1,
      } as any);
      console.log('Deployed a "Holographer" empty contract for block explorer verification purposes.');
    }

    const cxipERC721Proxy: Contract | null = await hre.ethers.getContractOrNull('CxipERC721Proxy', deployerAddress);
    if (cxipERC721Proxy === null) {
      await hre.deployments.deploy('CxipERC721Proxy', {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: '0x0000000000000000000000000000000000000000',
          gasLimit: await hre.ethers.provider.estimateGas(
            (await hre.ethers.getContractFactory('CxipERC721Proxy')).getDeployTransaction()
          ),
        })),
        args: [],
        log: true,
        waitConfirmations: 1,
      } as any);
      console.log('Deployed a "CxipERC721Proxy" empty contract for block explorer verification purposes.');
    }

    const holographDropERC721Proxy: Contract | null = await hre.ethers.getContractOrNull(
      'HolographDropERC721Proxy',
      deployerAddress
    );
    if (holographDropERC721Proxy === null) {
      await hre.deployments.deploy('HolographDropERC721Proxy', {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: '0x0000000000000000000000000000000000000000',
          gasLimit: await hre.ethers.provider.estimateGas(
            (await hre.ethers.getContractFactory('HolographDropERC721Proxy')).getDeployTransaction()
          ),
        })),
        args: [],
        log: true,
        waitConfirmations: 1,
      } as any);
      console.log('Deployed a "HolographDropERC721Proxy" empty contract for block explorer verification purposes.');
    }

    const holographUtilityToken: Contract | null = await hre.ethers.getContractOrNull(
      'HolographUtilityToken',
      deployerAddress
    );
    if (holographUtilityToken === null) {
      await hre.deployments.deploy('HolographUtilityToken', {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: '0x0000000000000000000000000000000000000000',
          gasLimit: await hre.ethers.provider.estimateGas(
            (await hre.ethers.getContractFactory('HolographUtilityToken')).getDeployTransaction()
          ),
        })),
        args: [],
        log: true,
        waitConfirmations: 1,
      } as any);
      console.log('Deployed a "HolographUtilityToken" empty contract for block explorer verification purposes.');
    }

    const hTokenProxy: Contract | null = await hre.ethers.getContractOrNull('hTokenProxy', deployerAddress);
    if (hTokenProxy === null) {
      await hre.deployments.deploy('hTokenProxy', {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: '0x0000000000000000000000000000000000000000',
          gasLimit: await hre.ethers.provider.estimateGas(
            (await hre.ethers.getContractFactory('hTokenProxy')).getDeployTransaction()
          ),
        })),
        args: [],
        log: true,
        waitConfirmations: 1,
      } as any);
      console.log('Deployed a "hTokenProxy" empty contract for block explorer verification purposes.');
    }
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = [
  'Holographer4verify',
  'CxipERC721Proxy4verify',
  'HolographDropERC721Proxy4verify',
  'HolographUtilityToken4verify',
  'hToken4verify',
];
func.dependencies = [];
