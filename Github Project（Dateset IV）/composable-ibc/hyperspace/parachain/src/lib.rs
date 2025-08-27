// Copyright 2022 ComposableFi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#![allow(clippy::all)]

use std::{
	collections::{BTreeMap, HashSet},
	path::PathBuf,
	str::FromStr,
	sync::{Arc, Mutex},
	time::Duration,
};

pub mod chain;
pub mod error;
pub mod key_provider;
pub mod parachain;
pub mod provider;
pub mod signer;
pub mod utils;

pub mod finality_protocol;
pub mod light_client_sync;
#[cfg(any(test, feature = "testing"))]
pub mod test_provider;

use error::Error;
use frame_support::Serialize;
use serde::Deserialize;

use crate::{
	finality_protocol::FinalityProtocol, signer::ExtrinsicSigner, utils::fetch_max_extrinsic_weight,
};
use beefy_light_client_primitives::{ClientState, MmrUpdateProof};
use beefy_prover::Prover;
use codec::Decode;
use grandpa_light_client_primitives::ParachainHeaderProofs;
use grandpa_prover::GrandpaProver;
use ibc::{
	core::ics24_host::identifier::{ChannelId, ClientId, ConnectionId, PortId},
	timestamp::Timestamp,
};
use ics10_grandpa::{
	client_state::ClientState as GrandpaClientState,
	consensus_state::ConsensusState as GrandpaConsensusState,
};
use ics11_beefy::{
	client_message::ParachainHeader, client_state::ClientState as BeefyClientState,
	consensus_state::ConsensusState as BeefyConsensusState,
};
use jsonrpsee_ws_client::WsClientBuilder;
use light_client_common::config::{AsInner, RuntimeStorage};
use pallet_ibc::light_clients::{AnyClientState, AnyConsensusState, HostFunctionsManager};
use pallet_mmr_primitives::Proof;
use primitives::{CommonClientState, KeyProvider};
use sc_keystore::LocalKeystore;
use sp_core::{ecdsa, ed25519, sr25519, Bytes, Pair, H256};
use sp_keystore::KeystorePtr;
use sp_runtime::{
	traits::{IdentifyAccount, One, Verify},
	KeyTypeId, MultiSignature, MultiSigner,
};
use ss58_registry::Ss58AddressFormat;
use subxt::{
	config::{Header as HeaderT, Header},
	tx::TxPayload,
};
use tokio::sync::Mutex as AsyncMutex;

/// Implements the [`crate::Chain`] trait for parachains.
/// This is responsible for:
/// 1. Tracking a parachain light client on a counter-party chain, advancing this light
/// client state  as new finality proofs are observed.
/// 2. Submiting new IBC messages to this parachain.
#[derive(Clone)]
pub struct ParachainClient<T: light_client_common::config::Config> {
	/// Chain name
	pub name: String,
	/// rpc url for parachain
	pub parachain_rpc_url: String,
	/// rpc url for relay chain
	pub relay_chain_rpc_url: String,
	/// Relay chain rpc client
	pub relay_client: subxt::OnlineClient<T>,
	/// Parachain rpc client
	pub para_client: subxt::OnlineClient<T>,
	/// Relay chain ws client
	pub relay_ws_client: Arc<jsonrpsee_ws_client::WsClient>,
	/// Parachain ws client
	pub para_ws_client: Arc<jsonrpsee_ws_client::WsClient>,
	/// Parachain Id
	pub para_id: u32,
	/// Light client id on counterparty chain
	pub client_id: Arc<Mutex<Option<ClientId>>>,
	/// Connection Id
	pub connection_id: Arc<Mutex<Option<ConnectionId>>>,
	/// Channels cleared for packet relay
	pub channel_whitelist: Arc<Mutex<HashSet<(ChannelId, PortId)>>>,
	/// ICS-23 provable store commitment prefix
	pub commitment_prefix: Vec<u8>,
	/// Public key for relayer on chain
	pub public_key: MultiSigner,
	/// Reference to keystore
	pub key_store: KeystorePtr,
	/// Key type Id
	pub key_type_id: KeyTypeId,
	/// used for encoding relayer address.
	pub ss58_version: Ss58AddressFormat,
	/// the maximum extrinsic weight allowed by this client
	pub max_extrinsic_weight: u64,
	/// Finality protocol to use, eg Beefy, Grandpa
	pub finality_protocol: FinalityProtocol,
	/// Common relayer data
	pub common_state: CommonClientState,
}

