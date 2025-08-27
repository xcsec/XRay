import { expect, assert } from 'chai';
import { PreTest } from './utils';
import setup from './utils';
import { BigNumber } from 'ethers';
import {
  Signature,
  StrictECDSA,
  zeroAddress,
  generateInitCode,
  generateErc20Config,
  generateErc721Config,
  getGasUsage,
} from '../scripts/utils/helpers';
import {
  HolographERC20Event,
  HolographERC721Event,
  HolographERC1155Event,
  ConfigureEvents,
} from '../scripts/utils/events';

import {
  Admin,
  CxipERC721,
  CxipERC721Proxy,
  ERC20Mock,
  Holograph,
  HolographBridge,
  HolographBridgeProxy,
  Holographer,
  HolographERC20,
  HolographERC721,
  HolographFactory,
  HolographFactoryProxy,
  HolographGenesis,
  HolographRegistry,
  HolographRegistryProxy,
  HToken,
  HolographInterfaces,
  MockERC721Receiver,
  Owner,
  HolographRoyalties,
  SampleERC20,
  SampleERC721,
} from '../typechain-types';
import { DeploymentConfigStruct } from '../typechain-types/HolographFactory';

describe('Testing cross-chain configurations (CHAIN1 & CHAIN2)', async function () {
  let chain1: PreTest;
  let chain2: PreTest;

  let gasUsage: {
    [key: string]: BigNumber;
  } = {};

  before(async function () {
    chain1 = await setup();
    chain2 = await setup(true);

    gasUsage['hToken deploy chain1 on chain2'] = BigNumber.from(0);
    gasUsage['hToken deploy chain2 on chain1'] = BigNumber.from(0);
    gasUsage['SampleERC20 deploy chain1 on chain2'] = BigNumber.from(0);
    gasUsage['SampleERC20 deploy chain2 on chain1'] = BigNumber.from(0);
    gasUsage['SampleERC721 deploy chain1 on chain2'] = BigNumber.from(0);
    gasUsage['SampleERC721 deploy chain2 on chain1'] = BigNumber.from(0);
    gasUsage['CxipERC721 deploy chain1 on chain2'] = BigNumber.from(0);
    gasUsage['CxipERC721 deploy chain2 on chain1'] = BigNumber.from(0);
  });

  after(async function () {});

  beforeEach(async function () {});

  afterEach(async function () {});

  describe('Validate cross-chain data', async function () {
    describe('CxipERC721', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.cxipErc721Proxy.address).to.not.equal(chain2.cxipErc721Proxy.address);
      });
    });

    describe('ERC20Mock', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.erc20Mock.address).to.equal(chain2.erc20Mock.address);
      });
    });

    describe('Holograph', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holograph.address).to.equal(chain2.holograph.address);
      });
    });

    describe('HolographBridge', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographBridge.address).to.equal(chain2.holographBridge.address);
      });
    });

    describe('HolographBridgeProxy', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographBridgeProxy.address).to.equal(chain2.holographBridgeProxy.address);
      });
    });

    describe('Holographer', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.holographer.address).to.not.equal(chain2.holographer.address);
      });
    });

    describe('HolographERC20', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographErc20.address).to.equal(chain2.holographErc20.address);
      });
    });

    describe('HolographERC721', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographErc721.address).to.equal(chain2.holographErc721.address);
      });
    });

    describe('HolographFactory', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographFactory.address).to.equal(chain2.holographFactory.address);
      });
    });

    describe('HolographFactoryProxy', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographFactoryProxy.address).to.equal(chain2.holographFactoryProxy.address);
      });
    });

    describe('HolographGenesis', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographGenesis.address).to.equal(chain2.holographGenesis.address);
      });
    });

    describe('HolographOperator', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographOperator.address).to.equal(chain2.holographOperator.address);
      });
    });

    describe('HolographOperatorProxy', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographOperatorProxy.address).to.equal(chain2.holographOperatorProxy.address);
      });
    });

    describe('HolographRegistry', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographRegistry.address).to.equal(chain2.holographRegistry.address);
      });
    });

    describe('HolographRegistryProxy', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographRegistryProxy.address).to.equal(chain2.holographRegistryProxy.address);
      });
    });

    describe('HolographTreasury', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographTreasury.address).to.equal(chain2.holographTreasury.address);
      });
    });

    describe('HolographTreasuryProxy', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographTreasuryProxy.address).to.equal(chain2.holographTreasuryProxy.address);
      });
    });

    describe('hToken', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.hToken.address).to.not.equal(chain2.hToken.address);
      });
    });

    describe('HolographInterfaces', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.holographInterfaces.address).to.equal(chain2.holographInterfaces.address);
      });
    });

    describe('MockERC721Receiver', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.mockErc721Receiver.address).to.equal(chain2.mockErc721Receiver.address);
      });
    });

    describe('HolographRoyalties', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.royalties.address).to.equal(chain2.royalties.address);
      });
    });

    describe('SampleERC20', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.sampleErc20.address).to.not.equal(chain2.sampleErc20.address);
      });
    });

    describe('SampleERC721', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.sampleErc721.address).to.not.equal(chain2.sampleErc721.address);
      });
    });

    describe('HolographRegistry', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.registry.address).to.equal(chain2.registry.address);
      });
    });

    describe('HolographFactory', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.factory.address).to.equal(chain2.factory.address);
      });
    });

    describe('HolographBridge', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.bridge.address).to.equal(chain2.bridge.address);
      });
    });

    describe('hToken Holographer', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.hTokenHolographer.address).to.not.equal(chain2.hTokenHolographer.address);
      });
    });

    describe('hToken HolographERC20 Enforcer', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.hTokenEnforcer.address).to.equal(chain2.hTokenEnforcer.address);
      });
    });

    describe('SampleERC20 Holographer', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.sampleErc20Holographer.address).to.not.equal(chain2.sampleErc20Holographer.address);
      });
    });

    describe('SampleERC20 HolographERC20 Enforcer', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.sampleErc20Enforcer.address).to.equal(chain2.sampleErc20Enforcer.address);
      });
    });

    describe('SampleERC721 Holographer', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.sampleErc721Holographer.address).to.not.equal(chain2.sampleErc721Holographer.address);
      });
    });

    describe('SampleERC721 HolographERC721 Enforcer', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.sampleErc721Enforcer.address).to.equal(chain2.sampleErc721Enforcer.address);
      });
    });

    describe('CxipERC721 Holographer', async function () {
      it('contract addresses should not match', async function () {
        expect(chain1.cxipErc721Holographer.address).to.not.equal(chain2.cxipErc721Holographer.address);
      });
    });

    describe('CxipERC721 HolographERC721 Enforcer', async function () {
      it('contract addresses should match', async function () {
        expect(chain1.cxipErc721Enforcer.address).to.equal(chain2.cxipErc721Enforcer.address);
      });
    });
  });

  describe('Deploy cross-chain contracts', async function () {
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

        await expect(chain2.factory.deployHolographableContract(erc20Config, signature, chain1.deployer.address))
          .to.emit(chain2.factory, 'BridgeableContractDeployed')
          .withArgs(hTokenErc20Address, erc20ConfigHash);

        gasUsage['hToken deploy chain1 on chain2'] = gasUsage['hToken deploy chain1 on chain2'].add(
          await getGasUsage(chain2.hre)
        );
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

        await expect(chain1.factory.deployHolographableContract(erc20Config, signature, chain2.deployer.address))
          .to.emit(chain1.factory, 'BridgeableContractDeployed')
          .withArgs(hTokenErc20Address, erc20ConfigHash);

        gasUsage['hToken deploy chain2 on chain1'] = gasUsage['hToken deploy chain2 on chain1'].add(
          await getGasUsage(chain1.hre)
        );
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

        await expect(chain2.factory.deployHolographableContract(erc20Config, signature, chain1.deployer.address))
          .to.emit(chain2.factory, 'BridgeableContractDeployed')
          .withArgs(sampleErc20Address, erc20ConfigHash);

        gasUsage['SampleERC20 deploy chain1 on chain2'] = gasUsage['SampleERC20 deploy chain1 on chain2'].add(
          await getGasUsage(chain2.hre)
        );
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

        await expect(chain1.factory.deployHolographableContract(erc20Config, signature, chain2.deployer.address))
          .to.emit(chain1.factory, 'BridgeableContractDeployed')
          .withArgs(sampleErc20Address, erc20ConfigHash);

        gasUsage['SampleERC20 deploy chain2 on chain1'] = gasUsage['SampleERC20 deploy chain2 on chain1'].add(
          await getGasUsage(chain1.hre)
        );
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
          generateInitCode(['address'], [chain1.deployer.address /*owner*/]),
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

        await expect(chain2.factory.deployHolographableContract(erc721Config, signature, chain1.deployer.address))
          .to.emit(chain2.factory, 'BridgeableContractDeployed')
          .withArgs(sampleErc721Address, erc721ConfigHash);

        gasUsage['SampleERC721 deploy chain1 on chain2'] = gasUsage['SampleERC721 deploy chain1 on chain2'].add(
          await getGasUsage(chain2.hre)
        );
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
          generateInitCode(['address'], [chain2.deployer.address /*owner*/]),
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

        await expect(chain1.factory.deployHolographableContract(erc721Config, signature, chain2.deployer.address))
          .to.emit(chain1.factory, 'BridgeableContractDeployed')
          .withArgs(sampleErc721Address, erc721ConfigHash);

        gasUsage['SampleERC721 deploy chain2 on chain1'] = gasUsage['SampleERC721 deploy chain2 on chain1'].add(
          await getGasUsage(chain1.hre)
        );
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

        await expect(chain2.factory.deployHolographableContract(erc721Config, signature, chain1.deployer.address))
          .to.emit(chain2.factory, 'BridgeableContractDeployed')
          .withArgs(cxipErc721Address, erc721ConfigHash);

        gasUsage['CxipERC721 deploy chain1 on chain2'] = gasUsage['CxipERC721 deploy chain1 on chain2'].add(
          await getGasUsage(chain2.hre)
        );
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

        await expect(chain1.factory.deployHolographableContract(erc721Config, signature, chain2.deployer.address))
          .to.emit(chain1.factory, 'BridgeableContractDeployed')
          .withArgs(cxipErc721Address, erc721ConfigHash);

        gasUsage['CxipERC721 deploy chain2 on chain1'] = gasUsage['CxipERC721 deploy chain2 on chain1'].add(
          await getGasUsage(chain1.hre)
        );
      });
    });
  });

  describe('Verify chain configs', async function () {
    describe('MessagingModule endpoints', async function () {
      it('should not be empty', async function () {
        expect(await chain1.operator.getMessagingModule()).to.not.equal(zeroAddress);

        expect(await chain2.operator.getMessagingModule()).to.not.equal(zeroAddress);
      });
      it('should be same address on both chains', async function () {
        expect(await chain1.operator.getMessagingModule()).to.equal(await chain2.operator.getMessagingModule());
      });
    });

    describe('Chain IDs', async function () {
      it('chain1 chain id should be correct', async function () {
        expect(await chain1.holograph.getHolographChainId()).to.equal(chain1.network.holographId);
      });

      it('chain2 chain id should be correct', async function () {
        expect(await chain2.holograph.getHolographChainId()).to.equal(chain2.network.holographId);
      });
    });
  });

  describe('Get gas calculations', async function () {
    it('hToken deploy chain1 on chain2', async function () {
      let name: string = 'hToken deploy chain1 on chain2';
      process.stdout.write('          ' + name + ': ' + gasUsage[name].toString() + '\n');
      assert(!gasUsage[name].isZero(), 'zero sum returned');
    });

    it('hToken deploy chain2 on chain1', async function () {
      let name: string = 'hToken deploy chain2 on chain1';
      process.stdout.write('          ' + name + ': ' + gasUsage[name].toString() + '\n');
      assert(!gasUsage[name].isZero(), 'zero sum returned');
    });

    it('SampleERC20 deploy chain1 on chain2', async function () {
      let name: string = 'SampleERC20 deploy chain1 on chain2';
      process.stdout.write('          ' + name + ': ' + gasUsage[name].toString() + '\n');
      assert(!gasUsage[name].isZero(), 'zero sum returned');
    });

    it('SampleERC20 deploy chain2 on chain1', async function () {
      let name: string = 'SampleERC20 deploy chain2 on chain1';
      process.stdout.write('          ' + name + ': ' + gasUsage[name].toString() + '\n');
      assert(!gasUsage[name].isZero(), 'zero sum returned');
    });

    it('SampleERC721 deploy chain1 on chain2', async function () {
      let name: string = 'SampleERC721 deploy chain1 on chain2';
      process.stdout.write('          ' + name + ': ' + gasUsage[name].toString() + '\n');
      assert(!gasUsage[name].isZero(), 'zero sum returned');
    });

    it('SampleERC721 deploy chain2 on chain1', async function () {
      let name: string = 'SampleERC721 deploy chain2 on chain1';
      process.stdout.write('          ' + name + ': ' + gasUsage[name].toString() + '\n');
      assert(!gasUsage[name].isZero(), 'zero sum returned');
    });

    it('CxipERC721 deploy chain1 on chain2', async function () {
      let name: string = 'CxipERC721 deploy chain1 on chain2';
      process.stdout.write('          ' + name + ': ' + gasUsage[name].toString() + '\n');
      assert(!gasUsage[name].isZero(), 'zero sum returned');
    });

    it('CxipERC721 deploy chain2 on chain1', async function () {
      let name: string = 'CxipERC721 deploy chain2 on chain1';
      process.stdout.write('          ' + name + ': ' + gasUsage[name].toString() + '\n');
      assert(!gasUsage[name].isZero(), 'zero sum returned');
    });
  });
});
