import { BridgeConfig } from "./interface";

export const POLIS_FANTOM_BRIDGE: BridgeConfig = {
  home: {
    bridge: "0x9411446287A9DE0Fc02B8bB0201E3d401d7615F4",
    start_block: "1460324",
    rpc_url: "https://rpc-tracing.polis.tech",
    gas_price: "1000000000",
  },
  foreign: {
    bridge: "0xF34029CD8A376f30d65Bf8f71C3bBFA01Fab91a3",
    start_block: "23521193",
    rpc_url: "https://rpc.ftm.tools",
    gas_price: "300000000000",
  },
};
