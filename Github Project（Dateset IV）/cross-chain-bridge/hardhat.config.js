/** @type import('hardhat/config').HardhatUserConfig */

require("@nomiclabs/hardhat-web3");
require("@nomicfoundation/hardhat-toolbox");


task("accounts", "Prints accounts", async (_, { web3 }) => {
  console.log(await web3.eth.getAccounts());
});

module.exports = {
  solidity: "0.8.9",
};
