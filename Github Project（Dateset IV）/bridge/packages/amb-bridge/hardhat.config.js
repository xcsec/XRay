require("@nomiclabs/hardhat-waffle");
require("dotenv").config()

let private_key = process.env.PRIVATE_KEY;
let home = process.env.HOME_RPC;
let foreign = process.env.FOREIGN_RPC;

module.exports = {
  networks: {
    hardhat: {},
    home: {
      gasPrice: parseInt(process.env.HOME_GAS_PRICE),
      url: home,
      accounts: [private_key]
    },
    foreign: {
      gasPrice: parseInt(process.env.FOREIGN_GAS_PRICE),
      url: foreign,
      accounts: [private_key]
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.4.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ],
  },
};
