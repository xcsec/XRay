import { Contract, utils } from "ethers";
import {
  EXCHANGE_CONTRACT_ABI,
  EXCHANGE_CONTRACT_ADDRESS
} from "../constants";

export const removeLiquidity = async (lpTokenAmountWei, signer) => {
  const exchangeContract = new Contract(
    EXCHANGE_CONTRACT_ADDRESS,
    EXCHANGE_CONTRACT_ABI,
    signer
  );
  let tx = await exchangeContract.removeLiquidity(lpTokenAmountWei);
  await tx.wait();
};

export const getTokensAfterRemove = async (
  provider,
  lpTokenAmountWei,
  ethBalance,
  cryptoDevTokenReserve
) => {
  const exchangeContract = new Contract(
    EXCHANGE_CONTRACT_ADDRESS,
    EXCHANGE_CONTRACT_ABI,
    provider
  );
  try{
    const cdTotalLPSupply = await exchangeContract.totalSupply();
    if(cdTotalLPSupply == 0) {
      // If liquidity pool is empty, there's no liquidity present so early-out
      const bnZero = utils.formatEther("0");
      return {bnZero, bnZero};
    }

    // Use clever predefined formula to calculate the amount of ETH that would be sent back to the user, after
    // withdrawing the defined amount of LP tokens
    const removeEther = ethBalance.mul(lpTokenAmountWei).div(cdTotalLPSupply);

    // Use equally clever formula to calculate the CD tokens the user would get back when withdrawing their LP tokens
    const removeCD = cryptoDevTokenReserve.mul(lpTokenAmountWei).div(cdTotalLPSupply);

    return {removeEther, removeCD};
  } catch (e) {
    console.log(e);
    return {};
  }
};