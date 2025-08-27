import { Checkbox, Flex, Grid, Text } from "@chakra-ui/react";
import { HistoryItem } from "components/history/HistoryItem";
import { HistoryPagination } from "components/history/HistoryPagination";
import { ManualClaim } from "components/history/ManualClaim";
import { NoHistory } from "components/history/NoHistory";
import { ClaimErrorModal } from "components/modals/ClaimErrorModal";
import { LoadingModal } from "components/modals/LoadingModal";
import { useUserHistory } from "hooks/useUserHistory";
import React, { useCallback, useState } from "react";
import { Redirect } from "react-router-dom";

const TOTAL_PER_PAGE = 20;

export const BridgeHistory = ({ page }) => {
  const [onlyUnReceived, setOnlyUnReceived] = useState(false);
  const [claimErrorShow, setClaimErrorShow] = useState(false);
  const [claimErrorToken, setClaimErrorToken] = useState(null);

  const { transfers, loading } = useUserHistory();

  const handleClaimError = useCallback((toToken) => {
    toToken && setClaimErrorToken(toToken);
    setClaimErrorShow(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setClaimErrorShow(false);
    claimErrorToken && setClaimErrorToken(null);
  }, [claimErrorToken]);

  if (loading) {
    return (
      <Flex w="100%" maxW="75rem" direction="column" mt={8} px={8}>
        <LoadingModal />
      </Flex>
    );
  }

  const filteredTransfers = onlyUnReceived
    ? transfers.filter((i) => i.receivingTx === null)
    : transfers;

  const numPages = Math.ceil(filteredTransfers.length / TOTAL_PER_PAGE);
  const displayHistory = filteredTransfers.slice(
    (page - 1) * TOTAL_PER_PAGE,
    Math.min(page * TOTAL_PER_PAGE, filteredTransfers.length)
  );

  if (numPages > 1 && page > numPages) {
    return <Redirect to="/history" />;
  }

  return (
    <Flex
      maxW="75rem"
      direction="column"
      mt={8}
      px={{ base: 4, sm: 8 }}
      w="100%"
    >
      <ClaimErrorModal
        claimErrorShow={claimErrorShow}
        claimErrorToken={claimErrorToken}
        onClose={handleModalClose}
      />
      <ManualClaim handleClaimError={handleClaimError} />
      <Flex justify="space-between" align="center" mb={4}>
        <Text fontSize="xl" fontWeight="bold" color="white">
          History
        </Text>
        <Checkbox
          isChecked={onlyUnReceived}
          onChange={(e) => setOnlyUnReceived(e.target.checked)}
          borderColor="grey"
          borderRadius="4px"
          size="lg"
          variant="solid"
        >
          <Text fontSize="sm" color="white">
            Show only unreceived
          </Text>
        </Checkbox>
      </Flex>

      {displayHistory.length > 0 ? (
        <>
          <Grid
            templateColumns={{
              base: "1fr",
              md: "0.5fr 1.75fr 1fr 1fr 1.25fr 0.5fr",
              lg: "1fr 1.25fr 1fr 1fr 1.25fr 0.5fr",
            }}
            color="grey"
            fontSize="sm"
            px={4}
            mb={4}
            display={{ base: "none", md: "grid" }}
          >
            <Text>Date</Text>
            <Text>Direction</Text>
            <Text textAlign="center">Sending Tx</Text>
            <Text textAlign="center">Receiving Tx</Text>
            <Text textAlign="center">Amount</Text>
            <Text textAlign="right">Status</Text>
          </Grid>
          {displayHistory.slice(0, 3).map((item) => (
            <HistoryItem
              key={item.sendingTx}
              data={item}
              handleClaimError={handleClaimError}
            />
          ))}
          {displayHistory.slice(3).map((item) => (
            <HistoryItem
              key={item.sendingTx}
              data={item}
              handleClaimError={handleClaimError}
            />
          ))}
          {numPages > 1 && (
            <HistoryPagination numPages={numPages} currentPage={page} />
          )}
        </>
      ) : (
        <NoHistory />
      )}
    </Flex>
  );
};
