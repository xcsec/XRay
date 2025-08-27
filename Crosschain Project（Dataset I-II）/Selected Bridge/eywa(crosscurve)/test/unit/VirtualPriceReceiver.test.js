const { ethers, contract } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');
const { shouldBehaveLikeVirtualPriceReceiver } = require('./VirtualPriceReceiver.behavior');


describe('VirtualPriceReceiver unit tests', () => {

  chainId = network.config.chainId;

  beforeEach(async () => {
    [owner, operator, alice, bob, router] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('BridgeMock');
    bridge = await factory.deploy();
    await bridge.deployed();

    factory = await ethers.getContractFactory('GateKeeperMock');
    gateKeeper = await factory.deploy(bridge.address);
    await gateKeeper.deployed();
    await bridge.grantRole(await bridge.GATEKEEPER_ROLE(), gateKeeper.address);
    await gateKeeper.setBridge(owner.address);

    factory = await ethers.getContractFactory('AddressBook');
    addressBook = await factory.deploy();
    await addressBook.deployed();
    await addressBook.setGateKeeper(gateKeeper.address);

    factory = await ethers.getContractFactory('PriceOraclePoolMock');
    cryptoPool = await factory.deploy();

    factory = await ethers.getContractFactory('VirtualPriceReceiver');
    virtualPriceReceiver = await factory.deploy(addressBook.address, [chainId], [bridge.address]);
    await virtualPriceReceiver.deployed();

    await virtualPriceReceiver.grantRole(await virtualPriceReceiver.OPERATOR_ROLE(), operator.address);
  });

  shouldBehaveLikeVirtualPriceReceiver.call(this);

  it('should return correct price', async () => {
    const virtualPriceEth = parse18('0.01');
    const virtualPriceBsc = parse18('0.56');
    const virtualPricePol = parse18('0.137');
    const virtualPriceOp = parse18('0.1');
    const virtualPriceArb = parse18('0.42161');
    const virtualPriceAvax = parse18('0.43114');
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceEth, 1);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceBsc, 56);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPricePol, 137);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceOp, 10);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceArb, 42161);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceAvax, 43114);
    expect(await virtualPriceReceiver.getVirtualPriceEth()).to.equal(virtualPriceEth);
    expect(await virtualPriceReceiver.getVirtualPriceBsc()).to.equal(virtualPriceBsc);
    expect(await virtualPriceReceiver.getVirtualPricePol()).to.equal(virtualPricePol);
    expect(await virtualPriceReceiver.getVirtualPriceOpt()).to.equal(virtualPriceOp);
    expect(await virtualPriceReceiver.getVirtualPriceArb()).to.equal(virtualPriceArb);
    expect(await virtualPriceReceiver.getVirtualPriceAvax()).to.equal(virtualPriceAvax);
  });

});