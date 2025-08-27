import { useWeb3Context } from "contexts/Web3Context";
import { BigNumber } from "ethers";
import { LARGEST_UINT256 } from "lib/constants";
import { logDebug, logError } from "lib/helpers";
import { approveToken, fetchAllowance } from "lib/token";
import { useCallback, useEffect, useState } from "react";

export const useApproval = (fromToken, fromAmount, txHash) => {
  const { account, ethersProvider, providerChainId } = useWeb3Context();
  const [allowance, setAllowance] = useState(BigNumber.from(0));
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    if (fromToken && providerChainId === fromToken.chainId) {
      fetchAllowance(fromToken, account, ethersProvider).then(setAllowance);
    } else {
      setAllowance(BigNumber.from(0));
    }
  }, [ethersProvider, account, fromToken, providerChainId, txHash]);

  useEffect(() => {
    setAllowed(
      (fromToken && ["NATIVE", "erc677"].includes(fromToken.mode)) ||
        allowance.gte(fromAmount)
    );
  }, [fromAmount, allowance, fromToken]);

  const [unlockLoading, setUnlockLoading] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState();

  const approve = useCallback(async () => {
    setUnlockLoading(true);
    try {
      const tx = await approveToken(ethersProvider, fromToken, LARGEST_UINT256);
      setApprovalTxHash(tx.hash);
      await tx.wait();
      setAllowance(LARGEST_UINT256);
    } catch (approveError) {
      if (approveError?.code === "TRANSACTION_REPLACED") {
        if (approveError.cancelled) {
          throw new Error("transaction was replaced");
        } else {
          logDebug("TRANSACTION_REPLACED");
          setApprovalTxHash(approveError.replacement.hash);
          try {
            await approveError.replacement.wait();
            setAllowance(LARGEST_UINT256);
          } catch (secondApprovalError) {
            logError({
              secondApprovalError,
              fromToken,
              approvalAmount: LARGEST_UINT256.toString(),
              account,
            });
            throw secondApprovalError;
          }
        }
      } else {
        logError({
          approveError,
          fromToken,
          approvalAmount: LARGEST_UINT256.toString(),
          account,
        });
        throw approveError;
      }
    } finally {
      setApprovalTxHash();
      setUnlockLoading(false);
    }
  }, [fromToken, ethersProvider, account]);

  return { allowed, unlockLoading, approvalTxHash, approve };
};
