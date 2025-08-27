import { BridgeConfig } from "./interface";

export const POLIS_MAINNET_BRIDGE: BridgeConfig = {
  home: {
    bridge: "0x651581b964A22bCE9eAfCE0a762189d2D04cAe6a",
    start_block: "1494432",
    rpc_url: "https://rpc-tracing.polis.tech",
    gas_price: "1000000000",
  },
  foreign: {
    bridge: "0x5172747f21EE6D4065CE9a36691D3b579bfCDf20",
    start_block: "13724168",
    rpc_url: process.env.MAINNET_RPC,
    gas_price: "50000000000",
  },
};
