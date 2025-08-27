declare var global: any;
import path from 'path';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import { getDeployer, hreSplit, txParams } from '../scripts/utils/helpers';
import { MultisigAwareTx } from '../scripts/utils/multisig-aware-tx';
import { NetworkType, Network, networks } from '@holographxyz/networks';
import { Environment, getEnvironment } from '@holographxyz/environment';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();

  global.__txNonce = {} as { [key: string]: number };
  global.__txNonce[hre.networkName] = await hre.ethers.provider.getTransactionCount(deployerAddress);

  const network: Network = networks[hre.networkName];
  const environment: Environment = getEnvironment();

  // If we are on a mainnet or testnet, and we are deploying to a mainnet or testnet environment, then we need to set the multisig
  if (
    (network.type === NetworkType.mainnet || network.type === NetworkType.testnet) &&
    (environment === Environment.mainnet || environment === Environment.testnet)
  ) {
    // If there is no multisig, then we need to use the deployer address
    // Otherwise, we use the multisig address
    let useDeployer: boolean = false;
    if (network.protocolMultisig === undefined) {
      useDeployer = true;
    }
    const MULTI_SIG: string = useDeployer
      ? deployerAddress.toLowerCase()
      : (network.protocolMultisig as string).toLowerCase();

    const switchToHolograph: string[] = [
      // Proxies
      'HolographBridgeProxy',
      'HolographFactoryProxy',
      'HolographInterfaces',
      'HolographOperatorProxy',
      'HolographRegistryProxy',
      'HolographTreasuryProxy',
      'LayerZeroModuleProxy',
      'DropsPriceOracleProxy',
      'DropsMetadataRendererProxy',
      'EditionsMetadataRendererProxy',

      // Implementations
      'HolographBridge',
      'HolographFactory',
      'HolographOperator',
      'HolographRegistry',
      'HolographTreasury',
      'LayerZeroModule',
      'OVM_GasPriceOracle',
    ];

    const holograph = await hre.ethers.getContract('Holograph', deployerAddress);

    if ((await holograph.getAdmin()).toLowerCase() !== MULTI_SIG) {
      console.log(
        `The Holograph Admin is ${await holograph.getAdmin()} not the multisig at ${MULTI_SIG}, updating it to be the multisig`
      );

      let setHolographAdminTx = await MultisigAwareTx(
        hre,
        'Holograph',
        holograph,
        await holograph.populateTransaction.setAdmin(MULTI_SIG, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.populateTransaction.setAdmin(MULTI_SIG),
          })),
        })
      );
      console.log(`Changing Holograph Admin tx ${setHolographAdminTx.hash}`);
      await setHolographAdminTx.wait();
      console.log('Changed Holograph Admin');
    }

    for (const contractName of switchToHolograph) {
      const contract = await hre.ethers.getContract(contractName, deployerAddress);
      const contractAdmin = await contract.getAdmin();
      if (contractAdmin.toLowerCase() !== holograph.address.toLowerCase()) {
        console.log(
          `The ${contractName} Admin is ${contractAdmin} not Holograph, updating it to be Holograph at ${holograph.address}`
        );
        let setHolographAsAdminTx = await MultisigAwareTx(
          hre,
          contractName,
          contract,
          await contract.populateTransaction.setAdmin(holograph.address, {
            ...(await txParams({
              hre,
              from: deployerAddress,
              to: contract,
              data: contract.populateTransaction.setAdmin(holograph.address),
            })),
          })
        );
        console.log(`Changing ${contractName} Admin to Holograph tx ${setHolographAsAdminTx.hash}`);
        await setHolographAsAdminTx.wait();
        console.log(`Changed ${contractName} Admin to Holograph`);
      }
    }
  } else {
    console.log(`Skipping multisig setup for ${NetworkType[network.type]}`);
  }
  console.log(`Exiting script: ${__filename} ✅\n`);
};
export default func;
func.tags = ['MultiSig'];
func.dependencies = [];
