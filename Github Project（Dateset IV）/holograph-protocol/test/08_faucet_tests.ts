import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { PreTest } from './utils';
import setup from './utils';
import { Faucet, HolographERC20 } from '../typechain-types';
import { generateInitCode } from '../scripts/utils/helpers';

describe('Testing the Holograph Faucet', async () => {
  let chain1: PreTest;

  let ERC20: HolographERC20;
  let FAUCET: Faucet;
  let FAUCET_PREFUND_AMOUNT: BigNumber;

  const DEFAULT_DRIP_AMOUNT = BigNumber.from('100000000000000000000'); // 100 eth
  const DEFAULT_DRIP_COOLDOWN = 24 * 60 * 60; // 24 hours in seconds
  const INITIAL_FAUCET_FUNDS = DEFAULT_DRIP_AMOUNT.mul(20); // enough for 10 drips
  let dripCount = 0;

  // Revert messages
  const INITIALIZED = 'Faucet contract is already initialized';
  const COME_BACK_LATER = 'Come back later';
  const NOT_AN_OWNER = 'Caller is not the owner';

  before(async function () {
    chain1 = await setup();

    ERC20 = await chain1.holographErc20.attach(await chain1.holograph.getUtilityToken());
    FAUCET = chain1.faucet;

    FAUCET_PREFUND_AMOUNT = await ERC20.balanceOf(FAUCET.address);
    await ERC20.transfer(FAUCET.address, INITIAL_FAUCET_FUNDS);
  });

  after(async () => {});

  beforeEach(async () => {});

  afterEach(async () => {});

  describe('Test Initializer', async function () {
    it('should fail initializing already initialized Faucet', async function () {
      await expect(
        FAUCET.init(generateInitCode(['address', 'address'], [chain1.deployer.address, ERC20.address]))
      ).to.be.revertedWith(INITIALIZED);
    });
  });

  describe('Default drip flow', async () => {
    // TODO: Add test to check for the `Faucet is empty` Error

    it('isAllowedToWithdraw(): User is allowed to withdraw for the first time', async function () {
      expect(await FAUCET.isAllowedToWithdraw(chain1.wallet1.address)).to.be.true;
    });

    it('requestTokens(): User can withdraw for the first time', async function () {
      await FAUCET.connect(chain1.wallet1).requestTokens();
      dripCount++;
      expect(await ERC20.balanceOf(chain1.wallet1.address)).to.equal(DEFAULT_DRIP_AMOUNT);
    });

    it('isAllowedToWithdraw(): User is not allowed to withdraw for the second time', async function () {
      expect(await FAUCET.isAllowedToWithdraw(chain1.wallet1.address)).to.be.false;
    });

    it('requestTokens(): User cannot withdraw for the second time', async function () {
      await expect(FAUCET.connect(chain1.wallet1).requestTokens()).to.be.revertedWith(COME_BACK_LATER);
    });
  });

  describe('Owner drip flow', async () => {
    // TODO: Add test to check for the `Faucet is empty` Error

    it('grantTokens(): Owner can grant tokens', async function () {
      await FAUCET['grantTokens(address)'](chain1.wallet1.address);
      dripCount++;
      expect(await ERC20.balanceOf(chain1.wallet1.address)).to.equal(DEFAULT_DRIP_AMOUNT.mul(2));
    });

    it('grantTokens(): Owner can grant tokens again with arbitrary amount', async function () {
      const factor = 2;
      await FAUCET['grantTokens(address,uint256)'](chain1.wallet1.address, DEFAULT_DRIP_AMOUNT.mul(factor));
      dripCount += factor;
      expect(await ERC20.balanceOf(chain1.wallet1.address)).to.equal(DEFAULT_DRIP_AMOUNT.mul(2 + factor));
    });

    it('grantTokens(): Non Owner should fail to grant tokens');

    it('grantTokens(): Should fail if contract has insufficient funds');
  });

  describe('Owner can adjust Withdraw Cooldown', async () => {
    it('isAllowedToWithdraw(): Owner is not allowed to withdraw', async function () {
      await FAUCET.requestTokens();
      expect(await FAUCET.isAllowedToWithdraw(chain1.deployer.address)).to.be.false;
      await ERC20.transfer(FAUCET.address, DEFAULT_DRIP_AMOUNT);
    });

    it('setWithdrawCooldown(): Owner adjusts Withdraw Cooldown to 0 seconds', async function () {
      await expect(FAUCET.setWithdrawCooldown(0)).to.not.be.reverted;
      expect(await FAUCET.faucetCooldown()).to.equal(0);
    });

    it('isAllowedToWithdraw(): Owner is allowed to withdraw', async function () {
      expect(await FAUCET.isAllowedToWithdraw(chain1.deployer.address)).to.be.true;
    });

    it('setWithdrawCooldown(): Owner adjusts Withdraw Cooldown back to 24 hours', async function () {
      await expect(FAUCET.setWithdrawCooldown(DEFAULT_DRIP_COOLDOWN)).to.not.be.reverted;
      expect(await FAUCET.faucetCooldown()).to.equal(DEFAULT_DRIP_COOLDOWN);
    });

    it('isAllowedToWithdraw(): Owner is not allowed to withdraw', async function () {
      expect(await FAUCET.isAllowedToWithdraw(chain1.deployer.address)).to.be.false;
    });

    it("setWithdrawCooldown(): User can't adjust Withdraw Cooldown", async function () {
      await expect(FAUCET.connect(chain1.wallet1).setWithdrawCooldown(0)).to.revertedWith(NOT_AN_OWNER);
    });
  });

  describe('Owner can adjust Withdraw Amount', async () => {
    const factor = 2;

    it('setWithdrawAmount(): Owner adjusts Withdraw Amount', async function () {
      await expect(FAUCET.setWithdrawAmount(DEFAULT_DRIP_AMOUNT.mul(factor))).to.not.be.reverted;
      expect(await FAUCET.faucetDripAmount()).to.equal(DEFAULT_DRIP_AMOUNT.mul(factor));
    });

    it('requestTokens(): User can withdraw increased amount', async function () {
      await FAUCET.connect(chain1.wallet2).requestTokens();
      dripCount += factor;
      expect(await ERC20.balanceOf(chain1.wallet2.address)).to.equal(DEFAULT_DRIP_AMOUNT.mul(factor));
    });

    it('setWithdrawAmount(): Owner adjusts Withdraw Amount back to 100 eth', async function () {
      await expect(FAUCET.setWithdrawAmount(DEFAULT_DRIP_AMOUNT)).to.not.be.reverted;
      expect(await FAUCET.faucetDripAmount()).to.equal(DEFAULT_DRIP_AMOUNT);
    });

    it(`setWithdrawAmount(): User can't adjust Withdraw Amount`, async function () {
      await expect(FAUCET.connect(chain1.wallet1).setWithdrawAmount(0)).to.revertedWith(NOT_AN_OWNER);
    });
  });

  describe('Owner can Withdraw Faucet funds', async () => {
    it('withdrawTokens()', async function () {
      await FAUCET.withdrawTokens(chain1.wallet3.address, DEFAULT_DRIP_AMOUNT);
      dripCount++;
      expect(await ERC20.balanceOf(chain1.wallet3.address)).to.equal(DEFAULT_DRIP_AMOUNT);
    });

    // NOTE: Faucet is prefunded outside of this test suite so FAUCET_PREFUND_AMOUNT is not 0 and therefore must be added to
    // the balance that is transfered in the before hook of this test suite for the expected balance to be correct
    // TODO: Remove either the logic that prefunds the faucet or use the prefund amount as the initial faucet funds
    it('withdrawAllTokens()', async function () {
      await FAUCET.withdrawAllTokens(chain1.wallet4.address);
      expect(await ERC20.balanceOf(chain1.wallet4.address)).to.equal(
        FAUCET_PREFUND_AMOUNT.add(INITIAL_FAUCET_FUNDS).sub(DEFAULT_DRIP_AMOUNT.mul(dripCount))
      );
      expect(await ERC20.balanceOf(FAUCET.address)).to.equal(0);
    });

    it('withdrawAllTokens(): Non Owner should fail to Withdraw All Tokens');
  });
});
