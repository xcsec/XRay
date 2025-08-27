import {
  Box,
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LoadingModal } from "components/modals/LoadingModal";
import { useClaimableTransfers } from "hooks/useClaimableTransfers";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export const ClaimTokensModal = () => {
  const { transfers, loading } = useClaimableTransfers();
  const [isOpen, setOpen] = useState(false);

  const onClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    setOpen(!!transfers && transfers.length > 0);
  }, [transfers]);

  if (loading) return <LoadingModal />;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay background="modalBG">
        <ModalContent
          boxShadow="0px 1rem 2rem #617492"
          borderRadius="1rem"
          maxW="33.75rem"
          mx={{ base: 12, lg: 0 }}
        >
          <ModalHeader p={6}>
            <Text>Claim Your Tokens</Text>
          </ModalHeader>
          <ModalCloseButton
            size="lg"
            top={-10}
            right={-10}
            color="white"
            p={2}
          />
          <ModalBody px={6} py={0}>
            <VStack align="center" direction="column" spacing="4">
              <Box w="100%">
                <Text as="span">{`You have `}</Text>
                <Text as="b">{transfers ? transfers.length : 0}</Text>
                <Text as="span">{` not claimed transactions `}</Text>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter p={6}>
            <Flex
              w="100%"
              justify="space-between"
              align={{ base: "stretch", md: "center" }}
              direction={{ base: "column", md: "row" }}
            >
              <Button
                px={12}
                onClick={onClose}
                background="background"
                _hover={{ background: "#bfd3f2" }}
                color="#687D9D"
              >
                Cancel
              </Button>
              <Link
                to="/history"
                display="flex"
                onClick={() => {
                  window.localStorage.setItem("dont-show-claims", "false");
                }}
              >
                <Button px={12} color="blue" mt={{ base: 2, md: 0 }} w="100%">
                  Claim
                </Button>
              </Link>
            </Flex>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    </Modal>
  );
};
