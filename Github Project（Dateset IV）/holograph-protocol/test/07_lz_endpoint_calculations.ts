//declare var global: any;
//import Web3 from 'web3';
//import { AbiItem } from 'web3-utils';
//import { expect, assert } from 'chai';
//import { PreTest } from './utils';
//import setup from './utils';
//import { BigNumberish, BytesLike, BigNumber, ContractFactory } from 'ethers';
//import {
//  Signature,
//  StrictECDSA,
//  zeroAddress,
//  functionHash,
//  XOR,
//  hexToBytes,
//  stringToHex,
//  buildDomainSeperator,
//  randomHex,
//  generateInitCode,
//  generateErc20Config,
//  generateErc721Config,
//  LeanHardhatRuntimeEnvironment,
//  getGasUsage,
//} from '../scripts/utils/helpers';
//import {
//  HolographERC20Event,
//  HolographERC721Event,
//  HolographERC1155Event,
//  ConfigureEvents,
//  AllEventsEnabled,
//} from '../scripts/utils/events';
//import ChainId from '../scripts/utils/chain';
//import {
//  Admin,
//  CxipERC721,
//  ERC20Mock,
//  Holograph,
//  HolographBridge,
//  HolographBridgeProxy,
//  Holographer,
//  HolographERC20,
//  HolographERC721,
//  HolographFactory,
//  HolographFactoryProxy,
//  HolographGenesis,
//  HolographRegistry,
//  HolographRegistryProxy,
//  HToken,
//  HolographInterfaces,
//  MockERC721Receiver,
//  Owner,
//  HolographRoyalties,
//  SampleERC20,
//  SampleERC721,
//} from '../typechain-types';
//import { DeploymentConfigStruct } from '../typechain-types/HolographFactory';
//
//describe('Testing LZ Endpoint costs (CHAIN1 & CHAIN2)', async function () {
//  const lzReceiveABI = {
//    inputs: [
//      {
//        internalType: 'uint16',
//        name: '',
//        type: 'uint16',
//      },
//      {
//        internalType: 'bytes',
//        name: '_srcAddress',
//        type: 'bytes',
//      },
//      {
//        internalType: 'uint64',
//        name: '',
//        type: 'uint64',
//      },
//      {
//        internalType: 'bytes',
//        name: '_payload',
//        type: 'bytes',
//      },
//    ],
//    name: 'lzReceive',
//    outputs: [],
//    stateMutability: 'payable',
//    type: 'function',
//  } as AbiItem;
//  const lzReceive = function (web3: Web3, params: any[]): BytesLike {
//    return chain1.web3.eth.abi.encodeFunctionCall(lzReceiveABI, params);
//  };
//
//  let chain1: PreTest;
//  let chain2: PreTest;
//
//  let totalNFTs: number = 2;
//  let firstNFTchain1: BigNumber = BigNumber.from(1);
//  let firstNFTchain2: BigNumber = BigNumber.from(1);
//  let secondNFTchain1: BigNumber = BigNumber.from(2);
//  let secondNFTchain2: BigNumber = BigNumber.from(2);
//  let thirdNFTchain1: BigNumber = BigNumber.from(3);
//  let thirdNFTchain2: BigNumber = BigNumber.from(3);
//  let fourthNFTchain1: BigNumber = BigNumber.from(4);
//  let fourthNFTchain2: BigNumber = BigNumber.from(4);
//  let fifthNFTchain1: BigNumber = BigNumber.from(5);
//  let fifthNFTchain2: BigNumber = BigNumber.from(5);
//
//  let payloadThirdNFTchain1: BytesLike;
//  let payloadThirdNFTchain2: BytesLike;
//
//  const tokenURIs: string[] = [
//    'undefined',
//    'QmS9hKVbDDaBi65xLSG4Han6da49szSJ1ZuwtkBwNkGZaK/metadata.json',
//    'QmS9hKVbDDaBi65xLSG4Han6da49szSJ1ZuwtkBwNkGZaK/metadata.json',
//    'QmS9hKVbDDaBi65xLSG4Han6da49szSJ1ZuwtkBwNkGZaK/metadata.json',
//    'QmS9hKVbDDaBi65xLSG4Han6da49szSJ1ZuwtkBwNkGZaK/metadata.json',
//    'QmS9hKVbDDaBi65xLSG4Han6da49szSJ1ZuwtkBwNkGZaK/metadata.json',
//  ];
//
//  let gasUsage: {
//    [key: string]: BigNumber;
//  } = {};
//
//  before(async function () {
//    chain1 = await setup();
//    chain2 = await setup(true);
//
//    firstNFTchain2 = BigNumber.from('0x' + chain2.network.holographId.toString(16).padStart(8, '0') + '00'.repeat(28)).add(
//      firstNFTchain1
//    );
//    secondNFTchain2 = BigNumber.from('0x' + chain2.network.holographId.toString(16).padStart(8, '0') + '00'.repeat(28)).add(
//      secondNFTchain1
//    );
//    thirdNFTchain2 = BigNumber.from('0x' + chain2.network.holographId.toString(16).padStart(8, '0') + '00'.repeat(28)).add(
//      thirdNFTchain1
//    );
//    fourthNFTchain2 = BigNumber.from('0x' + chain2.network.holographId.toString(16).padStart(8, '0') + '00'.repeat(28)).add(
//      fourthNFTchain1
//    );
//    fifthNFTchain2 = BigNumber.from('0x' + chain2.network.holographId.toString(16).padStart(8, '0') + '00'.repeat(28)).add(
//      fifthNFTchain1
//    );
//
//    gasUsage['#3 bridge from chain1'] = BigNumber.from(0);
//    gasUsage['#3 bridge from chain2'] = BigNumber.from(0);
//    gasUsage['#1 mint on chain1'] = BigNumber.from(0);
//    gasUsage['#1 mint on chain2'] = BigNumber.from(0);
//
//    payloadThirdNFTchain1 =
//      functionHash('erc721in(uint32,address,address,address,uint256,bytes)') +
//      generateInitCode(
//        ['uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
//        [
//          chain1.network.holographId,
//          chain1.cxipErc721Holographer.address,
//          chain1.deployer.address,
//          chain2.deployer.address,
//          thirdNFTchain1.toHexString(),
//          generateInitCode(['uint8', 'string'], [1, tokenURIs[3]]),
//        ]
//      ).substring(2);
//
//    payloadThirdNFTchain2 =
//      functionHash('erc721in(uint32,address,address,address,uint256,bytes)') +
//      generateInitCode(
//        ['uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
//        [
//          chain2.network.holographId,
//          chain1.cxipErc721Holographer.address,
//          chain2.deployer.address,
//          chain1.deployer.address,
//          thirdNFTchain2.toHexString(),
//          generateInitCode(['uint8', 'string'], [1, tokenURIs[3]]),
//        ]
//      ).substring(2);
//  });
//
//  after(async function () {});
//
//  beforeEach(async function () {});
//
//  afterEach(async function () {});
//
//  describe('Enable operators for chain1 and chain2', async function () {
//    it('should add 100 operator wallets for each chain', async function () {
//      for (let i = 0, l = 100; i < l; i++) {
//        await chain1.operator.bondUtilityToken(randomHex(20), BigNumber.from('1000000000000000000'), 0);
//        await chain2.operator.bondUtilityToken(randomHex(20), BigNumber.from('1000000000000000000'), 0);
//      }
//      await expect(chain1.operator.bondUtilityToken(randomHex(20), BigNumber.from('1000000000000000000'), 0)).to.not.be
//        .reverted;
//      await expect(chain2.operator.bondUtilityToken(randomHex(20), BigNumber.from('1000000000000000000'), 0)).to.not.be
//        .reverted;
//    });
//  });
//
//  describe('Deploy cross-chain contracts via bridge deploy', async function () {
//    describe('CxipERC721', async function () {
//      it('deploy chain1 equivalent on chain2', async function () {
//        let { erc721Config, erc721ConfigHash, erc721ConfigHashBytes } = await generateErc721Config(
//          chain1.network,
//          chain1.deployer.address,
//          'CxipERC721Proxy',
//          'CXIP ERC721 Collection (' + chain1.hre.networkName + ')',
//          'CXIP',
//          1000,
//          // AllEventsEnabled(),
//          ConfigureEvents([
//            HolographERC721Event.bridgeIn,
//            HolographERC721Event.bridgeOut,
//            HolographERC721Event.afterBurn,
//          ]),
//          generateInitCode(
//            ['bytes32', 'address', 'bytes'],
//            [
//              '0x' + chain1.web3.utils.asciiToHex('CxipERC721').substring(2).padStart(64, '0'),
//              chain1.registry.address,
//              generateInitCode(['address'], [chain1.deployer.address]),
//            ]
//          ),
//          chain1.salt
//        );
//
//        let cxipErc721Address = await chain2.registry.getHolographedHashAddress(erc721ConfigHash);
//
//        expect(cxipErc721Address).to.equal(zeroAddress);
//
//        cxipErc721Address = await chain1.registry.getHolographedHashAddress(erc721ConfigHash);
//
//        let sig = await chain1.deployer.signMessage(erc721ConfigHashBytes);
//        let signature: Signature = StrictECDSA({
//          r: '0x' + sig.substring(2, 66),
//          s: '0x' + sig.substring(66, 130),
//          v: '0x' + sig.substring(130, 132),
//        } as Signature);
//
//        let payload: BytesLike =
//          functionHash('deployIn(bytes)') +
//          generateInitCode(
//            ['bytes'],
//            [
//              generateInitCode(
//                ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
//                [
//                  [
//                    erc721Config.contractType,
//                    erc721Config.chainType,
//                    erc721Config.salt,
//                    erc721Config.byteCode,
//                    erc721Config.initCode,
//                  ],
//                  [signature.r, signature.s, signature.v],
//                  chain1.deployer.address,
//                ]
//              ),
//            ]
//          ).substring(2);
//
//        await expect(chain1.bridge.deployOut(chain2.network.holographId, erc721Config, signature, chain1.deployer.address))
//          .to.emit(chain1.mockLZEndpoint, 'LzEvent')
//          .withArgs(ChainId.hlg2lz(chain2.network.holographId), chain1.operator.address.toLowerCase(), payload);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        await expect(chain2.operator.executeJob(payload))
//          .to.emit(chain2.factory, 'BridgeableContractDeployed')
//          .withArgs(cxipErc721Address, erc721ConfigHash);
//
//        expect(await chain2.registry.getHolographedHashAddress(erc721ConfigHash)).to.equal(cxipErc721Address);
//      });
//
//      it('deploy chain2 equivalent on chain1', async function () {
//        let { erc721Config, erc721ConfigHash, erc721ConfigHashBytes } = await generateErc721Config(
//          chain2.network,
//          chain2.deployer.address,
//          'CxipERC721Proxy',
//          'CXIP ERC721 Collection (' + chain2.hre.networkName + ')',
//          'CXIP',
//          1000,
//          // AllEventsEnabled(),
//          ConfigureEvents([
//            HolographERC721Event.bridgeIn,
//            HolographERC721Event.bridgeOut,
//            HolographERC721Event.afterBurn,
//          ]),
//          generateInitCode(
//            ['bytes32', 'address', 'bytes'],
//            [
//              '0x' + chain2.web3.utils.asciiToHex('CxipERC721').substring(2).padStart(64, '0'),
//              chain2.registry.address,
//              generateInitCode(['address'], [chain2.deployer.address]),
//            ]
//          ),
//          chain2.salt
//        );
//
//        let cxipErc721Address = await chain1.registry.getHolographedHashAddress(erc721ConfigHash);
//
//        expect(cxipErc721Address).to.equal(zeroAddress);
//
//        cxipErc721Address = await chain2.registry.getHolographedHashAddress(erc721ConfigHash);
//
//        let sig = await chain2.deployer.signMessage(erc721ConfigHashBytes);
//        let signature: Signature = StrictECDSA({
//          r: '0x' + sig.substring(2, 66),
//          s: '0x' + sig.substring(66, 130),
//          v: '0x' + sig.substring(130, 132),
//        } as Signature);
//
//        let payload: BytesLike =
//          functionHash('deployIn(bytes)') +
//          generateInitCode(
//            ['bytes'],
//            [
//              generateInitCode(
//                ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
//                [
//                  [
//                    erc721Config.contractType,
//                    erc721Config.chainType,
//                    erc721Config.salt,
//                    erc721Config.byteCode,
//                    erc721Config.initCode,
//                  ],
//                  [signature.r, signature.s, signature.v],
//                  chain1.deployer.address,
//                ]
//              ),
//            ]
//          ).substring(2);
//
//        await expect(chain2.bridge.deployOut(chain1.network.holographId, erc721Config, signature, chain2.deployer.address))
//          .to.emit(chain2.mockLZEndpoint, 'LzEvent')
//          .withArgs(ChainId.hlg2lz(chain1.network.holographId), chain2.operator.address.toLowerCase(), payload);
//
//        await expect(
//          chain1.mockLZEndpoint
//            .connect(chain1.lzEndpoint)
//            .adminCall(
//              chain1.operator.address,
//              lzReceive(chain1.web3, [ChainId.hlg2lz(chain2.network.holographId), chain2.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain1.operator, 'AvailableOperatorJob')
//          .withArgs(chain1.web3.utils.keccak256(payload as string), payload);
//
//        await expect(chain1.operator.executeJob(payload))
//          .to.emit(chain1.factory, 'BridgeableContractDeployed')
//          .withArgs(cxipErc721Address, erc721ConfigHash);
//
//        expect(await chain1.registry.getHolographedHashAddress(erc721ConfigHash)).to.equal(cxipErc721Address);
//      });
//    });
//  });
//
//  describe('CxipERC721', async function () {
//    describe('check current state', async function () {
//      it('chain1 should have a total supply of 0 on chain1', async function () {
//        expect(await chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address).totalSupply()).to.equal(0);
//      });
//
//      it('chain1 should have a total supply of 0 on chain2', async function () {
//        expect(await chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address).totalSupply()).to.equal(0);
//      });
//
//      it('chain2 should have a total supply of 0 on chain2', async function () {
//        expect(await chain2.cxipErc721Enforcer.attach(chain2.cxipErc721Holographer.address).totalSupply()).to.equal(0);
//      });
//
//      it('chain2 should have a total supply of 0 on chain1', async function () {
//        expect(await chain1.cxipErc721Enforcer.attach(chain2.cxipErc721Holographer.address).totalSupply()).to.equal(0);
//      });
//    });
//
//    describe('validate mint functionality', async function () {
//      it('chain1 should mint token #1 as #1 on chain1', async function () {
//        await expect(chain1.cxipErc721.attach(chain1.cxipErc721Holographer.address).cxipMint(firstNFTchain1, 1, tokenURIs[1]))
//          .to.emit(chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(zeroAddress, chain1.deployer.address, firstNFTchain1);
//
//        gasUsage['#1 mint on chain1'] = gasUsage['#1 mint on chain1'].add(await getGasUsage(chain1.hre));
//      });
//
//      it('chain1 should mint token #1 not as #1 on chain2', async function () {
//        await expect(chain2.cxipErc721.attach(chain1.cxipErc721Holographer.address).cxipMint(firstNFTchain1, 1, tokenURIs[1]))
//          .to.emit(chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(zeroAddress, chain1.deployer.address, firstNFTchain2);
//
//        gasUsage['#1 mint on chain2'] = gasUsage['#1 mint on chain2'].add(await getGasUsage(chain1.hre));
//      });
//
//      it('mint tokens #2 and #3 on chain1 and chain2', async function () {
//        await expect(chain1.cxipErc721.attach(chain1.cxipErc721Holographer.address).cxipMint(secondNFTchain1, 1, tokenURIs[2]))
//          .to.emit(chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(zeroAddress, chain1.deployer.address, secondNFTchain1);
//
//        await expect(chain2.cxipErc721.attach(chain1.cxipErc721Holographer.address).cxipMint(secondNFTchain1, 1, tokenURIs[2]))
//          .to.emit(chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(zeroAddress, chain1.deployer.address, secondNFTchain2);
//
//        await expect(chain1.cxipErc721.attach(chain1.cxipErc721Holographer.address).cxipMint(thirdNFTchain1, 1, tokenURIs[3]))
//          .to.emit(chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(zeroAddress, chain1.deployer.address, thirdNFTchain1);
//
//        await expect(chain2.cxipErc721.attach(chain1.cxipErc721Holographer.address).cxipMint(thirdNFTchain1, 1, tokenURIs[3]))
//          .to.emit(chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(zeroAddress, chain1.deployer.address, thirdNFTchain2);
//      });
//    });
//
//    describe('validate bridge functionality', async function () {
//      it('token #3 bridge out on chain1 should succeed', async function () {
//        let payload: BytesLike = payloadThirdNFTchain1;
//
//        await expect(
//          chain1.bridge.erc721out(
//            chain2.network.holographId,
//            chain1.cxipErc721Holographer.address,
//            chain1.deployer.address,
//            chain2.deployer.address,
//            thirdNFTchain1
//          )
//        )
//          .to.emit(chain1.mockLZEndpoint, 'LzEvent')
//          .withArgs(ChainId.hlg2lz(chain2.network.holographId), chain1.operator.address.toLowerCase(), payload);
//
//        gasUsage['#3 bridge from chain1'] = gasUsage['#3 bridge from chain1'].add(await getGasUsage(chain1.hre));
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        gasUsage['#3 bridge from chain1'] = gasUsage['#3 bridge from chain1'].add(await getGasUsage(chain2.hre));
//
//        await expect(
//          chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address).ownerOf(thirdNFTchain1)
//        ).to.be.revertedWith('ERC721: token does not exist');
//      });
//
//      it('token #3 bridge out on chain2 should succeed', async function () {
//        let payload: BytesLike = payloadThirdNFTchain2;
//
//        await expect(
//          chain2.bridge.erc721out(
//            chain1.network.holographId,
//            chain1.cxipErc721Holographer.address,
//            chain2.deployer.address,
//            chain1.deployer.address,
//            thirdNFTchain2
//          )
//        )
//          .to.emit(chain2.mockLZEndpoint, 'LzEvent')
//          .withArgs(ChainId.hlg2lz(chain1.network.holographId), chain2.operator.address.toLowerCase(), payload);
//
//        gasUsage['#3 bridge from chain2'] = gasUsage['#3 bridge from chain2'].add(await getGasUsage(chain2.hre));
//
//        await expect(
//          chain1.mockLZEndpoint
//            .connect(chain1.lzEndpoint)
//            .adminCall(
//              chain1.operator.address,
//              lzReceive(chain1.web3, [ChainId.hlg2lz(chain2.network.holographId), chain2.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain1.operator, 'AvailableOperatorJob')
//          .withArgs(chain1.web3.utils.keccak256(payload as string), payload);
//
//        gasUsage['#3 bridge from chain2'] = gasUsage['#3 bridge from chain2'].add(await getGasUsage(chain1.hre));
//
//        await expect(
//          chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address).ownerOf(thirdNFTchain2)
//        ).to.be.revertedWith('ERC721: token does not exist');
//      });
//
//      it('token #3 bridge in on chain2 should succeed', async function () {
//        let payload: BytesLike = payloadThirdNFTchain1;
//
//        await expect(chain2.operator.executeJob(payload))
//          .to.emit(chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(zeroAddress, chain2.deployer.address, thirdNFTchain1.toHexString());
//
//        gasUsage['#3 bridge from chain1'] = gasUsage['#3 bridge from chain1'].add(await getGasUsage(chain2.hre));
//
//        expect(await chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address).ownerOf(thirdNFTchain1)).to.equal(
//          chain2.deployer.address
//        );
//      });
//
//      it('token #3 bridge in on chain1 should succeed', async function () {
//        let payload: BytesLike = payloadThirdNFTchain2;
//
//        await expect(chain1.operator.executeJob(payload))
//          .to.emit(chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(zeroAddress, chain1.deployer.address, thirdNFTchain2.toHexString());
//
//        gasUsage['#3 bridge from chain2'] = gasUsage['#3 bridge from chain2'].add(await getGasUsage(chain1.hre));
//
//        expect(await chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address).ownerOf(thirdNFTchain2)).to.equal(
//          chain1.deployer.address
//        );
//      });
//    });
//
//    describe('Get gas calculations', async function () {
//      it('SampleERC721 #1 mint on chain1', async function () {
//        process.stdout.write('          #1 mint on chain1 gas used: ' + gasUsage['#1 mint on chain1'].toString() + '\n');
//        assert(!gasUsage['#1 mint on chain1'].isZero(), 'zero sum returned');
//      });
//
//      it('SampleERC721 #1 mint on chain2', async function () {
//        process.stdout.write('          #1 mint on chain2 gas used: ' + gasUsage['#1 mint on chain2'].toString() + '\n');
//        assert(!gasUsage['#1 mint on chain2'].isZero(), 'zero sum returned');
//      });
//
//      it('SampleERC721 #1 transfer on chain1', async function () {
//        await expect(
//          chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address).transfer(chain1.wallet1.address, firstNFTchain1)
//        )
//          .to.emit(chain1.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(chain1.deployer.address, chain1.wallet1.address, firstNFTchain1);
//
//        process.stdout.write('          #1 transfer on chain1 gas used: ' + (await getGasUsage(chain1.hre)).toString() + '\n');
//      });
//
//      it('SampleERC721 #1 transfer on chain2', async function () {
//        await expect(
//          chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address).transfer(chain2.wallet1.address, firstNFTchain2)
//        )
//          .to.emit(chain2.cxipErc721Enforcer.attach(chain1.cxipErc721Holographer.address), 'Transfer')
//          .withArgs(chain2.deployer.address, chain2.wallet1.address, firstNFTchain2);
//
//        process.stdout.write('          #1 transfer on chain2 gas used: ' + (await getGasUsage(chain2.hre)).toString() + '\n');
//      });
//
//      it('SampleERC721 #3 bridge from chain1', async function () {
//        process.stdout.write(
//          '          #3 bridge from chain1 gas used: ' + gasUsage['#3 bridge from chain1'].toString() + '\n'
//        );
//        assert(!gasUsage['#3 bridge from chain1'].isZero(), 'zero sum returned');
//      });
//
//      it('SampleERC721 #3 bridge from chain2', async function () {
//        process.stdout.write(
//          '          #3 bridge from chain2 gas used: ' + gasUsage['#3 bridge from chain2'].toString() + '\n'
//        );
//        assert(!gasUsage['#3 bridge from chain2'].isZero(), 'zero sum returned');
//      });
//    });
//
//    describe('Calculate LayerZero gas usage', async function () {
//      it('chain1 erc721in cost 1', async function () {
//        let payload: BytesLike =
//          functionHash('erc721in(uint32,address,address,address,uint256,bytes)') +
//          generateInitCode(
//            ['uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
//            [
//              chain1.network.holographId,
//              chain1.cxipErc721Holographer.address,
//              chain1.deployer.address,
//              chain2.deployer.address,
//              firstNFTchain1.toHexString(),
//              generateInitCode(['uint8', 'string'], [1, tokenURIs[1]]),
//            ]
//          ).substring(2);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain1 erc721in cost 2', async function () {
//        let payload: BytesLike =
//          functionHash('erc721in(uint32,address,address,address,uint256,bytes)') +
//          generateInitCode(
//            ['uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
//            [
//              chain1.network.holographId,
//              chain1.cxipErc721Holographer.address,
//              chain1.deployer.address,
//              chain2.deployer.address,
//              secondNFTchain1.toHexString(),
//              generateInitCode(['uint8', 'string'], [1, tokenURIs[2]]),
//            ]
//          ).substring(2);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain1 erc721in cost 3', async function () {
//        let payload: BytesLike =
//          functionHash('erc721in(uint32,address,address,address,uint256,bytes)') +
//          generateInitCode(
//            ['uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
//            [
//              chain1.network.holographId,
//              chain1.cxipErc721Holographer.address,
//              chain1.deployer.address,
//              chain2.deployer.address,
//              thirdNFTchain1.toHexString(),
//              generateInitCode(['uint8', 'string'], [1, tokenURIs[3]]),
//            ]
//          ).substring(2);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain1 erc721in cost 4', async function () {
//        let payload: BytesLike =
//          functionHash('erc721in(uint32,address,address,address,uint256,bytes)') +
//          generateInitCode(
//            ['uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
//            [
//              chain1.network.holographId,
//              chain1.cxipErc721Holographer.address,
//              chain1.deployer.address,
//              chain2.deployer.address,
//              fourthNFTchain1.toHexString(),
//              generateInitCode(['uint8', 'string'], [1, tokenURIs[4]]),
//            ]
//          ).substring(2);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain1 erc721in cost 5', async function () {
//        let payload: BytesLike =
//          functionHash('erc721in(uint32,address,address,address,uint256,bytes)') +
//          generateInitCode(
//            ['uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
//            [
//              chain1.network.holographId,
//              chain1.cxipErc721Holographer.address,
//              chain1.deployer.address,
//              chain2.deployer.address,
//              fifthNFTchain1.toHexString(),
//              generateInitCode(['uint8', 'string'], [1, tokenURIs[5]]),
//            ]
//          ).substring(2);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain2 erc721in cost 1', async function () {
//        let payload: BytesLike = randomHex(4) + randomHex(32, false);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        process.stdout.write(
//          '\n' +
//            'Expecting ' +
//            (52000 + (((payload as string).length - 2) / 2) * 25).toString() +
//            ' of gas to be used' +
//            '\n'
//        );
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain2 erc721in cost 2', async function () {
//        let payload: BytesLike = randomHex(4) + randomHex(64, false);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        process.stdout.write(
//          '\n' +
//            'Expecting ' +
//            (52000 + (((payload as string).length - 2) / 2) * 25).toString() +
//            ' of gas to be used' +
//            '\n'
//        );
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain2 erc721in cost 3', async function () {
//        let payload: BytesLike = randomHex(4) + randomHex(128, false);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        process.stdout.write(
//          '\n' +
//            'Expecting ' +
//            (52000 + (((payload as string).length - 2) / 2) * 25).toString() +
//            ' of gas to be used' +
//            '\n'
//        );
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain2 erc721in cost 4', async function () {
//        let payload: BytesLike = randomHex(4) + randomHex(256, false);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        process.stdout.write(
//          '\n' +
//            'Expecting ' +
//            (52000 + (((payload as string).length - 2) / 2) * 25).toString() +
//            ' of gas to be used' +
//            '\n'
//        );
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//
//      it('chain2 erc721in cost 5', async function () {
//        let payload: BytesLike = randomHex(4) + randomHex(1024, false);
//
//        await expect(
//          chain2.mockLZEndpoint
//            .connect(chain2.lzEndpoint)
//            .adminCall(
//              chain2.operator.address,
//              lzReceive(chain2.web3, [ChainId.hlg2lz(chain1.network.holographId), chain1.operator.address, 0, payload])
//            )
//        )
//          .to.emit(chain2.operator, 'AvailableOperatorJob')
//          .withArgs(chain2.web3.utils.keccak256(payload as string), payload);
//
//        process.stdout.write(
//          '\n' +
//            'Expecting ' +
//            (52000 + (((payload as string).length - 2) / 2) * 25).toString() +
//            ' of gas to be used' +
//            '\n'
//        );
//        await getGasUsage(chain2.hre, 'erc721in available job', true);
//      });
//    });
//  });
//});
