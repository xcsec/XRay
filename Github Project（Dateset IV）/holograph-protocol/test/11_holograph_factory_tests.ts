import { generateRandomSalt, PreTest } from './utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import setup from './utils';
import {
  Signature,
  StrictECDSA,
  generateInitCode,
  generateErc20Config,
  generateErc721Config,
} from '../scripts/utils/helpers';
import { ALREADY_DEPLOYED_ERROR_MSG, INVALID_SIGNATURE_ERROR_MSG, ONLY_ADMIN_ERROR_MSG } from './utils/error_constants';
import { ConfigureEvents } from '../scripts/utils/events';

describe('Holograph Factory Contract', async () => {
  let chain1: PreTest;
  let chain2: PreTest;

  let Mock: any;
  let mock: any;
  let accounts: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let nonOwner: SignerWithAddress;
  let mockSigner: SignerWithAddress;
  let chainId: number;

  let configObj: any;
  let erc20Config: any;
  let erc20ConfigHash: string;
  let erc20ConfigHashBytes: any;
  let signature: Signature;

  before(async () => {
    chain1 = await setup();
    chain2 = await setup(true);
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    owner = accounts[1];
    nonOwner = accounts[2];

    chainId = (await ethers.provider.getNetwork()).chainId;

    Mock = await ethers.getContractFactory('Mock');
    mock = await Mock.deploy();
    await mock.deployed();

    mockSigner = await ethers.getSigner(mock.address);

    configObj = await generateErc20Config(
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

    erc20Config = configObj.erc20Config;
    erc20ConfigHash = configObj.erc20ConfigHash;
    erc20ConfigHashBytes = configObj.erc20ConfigHashBytes;

    let hTokenErc20Address = await chain1.registry.getHolographedHashAddress(erc20ConfigHash);
    hTokenErc20Address = await chain1.registry.getHolographedHashAddress(erc20ConfigHash);

    let sig = await chain1.deployer.signMessage(erc20ConfigHashBytes);
    signature = StrictECDSA({
      r: '0x' + sig.substring(2, 66),
      s: '0x' + sig.substring(66, 130),
      v: '0x' + sig.substring(130, 132),
    } as Signature);
  });

  describe('init():', async () => {
    // Contracts are initialized in the PreTest setup
    it('should fail if already initialized', async () => {
      const initCode = generateInitCode(
        ['address', 'address'],
        [chain1.holographFactory.address, chain1.holographRegistry.address]
      );
      await expect(chain1.holographFactory.connect(deployer).init(initCode)).to.be.revertedWith(
        'HOLOGRAPH: already initialized'
      );
    });
  });

  describe('deployHolographableContract()', async () => {
    it('should fail with invalid signature if config is incorrect', async () => {
      await expect(
        chain1.holographFactory.connect(deployer).deployHolographableContract(erc20Config, signature, owner.address)
      ).to.be.revertedWith(INVALID_SIGNATURE_ERROR_MSG);
    });

    it('should fail contract was already deployed', async () => {
      await expect(
        chain1.factory.deployHolographableContract(erc20Config, signature, chain1.deployer.address)
      ).to.be.revertedWith(ALREADY_DEPLOYED_ERROR_MSG);
    });

    it('should fail contract was already deployed', async () => {
      await expect(
        chain1.factory.deployHolographableContract(erc20Config, signature, chain1.deployer.address)
      ).to.be.revertedWith(ALREADY_DEPLOYED_ERROR_MSG);
    });

    it('should fail with invalid signature if signature.r is incorrect', async () => {
      signature.r = `0x${'00'.repeat(32)}`;
      await expect(
        chain1.holographFactory.connect(deployer).deployHolographableContract(erc20Config, signature, owner.address)
      ).to.be.revertedWith(INVALID_SIGNATURE_ERROR_MSG);
    });

    it('should fail with invalid signature if signature.s is incorrect', async () => {
      signature.s = `0x${'00'.repeat(32)}`;
      await expect(
        chain1.holographFactory.connect(deployer).deployHolographableContract(erc20Config, signature, owner.address)
      ).to.be.revertedWith(INVALID_SIGNATURE_ERROR_MSG);
    });

    it('should fail with invalid signature if signature.v is incorrect', async () => {
      signature.v = `0x${'00'.repeat(32)}`;
      await expect(
        chain1.holographFactory.connect(deployer).deployHolographableContract(erc20Config, signature, owner.address)
      ).to.be.revertedWith(INVALID_SIGNATURE_ERROR_MSG);
    });

    it('should fail with invalid signature if signer is incorrect', async () => {
      await expect(
        chain1.factory.deployHolographableContract(erc20Config, signature, nonOwner.address)
      ).to.be.revertedWith(INVALID_SIGNATURE_ERROR_MSG);
    });

    it('Should allow external contract to call fn');
    it('should fail to allow inherited contract to call fn');
  });

  describe(`bridgeIn()`, async () => {
    it('should return the expected selector from the input payload', async () => {
      let { erc721Config, erc721ConfigHashBytes } = await generateErc721Config(
        chain1.network,
        chain1.deployer.address,
        'SampleERC721',
        'Sample ERC721 Contract (' + chain1.hre.networkName + ')',
        'SMPLR',
        1000,
        generateRandomSalt(),
        generateInitCode(['address'], [chain1.deployer.address]),
        generateRandomSalt()
      );
      let sig = await chain1.deployer.signMessage(erc721ConfigHashBytes);
      signature = StrictECDSA({
        r: '0x' + sig.substring(2, 66),
        s: '0x' + sig.substring(66, 130),
        v: '0x' + sig.substring(130, 132),
      } as Signature);

      const payload = generateInitCode(
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
          deployer.address,
        ]
      );

      const selector = await chain1.factory.connect(deployer).callStatic.bridgeIn(chainId, payload);
      expect(selector).to.equal('0x08a1eb20');
    });

    it('should revert if payload data is invalid', async () => {
      let { erc721ConfigHashBytes } = await generateErc721Config(
        chain1.network,
        chain1.deployer.address,
        'SampleERC721',
        'Sample ERC721 Contract (' + chain1.hre.networkName + ')',
        'SMPLR',
        1000,
        generateRandomSalt(),
        generateInitCode(['address'], [chain1.deployer.address]),
        generateRandomSalt()
      );
      let sig = await chain1.deployer.signMessage(erc721ConfigHashBytes);
      signature = StrictECDSA({
        r: '0x' + sig.substring(2, 66),
        s: '0x' + sig.substring(66, 130),
        v: '0x' + sig.substring(130, 132),
      } as Signature);

      const payload = '0x' + '00'.repeat(32);

      await expect(chain1.factory.connect(deployer).bridgeIn(chainId, payload)).to.be.reverted;
    });
  });

  describe('bridgeOut()', async () => {
    it('should return selector and payload', async function () {
      let { erc721Config } = await generateErc721Config(
        chain1.network,
        chain1.deployer.address,
        'SampleERC721',
        'Sample ERC721 Contract (' + chain1.hre.networkName + ')',
        'SMPLR',
        1000,
        `0x${'00'.repeat(32)}`,
        generateInitCode(['address'], [chain1.deployer.address]),
        chain1.salt
      );
      let sig = await chain1.deployer.signMessage(erc20ConfigHashBytes);
      signature = StrictECDSA({
        r: '0x' + sig.substring(2, 66),
        s: '0x' + sig.substring(66, 130),
        v: '0x' + sig.substring(130, 132),
      } as Signature);

      const payload = generateInitCode(
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
          deployer.address,
        ]
      );

      const selector = await chain1.factory.connect(owner).bridgeOut(1, deployer.address, payload);
      expect(selector[0]).to.equal('0xb7e03661');
    });
  });

  describe('setHolograph() / getHolograph()', async () => {
    it('should allow admin to alter _holographSlot', async () => {
      await chain1.holographFactory.setHolograph(chain1.holograph.address);
      const _holographSlot = await chain1.holographFactory.getHolograph();
      expect(_holographSlot).to.equal(chain1.holograph.address);
    });

    it('should fail to allow owner to alter _holographSlot', async () => {
      await expect(chain1.holographFactory.connect(nonOwner).setHolograph(chain1.holograph.address)).to.be.revertedWith(
        ONLY_ADMIN_ERROR_MSG
      );
    });

    it('should fail to allow non-owner to alter _holographSlot', async () => {
      await expect(
        chain1.holographFactory.connect(nonOwner).setHolograph(chain1.holographRegistry.address)
      ).to.be.revertedWith(ONLY_ADMIN_ERROR_MSG);
    });
  });

  describe('setRegistry() / getRegistry()', async () => {
    it('should allow admin to alter _registrySlot', async () => {
      await chain1.holographFactory.setRegistry(chain1.holographRegistry.address);
      const _registrySlot = await chain1.holographFactory.getRegistry();
      expect(_registrySlot).to.equal(chain1.holographRegistry.address);
    });

    it('should fail to allow owner to alter _registrySlot', async () => {
      await expect(
        chain1.holographFactory.connect(nonOwner).setRegistry(chain1.holographRegistry.address)
      ).to.be.revertedWith(ONLY_ADMIN_ERROR_MSG);
    });

    it('should fail to allow non-owner to alter _registrySlot', async () => {
      await expect(
        chain1.holographFactory.connect(nonOwner).setRegistry(chain1.holographRegistry.address)
      ).to.be.revertedWith(ONLY_ADMIN_ERROR_MSG);
    });
  });

  describe.skip('_isContract()', async () => {
    it('should not be callable', async () => {
      // await expect(chain1.holographFactory._isContract()).to.be.throw;
    });
  });

  describe.skip('_verifySigner()', async () => {
    it('should not be callable');
  });

  describe(`receive()`, async () => {
    it('should revert', async () => {
      await expect(
        deployer.sendTransaction({
          to: chain1.holographFactory.address,
          value: 1,
        })
      ).to.be.reverted;
    });
  });

  describe(`fallback()`, async () => {
    it('should revert', async () => {
      await expect(
        deployer.sendTransaction({
          to: chain1.holographFactory.address,
        })
      ).to.be.reverted;
    });
  });
});
