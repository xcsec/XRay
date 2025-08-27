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
import { useBridgeContext } from "contexts/BridgeContext";
import React from "react";

export const LoadingModal = ({ loadingText }) => {
  const { loading } = useBridgeContext();
  return (
    <Modal
      isOpen={!loading}
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
                    <Spinner
                      position="absolute"
                      color="blue"
                      thickness="5px"
                      h="3.25rem"
                      w="3.25rem"
                      speed="0.75s"
                    />
                  </Flex>
                  <Flex
                    flex={1}
                    direction="column"
                    align={{ base: "center", md: "flex-start" }}
                    justify="center"
                    mt={{ base: 2, md: 0 }}
                  >
                    <Text textAlign="center">{`${loadingText}...`}</Text>
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
