import { BridgeConfig } from "./interface";

export const POLIS_BSC_BRIDGE: BridgeConfig = {
  home: {
    bridge: "0x731885890fdF7e53311A7271eb0713E7dbC25E8a",
    start_block: "1460460",
    rpc_url: "https://rpc-tracing.polis.tech",
    gas_price: "1000000000",
  },
  foreign: {
    bridge: "0xF34029CD8A376f30d65Bf8f71C3bBFA01Fab91a3",
    start_block: "13062301",
    rpc_url: "https://bsc-dataseed1.defibit.io/",
    gas_price: "10000000000",
  },
};
