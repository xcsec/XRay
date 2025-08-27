declare var global: any;

import { TransactionRequest, TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';
import { TransactionDescription } from '@ethersproject/abi';
import { Contract, ContractTransaction } from '@ethersproject/contracts';
import { Contract as ExtendedContract } from '@nomiclabs/hardhat-ethers';
import { Network, networks } from '@holographxyz/networks';
import { Environment, getEnvironment } from '@holographxyz/environment';
import { BigNumber } from '@ethersproject/bignumber';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { txParams, zeroAddress, remove0x, getDeployer } from './helpers';

interface MultisigHandler extends ContractTransaction {
  wait(confirmations?: number): Promise<ContractReceipt>;
}

const getNetworkByHolographId = function (currentNetwork: string, holographId: number): Network {
  let networkArray: Network[] = Object.values(networks);
  for (network of networkArray) {
    if (network.holographId === holographId) {
      return network;
    }
  }
  return networks[currentNetwork];
};

const pressAnyKeyToContinue = async (prompt?: string = 'Press any key to continue: '): Promise<void> => {
  return new Promise((resolve, reject): void => {
    process.stdin.resume();
    process.stdout.write(prompt);
    process.stdin.once('data', (data: any): void => {
      resolve();
    });
    // process.stdin.once('error', reject);
  });
};

const zero: BigNumber = BigNumber.from('0');

const hex2ascii = function (hex: string): string {
  hex = remove0x(hex).replace(/^(00){1,}/, '');
  let str: string = '';
  for (let i: number = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
};

const MultisigAwareTx = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  targetContract: Contract | ExtendedContract,
  futureTx: TransactionRequest
): Promise<MultisigHandler | ContractTransaction | TransactionResponse> => {
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();

  const tx: TransactionDescription = targetContract.interface.parseTransaction({ data: futureTx.data, value: zero });
  let txArgs: { [key: string]: any } = {};
  for (let key of Object.keys(tx.args)) {
    if (!/\d+/.test(key)) {
      let value = tx.args[key];
      switch (tx.name) {
        case 'setReservedContractTypeAddresses':
          if (key == 'hashes') {
            let newValue: string = [];
            for (let hash of value as string[]) {
              newValue.push(hex2ascii(hash));
            }
            value = newValue;
          }
          break;
        case 'setContractTypeAddress':
          if (key == 'contractType') {
            value = hex2ascii(value);
          }
          break;
        case 'updateChainIdMaps':
          if (key == 'fromChainType' || key == 'toChainType') {
            let newValue: string = [];
            for (let chainIdType of value as number[]) {
              let chainIdTypes: string[] = [
                'ChainIdType.UNDEFINED',
                'ChainIdType.EVM',
                'ChainIdType.HOLOGRAPH',
                'ChainIdType.LAYERZERO',
                'ChainIdType.HYPERLANE',
              ];
              newValue.push(chainIdTypes[chainIdType]);
            }
            value = newValue;
          }
          break;
        case 'updateUriPrepends':
          if (key == 'uriTypes') {
            let newValue: string = [];
            for (let uriType of value as number[]) {
              let tokenUriTypes: string[] = [
                'TokenUriType.UNDEFINED',
                'TokenUriType.IPFS',
                'TokenUriType.HTTPS',
                'TokenUriType.ARWEAVE',
              ];
              newValue.push(tokenUriTypes[uriType]);
            }
            value = newValue;
          }
          break;
        case 'setGasParameters':
          if (key == 'chainIds') {
            let newValue: string = [];
            for (let holographId of value as number[]) {
              newValue.push(getNetworkByHolographId(hre.networkName, holographId).key);
            }
            value = newValue;
          } else if (key == 'gasParameters') {
            let newValue: {
              msgBaseGas: string;
              msgGasPerByte: string;
              jobBaseGas: string;
              jobGasPerByte: string;
              minGasPrice: string;
              maxGasLimit: string;
            }[] = [];
            for (let gasParams of value as {
              msgBaseGas: string;
              msgGasPerByte: string;
              jobBaseGas: string;
              jobGasPerByte: string;
              minGasPrice: string;
              maxGasLimit: string;
            }[]) {
              newValue.push({
                msgBaseGas:
                  BigNumber.from(gasParams.msgBaseGas).toString() +
                  ' => ' +
                  BigNumber.from(gasParams.msgBaseGas).toHexString(),
                msgGasPerByte:
                  BigNumber.from(gasParams.msgGasPerByte).toString() +
                  ' => ' +
                  BigNumber.from(gasParams.msgGasPerByte).toHexString(),
                jobBaseGas:
                  BigNumber.from(gasParams.jobBaseGas).toString() +
                  ' => ' +
                  BigNumber.from(gasParams.jobBaseGas).toHexString(),
                jobGasPerByte:
                  BigNumber.from(gasParams.jobGasPerByte).toString() +
                  ' => ' +
                  BigNumber.from(gasParams.jobGasPerByte).toHexString(),
                minGasPrice:
                  BigNumber.from(gasParams.minGasPrice).toString() +
                  ' => ' +
                  BigNumber.from(gasParams.minGasPrice).toHexString(),
                maxGasLimit:
                  BigNumber.from(gasParams.maxGasLimit).toString() +
                  ' => ' +
                  BigNumber.from(gasParams.maxGasLimit).toHexString(),
              });
            }
            value = newValue;
          }
          break;
        default:
          if (BigNumber.isBigNumber(value)) {
            txArgs[key] = BigNumber.from(value).toString() + ' => ' + BigNumber.from(value).toHexString();
          }
          break;
      }
      txArgs[key] = value;
    }
  }
  const network: Network = networks[hre.networkName];
  const environment: Environment = getEnvironment();
  let contract: Contract = await hre.ethers.getContractAt('Admin', futureTx.to, deployerAddress);
  let admin: string = (await contract.admin()).toLowerCase(); // just in case, get it, in case?
  // accomodate factory deployed contracts, which use owner storage slot instead of admin
  if (admin === global.__holographFactoryAddress) {
    contract = await hre.ethers.getContractAt('Owner', futureTx.to, deployerAddress);
    admin = (await contract.owner()).toLowerCase();
  }
  // check if deployer is admin
  if (admin === deployerAddress.toLowerCase()) {
    futureTx.from = deployerAddress;
    return (await deployer.signer.sendTransaction(futureTx)) as ContractTransaction;
  } else {
    // deployer is not admin
    // check if holograph is admin
    console.log(`Deployer is not admin of ${contractName}`);
    console.log(`Admin of ${contractName} is ${admin}`);
    const holograph = await hre.ethers.getContract('Holograph', deployerAddress);
    console.log(`Holograph Contract address is ${holograph.address}`);

    if (admin === global.__holographAddress || admin === holograph.address.toLowerCase()) {
      // const holograph: Contract = await hre.ethers.getContractAt('Admin', holograph.address, deployer);
      const holographAdmin: string = (await holograph.admin()).toLowerCase();
      // check if deployer is admin of holograph
      if (holographAdmin === deployerAddress.toLowerCase()) {
        console.log(`Deployer is admin of Holograph`);

        // NOTE: This is required to connect to the contract with the deployer signer
        //       otherwise the call will fail with an error that the signer is not connected to the node
        const holographWithSigner = holograph.connect(deployer.signer);

        global.__txNonce[hre.networkName] -= 1;
        return (await holographWithSigner.adminCall(futureTx.to, futureTx.data, {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holograph,
            data: holograph.populateTransaction.adminCall(futureTx.to, futureTx.data),
          })),
        })) as ContractTransaction;
      } else {
        if (network.protocolMultisig === undefined || network.protocolMultisig === zeroAddress) {
          // deployer not admin of holograph
          throw new Error('No multisig available, admin is Holograph, deployer not admin of Holograph');
        } else {
          // multisig exists, need to check if it's admin of holograph
          if (holographAdmin === network.protocolMultisig.toLowerCase()) {
            let outputText: string = [
              '',
              '🚨🚨🚨' + '\x1b[31m' + ' Multisig Transaction ' + '\x1b[89m' + '\x1b[37m\x1b[89m' + '🚨🚨🚨',
              'You will need to make a transaction on your ' +
                network.name +
                ' multisig at address ' +
                network.protocolMultisig,
              'The following transaction needs to be created:',
              '',
              '\t' + '\x1b[33m' + 'Holograph(' + holograph.address + ').adminCall({',
              '\t\t' + 'target: ' + futureTx.to,
              '\t\t' + 'payload: ' + futureTx.data,
              '\t\t' +
                'decodedPayload: ' +
                contractName +
                '(' +
                futureTx.to +
                ').' +
                tx.signature.split('(')[0] +
                '(' +
                JSON.stringify(txArgs, undefined, 2).replace(/\n/gm, '\n\t\t') +
                ')',
              '\t' + '})' + '\x1b[89m' + '\x1b[37m\x1b[89m',
              '',
              'In transaction builder enter the following address: 🔐 ' +
                '\x1b[32m' +
                holograph.address +
                '\x1b[89m' +
                '\x1b[37m\x1b[89m',
              'Select "' + '\x1b[32m' + 'Custom data' + '\x1b[89m' + '\x1b[37m\x1b[89m' + '"',
              'Set ETH value to: ' + '\x1b[32m' + '0' + '\x1b[89m' + '\x1b[37m\x1b[89m',
              'Use the following payload for Data input field:',
              '\t' +
                '\x1b[32m' +
                (await holograph.populateTransaction.adminCall(futureTx.to, futureTx.data)).data +
                '\x1b[89m' +
                '\x1b[37m\x1b[89m',
              '',
            ].join('\n');
            await pressAnyKeyToContinue(outputText);
            global.__txNonce[hre.networkName] -= 1;
            return {
              hash: 'multisig transaction',
              wait: async (): Promise<ContractReceipt> => {
                return {} as ContractReceipt;
              },
            } as MultisigHandler;
          } else {
            throw new Error('Admin is Holograph, neither multisig nor deployer are admin of Holograph');
          }
        }
      }
    } else {
      // holograph is not admin
      if (network.protocolMultisig === undefined || network.protocolMultisig === zeroAddress) {
        // multisig does not exist
        throw new Error('No multisig available, neither deployer nor Holograph are admin of this contract');
      } else {
        console.log(`Multisig exists at ${network.protocolMultisig}`);
        // multisig exists, need to check if it's admin admin of contract
        console.log(`Admin of ${contractName} is ${admin}`);
        if (admin === network.protocolMultisig.toLowerCase()) {
          // here we need to call function directly on contract
          // this is a multisig owned contracts, so instructions need to be provided to multisig
          let outputText: string = [
            '',
            '🚨🚨🚨' + '\x1b[31m' + ' Multisig Transaction ' + '\x1b[89m' + '\x1b[37m\x1b[89m' + '🚨🚨🚨',
            'You will need to make a transaction on your ' +
              network.name +
              ' multisig at address ' +
              network.protocolMultisig,
            'The following transaction needs to be created:',
            '',
            '\t' +
              '\x1b[33m' +
              contractName +
              '(' +
              futureTx.to +
              ').' +
              tx.signature.split('(')[0] +
              '(' +
              JSON.stringify(txArgs, undefined, 2).replace(/\n/gm, '\n\t\t') +
              ')' +
              '\x1b[89m' +
              '\x1b[37m\x1b[89m',
            '',
            'In transaction builder enter the following address: 🔐 ' +
              '\x1b[32m' +
              futureTx.to +
              '\x1b[89m' +
              '\x1b[37m\x1b[89m',
            'Select "' + '\x1b[32m' + 'Custom data' + '\x1b[89m' + '\x1b[37m\x1b[89m' + '"',
            'Set ETH value to: ' + '\x1b[32m' + '0' + '\x1b[89m' + '\x1b[37m\x1b[89m',
            'Use the following payload for Data input field:',
            '\t' + '\x1b[32m' + futureTx.data + '\x1b[89m' + '\x1b[37m\x1b[89m',
            '',
          ].join('\n');
          await pressAnyKeyToContinue(outputText);
          global.__txNonce[hre.networkName] -= 1;
          return {
            hash: 'multisig transaction',
            wait: async (): Promise<ContractReceipt> => {
              return {} as ContractReceipt;
            },
          } as MultisigHandler;
        } else {
          throw new Error('Neither deployer, multisig, nor Holograph are admin of this contract');
        }
      }
    }
  }
};

export { MultisigHandler, MultisigAwareTx };
