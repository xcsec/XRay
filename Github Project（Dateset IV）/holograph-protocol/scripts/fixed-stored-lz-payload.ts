import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('RETRY_PAYLOAD', 'A description for your task').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  let srcChainId = 43113; // the lz chain id of the origin chain

  // This is the address of the LayerZeroModuleProxy contract on source chain and destination chain (same for both chains)
  let trustedRemote = hre.ethers.utils.solidityPack(
    ['address', 'address'],
    ['0xa534C5D756b0b7Cb5dec153FA64351459a28eB98', '0xa534C5D756b0b7Cb5dec153FA64351459a28eB98']
  );
  let payload = '0x16F1BE70...'; // shortened for brevity. use the payload data that needs to be retried

  console.log(trustedRemote);

  // Use the ABI and address to get a contract instance
  const LZEndpointMockABI = require('../artifacts/src/mock/LZEndpointMock.sol/LZEndpointMock.json').abi;
  const contractAddress = '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706'; // Address of the LZ Endpoint contract on the destination chain
  const endpoint = new hre.ethers.Contract(contractAddress, LZEndpointMockABI, hre.ethers.provider);

  let tx = await endpoint.retryPayload(srcChainId, trustedRemote, payload);
  console.log(`tx: ${tx.hash}`);
});

export default {};
