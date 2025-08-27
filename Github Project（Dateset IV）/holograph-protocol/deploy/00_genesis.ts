declare var global: any;
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, Deployment } from '@holographxyz/hardhat-deploy-holographed/types';
import { networks } from '@holographxyz/networks';
import { getDeployer, hreSplit, txParams } from '../scripts/utils/helpers';
import path from 'path';
import { BigNumber, Contract } from 'ethers';

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)}`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);

  const deployer = await getDeployer(hre1);
  const deployerAddress = await deployer.signer.getAddress();
  console.log(`Deployer: ${deployerAddress}`);

  if (hre.networkName === 'localhost' || hre.networkName === 'localhost2') {
    // Choose the contract based on the network
    const contractName = ['localhost', 'localhost2'].includes(hre.networkName)
      ? 'HolographGenesisLocal'
      : 'HolographGenesis';

    let holographGenesisContract: Contract | null = await hre.ethers.getContractOrNull(contractName);
    let holographGenesisDeployment: Deployment | null = await hre.deployments.getOrNull(contractName);

    if (!holographGenesisDeployment || holographGenesisContract === null) {
      console.log(`${contractName} contract not found or deployment record is missing, attempting to deploy...`);
      // Deploying the contract if not found or if deployment record is missing
      const deploymentOptions = {
        from: deployerAddress,
        log: true,
        waitConfirmations: 1,
        args: [],
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: '0x0000000000000000000000000000000000000000',
          nonce: 0,
          gasLimit: BigNumber.from(1000000),
        })),
      };

      let deployment = await hre.deployments.deploy(contractName, deploymentOptions as any);
      console.log(`${contractName} deployed at ${deployment.address}`);
      console.log(`${contractName} txHash: ${deployment.receipt!.transactionHash}`);
    } else {
      let deployedCode: string = await hre.ethers.provider.send('eth_getCode', [
        holographGenesisDeployment.address,
        'latest',
      ]);
      if (deployedCode === '0x' || deployedCode === '') {
        // Redeploying the contract as code is not present at the address
        console.log(`${contractName} deployment found but no code at address, redeploying...`);

        const deploymentOptions = {
          from: deployerAddress,
          log: true,
          waitConfirmations: 1,
          args: [],
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: '0x0000000000000000000000000000000000000000',
            nonce: 0,
            gasLimit: BigNumber.from(1000000),
          })),
        };

        // Get the contract factory with the deployer's signer
        const ContractFactory = await hre.ethers.getContractFactory(contractName, deployerAddress);

        // Deploy the contract with custom transaction parameters
        const contract = await ContractFactory.deploy(...deploymentOptions.args, {
          gasLimit: deploymentOptions.gasLimit, // Use the custom gas limit
          nonce: deploymentOptions.nonce, // Nonce is usually managed automatically, use with caution
        });

        // Wait for the transaction to be mined with a specified number of confirmations
        await contract.deployTransaction.wait(deploymentOptions.waitConfirmations);

        console.log(`${contractName} re-deployed at ${contract.address}`);
        console.log(`${contractName} txHash: ${contract.deployTransaction.hash}`);
      } else {
        console.log(`${contractName} contract found and verified at ${holographGenesisDeployment.address}`);
      }
    }
  } else {
    console.log('Skipping deployment of HolographGenesis contract. Only needed for local deployments.');
  }

  console.log(`Exiting script: ${path.basename(__filename)} ✅\n`);
};

export default func;
func.tags = ['HolographGenesis'];
func.dependencies = [];
