import { Contract, utils } from "ethers";
import {
  EXCHANGE_CONTRACT_ABI,
  EXCHANGE_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ABI,
  TOKEN_CONTRACT_ADDRESS
} from "../constants";

export const addLiquidity = async (addCDAmountWei, addEtherAmountWei, signer) => {
  try {
    const tokenContract = new Contract(
      TOKEN_CONTRACT_ADDRESS,
      TOKEN_CONTRACT_ABI,
      signer
    );

    const exchangeContract = new Contract(
      EXCHANGE_CONTRACT_ADDRESS,
      EXCHANGE_CONTRACT_ABI,
      signer
    );

    // Give the exchange contract allowance to take <addCDAmountWei> amount of CryptoDevs out of the signer's wallet
    let tx = await tokenContract.approve(EXCHANGE_CONTRACT_ADDRESS, addCDAmountWei.toString());
    await tx.wait(); // Wait for the transaction to be mined

    // Add liquidity to the exchange
    tx = await exchangeContract.addLiquidity(addCDAmountWei, {value: addEtherAmountWei});
    await tx.wait();
  } catch (e) {
    console.log(e);
  }
};

export const calculateCD = async (addEther = 0, etherBalanceContract, cdTokenReserve) => {
  const addEtherAmountWei = utils.parseEther(addEther); // Need to be working with BigInts here

  // Calculate the CryptoDev tokens that need to be added to the liquidity given `addEtherAmountWei` amount of ether
  // Predefined equation to ensure that the ratio (and therefore value) of both ETH and CD tokens doesn't change
  const cryptoDevTokenAmount = addEtherAmountWei.mul(cdTokenReserve).div(etherBalanceContract);
  return cryptoDevTokenAmount;
};