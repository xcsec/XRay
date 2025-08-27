import { useLocalState } from "hooks/useLocalState";
import {
  ADDRESS_ZERO,
  DEFAULT_BRIDGE_DIRECTION,
  LOCAL_STORAGE_KEYS,
} from "lib/constants";
import { fetchQueryParams, getNativeCurrency } from "lib/helpers";
import { networks } from "lib/networks";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

const { BRIDGE_DIRECTION } = LOCAL_STORAGE_KEYS;

const SettingsContext = React.createContext({});

export const SettingsProvider = ({ children }) => {
  const [queryToken, setQueryToken] = useState(null);

  const [bridgeDirection, setBridgeDirection] = useLocalState(
    DEFAULT_BRIDGE_DIRECTION,
    BRIDGE_DIRECTION
  );

  const history = useHistory();

  useEffect(() => {
    const params = fetchQueryParams(window.location.search);

    if (params) {
      history.replace({
        search: "",
      });

      if (params?.from && params?.to && params?.token) {
        const fromChainId = parseInt(params.from, 10);
        const toChainId = parseInt(params.to, 10);
        const tokenAddress = params.token;

        const networkEntry = Object.entries(networks).find(
          ([_, { homeChainId, foreignChainId }]) =>
            (homeChainId === fromChainId && foreignChainId === toChainId) ||
            (homeChainId === toChainId && foreignChainId === fromChainId)
        );

        if (networkEntry) {
          setBridgeDirection(networkEntry[0], true);
          setQueryToken(
            tokenAddress === ADDRESS_ZERO &&
              networkEntry[1].enableForeignCurrencyBridge &&
              networkEntry[1].foreignChainId === fromChainId
              ? getNativeCurrency(fromChainId)
              : { chainId: fromChainId, address: tokenAddress }
          );
        }
      }
    }
  }, [setBridgeDirection, history]);

  const [needsSaving, setNeedsSaving] = useState(false);

  const save = useCallback(() => {
    if (needsSaving) {
      setBridgeDirection((bNet) => bNet, true);
      setNeedsSaving(false);
    }
  }, [setBridgeDirection, needsSaving]);

  return (
    <SettingsContext.Provider
      value={{
        bridgeDirection,
        setBridgeDirection,
        needsSaving,
        save,
        queryToken,
        setQueryToken,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
