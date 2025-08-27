import { BridgeConfig } from "./interface";

export const POLIS_IOTEX_BRIDGE: BridgeConfig = {
  home: {
    bridge: "0x2953A5f857eC9fA213105E745cCf2c8f6852aBb4",
    start_block: "1713932",
    rpc_url: "https://rpc-tracing.polis.tech",
    gas_price: "1000000000",
  },
  foreign: {
    bridge: "0xA600c818a7Bb37cDd6B0098aB5B18B69c71892f7",
    start_block: "14791624",
    rpc_url: "https://babel-api.mainnet.iotex.io",
    gas_price: "1000000000000",
  },
};
