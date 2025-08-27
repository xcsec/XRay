import { BridgeConfig } from "./interface";
import { POLIS_POLYGON_BRIDGE } from "./polis-polygon";
import { POLIS_MAINNET_BRIDGE } from "./polis-mainnet";
import { POLIS_IOTEX_BRIDGE } from "./polis-iotex";
import { POLIS_FANTOM_BRIDGE } from "./polis-fantom";
import { POLIS_BSC_BRIDGE } from "./polis-bsc";
import { POLIS_AVALANCHE_BRIDGE } from "./polis-avalanche";

export const BRIDGES: BridgeConfig[] = [
  POLIS_POLYGON_BRIDGE,
  POLIS_MAINNET_BRIDGE,
  POLIS_IOTEX_BRIDGE,
  POLIS_FANTOM_BRIDGE,
  POLIS_BSC_BRIDGE,
  POLIS_AVALANCHE_BRIDGE,
];