enum KeyType {
	Sr25519,
	Ed25519,
	Ecdsa,
}

pub const DEFAULT_RPC_CALL_DELAY: Duration = Duration::from_millis(10);
pub const WAIT_FOR_IN_BLOCK_TIMEOUT: Duration = Duration::from_secs(60 * 1);

impl KeyType {
	pub fn to_key_type_id(&self) -> KeyTypeId {
		match self {
			KeyType::Sr25519 => KeyTypeId(sr25519::CRYPTO_ID.0),
			KeyType::Ed25519 => KeyTypeId(ed25519::CRYPTO_ID.0),
			KeyType::Ecdsa => KeyTypeId(ecdsa::CRYPTO_ID.0),
		}
	}
}

impl FromStr for KeyType {
	type Err = Error;

	fn from_str(s: &str) -> Result<Self, Self::Err> {
		match s {
			"sr25519" => Ok(KeyType::Sr25519),
			"ed25519" => Ok(KeyType::Ed25519),
			"ecdsa" => Ok(KeyType::Ecdsa),
			_ => Err(Error::Custom("Invalid key type".to_string())),
		}
	}
}

/// config options for [`ParachainClient`]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParachainClientConfig {
	/// Chain name
	pub name: String,
	/// Parachain Id
	pub para_id: u32,
	/// rpc url for parachain
	pub parachain_rpc_url: String,
	/// rpc url for relay chain
	pub relay_chain_rpc_url: String,
	/// Light client id on counterparty chain
	pub client_id: Option<ClientId>,
	/// Connection Id
	pub connection_id: Option<ConnectionId>,
	/// Commitment prefix
	pub commitment_prefix: Bytes,
	/// Raw private key for signing transactions
	pub private_key: String,
	/// used for encoding relayer address.
	pub ss58_version: u8,
	/// Channels cleared for packet relay
	pub channel_whitelist: Vec<(ChannelId, PortId)>,
	/// Finality protocol
	pub finality_protocol: FinalityProtocol,
	/// Digital signature scheme
	pub key_type: String,
	/// All the client states and headers will be wrapped in WASM ones using the WASM code ID.
	#[serde(default)]
	pub wasm_checksum: Option<String>,
}

