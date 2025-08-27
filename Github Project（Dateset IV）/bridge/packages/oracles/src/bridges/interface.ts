export interface BridgeConfig {
  home: {
    bridge: string;
    start_block: string;
    rpc_url: string;
    gas_price: string;
  };
  foreign: {
    bridge: string;
    start_block: string;
    rpc_url: string;
    gas_price: string;
  };
}
