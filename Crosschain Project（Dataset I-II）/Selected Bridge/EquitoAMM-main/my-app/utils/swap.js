import { Contract } from "ethers";
import {
  EXCHANGE_CONTRACT_ABI,
  EXCHANGE_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ABI,
  TOKEN_CONTRACT_ADDRESS
} from "../constants";

export const getAmountOfTokensReceivedFromSwap = async (
  provider,
  swapAmountWei,
  ethSelected,
  ethBalance,
  reserveCD
) => {
  const exchangeContract = new Contract(
    EXCHANGE_CONTRACT_ADDRESS,
    EXCHANGE_CONTRACT_ABI,
    provider
  );

  let amountOfTokens;
  if(ethSelected) {
    amountOfTokens = await exchangeContract.getAmountOfTokens(swapAmountWei, ethBalance, reserveCD);
  } else {
    amountOfTokens = await exchangeContract.getAmountOfTokens(swapAmountWei, reserveCD, ethBalance)
  }

  return amountOfTokens;
};

export const swapTokens = async (
  signer,
  swapAmountWei,
  tokenToBeReceivedFromSwap,
  ethSelected
) => {
  const exchangeContract = new Contract(
    EXCHANGE_CONTRACT_ADDRESS,
    EXCHANGE_CONTRACT_ABI,
    signer
  );

  const tokenContract = new Contract(
    TOKEN_CONTRACT_ADDRESS,
    TOKEN_CONTRACT_ABI,
    signer
  );

  let tx;

  if(ethSelected) {
    tx = await exchangeContract.ethToCryptoDevToken(tokenToBeReceivedFromSwap, {value: swapAmountWei});
  } else {
    tx = await tokenContract.approve(EXCHANGE_CONTRACT_ADDRESS, swapAmountWei.toString());
    await tx.wait();
    tx = await exchangeContract.cryptoDevTokenToEther(swapAmountWei, tokenToBeReceivedFromSwap);
  }

  await tx.wait();
};