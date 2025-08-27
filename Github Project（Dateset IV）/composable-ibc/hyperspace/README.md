# Hyperspace Relayer

## Architecture
The relayer is designed to be:

### 1. Stateless 
This means that the relayer does not perform **any form** of data caching. The relayer, therefore, relies heavily on  
the nodes it's connected to for sourcing data as needed. This design choice eliminates a class of bugs that could come from cache invalidation.

### 2. Event Driven
The relayer follows an event-driven model, where it waits idly until it receives a finality notification from any of the chains it's connected to. The finality notification represents new IBC messages and events that have been finalized and are ready to be sent to the connected counterparty chain.

## Relayer Loop

The relayer has a single entry point, which is the [`relay`](/hyperspace/core/src/lib.rs#L20) function, this function takes two [`Chain`](/hyperspace/primitives/src/lib.rs#L346) implementations  
alongside optional metric handlers and starts the relayer loop.  

The relayer loops awaits finality events from the finality subscription of the chain handlers.  
Whenever a finality event is received, the latest IBC events are queried using `query_latest_ibc_events`.  
These events are then parsed into the appropriate outgoing IBC messages, and sent off to the counterparty chain.
The `query_ready_and_timed_out_packets` queries a chain and  
produces all packet messages that have passed the connection delay check.
It also returns timed-out packet messages that have passed the connection delay check.  

### Connection delay and Packet Timeout
 
The relayer needs to submit packets with a proof fetched at a height where the equivalent client consensus state on the  
counterparty chain has satisfied the connection delay.
Since the relayer has no cache of the block heights at which packet events were emitted, it has to go through a more rigorous process to identify when the connection delay has been satisfied for some arbitrary consensus height.  
The following pseudocode describes how connection delays and packet timeouts are handled:

```rust
    let mut ready_messages = vec![];
    let mut timeout_messages = vec![];
    // query undelivered send packet sequences from the source chain
    let seqs = query_undelivered_send_packet_sequences(source, sink, channel_id, port_i);

    // The `PacketInfo` type returned by `query_send_packets` must contain a height field, which represents the block height 
    // at which the packet was created
    let send_packets: Vec<PacketInfo> = source.query_send_packets(channel_id, port_id, seqs);
    for send_packet in send_packets {
        let packet = packet_info_to_packet(&send_packet);
        // Check if packet has timed out
        if packet.timed_out(&sink_timestamp, sink_height) {
            // Find a suitable consensus height for sink chain's light client consensus height on source chain to prove packet timeout
            let proof_height = if let Some(proof_height) = get_timeout_proof_height(source, sink, send_packet) {
                proof_height
            } else {
               continue
            };

            // Check if connection delay is satisfied for this proof height
            if !verify_delay_passed(source, sink, send_packet, proof_height) {
                continue
            }

            // lets construct the timeout message to be sent to the source
            let msg = construct_timeout_message(source, sink, packet, proof_height)
            timeout_messages.push(msg);
            continue
        }
        
        // If packet has not timed out find a suitable client consensus height for source chain on the sink that can be used to prove packet existence
        let proof_height = if let Some(proof_height) = find_suitable_proof_height_for_client(source, sink, send_packet) {
            proof_height
        } else {
            continue
        };
        // verify that the connection delay is satisfied
        if !verify_delay_passed(source, sink, send_packet, proof_height) {
            continue
        }
        let msg = construct_msg_recv_packet(source, sink, packet, proof_height);
        ready_messages.push(msg)   
    }

    // Query undelivered acknowledgement sequences from the source chain
    let seqs = query_undelivered_acknowledgement_sequences(source, sink, channel_id, port_id);
    // The `PacketInfo` type returned by `query_recv_packets` must contain a height field, which represents the block height at
    // which the acknowledgement of the packet was written on chain(for the majority of chains which execute IBC callbacks synchronously, this
    // would be equivalent to the height at which the packet was received on chain).
    let recv_packets: Vec<PacketInfo> = source.query_recv_packets(channel_id, port_id, seqs);
    for recv_packet in recv_packets { 
        // If acknowledgement is not defined then skip packet
        if recv_packet.ack.is_none() {
            continue
        }
       // Find a suitable client consensus height for source chain on the sink that can be used to prove packet acknowledgement
        let proof_height = if let Some(proof_height) = find_suitable_proof_height_for_client(source, sink, recv_packet) {
            proof_height
        } else {
            continue
        };
        // verify that the connection delay is satisfied
        if !verify_delay_passed(source, sink, recv_packet, proof_height) {
            continue
        }
        let msg = construct_msg_ack_packet(source, sink, packet, proof_height);
        ready_messages.push(msg)
    }
```

For timeouts due to channel close, since there's no way to know the exact height at which the channel closed on the sink chain,  
the timeouts are only processed when the packets eventually timeout.

## Using the relayer

Using the relayer requires having a [`Chain`](/hyperspace/primitives/src/lib.rs#L346) implementation for the chain types  
that packets would be relayed between.

```rust
    // Naive example of how to use the relayer
    pub struct ChainA { ... }

    impl hyperspace_primitives::IbcProvider for ChainA { ... }
    impl hyperspace_primitives::KeyProvider for ChainA { ... }
    impl hyperspace_primitives::LightClientSync for ChainA { ... }
    impl hyperspace_primitives::Chain for ChainA { ... }



    pub struct ChainB { ... }

    impl hyperspace_primitives::IbcProvider for ChainB { ... }
    impl hyperspace_primitives::KeyProvider for ChainB { ... }
    impl hyperspace_primitives::LightClientSync for ChainB { ... }
    impl hyperspace_primitives::Chain for ChainB { ... }


    async fn main() -> Result<(), anyhow::Error>{
        let chain_a = ChainA::default();
        let chain_b = ChainB::default();
        hyperspace_core::relay(chain_a, chain_b, None, None).await?;
        Ok(())
    }
```

**Note*: When `hyperspace_core::relay` is executed the relayer automatically tries to sync the light clients on both chains to the latest  
block height before starting the core relayer loop.  
**Note** Correct functioning of the relayer is dependent on correct implementation of the trait methods, read documentation  
for each of the trait methods for implementation details.

## Gas Awareness

The relayer is gas aware when submitting IBC messages. Messages whose execution cost would exceed block gas limits  
are split into chunks.  
The gas limit tuning is performed by [`flush_message_batch`](/hyperspace/core/src/queue.rs#L6), it achieves this by estimating the weight of the message batch  
using [`estimate_weight`](/hyperspace/primitives/src/lib.rs#L354) and comparing it with the maximum block gas limit provided by [`block_max_weight`](/hyperspace/primitives/src/lib.rs#L351),  
if the estimate exceeds the latter then the ibc messages are split into smaller chunks that fit within the gas limit and  
these chunks are then submitted as individual transactions.  


## Running the relayer

### How to build Hyperspace

In order to deploy a relayer, there are some things to install first:

1. Install [go](https://go.dev/doc/install)

2. Install [rust](https://rustup.rs/)

3. Install Protobuf --> 

```
curl -LO https://github.com/protocolbuffers/protobuf/releases/download/v24.2/protoc-24.2-linux-x86_64.zip && \
unzip  protoc-24.2-linux-x86_64.zip -d /usr/local/protoc && \
export PATH=$PATH:/usr/local/protoc/bin
```

4. Install clang, solc, rocksdb (this can be installed through apt)

Then, run:

```
cd hyperspace/
make build-release-hyperspace
```

The binary will leave in the root directory of `centauri` repository,
on:
```
./target/release/hyperspace
```

### Running Hyperspace - CLI Interface

The CLI interface can be used to start the relayer from a config file and also perform the IBC setup on both chains. It assumes that `hyperspace` was already built.

A template configuration file (which is needed to run the CLI) can be found
[here](./config.toml)

- [`relay`](/hyperspace/core/src/command.rs#L24)  
  This command accepts a path to a config file and spawns the relayer alongside a Prometheus server for monitoring.  
  The config file must have all the parameters necessary for the chain clients to work correctly.
- [`create-clients`](/hyperspace/core/src/command.rs#L26)  
  This command takes a path to a config file and attempts to create a light client of each chain on its counterparty.
- [`create-connection`](/hyperspace/core/src/command.rs#L28)  
  This command takes a path to a config file and delay period in seconds and attempts to complete the connection  
  handshake between both chains.
  The config file must have a valid client id
- [`create-channel`](/hyperspace/core/src/command.rs#L30)  
  This command takes a path to a config file, a port id and a version, it attempts to complete the channel handshake  
  between both chains.
  The config file must have a valid client and connection id.
    
### Configuration

1. Compile the WASM file using `cargo +nightly-2023-02-07 build -p ics10-grandpa-cw --release --target wasm32-unknown-unknown --lib --no-default-features` (install the toolchain if needed).

2. How to create a [`gov`](https://www.youtube.com/watch?v=leFIbW9e2zY) proposal

- Generate draft gov proposal
```
centaurid tx gov draft-proposal
```

- submit gov proposal
```
# centaurid tx gov submit-proposal /home/ubuntu/draft_proposal.json --from validator --fees=300ppica
```

- list governance proposals
```
# centaurid q gov proposals
```

- vote "yes" for gov proposal (`id=3`)

```
# centaurid tx gov vote 3 yes --from validator --fees=300ppica
```

- check votes for gov proposal (`id=3`)
```
# centaurid q gov votes 3
```

3. You will need two config files in order to start the relayer. In the following example you will have a config file for `centauri` and for `picasso`:

The following is a template for banksy-testnet-5
```
type = "cosmos"
name = "banksy"
rpc_url = "https://rpc-testnet5.composable-cosmos.composablenodes.tech/"
grpc_url = "https://api-testnet5.composable-cosmos.composablenodes.tech"
websocket_url = "ws://rpc-testnet5.composable-cosmos.composablenodes.tech/websocket"
chain_id = "banksy-testnet-5"
client_id = "07-tendermint-0"
connection_id = "connection-2"
account_prefix = "centauri"
fee_denom = "ppica"
fee_amount = "4000"
gas_limit = 9223372036854775806
store_prefix = "ibc"
max_tx_size = 200000
wasm_code_id = "here_goes_the_wasm_code_id"
channel_whitelist = [["channel-2", "transfer"]]
mnemonic = "mnemonic phrase example ....."
skip_optional_client_updates = true
max_packets_to_process = 200
```

The following is a template of composable-mainnet

```
type = "cosmos"
name = "composable"
rpc_url = "wss://rpc.composable.finance"
grpc_url = "wss://polkadot-rpc.dwellir.com"
websocket_url = "ws://rpc.composable.finance/websocket"
chain_id = "centauri-1"
client_id = "07-tendermint-32"
connection_id = "connection-5"
account_prefix = "centauri"
fee_denom = "ppica"
fee_amount = "1500000"
gas_limit = 10000000000
store_prefix = "ibc"
max_tx_size = 20000000
wasm_code_id = "HERE IS THE WASM CODE"
channel_whitelist = [["channel-2", "transfer"]]
mnemonic = "mnemonic phrase example"
skip_optional_client_updates = true
skip_tokens_list = []
```

The following is a template of picasso mainnet

```
chain_id = "picasso_kusama"
type = "picasso_kusama"
name = "picasso"
para_id = 2087
parachain_rpc_url = "wss://rpc.composablenodes.tech"
relay_chain_rpc_url = "wss://kusama-rpc.dwellir.com"
client_id = "10-grandpa-28"
connection_id = "connection-23"
channel_whitelist = [["channel-15", "transfer"]]
commitment_prefix = "0x6962632f"
private_key = "here goes the private key"
ss58_version = 49
key_type = "sr25519"
finality_protocol = "Grandpa"
```

4. Upload the contract 
```
hyperspace upload-wasm --config picasso-local.toml --wasm-path ics10-grandpa-cw
```

or

```
centaurid tx 08-wasm push-wasm ics10-grandpa-cw --keyring-backend test --gas auto --fees 1000016pica -y --from mykey
```

5. Build the [`connection`](./contract.toml)

### Metrics

The relayer can be spawned with metrics enabled. The [`metrics`](/hyperspace/metrics/README.md) crate provides a Prometheus server that collects data  
about the relayer's operation.  

Metrics collected are centered around packets and light client states on either chain and also the cost of transactions submitted on both chains.  

### Troubleshooting

Update this section with feedback!