impl<T> ParachainClient<T>
where
	T: light_client_common::config::Config,
{
	/// Initializes a [`ParachainClient`] given a [`ParachainConfig`]
	pub async fn new(config: ParachainClientConfig) -> Result<Self, Error> {
		let relay_ws_client = Arc::new(
			WsClientBuilder::default()
				.build(&config.relay_chain_rpc_url)
				.await
				.map_err(|e| Error::from(format!("Rpc Error {:?}", e)))?,
		);
		let para_ws_client = Arc::new(
			WsClientBuilder::default()
				.build(&config.parachain_rpc_url)
				.await
				.map_err(|e| Error::from(format!("Rpc Error {:?}", e)))?,
		);

		let para_client = subxt::OnlineClient::from_rpc_client(para_ws_client.clone()).await?;

		let relay_client = subxt::OnlineClient::from_rpc_client(relay_ws_client.clone()).await?;

		let max_extrinsic_weight = fetch_max_extrinsic_weight(&para_client).await?;

		let temp_dir = PathBuf::from("/tmp/keystore");
		let key_store: KeystorePtr = Arc::new(LocalKeystore::open(temp_dir, None).unwrap());
		let key_type = KeyType::from_str(&config.key_type)?;
		let key_type_id = key_type.to_key_type_id();

		let public_key: MultiSigner = match key_type {
			KeyType::Sr25519 => sr25519::Pair::from_string_with_seed(&config.private_key, None)
				.map_err(|_| Error::Custom("invalid key".to_owned()))?
				.0
				.public()
				.into(),
			KeyType::Ed25519 => ed25519::Pair::from_string_with_seed(&config.private_key, None)
				.map_err(|_| Error::Custom("invalid key".to_owned()))?
				.0
				.public()
				.into(),
			KeyType::Ecdsa => ecdsa::Pair::from_string_with_seed(&config.private_key, None)
				.map_err(|_| Error::Custom("invalid key".to_owned()))?
				.0
				.public()
				.into(),
		};

		key_store
			.insert(key_type_id, &*config.private_key, public_key.as_ref())
			.unwrap();

		assert!(key_store.has_keys(&[(public_key.as_ref().to_vec(), key_type_id)]));
		Ok(Self {
			name: config.name,
			parachain_rpc_url: config.parachain_rpc_url,
			relay_chain_rpc_url: config.relay_chain_rpc_url,
			para_client,
			relay_client,
			para_id: config.para_id,
			client_id: Arc::new(Mutex::new(config.client_id)),
			commitment_prefix: config.commitment_prefix.0,
			connection_id: Arc::new(Mutex::new(config.connection_id)),
			public_key,
			key_store,
			key_type_id,
			max_extrinsic_weight,
			para_ws_client,
			relay_ws_client,
			ss58_version: Ss58AddressFormat::from(config.ss58_version),
			channel_whitelist: Arc::new(Mutex::new(config.channel_whitelist.into_iter().collect())),
			finality_protocol: config.finality_protocol,
			common_state: CommonClientState {
				skip_optional_client_updates: true,
				maybe_has_undelivered_packets: Arc::new(Mutex::new(Default::default())),
				rpc_call_delay: DEFAULT_RPC_CALL_DELAY,
				initial_rpc_call_delay: DEFAULT_RPC_CALL_DELAY,
				misbehaviour_client_msg_queue: Arc::new(AsyncMutex::new(vec![])),
				..Default::default()
			},
		})
	}
}

