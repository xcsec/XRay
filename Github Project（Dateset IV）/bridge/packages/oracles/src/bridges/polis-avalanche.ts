import { BridgeConfig } from "./interface";

export const POLIS_AVALANCHE_BRIDGE: BridgeConfig = {
  home: {
    bridge: "0xd66650Db783296918d11EdaE2FA6F191e9F7f884",
    start_block: "1550512",
    rpc_url: "https://rpc-tracing.polis.tech",
    gas_price: "1000000000",
  },
  foreign: {
    bridge: "0xd66650Db783296918d11EdaE2FA6F191e9F7f884",
    start_block: "7830196",
    rpc_url: "https://api.avax.network/ext/bc/C/rpc",
    gas_price: "30000000000",
  },
};
