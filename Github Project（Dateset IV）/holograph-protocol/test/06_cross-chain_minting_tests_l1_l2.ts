import { expect, assert } from 'chai';
import { PreTest } from './utils';
import setup from './utils';
import { BytesLike, BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  Signature,
  StrictECDSA,
  zeroAddress,
  functionHash,
  hexToBytes,
  stringToHex,
  generateInitCode,
  generateErc20Config,
  generateErc721Config,
  getGasUsage,
  KeyOf,
  HASH,
} from '../scripts/utils/helpers';
import { HolographERC20Event, HolographERC721Event, ConfigureEvents } from '../scripts/utils/events';
import { HolographERC20 } from '../typechain-types';
import { GasParametersStructOutput } from '../typechain-types/LayerZeroModule';

const hValueTrim = function (inputPayload: string | BytesLike): BytesLike {
  let index = 2 + 4 * 2 + 32 * 2 * 5; // 0x + functionSig + data
  let payload: string = inputPayload as string;
  return payload.slice(0, index) + '00'.repeat(32) + payload.slice(index + 32 * 2, payload.length);
};

const BLOCKTIME: number = 60;
const GWEI: BigNumber = BigNumber.from('1000000000');
const TESTGASLIMIT: BigNumber = BigNumber.from('10000000');
const GASPRICE: BigNumber = BigNumber.from('1000000000');

function shuffleWallets(array: KeyOf<PreTest>[]) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