impl<T: light_client_common::config::Config + Send + Sync> ParachainClient<T>
where
	u32: From<<<T as subxt::Config>::Header as HeaderT>::Number>,
	Self: KeyProvider,
	<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
		From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
	MultiSigner: From<MultiSigner>,
	<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
	<T as subxt::Config>::Signature: From<MultiSignature> + Send + Sync,
	H256: From<T::Hash>,
	<<T as subxt::Config>::Header as Header>::Number:
		From<u32> + Ord + sp_runtime::traits::Zero + One,
	<T as subxt::Config>::AccountId: Send + Sync,
	<T as subxt::Config>::Address: Send + Sync,
{
	/// Returns a grandpa proving client.
	pub fn grandpa_prover(&self) -> GrandpaProver<T> {
		let relay_ws_client = self.relay_ws_client.clone();
		let para_ws_client = self.para_ws_client.clone();
		GrandpaProver {
			relay_client: self.relay_client.clone(),
			relay_ws_client,
			para_client: self.para_client.clone(),
			para_ws_client,
			para_id: self.para_id,
			rpc_call_delay: self.common_state.rpc_call_delay,
		}
	}

	/// Queries parachain headers that have been finalized by BEEFY in between the given relay chain
	/// heights
	pub async fn query_beefy_finalized_parachain_headers_between(
		&self,
		commitment_block_number: u32,
		client_state: &ClientState,
	) -> Result<Vec<T::Header>, Error>
	where
		u32: From<<<T as subxt::Config>::Header as Header>::Number>,
		<<T as subxt::Config>::Header as Header>::Number: From<u32>,
		<T as subxt::Config>::Header: Decode,
	{
		let client_wrapper = Prover {
			relay_client: self.relay_client.clone(),
			para_client: self.para_client.clone(),
			para_id: self.para_id,
		};

		let headers = client_wrapper
			.query_finalized_parachain_headers_at(
				commitment_block_number,
				client_state.latest_beefy_height,
			)
			.await
			.map_err(|e| {
				Error::from(format!("[fetch_finalized_parachain_headers_at] Failed due to {:?}", e))
			})?;

		Ok(headers)
	}

	/// Construct the [`ParachainHeadersWithFinalityProof`] for parachain headers with the given
	/// numbers using the BEEFY finality proof with the given relay chain heights.
	pub async fn query_beefy_finalized_parachain_headers_with_proof(
		&self,
		commitment_block_number: u32,
		client_state: &ClientState,
		headers: Vec<<<T as subxt::Config>::Header as Header>::Number>,
	) -> Result<(Vec<ParachainHeader>, Proof<H256>), Error>
	where
		<<T as subxt::Config>::Header as Header>::Number: Ord + sp_runtime::traits::Zero,
		<T as subxt::Config>::Header: Decode,
	{
		let client_wrapper = Prover {
			relay_client: self.relay_client.clone(),
			para_client: self.para_client.clone(),
			para_id: self.para_id,
		};

		let (parachain_headers, batch_proof) = client_wrapper
			.query_finalized_parachain_headers_with_proof(
				commitment_block_number,
				client_state.latest_beefy_height,
				headers,
			)
			.await
			.map_err(|e| {
				Error::from(format!("[fetch_finalized_parachain_headers_at] Failed due to {:?}", e))
			})?;

		let parachain_headers = parachain_headers
			.into_iter()
			.map(|para_header| {
				Ok(ParachainHeader {
					parachain_header: codec::Decode::decode(&mut &*para_header.parachain_header)?,
					partial_mmr_leaf: para_header.partial_mmr_leaf,
					parachain_heads_proof: para_header.parachain_heads_proof,
					heads_leaf_index: para_header.heads_leaf_index,
					heads_total_count: para_header.heads_total_count,
					extrinsic_proof: para_header.extrinsic_proof,
					timestamp_extrinsic: para_header.timestamp_extrinsic,
				})
			})
			.collect::<Result<Vec<_>, codec::Error>>()?;

		Ok((parachain_headers, batch_proof))
	}

	/// Queries for the BEEFY mmr update proof for the given signed commitment height.
	pub async fn query_beefy_mmr_update_proof(
		&self,
		signed_commitment: beefy_primitives::SignedCommitment<
			u32,
			beefy_primitives::crypto::Signature,
		>,
	) -> Result<MmrUpdateProof, Error> {
		let prover = Prover {
			relay_client: self.relay_client.clone(),
			para_client: self.para_client.clone(),
			para_id: self.para_id,
		};

		let mmr_update =
			prover.fetch_mmr_update_proof_for(signed_commitment).await.map_err(|e| {
				Error::from(format!("[fetch_mmr_update_proof_for] Failed due to {:?}", e))
			})?;
		Ok(mmr_update)
	}

	/// Submits the given transaction to the parachain node, waits for it to be included in a block
	/// and asserts that it was successfully dispatched on-chain.
	///
	/// We retry sending the transaction up to 5 times in the case where the transaction pool might
	/// reject the transaction because of conflicting nonces.
	pub async fn submit_call<C: TxPayload>(&self, call: C) -> Result<(T::Hash, T::Hash), Error> {
		// Try extrinsic submission five times in case of failures
		let mut count = 0;
		let progress = loop {
			if count == 10 {
				Err(Error::Custom("Failed to submit extrinsic after 5 tries".to_string()))?
			}

			let other_params = T::custom_extrinsic_params(&self.para_client).await?;

			let res = {
				let signer = ExtrinsicSigner::<T, Self>::new(
					self.key_store.clone(),
					self.key_type_id.clone(),
					self.public_key.clone(),
				);
				self.para_client
					.tx()
					.sign_and_submit_then_watch(&call, &signer, other_params)
					.await
			};
			match res {
				Ok(progress) => break progress,
				Err(e) => {
					log::warn!("Failed to submit extrinsic: {:?}. Retrying...", e);
					count += 1;
					tokio::time::sleep(std::time::Duration::from_secs(10)).await;
				},
			}
		};

		let tx_in_block =
			tokio::time::timeout(WAIT_FOR_IN_BLOCK_TIMEOUT, progress.wait_for_in_block())
				.await
				.map_err(|e| {
					Error::from(format!("[submit_call] Failed to wait for in block due to {:?}", e))
				})??;
		tx_in_block.wait_for_success().await?;
		Ok((tx_in_block.extrinsic_hash(), tx_in_block.block_hash()))
	}

	pub fn client_id(&self) -> ClientId {
		self.client_id
			.lock()
			.unwrap()
			.as_ref()
			.expect("Client Id should be defined")
			.clone()
	}
}

