declare var global: any;
import path from 'path';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import {
  LeanHardhatRuntimeEnvironment,
  hreSplit,
  genesisDeployHelper,
  genesisDeriveFutureAddress,
  generateInitCode,
  getGasPrice,
  getGasLimit,
  getDeployer,
} from '../scripts/utils/helpers';
import { HolographERC20Event, ConfigureEvents } from '../scripts/utils/events';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();

  const salt = hre.deploymentSalt;

  const futureErc20Address = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographERC20',
    generateInitCode(
      ['string', 'string', 'uint16', 'uint256', 'string', 'string', 'bool', 'bytes'],
      [
        'Holograph ERC20 Token', // contractName
        'HolographERC20', // contractSymbol
        18, // contractDecimals
        ConfigureEvents([]), // eventConfig
        'HolographERC20', // domainSeperator
        '1', // domainVersion
        true, // skipInit
        '0x', // initCode
      ]
    )
  );
  console.log('the future "HolographERC20" address is', futureErc20Address);

  // HolographERC20
  let erc20DeployedCode: string = await hre.provider.send('eth_getCode', [futureErc20Address, 'latest']);
  if (erc20DeployedCode === '0x' || erc20DeployedCode === '') {
    console.log('"HolographERC20" bytecode not found, need to deploy"');
    let holographErc20 = await genesisDeployHelper(
      hre,
      salt,
      'HolographERC20',
      generateInitCode(
        ['string', 'string', 'uint16', 'uint256', 'string', 'string', 'bool', 'bytes'],
        [
          'Holograph ERC20 Token', // contractName
          'HolographERC20', // contractSymbol
          18, // contractDecimals
          ConfigureEvents([]), // eventConfig
          'HolographERC20', // domainSeperator
          '1', // domainVersion
          true, // skipInit
          '0x', // initCode
        ]
      ),
      futureErc20Address
    );
  } else {
    console.log('"HolographERC20" is already deployed.');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['HolographERC20', 'DeployERC20'];
func.dependencies = ['HolographGenesis', 'DeploySources'];
