declare var global: any;
import path from 'path';

import fs from 'fs';
import Web3 from 'web3';
import { BigNumberish, BytesLike, ContractFactory, Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  LeanHardhatRuntimeEnvironment,
  Signature,
  hreSplit,
  zeroAddress,
  StrictECDSA,
  generateErc20Config,
  genesisDeployHelper,
  generateInitCode,
  genesisDeriveFutureAddress,
  remove0x,
  txParams,
  getDeployer,
} from '../scripts/utils/helpers';
import { MultisigAwareTx } from '../scripts/utils/multisig-aware-tx';
import { HolographERC20Event, ConfigureEvents, AllEventsEnabled } from '../scripts/utils/events';
import { NetworkType, Network, networks } from '@holographxyz/networks';
import { Environment, getEnvironment } from '@holographxyz/environment';

interface HTokenData {
  primaryNetwork: Network;
  tokenSymbol: string;
  supportedNetworks: Network[];
}

const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();

  const web3 = new Web3();

  const salt = hre.deploymentSalt;

  const futureHTokenAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'hToken',
    generateInitCode(['address', 'uint16'], [deployerAddress, 0])
  );
  console.log('the future "hToken" address is', futureHTokenAddress);

  // hToken
  let hTokenDeployedCode: string = await hre.provider.send('eth_getCode', [futureHTokenAddress, 'latest']);
  if (hTokenDeployedCode === '0x' || hTokenDeployedCode === '') {
    console.log('"hToken" bytecode not found, need to deploy"');
    let holographErc20 = await genesisDeployHelper(
      hre,
      salt,
      'hToken',
      generateInitCode(['address', 'uint16'], [deployerAddress, 0]),
      futureHTokenAddress
    );
  } else {
    console.log('"hToken" is already deployed.');
  }

  const network = networks[hre.networkName];

  const holograph = await hre.ethers.getContract('Holograph', deployerAddress);

  const factory = (await hre.ethers.getContractAt(
    'HolographFactory',
    await holograph.getFactory(),
    deployerAddress
  )) as Contract;

  const registry = (await hre.ethers.getContractAt(
    'HolographRegistry',
    await holograph.getRegistry(),
    deployerAddress
  )) as Contract;

  const holographerBytecode: BytesLike = (await hre.ethers.getContractFactory('Holographer')).bytecode;

  const error = function (err: string) {
    console.log(err);
    process.exit();
  };

  const currentNetworkType: NetworkType = network.type;
  let hTokens: HTokenData[] = [];
  let primaryNetwork: Network;
  if (currentNetworkType === NetworkType.local) {
    primaryNetwork = networks.localhost;
    hTokens = [
      {
        primaryNetwork: networks.localhost,
        tokenSymbol: 'ETH',
        supportedNetworks: [networks.localhost, networks.localhost2],
      },
    ];
  } else if (currentNetworkType === NetworkType.testnet) {
    primaryNetwork = networks.ethereumTestnetSepolia;
    hTokens = [
      {
        primaryNetwork: networks.ethereumTestnetSepolia,
        tokenSymbol: 'ETH',
        supportedNetworks: [
          networks.arbitrumTestnetSepolia,
          networks.baseTestnetSepolia,
          networks.ethereumTestnetSepolia,
          networks.optimismTestnetSepolia,
          networks.zoraTestnetSepolia,
          networks.lineaTestnetGoerli,
        ],
      },
      {
        primaryNetwork: networks.avalancheTestnet,
        tokenSymbol: 'AVAX',
        supportedNetworks: [networks.avalancheTestnet],
      },
      {
        primaryNetwork: networks.binanceSmartChainTestnet,
        tokenSymbol: 'BNB',
        supportedNetworks: [networks.binanceSmartChainTestnet],
      },
      {
        primaryNetwork: networks.mantleTestnet,
        tokenSymbol: 'MNT',
        supportedNetworks: [networks.mantleTestnet],
      },
      {
        primaryNetwork: networks.polygonTestnet,
        tokenSymbol: 'MATIC',
        supportedNetworks: [networks.polygonTestnet],
      },
    ];
  } else if (currentNetworkType === NetworkType.mainnet) {
    primaryNetwork = networks.ethereum;
    hTokens = [
      {
        primaryNetwork: networks.ethereum,
        tokenSymbol: 'ETH',
        supportedNetworks: [
          networks.arbitrumOne,
          networks.arbitrumNova,
          networks.base,
          networks.ethereum,
          networks.optimism,
          networks.zora,
        ],
      },
      {
        primaryNetwork: networks.avalanche,
        tokenSymbol: 'AVAX',
        supportedNetworks: [networks.avalanche],
      },
      {
        primaryNetwork: networks.binanceSmartChain,
        tokenSymbol: 'BNB',
        supportedNetworks: [networks.binanceSmartChain],
      },
      {
        primaryNetwork: networks.mantle,
        tokenSymbol: 'MNT',
        supportedNetworks: [networks.mantle],
      },
      {
        primaryNetwork: networks.polygon,
        tokenSymbol: 'MATIC',
        supportedNetworks: [networks.polygon],
      },
    ];
  } else {
    throw new Error('cannot identity current NetworkType');
  }

  const hTokenDeployer = async function (
    holograph: Contract,
    factory: Contract,
    registry: Contract,
    holographerBytecode: BytesLike,
    data: HTokenData
  ) {
    const hTokenHash = '0x' + web3.utils.asciiToHex('hToken').substring(2).padStart(64, '0');
    const chainId = '0x' + data.primaryNetwork.holographId.toString(16).padStart(8, '0');

    // NOTICE: At the moment the hToken contract's address is reliant on the deployerAddress which prevents multiple approved deployers from deploying the same address. This is a temporary solution until the hToken contract is upgraded to allow any deployerAddress to be used.
    // NOTE: Use hardcoded version of deployerAddress from Ledger hardware only for testnet and mainnet envs
    // If environment is develop use the signers deployerAddress
    let erc20DeployerAddress = '0xBB566182f35B9E5Ae04dB02a5450CC156d2f89c1'; // Ledger deployerAddress
    const environment: Environment = getEnvironment();
    console.log(`Environment: ${environment}`);

    if (environment === Environment.develop) {
      console.log(`Using deployerAddress from signer ${deployerAddress}`);
      erc20DeployerAddress = deployerAddress;
    }

    let { erc20Config, erc20ConfigHash, erc20ConfigHashBytes } = await generateErc20Config(
      data.primaryNetwork,
      erc20DeployerAddress, // TODO: Upgrade the hToken contract so that any deployerAddress can be used
      'hTokenProxy',
      'Holographed ' + data.tokenSymbol,
      'h' + data.tokenSymbol,
      'Holographed ' + data.tokenSymbol,
      '1',
      18,
      ConfigureEvents([]),
      generateInitCode(
        ['bytes32', 'address', 'bytes'],
        [
          hTokenHash,
          registry.address,
          generateInitCode(
            ['address', 'uint16'],
            [erc20DeployerAddress /* TODO: Upgrade the hToken contract so that any deployerAddress can be used */, 0]
          ),
        ]
      ),
      salt
    );

    const futureHTokenAddress = hre.ethers.utils.getCreate2Address(
      factory.address,
      erc20ConfigHash,
      hre.ethers.utils.keccak256(holographerBytecode)
    );
    console.log('the future "hToken ' + data.tokenSymbol + '" address is', futureHTokenAddress);

    let hTokenDeployedCode: string = await hre.provider.send('eth_getCode', [futureHTokenAddress, 'latest']);
    if (hTokenDeployedCode === '0x' || hTokenDeployedCode === '') {
      console.log('need to deploy "hToken ' + data.tokenSymbol + '"');

      const sig = await deployer.signer.signMessage(erc20ConfigHashBytes);
      const signature: Signature = StrictECDSA({
        r: '0x' + sig.substring(2, 66),
        s: '0x' + sig.substring(66, 130),
        v: '0x' + sig.substring(130, 132),
      } as Signature);

      const factoryWithSigner = factory.connect(deployer.signer);

      const deployTx = await factoryWithSigner.deployHolographableContract(erc20Config, signature, deployerAddress, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: factory,
          data: factory.populateTransaction.deployHolographableContract(erc20Config, signature, deployerAddress),
        })),
      });
      const deployResult = await deployTx.wait();

      let eventIndex: number = 0;
      let eventFound: boolean = false;
      for (let i = 0, l = deployResult.events.length; i < l; i++) {
        let e = deployResult.events[i];
        if (e.event === 'BridgeableContractDeployed') {
          eventFound = true;
          eventIndex = i;
          break;
        }
      }
      if (!eventFound) {
        throw new Error('BridgeableContractDeployed event not fired');
      }
      let hTokenAddress = deployResult.events[eventIndex].args[0];
      if (hTokenAddress !== futureHTokenAddress) {
        throw new Error(
          `Seems like hTokenAddress ${hTokenAddress} and futureHTokenAddress ${futureHTokenAddress} do not match!`
        );
      }
      console.log('Deployed "hToken ' + data.tokenSymbol + '" at:', hTokenAddress);
    } else {
      console.log('Reusing "hToken ' + data.tokenSymbol + '" at:', futureHTokenAddress);
    }

    const hToken = ((await hre.ethers.getContract('hToken', deployerAddress)) as Contract).attach(futureHTokenAddress);

    for (let network of data.supportedNetworks) {
      if (!(await hToken.isSupportedChain(network.chain))) {
        console.log('Need to add ' + network.chain.toString() + ' as supported chain');
        const setSupportedChainTx = await MultisigAwareTx(
          hre,
          'hToken',
          hToken,
          await hToken.populateTransaction.updateSupportedChain(network.chain, true, {
            ...(await txParams({
              hre,
              from: deployerAddress,
              to: hToken,
              data: hToken.populateTransaction.updateSupportedChain(network.chain, true),
            })),
          })
        );
        await setSupportedChainTx.wait();
        console.log('Set ' + network.chain.toString() + ' as supported chain');
      }
      const chain = '0x' + network.holographId.toString(16).padStart(8, '0');
      if ((await registry.getHToken(chain)) !== futureHTokenAddress) {
        console.log(
          'Updated "Registry" with "hToken ' +
            data.tokenSymbol +
            '" for holographChainId #' +
            Number.parseInt(chain).toString()
        );
        const setHTokenTx = await MultisigAwareTx(
          hre,
          'HolographRegistry',
          registry,
          await registry.populateTransaction.setHToken(chain, futureHTokenAddress, {
            ...(await txParams({
              hre,
              from: deployerAddress,
              to: registry,
              data: registry.populateTransaction.setHToken(chain, futureHTokenAddress),
            })),
          })
        );
        await setHTokenTx.wait();
      }
    }
  };

  for (let hToken of hTokens) {
    await hTokenDeployer(holograph, factory, registry, holographerBytecode, hToken);
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['hToken'];
func.dependencies = ['HolographGenesis', 'DeploySources', 'DeployERC20', 'RegisterTemplates'];