describe('Testing cross-chain minting (CHAIN1 & CHAIN2)', async function () {
  let chain1: PreTest;
  let chain2: PreTest;

  let HLGCHAIN1: HolographERC20;
  let HLGCHAIN2: HolographERC20;

  let gasParameters: GasParametersStructOutput;
  let msgBaseGas: BigNumber;
  let msgGasPerByte: BigNumber;
  let jobBaseGas: BigNumber;
  let jobGasPerByte: BigNumber;

  let wallets: KeyOf<PreTest>[];

  let pickOperator = function (chain: PreTest, target: string, opposite: boolean = false): SignerWithAddress {
    let operator: SignerWithAddress = chain.deployer;
    let targetOperator = target.toLowerCase();
    if (targetOperator != zeroAddress) {
      let wallet: SignerWithAddress;
      // shuffle
      shuffleWallets(wallets);
      for (let i = 0, l = wallets.length; i < l; i++) {
        wallet = chain[wallets[i]] as SignerWithAddress;
        if (
          (!opposite && wallet.address.toLowerCase() == targetOperator) ||
          (opposite && wallet.address.toLowerCase() != targetOperator)
        ) {
          operator = wallet;
          break;
        }
      }
    }
    return operator;
  };

  let getLzMsgGas = function (payload: string): BigNumber {
    return msgBaseGas.add(BigNumber.from(Math.floor((payload.length - 2) / 2)).mul(msgGasPerByte));
  };

  let getHlgMsgGas = function (gasLimit: BigNumber, payload: string): BigNumber {
    return gasLimit.add(jobBaseGas.add(BigNumber.from(Math.floor((payload.length - 2) / 2)).mul(jobGasPerByte)));
  };

  let getRequestPayload = async function (
    chain1: PreTest,
    chain2: PreTest,
    target: string | BytesLike,
    data: string | BytesLike
  ): Promise<BytesLike> {
    let payload: BytesLike = await chain1.bridge
      .connect(chain1.deployer)
      .callStatic.getBridgeOutRequestPayload(
        chain2.network.holographId,
        target as string,
        '0x' + 'ff'.repeat(32),
        '0x' + 'ff'.repeat(32),
        data as string
      );
    return payload;
  };

  let getEstimatedGas = async function (
    chain1: PreTest,
    chain2: PreTest,
    target: string | BytesLike,
    data: string | BytesLike,
    payload: string | BytesLike
  ): Promise<{
    payload: string;
    estimatedGas: BigNumber;
    fee: BigNumber;
    hlgFee: BigNumber;
    msgFee: BigNumber;
    dstGasPrice: BigNumber;
  }> {
    let estimatedGas: BigNumber = TESTGASLIMIT.sub(
      await chain2.operator.callStatic.jobEstimator(payload as string, {
        gasPrice: GASPRICE,
        gasLimit: TESTGASLIMIT,
      })
    );

    payload = await chain1.bridge
      .connect(chain1.deployer)
      .callStatic.getBridgeOutRequestPayload(
        chain2.network.holographId,
        target as string,
        estimatedGas,
        GWEI,
        data as string
      );

    let fees = await chain1.bridge.callStatic.getMessageFee(chain2.network.holographId, estimatedGas, GWEI, payload);
    let total: BigNumber = fees[0].add(fees[1]);
    estimatedGas = TESTGASLIMIT.sub(
      await chain2.operator.callStatic.jobEstimator(payload as string, {
        value: total,
        gasPrice: GASPRICE,
        gasLimit: TESTGASLIMIT,
      })
    );
    estimatedGas = getHlgMsgGas(estimatedGas, payload);
    return { payload, estimatedGas, fee: total, hlgFee: fees[0], msgFee: fees[1], dstGasPrice: fees[2] };
  };

  let totalNFTs: number = 2;
  let firstNFTchain1: BigNumber = BigNumber.from(1);
  let firstNFTchain2: BigNumber = BigNumber.from(1);
  let secondNFTchain1: BigNumber = BigNumber.from(2);
  let secondNFTchain2: BigNumber = BigNumber.from(2);
  let thirdNFTchain1: BigNumber = BigNumber.from(3);
  let thirdNFTchain2: BigNumber = BigNumber.from(3);

  let payloadThirdNFTchain1: BytesLike;
  let payloadThirdNFTchain2: BytesLike;

  let contractName: string = 'Sample ERC721 Contract ';
  let contractSymbol: string = 'SMPLR';
  const contractBps: number = 1000;
  const contractImage: string = '';
  const contractExternalLink: string = '';
  const tokenURIs: string[] = [
    'undefined',
    'https://holograph.xyz/sample1.json',
    'https://holograph.xyz/sample2.json',
    'https://holograph.xyz/sample3.json',
  ];
  // let chain1ContractName = contractName + '(' + chain1.hre.networkName + ')';
  // let chain2ContractName = contractName + '(' + chain2.hre.networkName + ')';
  let gasUsage: {
    [key: string]: BigNumber;
  } = {};

  before(async function () {
    chain1 = await setup();
    chain2 = await setup(true);

    gasParameters = await chain1.lzModule.getGasParameters(chain1.network.holographId);

    msgBaseGas = gasParameters.msgBaseGas;
    msgGasPerByte = gasParameters.msgGasPerByte;
    jobBaseGas = gasParameters.jobBaseGas;
    jobGasPerByte = gasParameters.jobGasPerByte;

    HLGCHAIN1 = await chain1.holographErc20.attach(chain1.utilityTokenHolographer.address);
    HLGCHAIN2 = await chain2.holographErc20.attach(chain2.utilityTokenHolographer.address);

    wallets = [
      'wallet1',
      'wallet2',
      'wallet3',
      'wallet4',
      'wallet5',
      'wallet6',
      'wallet7',
      'wallet8',
      'wallet9',
      'wallet10',
    ];

    firstNFTchain2 = BigNumber.from(
      '0x' + chain2.network.holographId.toString(16).padStart(8, '0') + '00'.repeat(28)
    ).add(firstNFTchain1);
    secondNFTchain2 = BigNumber.from(
      '0x' + chain2.network.holographId.toString(16).padStart(8, '0') + '00'.repeat(28)
    ).add(secondNFTchain1);
    thirdNFTchain2 = BigNumber.from(
      '0x' + chain2.network.holographId.toString(16).padStart(8, '0') + '00'.repeat(28)
    ).add(thirdNFTchain1);

    gasUsage['#3 bridge from chain1'] = BigNumber.from(0);
    gasUsage['#3 bridge from chain2'] = BigNumber.from(0);
    gasUsage['#1 mint on chain1'] = BigNumber.from(0);
    gasUsage['#1 mint on chain2'] = BigNumber.from(0);

    payloadThirdNFTchain1 =
      functionHash('bridgeInRequest(uint256,uint32,address,address,address,uint256,bytes)') +
      generateInitCode(
        ['uint256', 'uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
        [
          0, // nonce
          chain1.network.holographId, // fromChain
          chain1.sampleErc721Holographer.address, // holographableContract
          chain1.hTokenHolographer.address, // hToken
          zeroAddress, // hTokenRecipient
          0, // hTokenValue
          generateInitCode(
            ['address', 'address', 'uint256', 'bytes'],
            [
              chain1.deployer.address, // from
              chain2.deployer.address, // to
              thirdNFTchain1.toHexString(), // tokenId
              generateInitCode(['bytes'], [hexToBytes(stringToHex(tokenURIs[3]))]), // data
            ]
          ), // data
        ]
      ).substring(2);

    payloadThirdNFTchain2 =
      functionHash('erc721in(uint32,address,address,address,uint256,bytes)') +
      generateInitCode(
        ['uint32', 'address', 'address', 'address', 'uint256', 'bytes'],
        [
          chain2.network.holographId,
          chain1.sampleErc721Holographer.address,
          chain2.deployer.address,
          chain1.deployer.address,
          thirdNFTchain2.toHexString(),
          generateInitCode(['bytes'], [hexToBytes(stringToHex(tokenURIs[3]))]),
        ]
      ).substring(2);

    // we need to balance wallets from chain1 and chain2
    let noncechain1 = await chain1.deployer.getTransactionCount();
    let noncechain2 = await chain2.deployer.getTransactionCount();
    let target = Math.max(noncechain1, noncechain2) - Math.min(noncechain1, noncechain2);
    let balancer = noncechain1 > noncechain2 ? chain2.deployer : chain1.deployer;
    for (let i = 0; i < target; i++) {
      let tx = await balancer.sendTransaction({
        to: balancer.address,
        value: '0x0000000000000000000000000000000000000000000000000000000000000000',
      });
      await tx.wait();
    }
  });

  after(async function () {});

  beforeEach(async function () {});

  afterEach(async function () {});

  describe('Enable operators for chain1 and chain2', async function () {
    it('should add 10 operator wallets for each chain', async function () {
      let bondAmounts: BigNumber[] = await chain1.operator.getPodBondAmounts(1);
      let bondAmount: BigNumber = bondAmounts[0];
      process.stdout.write('\n' + ' '.repeat(6) + 'bondAmount: ' + bondAmount.toString() + '\n');
      //      process.stdout.write('\n' + 'currentBalance chain1: ' + (await HLGCHAIN1.connect(chain1.deployer).balanceOf(chain1.deployer.address)).toString());
      //      process.stdout.write('\n' + 'currentBalance chain2: ' + (await HLGCHAIN2.connect(chain2.deployer).balanceOf(chain2.deployer.address)).toString() + '\n');
      for (let i = 0, l = wallets.length; i < l; i++) {
        let chain1wallet: SignerWithAddress = chain1[wallets[i]] as SignerWithAddress;
        let chain2wallet: SignerWithAddress = chain2[wallets[i]] as SignerWithAddress;
        //        process.stdout.write('working on wallet: ' + chain1wallet.address + '\n');
        await HLGCHAIN1.connect(chain1.deployer).transfer(chain1wallet.address, bondAmount);
        await HLGCHAIN1.connect(chain1wallet).approve(chain1.operator.address, bondAmount);
        await expect(chain1.operator.connect(chain1wallet).bondUtilityToken(chain1wallet.address, bondAmount, 1)).to.not
          .be.reverted;
        await HLGCHAIN2.connect(chain2.deployer).transfer(chain2wallet.address, bondAmount);
        await HLGCHAIN2.connect(chain2wallet).approve(chain2.operator.address, bondAmount);
        await expect(chain2.operator.connect(chain2wallet).bondUtilityToken(chain2wallet.address, bondAmount, 1)).to.not
          .be.reverted;
        //        process.stdout.write('finished wallet: ' + chain2wallet.address + '\n');
      }
    });
  });

  describe('Deploy cross-chain contracts via bridge deploy', async function () {
    describe('hToken', async function () {
      it('deploy chain1 equivalent on chain2', async function () {
        let { erc20Config, erc20ConfigHash, erc20ConfigHashBytes } = await generateErc20Config(
          chain1.network,
          chain1.deployer.address,
          'hToken',
          chain1.network.tokenName + ' (Holographed #' + chain1.network.holographId.toString() + ')',
          'h' + chain1.network.tokenSymbol,
          chain1.network.tokenName + ' (Holographed #' + chain1.network.holographId.toString() + ')',
          '1',
          18,
          ConfigureEvents([]),
          generateInitCode(['address', 'uint16'], [chain1.deployer.address, 0]),
          chain1.salt
        );

        let hTokenErc20Address = await chain2.registry.getHolographedHashAddress(erc20ConfigHash);

        expect(hTokenErc20Address).to.equal(zeroAddress);

        hTokenErc20Address = await chain1.registry.getHolographedHashAddress(erc20ConfigHash);

        let sig = await chain1.deployer.signMessage(erc20ConfigHashBytes);
        let signature: Signature = StrictECDSA({
          r: '0x' + sig.substring(2, 66),
          s: '0x' + sig.substring(66, 130),
          v: '0x' + sig.substring(130, 132),
        } as Signature);

        let data: BytesLike = generateInitCode(
          ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
          [
            [
              erc20Config.contractType,
              erc20Config.chainType,
              erc20Config.salt,
              erc20Config.byteCode,
              erc20Config.initCode,
            ],
            [signature.r, signature.s, signature.v],
            chain1.deployer.address,
          ]
        );

        let originalMessagingModule = await chain2.operator.getMessagingModule();
        let payload: BytesLike = hValueTrim(await getRequestPayload(chain1, chain2, chain1.factory.address, data));
        let gasEstimates = await getEstimatedGas(chain1, chain2, chain1.factory.address, data, payload);
        payload = hValueTrim(gasEstimates.payload);
        let payloadHash: string = HASH(payload);
        // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
        await chain2.operator.setMessagingModule(chain2.mockLZEndpoint.address);
        // make call with mockLZEndpoint AS messaging module
        await chain2.mockLZEndpoint.crossChainMessage(chain2.operator.address, getLzMsgGas(String(payload)), payload, {
          gasLimit: TESTGASLIMIT,
        });
        // return messaging module back to original address
        await chain2.operator.setMessagingModule(originalMessagingModule);
        let operatorJob = await chain2.operator.getJobDetails(payloadHash);
        let operator = (operatorJob[2] as string).toLowerCase();
        // execute job to leave operator bonded
        await expect(
          chain2.operator
            .connect(pickOperator(chain2, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
        )
          .to.emit(chain2.factory, 'BridgeableContractDeployed')
          .withArgs(hTokenErc20Address, erc20ConfigHash);
        expect(await chain2.registry.getHolographedHashAddress(erc20ConfigHash)).to.equal(hTokenErc20Address);
      });

      it('deploy chain2 equivalent on chain1', async function () {
        let { erc20Config, erc20ConfigHash, erc20ConfigHashBytes } = await generateErc20Config(
          chain2.network,
          chain2.deployer.address,
          'hToken',
          chain2.network.tokenName + ' (Holographed #' + chain2.network.holographId.toString() + ')',
          'h' + chain2.network.tokenSymbol,
          chain2.network.tokenName + ' (Holographed #' + chain2.network.holographId.toString() + ')',
          '1',
          18,
          ConfigureEvents([]),
          generateInitCode(['address', 'uint16'], [chain2.deployer.address, 0]),
          chain2.salt
        );

        let hTokenErc20Address = await chain1.registry.getHolographedHashAddress(erc20ConfigHash);

        expect(hTokenErc20Address).to.equal(zeroAddress);

        hTokenErc20Address = await chain2.registry.getHolographedHashAddress(erc20ConfigHash);

        let sig = await chain2.deployer.signMessage(erc20ConfigHashBytes);
        let signature: Signature = StrictECDSA({
          r: '0x' + sig.substring(2, 66),
          s: '0x' + sig.substring(66, 130),
          v: '0x' + sig.substring(130, 132),
        } as Signature);

        let data: BytesLike = generateInitCode(
          ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
          [
            [
              erc20Config.contractType,
              erc20Config.chainType,
              erc20Config.salt,
              erc20Config.byteCode,
              erc20Config.initCode,
            ],
            [signature.r, signature.s, signature.v],
            chain2.deployer.address,
          ]
        );

        let originalMessagingModule = await chain1.operator.getMessagingModule();
        let payload: BytesLike = hValueTrim(await getRequestPayload(chain2, chain1, chain2.factory.address, data));
        let gasEstimates = await getEstimatedGas(chain2, chain1, chain2.factory.address, data, payload);
        payload = hValueTrim(gasEstimates.payload);
        let payloadHash: string = HASH(payload);
        // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
        await chain1.operator.setMessagingModule(chain1.mockLZEndpoint.address);
        // make call with mockLZEndpoint AS messaging module
        await chain1.mockLZEndpoint.crossChainMessage(chain1.operator.address, getLzMsgGas(String(payload)), payload, {
          gasLimit: TESTGASLIMIT,
        });
        // return messaging module back to original address
        await chain1.operator.setMessagingModule(originalMessagingModule);
        let operatorJob = await chain1.operator.getJobDetails(payloadHash);
        let operator = (operatorJob[2] as string).toLowerCase();
        // execute job to leave operator bonded
        await expect(
          chain1.operator
            .connect(pickOperator(chain1, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
        )
          .to.emit(chain1.factory, 'BridgeableContractDeployed')
          .withArgs(hTokenErc20Address, erc20ConfigHash);
        expect(await chain1.registry.getHolographedHashAddress(erc20ConfigHash)).to.equal(hTokenErc20Address);
      });
    });

    describe('SampleERC20', async function () {
      it('deploy chain1 equivalent on chain2', async function () {
        let { erc20Config, erc20ConfigHash, erc20ConfigHashBytes } = await generateErc20Config(
          chain1.network,
          chain1.deployer.address,
          'SampleERC20',
          'Sample ERC20 Token (' + chain1.hre.networkName + ')',
          'SMPL',
          'Sample ERC20 Token',
          '1',
          18,
          ConfigureEvents([HolographERC20Event.bridgeIn, HolographERC20Event.bridgeOut]),
          generateInitCode(['address', 'uint16'], [chain1.deployer.address, 0]),
          chain1.salt
        );

        let sampleErc20Address = await chain2.registry.getHolographedHashAddress(erc20ConfigHash);

        expect(sampleErc20Address).to.equal(zeroAddress);

        sampleErc20Address = await chain1.registry.getHolographedHashAddress(erc20ConfigHash);

        let sig = await chain1.deployer.signMessage(erc20ConfigHashBytes);
        let signature: Signature = StrictECDSA({
          r: '0x' + sig.substring(2, 66),
          s: '0x' + sig.substring(66, 130),
          v: '0x' + sig.substring(130, 132),
        } as Signature);

        let data: BytesLike = generateInitCode(
          ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
          [
            [
              erc20Config.contractType,
              erc20Config.chainType,
              erc20Config.salt,
              erc20Config.byteCode,
              erc20Config.initCode,
            ],
            [signature.r, signature.s, signature.v],
            chain1.deployer.address,
          ]
        );

        let originalMessagingModule = await chain2.operator.getMessagingModule();
        let payload: BytesLike = await getRequestPayload(chain1, chain2, chain1.factory.address, data);
        let gasEstimates = await getEstimatedGas(chain1, chain2, chain1.factory.address, data, payload);
        payload = gasEstimates.payload;
        let payloadHash: string = HASH(payload);
        // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
        await chain2.operator.setMessagingModule(chain2.mockLZEndpoint.address);
        // make call with mockLZEndpoint AS messaging module
        await chain2.mockLZEndpoint.crossChainMessage(chain2.operator.address, getLzMsgGas(payload), payload, {
          gasLimit: TESTGASLIMIT,
        });
        // return messaging module back to original address
        await chain2.operator.setMessagingModule(originalMessagingModule);
        let operatorJob = await chain2.operator.getJobDetails(payloadHash);
        let operator = (operatorJob[2] as string).toLowerCase();
        // execute job to leave operator bonded
        await expect(
          chain2.operator
            .connect(pickOperator(chain2, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
        )
          .to.emit(chain2.factory, 'BridgeableContractDeployed')
          .withArgs(sampleErc20Address, erc20ConfigHash);
        expect(await chain2.registry.getHolographedHashAddress(erc20ConfigHash)).to.equal(sampleErc20Address);
      });

      it('deploy chain2 equivalent on chain1', async function () {
        let { erc20Config, erc20ConfigHash, erc20ConfigHashBytes } = await generateErc20Config(
          chain2.network,
          chain2.deployer.address,
          'SampleERC20',
          'Sample ERC20 Token (' + chain2.hre.networkName + ')',
          'SMPL',
          'Sample ERC20 Token',
          '1',
          18,
          ConfigureEvents([HolographERC20Event.bridgeIn, HolographERC20Event.bridgeOut]),
          generateInitCode(['address', 'uint16'], [chain1.deployer.address, 0]),
          chain2.salt
        );

        let sampleErc20Address = await chain1.registry.getHolographedHashAddress(erc20ConfigHash);

        expect(sampleErc20Address).to.equal(zeroAddress);

        sampleErc20Address = await chain2.registry.getHolographedHashAddress(erc20ConfigHash);

        let sig = await chain2.deployer.signMessage(erc20ConfigHashBytes);
        let signature: Signature = StrictECDSA({
          r: '0x' + sig.substring(2, 66),
          s: '0x' + sig.substring(66, 130),
          v: '0x' + sig.substring(130, 132),
        } as Signature);

        let data: BytesLike = generateInitCode(
          ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
          [
            [
              erc20Config.contractType,
              erc20Config.chainType,
              erc20Config.salt,
              erc20Config.byteCode,
              erc20Config.initCode,
            ],
            [signature.r, signature.s, signature.v],
            chain2.deployer.address,
          ]
        );

        let originalMessagingModule = await chain1.operator.getMessagingModule();
        let payload: BytesLike = await getRequestPayload(chain2, chain1, chain2.factory.address, data);
        let gasEstimates = await getEstimatedGas(chain2, chain1, chain2.factory.address, data, payload);
        payload = gasEstimates.payload;
        let payloadHash: string = HASH(payload);
        // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
        await chain1.operator.setMessagingModule(chain1.mockLZEndpoint.address);
        // make call with mockLZEndpoint AS messaging module
        await chain1.mockLZEndpoint.crossChainMessage(chain1.operator.address, getLzMsgGas(payload), payload, {
          gasLimit: TESTGASLIMIT,
        });
        // return messaging module back to original address
        await chain1.operator.setMessagingModule(originalMessagingModule);
        let operatorJob = await chain1.operator.getJobDetails(payloadHash);
        let operator = (operatorJob[2] as string).toLowerCase();
        // execute job to leave operator bonded
        await expect(
          chain1.operator
            .connect(pickOperator(chain1, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
        )
          .to.emit(chain1.factory, 'BridgeableContractDeployed')
          .withArgs(sampleErc20Address, erc20ConfigHash);
        expect(await chain1.registry.getHolographedHashAddress(erc20ConfigHash)).to.equal(sampleErc20Address);
      });
    });

    describe('SampleERC721', async function () {
      it('deploy chain1 equivalent on chain2', async function () {
        let { erc721Config, erc721ConfigHash, erc721ConfigHashBytes } = await generateErc721Config(
          chain1.network,
          chain1.deployer.address,
          'SampleERC721',
          'Sample ERC721 Contract (' + chain1.hre.networkName + ')',
          'SMPLR',
          1000,
          ConfigureEvents([
            HolographERC721Event.bridgeIn,
            HolographERC721Event.bridgeOut,
            HolographERC721Event.afterBurn,
          ]),
          generateInitCode(['address'], [chain1.deployer.address]),
          chain1.salt
        );

        let sampleErc721Address = await chain2.registry.getHolographedHashAddress(erc721ConfigHash);

        expect(sampleErc721Address).to.equal(zeroAddress);

        sampleErc721Address = await chain1.registry.getHolographedHashAddress(erc721ConfigHash);

        let sig = await chain1.deployer.signMessage(erc721ConfigHashBytes);
        let signature: Signature = StrictECDSA({
          r: '0x' + sig.substring(2, 66),
          s: '0x' + sig.substring(66, 130),
          v: '0x' + sig.substring(130, 132),
        } as Signature);

        let data: BytesLike = generateInitCode(
          ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
          [
            [
              erc721Config.contractType,
              erc721Config.chainType,
              erc721Config.salt,
              erc721Config.byteCode,
              erc721Config.initCode,
            ],
            [signature.r, signature.s, signature.v],
            chain1.deployer.address,
          ]
        );

        let originalMessagingModule = await chain2.operator.getMessagingModule();
        let payload: BytesLike = await getRequestPayload(chain1, chain2, chain1.factory.address, data);
        let gasEstimates = await getEstimatedGas(chain1, chain2, chain1.factory.address, data, payload);
        payload = gasEstimates.payload;
        let payloadHash: string = HASH(payload);
        // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
        await chain2.operator.setMessagingModule(chain2.mockLZEndpoint.address);
        // make call with mockLZEndpoint AS messaging module
        await chain2.mockLZEndpoint.crossChainMessage(chain2.operator.address, getLzMsgGas(payload), payload, {
          gasLimit: TESTGASLIMIT,
        });
        // return messaging module back to original address
        await chain2.operator.setMessagingModule(originalMessagingModule);
        let operatorJob = await chain2.operator.getJobDetails(payloadHash);
        let operator = (operatorJob[2] as string).toLowerCase();
        // execute job to leave operator bonded
        await expect(
          chain2.operator
            .connect(pickOperator(chain2, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
        )
          .to.emit(chain2.factory, 'BridgeableContractDeployed')
          .withArgs(sampleErc721Address, erc721ConfigHash);
        expect(await chain2.registry.getHolographedHashAddress(erc721ConfigHash)).to.equal(sampleErc721Address);
      });

      it('deploy chain2 equivalent on chain1', async function () {
        let { erc721Config, erc721ConfigHash, erc721ConfigHashBytes } = await generateErc721Config(
          chain2.network,
          chain2.deployer.address,
          'SampleERC721',
          'Sample ERC721 Contract (' + chain2.hre.networkName + ')',
          'SMPLR',
          1000,
          ConfigureEvents([
            HolographERC721Event.bridgeIn,
            HolographERC721Event.bridgeOut,
            HolographERC721Event.afterBurn,
          ]),
          generateInitCode(['address'], [chain2.deployer.address]),
          chain2.salt
        );

        let sampleErc721Address = await chain1.registry.getHolographedHashAddress(erc721ConfigHash);

        expect(sampleErc721Address).to.equal(zeroAddress);

        sampleErc721Address = await chain2.registry.getHolographedHashAddress(erc721ConfigHash);

        let sig = await chain2.deployer.signMessage(erc721ConfigHashBytes);
        let signature: Signature = StrictECDSA({
          r: '0x' + sig.substring(2, 66),
          s: '0x' + sig.substring(66, 130),
          v: '0x' + sig.substring(130, 132),
        } as Signature);

        let data: BytesLike = generateInitCode(
          ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
          [
            [
              erc721Config.contractType,
              erc721Config.chainType,
              erc721Config.salt,
              erc721Config.byteCode,
              erc721Config.initCode,
            ],
            [signature.r, signature.s, signature.v],
            chain2.deployer.address,
          ]
        );

        let originalMessagingModule = await chain1.operator.getMessagingModule();
        let payload: BytesLike = await getRequestPayload(chain2, chain1, chain2.factory.address, data);
        let gasEstimates = await getEstimatedGas(chain2, chain1, chain2.factory.address, data, payload);
        payload = gasEstimates.payload;
        let payloadHash: string = HASH(payload);
        // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
        await chain1.operator.setMessagingModule(chain1.mockLZEndpoint.address);
        // make call with mockLZEndpoint AS messaging module
        await chain1.mockLZEndpoint.crossChainMessage(chain1.operator.address, getLzMsgGas(payload), payload, {
          gasLimit: TESTGASLIMIT,
        });
        // return messaging module back to original address
        await chain1.operator.setMessagingModule(originalMessagingModule);
        let operatorJob = await chain1.operator.getJobDetails(payloadHash);
        let operator = (operatorJob[2] as string).toLowerCase();
        // execute job to leave operator bonded
        await expect(
          chain1.operator
            .connect(pickOperator(chain1, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
        )
          .to.emit(chain1.factory, 'BridgeableContractDeployed')
          .withArgs(sampleErc721Address, erc721ConfigHash);
        expect(await chain1.registry.getHolographedHashAddress(erc721ConfigHash)).to.equal(sampleErc721Address);
      });
    });

    describe('CxipERC721', async function () {
      it('deploy chain1 equivalent on chain2', async function () {
        let { erc721Config, erc721ConfigHash, erc721ConfigHashBytes } = await generateErc721Config(
          chain1.network,
          chain1.deployer.address,
          'CxipERC721Proxy',
          'CXIP ERC721 Collection (' + chain1.hre.networkName + ')',
          'CXIP',
          1000,
          ConfigureEvents([
            HolographERC721Event.bridgeIn,
            HolographERC721Event.bridgeOut,
            HolographERC721Event.afterBurn,
          ]),
          generateInitCode(
            ['bytes32', 'address', 'bytes'],
            [
              '0x' + chain1.web3.utils.asciiToHex('CxipERC721').substring(2).padStart(64, '0'),
              chain1.registry.address,
              generateInitCode(['address'], [chain1.deployer.address]),
            ]
          ),
          chain1.salt
        );

        let cxipErc721Address = await chain2.registry.getHolographedHashAddress(erc721ConfigHash);

        expect(cxipErc721Address).to.equal(zeroAddress);

        cxipErc721Address = await chain1.registry.getHolographedHashAddress(erc721ConfigHash);

        let sig = await chain1.deployer.signMessage(erc721ConfigHashBytes);
        let signature: Signature = StrictECDSA({
          r: '0x' + sig.substring(2, 66),
          s: '0x' + sig.substring(66, 130),
          v: '0x' + sig.substring(130, 132),
        } as Signature);

        let data: BytesLike = generateInitCode(
          ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
          [
            [
              erc721Config.contractType,
              erc721Config.chainType,
              erc721Config.salt,
              erc721Config.byteCode,
              erc721Config.initCode,
            ],
            [signature.r, signature.s, signature.v],
            chain1.deployer.address,
          ]
        );

        let originalMessagingModule = await chain2.operator.getMessagingModule();
        let payload: BytesLike = await getRequestPayload(chain1, chain2, chain1.factory.address, data);
        let gasEstimates = await getEstimatedGas(chain1, chain2, chain1.factory.address, data, payload);
        payload = gasEstimates.payload;
        let payloadHash: string = HASH(payload);
        // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
        await chain2.operator.setMessagingModule(chain2.mockLZEndpoint.address);
        // make call with mockLZEndpoint AS messaging module
        await chain2.mockLZEndpoint.crossChainMessage(chain2.operator.address, getLzMsgGas(payload), payload, {
          gasLimit: TESTGASLIMIT,
        });
        // return messaging module back to original address
        await chain2.operator.setMessagingModule(originalMessagingModule);
        let operatorJob = await chain2.operator.getJobDetails(payloadHash);
        let operator = (operatorJob[2] as string).toLowerCase();
        // execute job to leave operator bonded
        await expect(
          chain2.operator
            .connect(pickOperator(chain2, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
        )
          .to.emit(chain2.factory, 'BridgeableContractDeployed')
          .withArgs(cxipErc721Address, erc721ConfigHash);
        expect(await chain2.registry.getHolographedHashAddress(erc721ConfigHash)).to.equal(cxipErc721Address);
      });

      it('deploy chain2 equivalent on chain1', async function () {
        let { erc721Config, erc721ConfigHash, erc721ConfigHashBytes } = await generateErc721Config(
          chain2.network,
          chain2.deployer.address,
          'CxipERC721Proxy',
          'CXIP ERC721 Collection (' + chain2.hre.networkName + ')',
          'CXIP',
          1000,
          ConfigureEvents([
            HolographERC721Event.bridgeIn,
            HolographERC721Event.bridgeOut,
            HolographERC721Event.afterBurn,
          ]),
          generateInitCode(
            ['bytes32', 'address', 'bytes'],
            [
              '0x' + chain2.web3.utils.asciiToHex('CxipERC721').substring(2).padStart(64, '0'),
              chain2.registry.address,
              generateInitCode(['address'], [chain2.deployer.address]),
            ]
          ),
          chain2.salt
        );

        let cxipErc721Address = await chain1.registry.getHolographedHashAddress(erc721ConfigHash);

        expect(cxipErc721Address).to.equal(zeroAddress);

        cxipErc721Address = await chain2.registry.getHolographedHashAddress(erc721ConfigHash);

        let sig = await chain2.deployer.signMessage(erc721ConfigHashBytes);
        let signature: Signature = StrictECDSA({
          r: '0x' + sig.substring(2, 66),
          s: '0x' + sig.substring(66, 130),
          v: '0x' + sig.substring(130, 132),
        } as Signature);

        let data: BytesLike = generateInitCode(
          ['tuple(bytes32,uint32,bytes32,bytes,bytes)', 'tuple(bytes32,bytes32,uint8)', 'address'],
          [
            [
              erc721Config.contractType,
              erc721Config.chainType,
              erc721Config.salt,
              erc721Config.byteCode,
              erc721Config.initCode,
            ],
            [signature.r, signature.s, signature.v],
            chain2.deployer.address,
          ]
        );

        let originalMessagingModule = await chain1.operator.getMessagingModule();
        let payload: BytesLike = await getRequestPayload(chain2, chain1, chain2.factory.address, data);
        let gasEstimates = await getEstimatedGas(chain2, chain1, chain2.factory.address, data, payload);
        payload = gasEstimates.payload;
        let payloadHash: string = HASH(payload);
        // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
        await chain1.operator.setMessagingModule(chain1.mockLZEndpoint.address);
        // make call with mockLZEndpoint AS messaging module
        await chain1.mockLZEndpoint.crossChainMessage(chain1.operator.address, getLzMsgGas(payload), payload, {
          gasLimit: TESTGASLIMIT,
        });
        // return messaging module back to original address
        await chain1.operator.setMessagingModule(originalMessagingModule);
        let operatorJob = await chain1.operator.getJobDetails(payloadHash);
        let operator = (operatorJob[2] as string).toLowerCase();
        // execute job to leave operator bonded
        await expect(
          chain1.operator
            .connect(pickOperator(chain1, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
        )
          .to.emit(chain1.factory, 'BridgeableContractDeployed')
          .withArgs(cxipErc721Address, erc721ConfigHash);
        expect(await chain1.registry.getHolographedHashAddress(erc721ConfigHash)).to.equal(cxipErc721Address);
      });
    });

    describe('SampleERC721', async function () {
      describe('check current state', async function () {
        it('chain1 should have a total supply of 0 on chain1', async function () {
          expect(
            await chain1.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address).totalSupply()
          ).to.equal(0);
        });

        it('chain1 should have a total supply of 0 on chain2', async function () {
          expect(
            await chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address).totalSupply()
          ).to.equal(0);
        });

        it('chain2 should have a total supply of 0 on chain2', async function () {
          expect(
            await chain2.sampleErc721Enforcer.attach(chain2.sampleErc721Holographer.address).totalSupply()
          ).to.equal(0);
        });

        it('chain2 should have a total supply of 0 on chain1', async function () {
          expect(
            await chain1.sampleErc721Enforcer.attach(chain2.sampleErc721Holographer.address).totalSupply()
          ).to.equal(0);
        });
      });

      describe('validate mint functionality', async function () {
        it('chain1 should mint token #1 as #1 on chain1', async function () {
          await expect(
            chain1.sampleErc721
              .attach(chain1.sampleErc721Holographer.address)
              .mint(chain1.deployer.address, firstNFTchain1, tokenURIs[1])
          )
            .to.emit(chain1.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain1.deployer.address, firstNFTchain1);

          gasUsage['#1 mint on chain1'] = gasUsage['#1 mint on chain1'].add(await getGasUsage(chain1.hre));
        });

        it('chain1 should mint token #1 not as #1 on chain2', async function () {
          await expect(
            chain2.sampleErc721
              .attach(chain1.sampleErc721Holographer.address)
              .mint(chain1.deployer.address, firstNFTchain1, tokenURIs[1])
          )
            .to.emit(chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain1.deployer.address, firstNFTchain2);

          gasUsage['#1 mint on chain2'] = gasUsage['#1 mint on chain2'].add(await getGasUsage(chain1.hre));
        });

        it('mint tokens #2 and #3 on chain1 and chain2', async function () {
          await expect(
            chain1.sampleErc721
              .attach(chain1.sampleErc721Holographer.address)
              .mint(chain1.deployer.address, secondNFTchain1, tokenURIs[2])
          )
            .to.emit(chain1.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain1.deployer.address, secondNFTchain1);

          await expect(
            chain2.sampleErc721
              .attach(chain1.sampleErc721Holographer.address)
              .mint(chain1.deployer.address, secondNFTchain1, tokenURIs[2])
          )
            .to.emit(chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain1.deployer.address, secondNFTchain2);

          await expect(
            chain1.sampleErc721
              .attach(chain1.sampleErc721Holographer.address)
              .mint(chain1.deployer.address, thirdNFTchain1, tokenURIs[3])
          )
            .to.emit(chain1.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain1.deployer.address, thirdNFTchain1);

          await expect(
            chain2.sampleErc721
              .attach(chain1.sampleErc721Holographer.address)
              .mint(chain1.deployer.address, thirdNFTchain1, tokenURIs[3])
          )
            .to.emit(chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain1.deployer.address, thirdNFTchain2);
        });
      });

      describe('validate bridge functionality', async function () {
        it('token #3 beaming from chain1 to chain2 should succeed', async function () {
          let data: BytesLike = generateInitCode(
            ['address', 'address', 'uint256'],
            [chain1.deployer.address, chain2.deployer.address, thirdNFTchain1.toHexString()]
          );

          let originalMessagingModule = await chain2.operator.getMessagingModule();
          let payload: BytesLike = await getRequestPayload(
            chain1,
            chain2,
            chain1.sampleErc721Holographer.address,
            data
          );
          let gasEstimates = await getEstimatedGas(
            chain1,
            chain2,
            chain1.sampleErc721Holographer.address,
            data,
            payload
          );
          payload = gasEstimates.payload;
          let payloadHash: string = HASH(payload);
          await chain1.bridge.bridgeOutRequest(
            chain2.network.holographId,
            chain1.sampleErc721Holographer.address,
            gasEstimates.estimatedGas,
            GWEI,
            data,
            { value: gasEstimates.fee }
          );
          // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
          await chain2.operator.setMessagingModule(chain2.mockLZEndpoint.address);
          // make call with mockLZEndpoint AS messaging module
          await chain2.mockLZEndpoint.crossChainMessage(chain2.operator.address, getLzMsgGas(payload), payload, {
            gasLimit: TESTGASLIMIT,
          });
          // return messaging module back to original address
          await chain2.operator.setMessagingModule(originalMessagingModule);
          let operatorJob = await chain2.operator.getJobDetails(payloadHash);
          let operator = (operatorJob[2] as string).toLowerCase();
          // execute job to leave operator bonded
          await expect(
            chain2.operator
              .connect(pickOperator(chain2, operator))
              .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
          )
            .to.emit(chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain2.deployer.address, thirdNFTchain1.toHexString());

          expect(
            await chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address).ownerOf(thirdNFTchain1)
          ).to.equal(chain2.deployer.address);
        });

        it('token #3 beaming from chain2 to chain1 should succeed', async function () {
          let data: BytesLike = generateInitCode(
            ['address', 'address', 'uint256'],
            [chain2.deployer.address, chain1.deployer.address, thirdNFTchain2.toHexString()]
          );

          let originalMessagingModule = await chain1.operator.getMessagingModule();
          let payload: BytesLike = await getRequestPayload(
            chain2,
            chain1,
            chain1.sampleErc721Holographer.address,
            data
          );
          let gasEstimates = await getEstimatedGas(
            chain2,
            chain1,
            chain1.sampleErc721Holographer.address,
            data,
            payload
          );
          payload = gasEstimates.payload;
          let payloadHash: string = HASH(payload);
          await chain2.bridge.bridgeOutRequest(
            chain1.network.holographId,
            chain1.sampleErc721Holographer.address,
            gasEstimates.estimatedGas,
            GWEI,
            data,
            { value: gasEstimates.fee }
          );
          // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
          await chain1.operator.setMessagingModule(chain1.mockLZEndpoint.address);
          // make call with mockLZEndpoint AS messaging module
          await chain1.mockLZEndpoint.crossChainMessage(chain1.operator.address, getLzMsgGas(payload), payload, {
            gasLimit: TESTGASLIMIT,
          });
          // return messaging module back to original address
          await chain1.operator.setMessagingModule(originalMessagingModule);
          let operatorJob = await chain1.operator.getJobDetails(payloadHash);
          let operator = (operatorJob[2] as string).toLowerCase();
          // execute job to leave operator bonded
          await expect(
            chain1.operator
              .connect(pickOperator(chain1, operator))
              .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
          )
            .to.emit(chain1.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain1.deployer.address, thirdNFTchain2.toHexString());

          expect(
            await chain1.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address).ownerOf(thirdNFTchain2)
          ).to.equal(chain1.deployer.address);
        });

        it('token #3 beaming from chain1 to chain2 should fail and recover', async function () {
          let data: BytesLike = generateInitCode(
            ['address', 'address', 'uint256'],
            [chain1.deployer.address, chain2.deployer.address, thirdNFTchain2.toHexString()]
          );

          let originalMessagingModule = await chain2.operator.getMessagingModule();
          let payload: BytesLike = await getRequestPayload(
            chain1,
            chain2,
            chain1.sampleErc721Holographer.address,
            data
          );
          let gasEstimates = await getEstimatedGas(
            chain1,
            chain2,
            chain1.sampleErc721Holographer.address,
            data,
            payload
          );
          payload = gasEstimates.payload;
          let payloadHash: string = HASH(payload);
          let originalGas: BigNumber = BigNumber.from(gasEstimates.estimatedGas);
          // purposefully setting lower gas limit to make job revert with `out of gas` error
          let badLowGas: BigNumber = originalGas.div(BigNumber.from('10'));
          let bridgeTx = await chain1.bridge.bridgeOutRequest(
            chain2.network.holographId,
            chain1.sampleErc721Holographer.address,
            badLowGas,
            GWEI,
            data,
            { value: gasEstimates.fee }
          );
          let bridgeReceipt = await bridgeTx.wait();
          // LzEvent
          for (const log of bridgeReceipt.logs) {
            if (log.address == chain1.mockLZEndpoint.address) {
              let l = chain1.mockLZEndpoint.interface.parseLog({ data: log.data, topics: log.topics });
              if (l.name == 'LzEvent') {
                payload = l.args[2];
                payloadHash = HASH(payload);
                break;
              }
            }
          }
          // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
          await chain2.operator.setMessagingModule(chain2.mockLZEndpoint.address);
          // make call with mockLZEndpoint AS messaging module
          await chain2.mockLZEndpoint.crossChainMessage(
            chain2.operator.address,
            getLzMsgGas(String(payload)),
            payload,
            {
              gasLimit: TESTGASLIMIT,
            }
          );
          // return messaging module back to original address
          await chain2.operator.setMessagingModule(originalMessagingModule);
          let operatorJob = await chain2.operator.getJobDetails(payloadHash);
          let operator = (operatorJob[2] as string).toLowerCase();
          // execute job to leave operator bonded
          await expect(
            chain2.operator
              .connect(pickOperator(chain2, operator))
              .executeJob(payload, { gasLimit: gasEstimates.estimatedGas })
          )
            .to.emit(chain2.operator, 'FailedOperatorJob')
            .withArgs(payloadHash);
          // recover the job
          await expect(chain2.operator.recoverJob(payload, { gasLimit: gasEstimates.estimatedGas }))
            .to.emit(chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
            .withArgs(zeroAddress, chain2.deployer.address, thirdNFTchain2.toHexString());

          expect(
            await chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address).ownerOf(thirdNFTchain2)
          ).to.equal(chain2.deployer.address);
        });

        it('token #2 beaming from chain1 to chain2 should keep TokenURI', async function () {
          const tokenURIBefore = await chain1.sampleErc721
            .attach(chain1.sampleErc721Holographer.address)
            .tokenURI(secondNFTchain1);

          let data: BytesLike = generateInitCode(
            ['address', 'address', 'uint256'],
            [chain1.deployer.address, chain2.deployer.address, secondNFTchain1.toHexString()]
          );

          let originalMessagingModule = await chain2.operator.getMessagingModule();
          let payload: BytesLike = await getRequestPayload(
            chain1,
            chain2,
            chain1.sampleErc721Holographer.address,
            data
          );
          let gasEstimates = await getEstimatedGas(
            chain1,
            chain2,
            chain1.sampleErc721Holographer.address,
            data,
            payload
          );
          payload = gasEstimates.payload;
          let payloadHash: string = HASH(payload);

          await chain1.bridge.bridgeOutRequest(
            chain2.network.holographId,
            chain1.sampleErc721Holographer.address,
            gasEstimates.estimatedGas,
            GWEI,
            data,
            { value: gasEstimates.fee }
          );
          // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
          await chain2.operator.setMessagingModule(chain2.mockLZEndpoint.address);
          // make call with mockLZEndpoint AS messaging module
          await chain2.mockLZEndpoint.crossChainMessage(chain2.operator.address, getLzMsgGas(payload), payload, {
            gasLimit: TESTGASLIMIT,
          });
          // return messaging module back to original address
          await chain2.operator.setMessagingModule(originalMessagingModule);
          let operatorJob = await chain2.operator.getJobDetails(payloadHash);
          let operator = (operatorJob[2] as string).toLowerCase();
          // execute job to leave operator bonded

          await chain2.operator
            .connect(pickOperator(chain2, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas });

          const tokenURIAfter = await chain2.sampleErc721Enforcer
            .attach(chain1.sampleErc721Holographer.address)
            .tokenURI(secondNFTchain1);

          expect(tokenURIBefore).to.be.equal(tokenURIAfter);
        });

        it('token #2 beaming from chain2 to chain1 should keep TokenURI', async function () {
          const tokenURIBefore = await chain2.sampleErc721
            .attach(chain1.sampleErc721Holographer.address)
            .tokenURI(secondNFTchain2);

          let data: BytesLike = generateInitCode(
            ['address', 'address', 'uint256'],
            [chain2.deployer.address, chain1.deployer.address, secondNFTchain2.toHexString()]
          );

          let originalMessagingModule = await chain1.operator.getMessagingModule();
          let payload: BytesLike = await getRequestPayload(
            chain2,
            chain1,
            chain1.sampleErc721Holographer.address,
            data
          );
          let gasEstimates = await getEstimatedGas(
            chain2,
            chain1,
            chain1.sampleErc721Holographer.address,
            data,
            payload
          );
          payload = gasEstimates.payload;
          let payloadHash: string = HASH(payload);

          await chain2.bridge.bridgeOutRequest(
            chain1.network.holographId,
            chain1.sampleErc721Holographer.address,
            gasEstimates.estimatedGas,
            GWEI,
            data,
            { value: gasEstimates.fee }
          );
          // temporarily set MockLZEndpoint as messaging module, to allow for easy sending
          await chain1.operator.setMessagingModule(chain1.mockLZEndpoint.address);
          // make call with mockLZEndpoint AS messaging module
          await chain1.mockLZEndpoint.crossChainMessage(chain1.operator.address, getLzMsgGas(payload), payload, {
            gasLimit: TESTGASLIMIT,
          });
          // return messaging module back to original address
          await chain1.operator.setMessagingModule(originalMessagingModule);
          let operatorJob = await chain1.operator.getJobDetails(payloadHash);
          let operator = (operatorJob[2] as string).toLowerCase();
          // execute job to leave operator bonded

          await chain1.operator
            .connect(pickOperator(chain1, operator))
            .executeJob(payload, { gasLimit: gasEstimates.estimatedGas });

          const tokenURIAfter = await chain1.sampleErc721Enforcer
            .attach(chain1.sampleErc721Holographer.address)
            .tokenURI(secondNFTchain2);

          expect(tokenURIBefore).to.be.equal(tokenURIAfter);
        });

        /*

      it('bridge out token #3 bridge out on chain1 should fail', async function () {
        let payload: BytesLike = payloadThirdNFTchain1;

        await expect(
          chain1.bridge.erc721out(
            chain2.network.holographId,
            chain1.sampleErc721Holographer.address,
            chain1.deployer.address,
            chain2.deployer.address,
            thirdNFTchain1
          )
        ).to.be.revertedWith("HOLOGRAPH: token doesn't exist");
      });

      it('bridge out token #3 bridge out on chain2 should fail', async function () {
        let payload: BytesLike = payloadThirdNFTchain2;

        await expect(
          chain2.bridge.erc721out(
            chain1.network.holographId,
            chain1.sampleErc721Holographer.address,
            chain2.deployer.address,
            chain1.deployer.address,
            thirdNFTchain2
          )
        ).to.be.revertedWith("HOLOGRAPH: token doesn't exist");
      });

      it('bridged in token #3 bridge in on chain2 should fail', async function () {
        let payload: BytesLike = payloadThirdNFTchain1;

        await expect(chain2.operator.executeJob(payload)).to.be.revertedWith('HOLOGRAPH: invalid job');
      });

      it('bridged in token #3 bridge in on chain1 should fail', async function () {
        let payload: BytesLike = payloadThirdNFTchain2;

        await expect(chain1.operator.executeJob(payload)).to.be.revertedWith('HOLOGRAPH: invalid job');
      });
*/
      });
    });

    describe('Get gas calculations', async function () {
      it('SampleERC721 #1 mint on chain1', async function () {
        process.stdout.write(
          '          #1 mint on chain1 gas used: ' + gasUsage['#1 mint on chain1'].toString() + '\n'
        );
        assert(!gasUsage['#1 mint on chain1'].isZero(), 'zero sum returned');
      });

      it('SampleERC721 #1 mint on chain2', async function () {
        process.stdout.write(
          '          #1 mint on chain2 gas used: ' + gasUsage['#1 mint on chain2'].toString() + '\n'
        );
        assert(!gasUsage['#1 mint on chain2'].isZero(), 'zero sum returned');
      });

      it('SampleERC721 #1 transfer on chain1', async function () {
        await expect(
          chain1.sampleErc721Enforcer
            .attach(chain1.sampleErc721Holographer.address)
            .transfer(chain1.wallet1.address, firstNFTchain1)
        )
          .to.emit(chain1.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
          .withArgs(chain1.deployer.address, chain1.wallet1.address, firstNFTchain1);

        process.stdout.write(
          '          #1 transfer on chain1 gas used: ' + (await getGasUsage(chain1.hre)).toString() + '\n'
        );
      });

      it('SampleERC721 #1 transfer on chain2', async function () {
        await expect(
          chain2.sampleErc721Enforcer
            .attach(chain1.sampleErc721Holographer.address)
            .transfer(chain2.wallet1.address, firstNFTchain2)
        )
          .to.emit(chain2.sampleErc721Enforcer.attach(chain1.sampleErc721Holographer.address), 'Transfer')
          .withArgs(chain2.deployer.address, chain2.wallet1.address, firstNFTchain2);

        process.stdout.write(
          '          #1 transfer on chain2 gas used: ' + (await getGasUsage(chain2.hre)).toString() + '\n'
        );
      });
    });

    describe('Get hToken balances', async function () {
      it('chain1 hToken should have more than 0', async function () {
        let hToken = await chain1.holographErc20.attach(await chain1.registry.getHToken(chain1.network.holographId));
        let balance = await chain1.hre.ethers.provider.getBalance(hToken.address);
        process.stdout.write('          chain1 hToken balance is: ' + balance + '\n');
        assert(!balance.isZero(), 'zero sum returned');
      });

      it('chain2 hToken should have more than 0', async function () {
        let hToken = await chain2.holographErc20.attach(await chain2.registry.getHToken(chain2.network.holographId));
        let balance = await chain2.hre.ethers.provider.getBalance(hToken.address);
        process.stdout.write('          chain2 hToken balance is: ' + balance + '\n');
        assert(!balance.isZero(), 'zero sum returned');
      });
    });
  });
});
