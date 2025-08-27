const { ethers } = require("hardhat");
const { CRYPTO_DEV_TOKEN_CONTRACT_ADDRESS } = require("../constants");

async function main() {
  const exchangeContract = await ethers.getContractFactory("Exchange");
  const deployedExchangeContract = await exchangeContract.deploy(CRYPTO_DEV_TOKEN_CONTRACT_ADDRESS);

  await deployedExchangeContract.deployed();

  console.log("Exchange contract deployed to:", deployedExchangeContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
