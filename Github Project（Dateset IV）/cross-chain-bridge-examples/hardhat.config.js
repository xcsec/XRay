require('dotenv').config();

require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');
require('hardhat-contract-sizer');
require('hardhat-deploy');
require('solidity-coverage');
require('./tasks/deposit-withdraw');
require('./tasks/send-message');
require('./tasks/greet');

const MNEMONIC = process.env.MNEMONIC;
const INFURA_API_KEY = process.env.INFURA_API_KEY;
const ALCHEMY_ARBITRUM_RPC = process.env.ALCHEMY_ARBITRUM_RPC;
const ALCHEMY_OPTIMISM_RPC = process.env.ALCHEMY_OPTIMISM_RPC;

const argv = require('yargs/yargs')()
  .env('')
  .options({
    tenderly: {
      type: 'boolean',
      default: false,
    },
  }).argv;

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
module.exports = {
  solidity: '0.8.11',
  networks: {
    hardhat: {
      tags: ['local'],
      allowUnlimitedContractSize: true,
    },
    arbitrum: {
      url: ALCHEMY_ARBITRUM_RPC,
      accounts: { mnemonic: MNEMONIC },
      companionNetworks: {
        l1: 'rinkeby',
      },
    },
    optimism: {
      chainId: 69,
      url: ALCHEMY_OPTIMISM_RPC,
      accounts: { mnemonic: MNEMONIC },
      companionNetworks: {
        l1: 'kovan',
      },
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
      accounts: { mnemonic: MNEMONIC },
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_API_KEY}`,
      accounts: { mnemonic: MNEMONIC },
    },
  },
  namedAccounts: {
    deployer: 0,
    user: 1,
    bob: 2,
    alice: 3,
  },
};

if (argv.tenderly) {
  const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT;
  const TENDERLY_USERNAME = process.env.TENDERLY_USERNAME;

  require('@tenderly/hardhat-tenderly');
  module.exports.tenderly = {
    project: TENDERLY_PROJECT,
    username: TENDERLY_USERNAME,
  };
}
