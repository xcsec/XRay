import { CheckIcon } from "@chakra-ui/icons";
import {
  Flex,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  Spinner,
  Text,
} from "@chakra-ui/react";
import LoadingImage from "assets/loading.svg";
import { ProgressRing } from "components/common/ProgressRing";
import { ClaimTokensModal } from "components/modals/ClaimTokensModal";
import { ClaimTransferModal } from "components/modals/ClaimTransferModal";
import { NeedsConfirmationModal } from "components/modals/NeedsConfirmationModal";
import { useBridgeContext } from "contexts/BridgeContext";
import { useWeb3Context } from "contexts/Web3Context";
import { useBridgeDirection } from "hooks/useBridgeDirection";
import { useTransactionStatus } from "hooks/useTransactionStatus";
import { LOCAL_STORAGE_KEYS } from "lib/constants";
import React, { useEffect, useState } from "react";

const { DONT_SHOW_CLAIMS } = LOCAL_STORAGE_KEYS;

const BridgeLoader = ({
  loading,
  loadingText,
  confirmations,
  totalConfirms,
}) => {
  const showConfirmations = confirmations < totalConfirms;
  const displayConfirms = showConfirmations ? confirmations : totalConfirms;

  return (
    <Modal
      isOpen={loading}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      isCentered
    >
      <ModalOverlay background="modalBG">
        <>
          {loadingText ? (
            <ModalContent
              borderRadius={{ base: "1rem", md: "full" }}
              mx={{ base: 12, lg: 0 }}
              maxW={{ base: "20rem", md: "25rem" }}
            >
              <ModalBody px={4} py={8}>
                <Flex
                  align={{ base: "center", md: "stretch" }}
                  direction={{ base: "column", md: "row" }}
                >
                  <Flex
                    h="3.25rem"
                    w="3.25rem"
                    align="center"
                    justify="center"
                    border="5px solid #eef4fd"
                    borderRadius="50%"
                    mx={4}
                    mb={{ base: 2, md: 0 }}
                    position="relative"
                  >
                    {showConfirmations ? (
                      <>
                        <Text fontSize="sm">
                          {displayConfirms}/{totalConfirms}
                        </Text>
                        <Flex
                          position="absolute"
                          justify="center"
                          align="center"
                          color="blue"
                        >
                          <ProgressRing
                            radius={33.5}
                            stroke={5}
                            progress={displayConfirms}
                            totalProgress={totalConfirms}
                          />
                        </Flex>
                      </>
                    ) : (
                      <>
                        <CheckIcon color="blue" boxSize="0.85rem" />
                        <Spinner
                          position="absolute"
                          color="blue"
                          thickness="5px"
                          w="3.25rem"
                          h="3.25rem"
                          speed="0.75s"
                        />
                      </>
                    )}
                  </Flex>
                  <Flex
                    flex={1}
                    direction="column"
                    align={{ base: "center", md: "flex-start" }}
                    justify="center"
                    mt={{ base: 2, md: 0 }}
                  >
                    <Text textAlign="center">
                      {`${loadingText || "Waiting for Block Confirmations"}...`}
                    </Text>
                  </Flex>
                </Flex>
              </ModalBody>
            </ModalContent>
          ) : (
            <ModalContent background="none" boxShadow="none" borderRadius="0">
              <Flex direction="column" align="center" justify="center">
                <Image src={LoadingImage} mb={4} />
                <Text color="white" fontWeight="bold">
                  Loading ...
                </Text>
              </Flex>
            </ModalContent>
          )}
        </>
      </ModalOverlay>
    </Modal>
  );
};

export const BridgeLoadingModal = () => {
  const { account, providerChainId: chainId } = useWeb3Context();
  const { homeChainId, foreignChainId } = useBridgeDirection();
  const { loading, txHash, totalConfirms } = useBridgeContext();
  const [message, setMessage] = useState();
  const {
    loadingText,
    needsConfirmation,
    setNeedsConfirmation,
    confirmations,
  } = useTransactionStatus(setMessage);

  useEffect(() => {
    if (chainId === homeChainId) {
      setMessage();
    }
  }, [chainId, homeChainId]);

  const txNeedsClaiming =
    !!message && !!txHash && !loading && chainId === foreignChainId;

  const claimTransfer = txNeedsClaiming ? (
    <ClaimTransferModal message={message} setMessage={setMessage} />
  ) : null;

  const claimAllTokens =
    txNeedsClaiming || loading || needsConfirmation ? null : (
      <ClaimTokensModal />
    );

  useEffect(() => {
    window.localStorage.setItem(DONT_SHOW_CLAIMS, "false");
  }, [account, chainId]);

  const loader = needsConfirmation ? (
    <NeedsConfirmationModal
      setNeedsConfirmation={setNeedsConfirmation}
      setMessage={setMessage}
    />
  ) : (
    <BridgeLoader
      loadingText={loadingText}
      loading={loading}
      confirmations={confirmations}
      totalConfirms={totalConfirms}
      chainId={chainId}
      txHash={txHash}
    />
  );

  return (
    <>
      {claimAllTokens}
      {claimTransfer}
      {loader}
    </>
  );
};
