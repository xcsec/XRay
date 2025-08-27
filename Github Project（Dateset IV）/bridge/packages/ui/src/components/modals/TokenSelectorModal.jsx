import {
  Button,
  Flex,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
} from "@chakra-ui/react";
import SearchIcon from "assets/search.svg";
import { Logo } from "components/common/Logo";
import { useBridgeContext } from "contexts/BridgeContext";
import { useWeb3Context } from "contexts/Web3Context";
import { useBridgeDirection } from "hooks/useBridgeDirection";
import { ADDRESS_ZERO } from "lib/constants";
import {
  formatValue,
  getNativeCurrency,
  logError,
  removeElement,
} from "lib/helpers";
import { fetchTokenBalanceWithProvider } from "lib/token";
import { fetchTokenList } from "lib/tokenList";
import React, { useCallback, useEffect, useRef, useState } from "react";

export const TokenSelectorModal = ({ isOpen, onClose, onCustom }) => {
  // Ref
  const initialRef = useRef();
  // Contexts
  const { setToken, setLoading: setBridgeLoading } = useBridgeContext();
  const { account, ethersProvider, providerChainId } = useWeb3Context();
  // State
  const [loading, setLoading] = useState(true);
  const [tokenList, setTokenList] = useState([]);
  const [filteredTokenList, setFilteredTokenList] = useState([]);
  const { foreignChainId, enableForeignCurrencyBridge } = useBridgeDirection();

  // Callbacks
  const fetchTokenListWithBalance = useCallback(
    async (tList) => {
      const tokenValueSortFn = ({ balance: balanceA }, { balance: balanceB }) =>
        balanceB.sub(balanceA).gt(0) ? 1 : -1;

      const tokenListWithBalance = await Promise.all(
        tList.map(async (token) => ({
          ...token,
          balance: await fetchTokenBalanceWithProvider(
            ethersProvider,
            token,
            account
          ),
        }))
      );

      const natCurIndex = tokenListWithBalance.findIndex(
        ({ address, mode }) => address === ADDRESS_ZERO && mode === "NATIVE"
      );

      if (natCurIndex !== -1) {
        return [
          tokenListWithBalance[natCurIndex],
          ...removeElement(tokenListWithBalance, natCurIndex).sort(
            tokenValueSortFn
          ),
        ];
      }

      return tokenListWithBalance.sort(tokenValueSortFn);
    },
    [account, ethersProvider]
  );

  const setDefaultTokenList = useCallback(
    async (chainId) => {
      setLoading(true);
      try {
        const baseTokenList = await fetchTokenList(chainId);

        const nativeCurrency =
          enableForeignCurrencyBridge && foreignChainId === chainId
            ? [getNativeCurrency(chainId)]
            : [];

        setTokenList(
          await fetchTokenListWithBalance(
            [].concat(baseTokenList).concat(nativeCurrency)
          )
        );
      } catch (fetchTokensError) {
        logError({ fetchTokensError });
      }
      setLoading(false);
    },
    [fetchTokenListWithBalance, enableForeignCurrencyBridge, foreignChainId]
  );

  // Effects
  useEffect(() => {
    if (tokenList.length) {
      setFilteredTokenList(tokenList);
    }
  }, [tokenList, setFilteredTokenList]);

  useEffect(() => {
    if (!isOpen) return;
    providerChainId && setDefaultTokenList(providerChainId);
  }, [isOpen, providerChainId, setDefaultTokenList]);

  // Handlers
  const selectToken = useCallback(
    async (token) => {
      onClose();
      setBridgeLoading(true);
      await setToken(token);
      setBridgeLoading(false);
    },
    [setBridgeLoading, onClose, setToken]
  );

  const onClick = useCallback(
    async (token) => {
      await selectToken(token);
    },
    [selectToken]
  );

  const onChange = (e) => {
    const newFilteredTokenList = tokenList.filter((token) => {
      const lowercaseSearch = e.target.value.toLowerCase();
      const { name, symbol, address } = token;
      return (
        name.toLowerCase().includes(lowercaseSearch) ||
        symbol.toLowerCase().includes(lowercaseSearch) ||
        address.toLowerCase().includes(lowercaseSearch)
      );
    });
    setFilteredTokenList(newFilteredTokenList);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      scrollBehavior="inside"
      isCentered
      initialFocusRef={initialRef}
    >
      <ModalOverlay background="modalBG">
        <ModalContent
          boxShadow="0px 1rem 2rem #617492"
          borderRadius="1rem"
          pb={4}
          pt={2}
          maxW="30rem"
          mx="12"
        >
          <ModalHeader pb={0}>
            <Flex align="center" justify="space-between">
              Select a Token
            </Flex>
            <Text color="grey" my={2} fontSize="md" fontWeight="normal">
              Search Name or Paste Token Contract Address
            </Text>
            <InputGroup mb={4} borderColor="#DAE3F0">
              <Input
                placeholder="Search ..."
                onChange={onChange}
                _placeholder={{ color: "grey" }}
                ref={initialRef}
              />
              <InputRightElement px={0}>
                <Image src={SearchIcon} />
              </InputRightElement>
            </InputGroup>
          </ModalHeader>
          <ModalCloseButton
            size="lg"
            top={-10}
            right={-10}
            color="white"
            p={2}
          />
          <ModalBody minH="5rem">
            {loading && (
              <Flex w="100%" align="center" justify="center">
                <Spinner color="blue" thickness="4px" size="xl" speed="0.75s" />
              </Flex>
            )}
            {!loading &&
              filteredTokenList.map((token) => {
                const { decimals, balance, name, address, logoURI, symbol } =
                  token;
                return (
                  <Button
                    variant="outline"
                    size="lg"
                    width="100%"
                    borderColor="#DAE3F0"
                    key={address + symbol}
                    onClick={() => onClick(token)}
                    mb={2}
                    px={4}
                  >
                    <Flex align="center" width="100%" justify="space-between">
                      <Flex align="center">
                        <Flex
                          justify="center"
                          align="center"
                          background="white"
                          border="1px solid #DAE3F0"
                          boxSize={8}
                          overflow="hidden"
                          borderRadius="50%"
                        >
                          <Logo uri={logoURI} />
                        </Flex>
                        <Text fontSize="lg" fontWeight="bold" mx={2}>
                          {symbol}
                        </Text>
                      </Flex>
                      <Text
                        color="grey"
                        fontWeight="normal"
                        textOverflow="ellipsis"
                        overflow="hidden"
                        maxWidth="60%"
                      >
                        {balance && decimals
                          ? formatValue(balance, decimals)
                          : name}
                      </Text>
                    </Flex>
                  </Button>
                );
              })}
          </ModalBody>
        </ModalContent>
      </ModalOverlay>
    </Modal>
  );
};
