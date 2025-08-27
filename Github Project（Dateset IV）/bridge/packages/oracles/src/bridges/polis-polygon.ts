import { BridgeConfig } from "./interface";

export const POLIS_POLYGON_BRIDGE: BridgeConfig = {
  home: {
    bridge: "0xa85f128B9cb883AaC4DF5272f206890D623EC2f8",
    start_block: "1461129",
    rpc_url: "https://rpc-tracing.polis.tech",
    gas_price: "1000000000",
  },
  foreign: {
    bridge: "0x5F05B526a5226A8270b078c3569EEb4e95a66a28",
    start_block: "21954686",
    rpc_url: "https://polygon-rpc.com/",
    gas_price: "30000000000",
  },
};