impl<T: light_client_common::config::Config + Send + Sync> ParachainClient<T>
where
	u32: From<<<T as subxt::Config>::Header as HeaderT>::Number>,
	Self: KeyProvider,
	<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
		From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
	MultiSigner: From<MultiSigner>,
	<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
	<T as subxt::Config>::Signature: From<MultiSignature> + Send + Sync,
	H256: From<T::Hash>,
	<<T as subxt::Config>::Header as Header>::Number: Ord + sp_runtime::traits::Zero + One,
	T::Header: HeaderT,
	<<T::Header as HeaderT>::Hasher as subxt::config::Hasher>::Output: From<T::Hash>,
	<<T as subxt::Config>::Header as Header>::Number: From<u32>,
	BTreeMap<H256, ParachainHeaderProofs>:
		From<BTreeMap<<T as subxt::Config>::Hash, ParachainHeaderProofs>>,
	<T as subxt::Config>::AccountId: Send + Sync,
	<T as subxt::Config>::Address: Send + Sync,
{
	/// Construct a beefy client state to be submitted to the counterparty chain
	pub async fn construct_beefy_client_state(
		&self,
	) -> Result<(AnyClientState, AnyConsensusState), Error>
	where
		Self: KeyProvider,
		<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
			From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
		MultiSigner: From<MultiSigner>,
		<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
		u32: From<<<T as subxt::Config>::Header as subxt::config::Header>::Number>,
	{
		use ibc::core::ics24_host::identifier::ChainId;
		let api = self.relay_client.storage();
		let para_client_api = self.para_client.storage();
		let client_wrapper = Prover {
			relay_client: self.relay_client.clone(),
			para_client: self.para_client.clone(),
			para_id: self.para_id,
		};
		loop {
			let beefy_state = client_wrapper.construct_beefy_client_state().await.map_err(|e| {
				Error::from(format!("[construct_beefy_client_state] Failed due to {:?}", e))
			})?;

			let subxt_block_number: subxt::rpc::types::BlockNumber =
				beefy_state.latest_beefy_height.into();
			let block_hash =
				self.relay_client.rpc().block_hash(Some(subxt_block_number)).await?.ok_or_else(
					|| Error::Custom(format!("Couldn't find block hash for relay block",)),
				)?;
			let heads_addr = T::Storage::paras_heads(self.para_id);
			let head_data = <T::Storage as RuntimeStorage>::HeadData::from_inner(
				api.at(block_hash).fetch(&heads_addr).await?.ok_or_else(|| {
					Error::Custom(format!(
						"Couldn't find header for ParaId({}) at relay block {:?}",
						self.para_id, block_hash
					))
				})?,
			);
			let decoded_para_head = sp_runtime::generic::Header::<
				u32,
				sp_runtime::traits::BlakeTwo256,
			>::decode(&mut &*head_data.as_ref())?;
			let block_number = decoded_para_head.number;
			let client_state = BeefyClientState::<HostFunctionsManager> {
				chain_id: ChainId::new("relay-chain".to_string(), 0),
				relay_chain: Default::default(),
				mmr_root_hash: beefy_state.mmr_root_hash,
				latest_beefy_height: beefy_state.latest_beefy_height,
				frozen_height: None,
				latest_para_height: block_number,
				para_id: self.para_id,
				authority: beefy_state.current_authorities,
				next_authority_set: beefy_state.next_authorities,
				_phantom: Default::default(),
			};
			// we can't use the genesis block to construct the initial state.
			if block_number == 0 {
				continue
			}
			let subxt_block_number: subxt::rpc::types::BlockNumber = block_number.into();
			let block_hash =
				self.para_client.rpc().block_hash(Some(subxt_block_number)).await?.ok_or_else(
					|| Error::Custom(format!("Couldn't find block hash for para block",)),
				)?;
			let timestamp_addr = T::Storage::timestamp_now();
			let unix_timestamp_millis = para_client_api
				.at(block_hash)
				.fetch(&timestamp_addr)
				.await?
				.expect("Timestamp should exist");
			let timestamp_nanos = Duration::from_millis(unix_timestamp_millis).as_nanos() as u64;

			let consensus_state = AnyConsensusState::Beefy(BeefyConsensusState {
				timestamp: Timestamp::from_nanoseconds(timestamp_nanos)
					.unwrap()
					.into_tm_time()
					.unwrap(),
				root: decoded_para_head.state_root.as_bytes().to_vec().into(),
			});

			return Ok((AnyClientState::Beefy(client_state), consensus_state))
		}
	}

	pub async fn construct_grandpa_client_state(
		&self,
	) -> Result<(AnyClientState, AnyConsensusState), Error>
	where
		Self: KeyProvider,
		<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
			From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
		MultiSigner: From<MultiSigner>,
		<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
		u32: From<<<T as subxt::Config>::Header as Header>::Number>,
		<T as subxt::Config>::Hash: From<H256>,
		<T as subxt::Config>::Header: Decode,
	{
		let relay_ws_client = self.relay_ws_client.clone();
		let para_ws_client = self.para_ws_client.clone();
		let prover = GrandpaProver {
			relay_client: self.relay_client.clone(),
			relay_ws_client,
			para_client: self.para_client.clone(),
			para_ws_client,
			para_id: self.para_id,
			rpc_call_delay: self.common_state.rpc_call_delay,
		};
		let api = self.relay_client.storage();
		let para_client_api = self.para_client.storage();
		loop {
			let light_client_state = prover
				.initialize_client_state()
				.await
				.map_err(|e| Error::from(format!("Error constructing client state: {e}")))?;

			let heads_addr = T::Storage::paras_heads(self.para_id);
			let head_data = <T::Storage as RuntimeStorage>::HeadData::from_inner(
				api.at(light_client_state.latest_relay_hash.into())
					.fetch(&heads_addr)
					.await?
					.ok_or_else(|| {
						Error::Custom(format!(
							"Couldn't find header for ParaId({}) at relay block {:?}",
							self.para_id, light_client_state.latest_relay_hash
						))
					})?,
			);
			let decoded_para_head = sp_runtime::generic::Header::<
				u32,
				sp_runtime::traits::BlakeTwo256,
			>::decode(&mut &*head_data.as_ref())?;
			let block_number = decoded_para_head.number;
			// we can't use the genesis block to construct the initial state.
			if block_number == 0 {
				continue
			}

			let mut client_state = GrandpaClientState::<HostFunctionsManager>::default();

			client_state.relay_chain = Default::default();
			client_state.current_authorities = light_client_state.current_authorities;
			client_state.current_set_id = light_client_state.current_set_id;
			client_state.latest_relay_hash = light_client_state.latest_relay_hash.into();
			client_state.frozen_height = None;
			client_state.latest_para_height = block_number;
			client_state.para_id = self.para_id;
			client_state.latest_relay_height = light_client_state.latest_relay_height;

			let subxt_block_number: subxt::rpc::types::BlockNumber = block_number.into();
			let block_hash =
				self.para_client.rpc().block_hash(Some(subxt_block_number)).await?.ok_or_else(
					|| {
						Error::Custom(format!(
							"Couldn't find block hash for ParaId({}) at block number {}",
							self.para_id, block_number
						))
					},
				)?;
			let timestamp_addr = T::Storage::timestamp_now();
			let unix_timestamp_millis = para_client_api
				.at(block_hash)
				.fetch(&timestamp_addr)
				.await?
				.expect("Timestamp should exist");
			let timestamp_nanos = Duration::from_millis(unix_timestamp_millis).as_nanos() as u64;

			let consensus_state = AnyConsensusState::Grandpa(GrandpaConsensusState {
				timestamp: Timestamp::from_nanoseconds(timestamp_nanos)
					.unwrap()
					.into_tm_time()
					.unwrap(),
				root: decoded_para_head.state_root.as_bytes().to_vec().into(),
			});

			return Ok((AnyClientState::Grandpa(client_state), consensus_state))
		}
	}
}
