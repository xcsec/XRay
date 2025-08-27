import { ethers } from 'ethers';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TokenSymbol, getHTokenAddress } from './utils/addresses';
import { NetworkType, networks } from '@holographxyz/networks';
import readLine from 'readline';

/**
 * Task to get the native token from the hToken contract
 * @param token The address of the hToken contract
 * @param recipient The address of the recipient
 * @param amount The amount of hTokens to extract
 *
 * Run this task with:
 * npx hardhat extractNativeToken --token [hETh, hMatic, hAvax...] --recipient [recipientAddress] --amount [amount] --network [networkName]
 */
task('extractNativeToken', 'Calls the extractNativeToken function in the hToken contract')
  .addParam('token', 'The hToken symbol [hETh, hMatic, hAvax...]')
  .addParam('recipient', 'The address of the recipient')
  .addParam('amount', 'The amount of hTokens to extract')
  .setAction(async ({ token, recipient, amount }, hre: HardhatRuntimeEnvironment) => {
    const signer = (await hre.ethers.getSigners())[0]; // Get the first signer

    // Get the address of the token to bridge
    const network = networks[hre.network.name];
    const currentNetworkType: NetworkType = network.type;

    // Get the hToken contract address
    const hTokenAddress = getHTokenAddress(currentNetworkType as NetworkType, token as TokenSymbol);
    if (!hTokenAddress) {
      throw new Error(`Invalid h token: ${token}`);
    }
    // Get the contract's ABI from the compiled artifacts
    const hTokenArtifact = await hre.artifacts.readArtifact('hToken');
    const balanceOfAbi = {
      inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    };
    hTokenArtifact.abi.push(balanceOfAbi);
    const hTokenContract = new ethers.Contract(hTokenAddress, hTokenArtifact.abi, signer);

    // Convert amount to wei (or the equivalent smallest unit for other tokens)
    const amountInWei = ethers.utils.parseEther(amount);

    // Get the sender balances
    const signerBalance = await signer.getBalance();
    const hTokenBalance = await hTokenContract.balanceOf(await signer.getAddress());

    // Display information about the transaction
    console.log(`\n\x1b[32m=== Environment ===\x1b[0m`);
    console.log(`Network: ${hre.network.name}`);
    console.log(`hToken address: ${hTokenAddress}`);
    console.log(`Sender address: ${await signer.getAddress()}`);
    console.log(`Sender ${token} balance: ${signerBalance}`);
    console.log(`Sender hToken balance: ${hTokenBalance}`);
    console.log(`\n\x1b[32m=== Transaction information ===\x1b[0m`);
    console.log(`Amount to extract: ${amountInWei.toString()} wei (${ethers.utils.formatEther(amountInWei)} ${token})`);
    console.log(`Gas price: ${await signer.getGasPrice()}`);
    console.log(`Gas limit: ${await hTokenContract.estimateGas.extractNativeToken(recipient, amountInWei)}`);
    console.log(`\n\x1b[32m=== Expected results ===\x1b[0m`);
    console.log(
      `Expected sender balance after tx: ${signerBalance.sub(amountInWei)} (${ethers.utils.formatEther(
        signerBalance.sub(amountInWei)
      )} ETH)`
    );
    console.log(
      `Expected sender hToken balance after tx: ${hTokenBalance.add(amountInWei)} (${ethers.utils.formatEther(
        hTokenBalance.add(amountInWei)
      )} hToken)`
    );
    console.log('\n');

    // Ask the user if he want to continue regarding the information displayed
    const rl = readLine.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const response = await new Promise<string>((resolve) => {
      rl.question('Do you want to send the transaction? (y/N): ', resolve);
    });

    // Stop script if the user doesn't want to continue
    if (response.toLowerCase() !== 'y') {
      console.log('🚫 \x1b[33mExtraction not executed.\x1b[0m');
      return;
    }

    // Send the transaction
    console.log('🚀 \x1b[36mSending transaction...\x1b[0m');

    const tx = await hTokenContract.extractNativeToken(recipient, amountInWei);
    console.log(`Transaction hash: ${tx.hash}`);

    await tx.wait(); // Wait for the transaction to be mined
    console.log(`Transaction confirmed in block: ${tx.blockNumber}`);
  });
