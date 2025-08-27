declare var global: any;
import path from 'path';

import fs from 'fs';
import Web3 from 'web3';
import { BytesLike, ContractFactory, Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DeployFunction } from '@holographxyz/hardhat-deploy-holographed/types';
import {
  LeanHardhatRuntimeEnvironment,
  hreSplit,
  generateInitCode,
  genesisDeriveFutureAddress,
  zeroAddress,
  txParams,
  getDeployer,
} from '../scripts/utils/helpers';
import { MultisigAwareTx } from '../scripts/utils/multisig-aware-tx';
import { reservedNamespaces, reservedNamespaceHashes } from '../scripts/utils/reserved-namespaces';
import { ConfigureEvents } from '../scripts/utils/events';

// NOTE: IF YOU WANT TO REGISTER A NEW CONTRACT TYPE (NAMESPACE), YOU NEED TO ADD IT TO THE reservedNamespaces ARRAY IN reserved-namespaces.ts
const func: DeployFunction = async function (hre1: HardhatRuntimeEnvironment) {
  console.log(`Starting deploy script: ${path.basename(__filename)} 👇`);

  let { hre, hre2 } = await hreSplit(hre1, global.__companionNetwork);
  const deployer = await getDeployer(hre);
  const deployerAddress = await deployer.signer.getAddress();
  console.log('Deployer address:', deployerAddress);

  const web3 = new Web3();
  const salt = hre.deploymentSalt;

  const holographRegistryProxy = await hre.ethers.getContract('HolographRegistryProxy', deployerAddress);
  const holographRegistry = ((await hre.ethers.getContract('HolographRegistry', deployerAddress)) as Contract).attach(
    holographRegistryProxy.address
  );

  // Logic for checking if all reserved namespaces are actually reserved
  // if some are missing, they will automatically be marked for reservation
  // Defines a fixed storage slot that is used to store the mapping of reserved namespaces
  // using Solidity's storage layout. The number 3 represents a specific slot in storage.
  const _reservedMappingSlot = web3.eth.abi.encodeParameters(['uint256'], [3]);

  // A function that calculates the storage slot for a given namespace key. This is done by
  // hashing the combination of the namespace key and the reserved mapping slot. The result
  // is the actual storage slot where the reservation status of the namespace is stored.
  const _getReservedStorageSlot = function (mappingKey: string): string {
    return web3.utils.keccak256(
      web3.eth.abi.encodeParameters(['bytes32', 'bytes32'], [mappingKey, _reservedMappingSlot])
    );
  };

  console.log('Checking the HolographRegistry reserved namespaces');

  // Initializes an array to keep track of namespaces that need to be reserved.
  let toReserve: number[] = [];

  // Iterates through the list of reserved namespaces to check their reservation status.
  for (let i: number = 0, l: number = reservedNamespaces.length; i < l; i++) {
    let name: string = reservedNamespaces[i];
    let hash: string = reservedNamespaceHashes[i];
    // Requests the current value stored at the calculated storage slot for the namespace.
    // This is done to check if the namespace is already marked as reserved.
    let reserved: string = await hre.ethers.provider.send('eth_getStorageAt', [
      holographRegistry.address,
      _getReservedStorageSlot(hash),
      'latest',
    ]);
    // If the storage slot is empty (indicated by '0x' followed by 64 zeros or '0x0'), it
    // means the namespace is not reserved, so it's added to the `toReserve` list.
    if (reserved === '0x' + '00'.repeat(32) || reserved === '0x0') {
      toReserve.push(i);
    }
  }

  // Checks if there are any namespaces to reserve. If not, logs a message indicating that
  // all namespaces are in order.
  if (toReserve.length === 0) {
    console.log('All HolographRegistry reserved namespaces are in order');
  } else {
    // If there are namespaces to reserve, logs the missing namespaces.
    console.log(
      'Missing the following namespaces:',
      toReserve.map((index: number) => reservedNamespaces[index]).join(', ')
    );

    // Prepares the arrays of namespace hashes and reservation statuses for the transaction.
    let hashArray: string[] = toReserve.map((index: number) => reservedNamespaceHashes[index]);
    let reserveArray: bool[] = toReserve.map(() => true);

    // Creates and sends a transaction to reserve the missing namespaces.
    // `populateTransaction` prepares transaction data for the `setReservedContractTypeAddresses` method.
    const setReservedContractTypeAddressesTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setReservedContractTypeAddresses(hashArray, reserveArray, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setReservedContractTypeAddresses(hashArray, reserveArray),
        })),
      })
    );

    console.log('Transaction hash:', setReservedContractTypeAddressesTx.hash);
    await setReservedContractTypeAddressesTx.wait();
    console.log('Missing namespaces have been reserved for HolographRegistry');
  }

  // At this point all reserved namespaces should be registered in protocol so we can proceed with registering the templates
  // Register DropsPriceOracleProxy
  const futureDropsPriceOracleProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'DropsPriceOracleProxy',
    generateInitCode([], [])
  );
  console.log('the future "DropsPriceOracleProxy" address is', futureDropsPriceOracleProxyAddress);

  const dropsPriceOracleProxyHash =
    '0x' + web3.utils.asciiToHex('DropsPriceOracleProxy').substring(2).padStart(64, '0');
  console.log(`dropsPriceOracleProxyHash: ${dropsPriceOracleProxyHash}`);
  if (
    (await holographRegistry.getContractTypeAddress(dropsPriceOracleProxyHash)) !== futureDropsPriceOracleProxyAddress
  ) {
    const dropsPriceOracleProxyTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(
        dropsPriceOracleProxyHash,
        futureDropsPriceOracleProxyAddress,
        {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: await holographRegistry.populateTransaction.setContractTypeAddress(
              dropsPriceOracleProxyHash,
              futureDropsPriceOracleProxyAddress
            ),
          })),
        }
      )
    );
    console.log('Transaction hash:', dropsPriceOracleProxyTx.hash);
    await dropsPriceOracleProxyTx.wait();
    console.log(
      `Registered "DropsPriceOracleProxy" to: ${await holographRegistry.getContractTypeAddress(
        dropsPriceOracleProxyHash
      )}`
    );
  } else {
    console.log('"DropsPriceOracleProxy" is already registered');
  }

  // Register DropsMetadataRendererProxy
  const futureDropsMetadataRendererAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'DropsMetadataRenderer',
    generateInitCode([], [])
  );
  const futureDropsMetadataRendererProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'DropsMetadataRendererProxy',
    generateInitCode(['address', 'bytes'], [futureDropsMetadataRendererAddress, generateInitCode([], [])])
  );
  console.log('the future "DropsMetadataRendererProxy" address is', futureDropsMetadataRendererProxyAddress);

  const dropsMetadataRendererProxyHash =
    '0x' + web3.utils.asciiToHex('DropsMetadataRendererProxy').substring(2).padStart(64, '0');
  console.log(`dropsMetadataRendererProxyHash: ${dropsMetadataRendererProxyHash}`);
  if (
    (await holographRegistry.getContractTypeAddress(dropsMetadataRendererProxyHash)) !=
    futureDropsMetadataRendererProxyAddress
  ) {
    const dropsMetadataRendererProxyTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(
        dropsMetadataRendererProxyHash,
        futureDropsMetadataRendererProxyAddress,
        {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: holographRegistry.populateTransaction.setContractTypeAddress(
              dropsMetadataRendererProxyHash,
              futureDropsMetadataRendererProxyAddress
            ),
          })),
        }
      )
    );
    console.log('Transaction hash:', dropsMetadataRendererProxyTx.hash);
    await dropsMetadataRendererProxyTx.wait();
    console.log(
      `Registered "DropsMetadataRendererProxy" to: ${await holographRegistry.getContractTypeAddress(
        dropsMetadataRendererProxyHash
      )}`
    );
  } else {
    console.log('"DropsMetadataRendererProxy" is already registered');
  }

  // Register EditionsMetadataRendererProxy
  const futureEditionsMetadataRendererAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'EditionsMetadataRenderer',
    generateInitCode([], [])
  );
  const futureEditionsMetadataRendererProxyAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'EditionsMetadataRendererProxy',
    generateInitCode(['address', 'bytes'], [futureEditionsMetadataRendererAddress, generateInitCode([], [])])
  );
  console.log('the future "EditionsMetadataRendererProxy" address is', futureEditionsMetadataRendererProxyAddress);

  const editionsMetadataRendererProxyHash =
    '0x' + web3.utils.asciiToHex('EditionsMetadataRendererProxy').substring(2).padStart(64, '0');
  console.log(`editionsMetadataRendererProxyHash: ${editionsMetadataRendererProxyHash}`);
  if (
    (await holographRegistry.getContractTypeAddress(editionsMetadataRendererProxyHash)) !=
    futureEditionsMetadataRendererProxyAddress
  ) {
    const editionsMetadataRendererProxyTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(
        editionsMetadataRendererProxyHash,
        futureEditionsMetadataRendererProxyAddress,
        {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: holographRegistry.populateTransaction.setContractTypeAddress(
              editionsMetadataRendererProxyHash,
              futureEditionsMetadataRendererProxyAddress
            ),
          })),
        }
      )
    );
    console.log('Transaction hash:', editionsMetadataRendererProxyTx.hash);
    await editionsMetadataRendererProxyTx.wait();
    console.log(
      `Registered "EditionsMetadataRendererProxy" to: ${await holographRegistry.getContractTypeAddress(
        editionsMetadataRendererProxyHash
      )}`
    );
  } else {
    console.log('"EditionsMetadataRendererProxy" is already registered');
  }

  // Register Generic
  const futureGenericAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographGeneric',
    generateInitCode(
      ['uint256', 'bool', 'bytes'],
      [
        ConfigureEvents([]), // eventConfig
        true, // skipInit
        '0x', // initCode
      ]
    )
  );
  console.log('the future "HolographGeneric" address is', futureGenericAddress);

  const genericHash = '0x' + web3.utils.asciiToHex('HolographGeneric').substring(2).padStart(64, '0');
  console.log(`genericHash: ${genericHash}`);
  if ((await holographRegistry.getContractTypeAddress(genericHash)) !== futureGenericAddress) {
    const genericTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(genericHash, futureGenericAddress, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setContractTypeAddress(genericHash, futureGenericAddress),
        })),
      })
    );
    console.log('Transaction hash:', genericTx.hash);
    await genericTx.wait();
    console.log(`Registered "HolographGeneric" to: ${await holographRegistry.getContractTypeAddress(genericHash)}`);
  } else {
    console.log('"HolographGeneric" is already registered');
  }

  // Register ERC721
  const futureErc721Address = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographERC721',
    generateInitCode(
      ['string', 'string', 'uint16', 'uint256', 'bool', 'bytes'],
      [
        'Holograph ERC721 Collection', // contractName
        'hNFT', // contractSymbol
        1000, // contractBps === 0%
        ConfigureEvents([]), // eventConfig
        true, // skipInit
        generateInitCode(['address'], [deployerAddress]), // initCode
      ]
    )
  );
  console.log('the future "HolographERC721" address is', futureErc721Address);

  const erc721Hash = '0x' + web3.utils.asciiToHex('HolographERC721').substring(2).padStart(64, '0');
  console.log(`erc721Hash: ${erc721Hash}`);
  if ((await holographRegistry.getContractTypeAddress(erc721Hash)) !== futureErc721Address) {
    const erc721Tx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(erc721Hash, futureErc721Address, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setContractTypeAddress(erc721Hash, futureErc721Address),
        })),
      })
    );
    console.log('Transaction hash:', erc721Tx.hash);
    await erc721Tx.wait();
    console.log(`Registered "HolographERC721" to: ${await holographRegistry.getContractTypeAddress(erc721Hash)}`);
  } else {
    console.log('"HolographERC721" is already registered');
  }

  // Register HolographDropERC721
  const HolographDropERC721InitCode = generateInitCode(
    [
      'tuple(address,address,address,address,uint64,uint16,bool,tuple(uint104,uint32,uint64,uint64,uint64,uint64,bytes32),address,bytes)',
    ],
    [
      [
        '0x0000000000000000000000000000000000000000', // holographERC721TransferHelper
        '0x0000000000000000000000000000000000000000', // marketFilterAddress (opensea)
        deployerAddress, // initialOwner
        deployerAddress, // fundsRecipient
        0, // 1000 editions
        1000, // 10% royalty
        false, // enableOpenSeaRoyaltyRegistry
        [0, 0, 0, 0, 0, 0, '0x' + '00'.repeat(32)], // salesConfig
        futureEditionsMetadataRendererProxyAddress, // metadataRenderer
        generateInitCode(['string', 'string', 'string'], ['decscription', 'imageURI', 'animationURI']), // metadataRendererInit
      ],
    ]
  );
  const futureHolographDropERC721Address = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographDropERC721',
    HolographDropERC721InitCode
  );
  console.log('the future "HolographDropERC721" address is', futureHolographDropERC721Address);
  const HolographDropERC721Hash = '0x' + web3.utils.asciiToHex('HolographDropERC721').substring(2).padStart(64, '0');
  console.log(`HolographDropERC721Hash: ${HolographDropERC721Hash}`);
  if ((await holographRegistry.getContractTypeAddress(HolographDropERC721Hash)) !== futureHolographDropERC721Address) {
    const erc721DropTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(
        HolographDropERC721Hash,
        futureHolographDropERC721Address,
        {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: holographRegistry.populateTransaction.setContractTypeAddress(
              HolographDropERC721Hash,
              futureHolographDropERC721Address
            ),
          })),
        }
      )
    );
    console.log('Transaction hash:', erc721DropTx.hash);
    await erc721DropTx.wait();
    console.log(
      `Registered "HolographDropERC721" to: ${await holographRegistry.getContractTypeAddress(HolographDropERC721Hash)}`
    );
  } else {
    console.log('"HolographDropERC721" is already registered');
  }

  // Register HolographDropERC721V2
  const HolographDropERC721V2InitCode = generateInitCode(
    ['tuple(address,address,uint64,uint16,tuple(uint104,uint32,uint64,uint64,uint64,uint64,bytes32),address,bytes)'],
    [
      [
        deployerAddress, // initialOwner
        deployerAddress, // fundsRecipient
        0, // 1000 editions
        1000, // 10% royalty
        [0, 0, 0, 0, 0, 0, '0x' + '00'.repeat(32)], // salesConfig
        futureEditionsMetadataRendererProxyAddress, // metadataRenderer
        generateInitCode(['string', 'string', 'string'], ['decscription', 'imageURI', 'animationURI']), // metadataRendererInit
      ],
    ]
  );
  const futureHolographDropERC721V2Address = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographDropERC721V2',
    HolographDropERC721V2InitCode
  );
  console.log('the future "HolographDropERC721V2" address is', futureHolographDropERC721V2Address);
  const HolographDropERC721V2Hash =
    '0x' + web3.utils.asciiToHex('HolographDropERC721V2').substring(2).padStart(64, '0');
  console.log(`HolographDropERC721V2Hash: ${HolographDropERC721V2Hash}`);
  if (
    (await holographRegistry.getContractTypeAddress(HolographDropERC721V2Hash)) !== futureHolographDropERC721V2Address
  ) {
    const erc721DropTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(
        HolographDropERC721V2Hash,
        futureHolographDropERC721V2Address,
        {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: holographRegistry.populateTransaction.setContractTypeAddress(
              HolographDropERC721V2Hash,
              futureHolographDropERC721V2Address
            ),
          })),
        }
      )
    );
    console.log('Transaction hash:', erc721DropTx.hash);
    await erc721DropTx.wait();
    console.log(
      `Registered "HolographDropERC721V2" to: ${await holographRegistry.getContractTypeAddress(
        HolographDropERC721Hash
      )}`
    );
  } else {
    console.log('"HolographDropERC721V2" is already registered');
  }

  // Register CxipERC721
  const futureCxipErc721Address = await genesisDeriveFutureAddress(
    hre,
    salt,
    'CxipERC721',
    generateInitCode(['address'], [zeroAddress])
  );
  console.log('the future "CxipERC721" address is', futureCxipErc721Address);

  const cxipErc721Hash = '0x' + web3.utils.asciiToHex('CxipERC721').substring(2).padStart(64, '0');
  console.log(`cxipErc721Hash: ${cxipErc721Hash}`);
  if ((await holographRegistry.getContractTypeAddress(cxipErc721Hash)) !== futureCxipErc721Address) {
    const cxipErc721Tx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(cxipErc721Hash, futureCxipErc721Address, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setContractTypeAddress(cxipErc721Hash, futureCxipErc721Address),
        })),
      })
    );
    console.log('Transaction hash:', cxipErc721Tx.hash);
    await cxipErc721Tx.wait();
    console.log(`Registered "CxipERC721" to: ${await holographRegistry.getContractTypeAddress(cxipErc721Hash)}`);
  } else {
    console.log('"CxipERC721" is already registered');
  }

  // Register ERC20
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

  const erc20Hash = '0x' + web3.utils.asciiToHex('HolographERC20').substring(2).padStart(64, '0');
  console.log(`erc20Hash: ${erc20Hash}`);
  if ((await holographRegistry.getContractTypeAddress(erc20Hash)) !== futureErc20Address) {
    const erc20Tx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(erc20Hash, futureErc20Address, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setContractTypeAddress(erc20Hash, futureErc20Address),
        })),
      })
    );
    console.log('Transaction hash:', erc20Tx.hash);
    await erc20Tx.wait();
    console.log(`Registered "HolographERC20" to: ${await holographRegistry.getContractTypeAddress(erc20Hash)}`);
  } else {
    console.log('"HolographERC20" is already registered');
  }

  // Register Royalties
  const futureRoyaltiesAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'HolographRoyalties',
    generateInitCode(['address', 'uint256'], [zeroAddress, '0x' + '00'.repeat(32)])
  );
  console.log('the future "HolographRoyalties" address is', futureRoyaltiesAddress);

  const holographRoyaltiesHash = '0x' + web3.utils.asciiToHex('HolographRoyalties').substring(2).padStart(64, '0');
  console.log(`holographRoyaltiesHash: ${holographRoyaltiesHash}`);
  if ((await holographRegistry.getContractTypeAddress(holographRoyaltiesHash)) !== futureRoyaltiesAddress) {
    const royaltiesTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(
        holographRoyaltiesHash,
        futureRoyaltiesAddress,
        {
          ...(await txParams({
            hre,
            from: deployerAddress,
            to: holographRegistry,
            data: holographRegistry.populateTransaction.setContractTypeAddress(
              holographRoyaltiesHash,
              futureRoyaltiesAddress
            ),
          })),
        }
      )
    );
    console.log('Transaction hash:', royaltiesTx.hash);
    await royaltiesTx.wait();
    console.log(
      `Registered "HolographRoyalties" to: ${await holographRegistry.getContractTypeAddress(holographRoyaltiesHash)}`
    );
  } else {
    console.log('"HolographRoyalties" is already registered');
  }

  // Register hToken
  const futureHTokenAddress = await genesisDeriveFutureAddress(
    hre,
    salt,
    'hToken',
    generateInitCode(['address', 'uint16'], [deployerAddress, 0])
  );
  console.log('the future "hToken" address is', futureHTokenAddress);

  const hTokenHash = '0x' + web3.utils.asciiToHex('hToken').substring(2).padStart(64, '0');
  console.log(`hTokenHash: ${hTokenHash}`);
  if ((await holographRegistry.getContractTypeAddress(hTokenHash)) !== futureHTokenAddress) {
    const hTokenTx = await MultisigAwareTx(
      hre,
      'HolographRegistry',
      holographRegistry,
      await holographRegistry.populateTransaction.setContractTypeAddress(hTokenHash, futureHTokenAddress, {
        ...(await txParams({
          hre,
          from: deployerAddress,
          to: holographRegistry,
          data: holographRegistry.populateTransaction.setContractTypeAddress(hTokenHash, futureHTokenAddress),
        })),
      })
    );
    console.log('Transaction hash:', hTokenTx.hash);
    await hTokenTx.wait();
    console.log(`Registered "hToken" to: ${await holographRegistry.getContractTypeAddress(hTokenHash)}`);
  } else {
    console.log('"hToken" is already registered');
  }

  console.log(`Exiting script: ${__filename} ✅\n`);
};

export default func;
func.tags = ['RegisterTemplates'];
func.dependencies = [
  'HolographGenesis',
  'DeploySources',
  'DeployGeneric',
  'DeployERC20',
  'DeployERC721',
  'HolographDropERC721',
  'HolographDropERC721V2',
  'DeployERC1155',
];
