import { JsonRpcProvider } from '@ethersproject/providers';
import { Network, NetworkType, networks } from '@holographxyz/networks';
import { Contract, BigNumber, BytesLike, ethers, BigNumberish, UnsignedTransaction } from 'ethers';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import Web3 from 'web3';
import { GasPricing, initializeGasPricing } from './utils/gas';
import { TokenSymbol, getHTokenAddress } from './utils/addresses';
const web3 = new Web3();

const TEST_GAS_LIMIT: BigNumber = ethers.BigNumber.from('10000000');
const IS_GAS_ESTIMATION_LOGS_ENABLED = true;
const IS_GAS_OVERRIDE_ENABLED = false;
export const INSUFFICIENT_BALANCE_ERROR = 'Insufficient balance';
export const MIN_POLYGON_GAS_PRICE = BigNumber.from('400000000000');

// npx hardhat bridge-htokens --token [hETh, hMatic, hAvax...] --amount [eth units] --network [the origin network] --to [account to send tokens to] --destination [network
task('bridge-htokens', 'Bridge hToken from one network to another')
  .addParam('token', 'The hToken to bridge')
  .addParam('amount', 'The amount of hToken to bridge')
  .addParam('destination', 'The network to bridge to')
  .addParam('to', 'The account to bridge tokens to on the destination', '')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    let { destination, amount, to } = taskArgs;

    const signer = (await hre.ethers.getSigners())[0]; // Get the first signer
    const from = await signer.getAddress();

    // If no address is provided to send the bridged tokens to, use the sender's address
    if (!to || to === '') {
      to = from;
    }

    // Get the address of the token to bridge
    const network = networks[hre.network.name];
    const currentNetworkType: NetworkType = network.type;

    const sourceChain = networks[network.key];
    const destinationChain = networks[destination];

    console.log(sourceChain);
    console.log(destinationChain);

    const hTokenAddress = getHTokenAddress(currentNetworkType as NetworkType, taskArgs.token as TokenSymbol);
    if (!hTokenAddress) {
      throw new Error(`Invalid h token: ${taskArgs.token}`);
    }

    // Convert amount in ETH units to Wei and to bytes32
    const amountInWei = ethers.utils.parseEther(amount);
    const formattedAmount = ethers.utils.hexZeroPad(amountInWei.toHexString(), 32);

    console.log(`Bridging ${amount} ETH (${amountInWei.toString()} Wei) of ${taskArgs.token}`);
    console.log(`Formatted amount: ${formattedAmount}`);

    console.log(`Network ${network.shortKey} is of type ${currentNetworkType}`);
    console.log(
      `Bridging ${amount} ${taskArgs.token} at ${hTokenAddress} from ${network.shortKey} to ${destinationChain.shortKey}`
    );
    console.log(`Formatted amount: ${formattedAmount}`);

    const data = generateInitCode(['address', 'address', 'uint256'], [from, to, formattedAmount]);
    console.log(`Data: ${data}`);

    // Estimate the bridging fee
    const result = await bridgeOut(hre, sourceChain, destinationChain, hTokenAddress!, data);
    console.log(
      `Finished bridging ${amount} ${taskArgs.token} from ${network.shortKey} to ${destinationChain.shortKey}`
    );
  });

async function bridgeOut(
  hre: any,
  sourceChain: any,
  destinationChain: any,
  htokenAddress: string,
  data: ethers.utils.BytesLike
): Promise<any> {
  const signer = (await hre.ethers.getSigners())[0];
  const { holograph, bridgeContract, operatorContract } = await initializeContracts(hre, signer);

  console.log(`Holgraph contract: ${holograph.address}`);
  console.log(`Bridge contract: ${bridgeContract.address}`);
  console.log(`Operator contract: ${operatorContract.address}`);
  console.log(`H Token address: ${htokenAddress}`);

  let payload = await bridgeContract.callStatic.getBridgeOutRequestPayload(
    destinationChain.holographId,
    htokenAddress,
    '0x' + 'ff'.repeat(32),
    '0x' + 'ff'.repeat(32),
    data
  );

  logEstimation(IS_GAS_ESTIMATION_LOGS_ENABLED, 1, {
    operatorAddress: operatorContract.address,
    bridgeAddress: bridgeContract.address,
    hTokenAddress: htokenAddress,
    initialPayload: payload,
  });

  const destinationProvider = getRpcProvider(destinationChain);
  const destinationFrom = getSpecialAddressForChain(destinationChain.chain);

  let estimatedGas = await estimateGasOnDestination(operatorContract, destinationProvider, payload, destinationFrom);

  const gasPricing: GasPricing = await initializeGasPricing(destinationChain.key, destinationProvider);
  let destinationGasPrice = gasPricing.isEip1559 ? gasPricing.maxFeePerGas : gasPricing.gasPrice;

  destinationGasPrice = destinationGasPrice!.add(destinationGasPrice!.div(2)); // Add 50% overhead

  if (
    (destinationChain.chain === networks.polygonTestnet.chain || destinationChain.chain === networks.polygon.chain) &&
    destinationGasPrice.lt(MIN_POLYGON_GAS_PRICE)
  ) {
    destinationGasPrice = MIN_POLYGON_GAS_PRICE;
  }

  logEstimation(IS_GAS_ESTIMATION_LOGS_ENABLED, 2, {
    destinationChainId: destinationChain.chain,
    estimatedGas: estimatedGas.toString(),
    gasPricing,
    destinationGasPrice: destinationGasPrice.toString(),
  });

  // Add 25% to the estimated gas limit for the destination network
  estimatedGas = estimatedGas.add(estimatedGas.div(4));

  if (IS_GAS_OVERRIDE_ENABLED) {
    estimatedGas = ethers.BigNumber.from('1000000'); // set gas limit to 1M wei for override
    destinationGasPrice = ethers.BigNumber.from('1000000000'); // set gas price to 1 Gwei for override
  }

  payload = await bridgeContract.callStatic.getBridgeOutRequestPayload(
    destinationChain.holographId,
    htokenAddress,
    estimatedGas,
    destinationGasPrice,
    data
  );

  logEstimation(IS_GAS_ESTIMATION_LOGS_ENABLED, 3, { payload });

  // Prepare for the transaction
  const fees = await bridgeContract.callStatic.getMessageFee(
    destinationChain.holographId,
    estimatedGas,
    destinationGasPrice,
    payload
  );

  // fees consist of two parts: hlg fee and lz fee
  // fees[0] = hlg fee is the amount that we charge user for making sure operators can get the job done
  // fees[1] = lz fee is what LayerZero charge for sending the message cross-chain
  // we add the two fees together into one number
  let total: BigNumber = fees[0].add(fees[1]);
  // for now, to accommodate us time to properly estimate and calculate fees, we add 25% to give us margin for error
  total = total.add(total.div(BigNumber.from('4')));

  const unsignedTx = await bridgeContract.populateTransaction.bridgeOutRequest(
    destinationChain.holographId,
    htokenAddress,
    estimatedGas,
    destinationGasPrice,
    data,
    { value: total }
  );

  logEstimation(IS_GAS_ESTIMATION_LOGS_ENABLED, 4, { unsignedTx });

  // Send the transaction
  const tx = await signer.sendTransaction(unsignedTx);
  await tx.wait();

  console.log(`Transaction hash: ${tx.hash}`);

  return {
    txHash: tx.hash,
    estimatedGas,
    destinationGasPrice,
    total,
  };
}

const generateInitCode = function (vars: string[], vals: any[]): string {
  return web3.eth.abi.encodeParameters(vars, vals);
};

export const getRpcProvider = (network: Network) => {
  return new JsonRpcProvider({
    url: network.rpc,
  });
};

export const checkBalanceBeforeTX = (balance: BigNumberish, gas: BigNumberish): string => {
  if (BigNumber.from(gas).gt(BigNumber.from(balance))) return INSUFFICIENT_BALANCE_ERROR;
  return '';
};

// Helper to initialize necessary contracts
async function initializeContracts(hre: any, signer: ethers.Signer) {
  const holograph = await hre.ethers.getContract('Holograph', signer);
  const bridgeContract = await hre.ethers.getContractAt('HolographBridge', await holograph.getBridge(), signer);
  const operatorContract = await hre.ethers.getContractAt('HolographOperator', await holograph.getOperator());
  return { holograph, bridgeContract, operatorContract };
}

// Helper for logging
function logEstimation(logEnabled: boolean, step: number, data: object) {
  if (logEnabled) {
    console.log(`Bridge gas estimation log ${step}: `, data);
  }
}

// Helper to determine special addresses for specific chains
function getSpecialAddressForChain(chainId: number): string {
  const specialAddresses: { [key: number]: string } = {
    10: '0x4200000000000000000000000000000000000006',
    420: '0x4200000000000000000000000000000000000006',
    42161: '0xEe01c0CD76354C383B8c7B4e65EA88D00B06f36f',
    421614: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  };
  return specialAddresses[chainId] || '0x0000000000000000000000000000000000000000';
}

// Helper to estimate gas on the destination network
// We call jobEstimator on destination
// by supplying 10 million gas, we get back result of how much gas is left from simulation
// subtract leftover gas from 10 million to know exactly how much gas is used for tx
async function estimateGasOnDestination(
  operatorContract: Contract,
  destinationProvider: any,
  payload: BytesLike,
  destinationFrom: string
): Promise<BigNumber> {
  return TEST_GAS_LIMIT.sub(
    await operatorContract.connect(destinationProvider).connect(destinationFrom).callStatic.jobEstimator(payload, {
      from: destinationFrom,
      gasLimit: TEST_GAS_LIMIT,
    })
  );
}

export default {};
