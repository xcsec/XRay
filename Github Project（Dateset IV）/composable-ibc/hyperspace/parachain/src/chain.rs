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

use super::{error::Error, signer::ExtrinsicSigner, ParachainClient};
use crate::{parachain::UncheckedExtrinsic, provider::TransactionId, FinalityProtocol};
use anyhow::anyhow;
use codec::{Decode, Encode};
use finality_grandpa::BlockNumberOps;
use finality_grandpa_rpc::GrandpaApiClient;
use futures::{Stream, StreamExt, TryFutureExt};
use grandpa_light_client_primitives::{FinalityProof, ParachainHeaderProofs};
use ibc::{
	core::{
		ics02_client::{
			events::UpdateClient,
			msgs::{update_client::MsgUpdateAnyClient, ClientMsg},
		},
		ics26_routing::msgs::Ics26Envelope,
	},
	events::IbcEvent,
	tx_msg::Msg,
	Height,
};
use ibc_proto::google::protobuf::Any;
use ics10_grandpa::client_message::{ClientMessage, Misbehaviour, RelayChainHeader};
use itertools::Itertools;
use jsonrpsee_ws_client::WsClientBuilder;
use light_client_common::config::{EventRecordT, RuntimeCall, RuntimeTransactions};
use pallet_ibc::light_clients::AnyClientMessage;
use primitives::{
	mock::LocalClientTypes, Chain, CommonClientState, IbcProvider, MisbehaviourHandler,
};
use sc_consensus_beefy_rpc::BeefyApiClient;
use sp_core::{twox_128, H256};
use sp_runtime::{
	traits::{IdentifyAccount, One, Verify},
	MultiSignature, MultiSigner,
};
use std::{collections::BTreeMap, fmt::Display, pin::Pin, sync::Arc, time::Duration};
use subxt::{
	config::{
		extrinsic_params::{BaseExtrinsicParamsBuilder, Era},
		ExtrinsicParams, Header as HeaderT, Header,
	},
	events::Phase,
};
use tokio::time::sleep;
use transaction_payment_rpc::TransactionPaymentApiClient;
use transaction_payment_runtime_api::RuntimeDispatchInfo;

type GrandpaJustification = grandpa_light_client_primitives::justification::GrandpaJustification<
	polkadot_core_primitives::Header,
>;

type BeefyJustification =
	beefy_primitives::SignedCommitment<u32, beefy_primitives::crypto::Signature>;

/// An encoded justification proving that the given header has been finalized
#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct JustificationNotification(sp_core::Bytes);

#[async_trait::async_trait]
impl<T: light_client_common::config::Config + Send + Sync + Clone + 'static> Chain
	for ParachainClient<T>
where
	u32: From<<<T as subxt::Config>::Header as HeaderT>::Number>,
	u32: From<<<T as subxt::Config>::Header as Header>::Number>,
	<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
		From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
	MultiSigner: From<MultiSigner>,
	<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
	<T as subxt::Config>::Signature: From<MultiSignature> + Send + Sync,
	<<T as subxt::Config>::Header as Header>::Number:
		BlockNumberOps + From<u32> + Display + Ord + sp_runtime::traits::Zero + One + Send + Sync,
	<T as subxt::Config>::Header: Decode + Send + Sync + Clone,
	T::Hash: From<sp_core::H256> + From<[u8; 32]>,
	BTreeMap<sp_core::H256, ParachainHeaderProofs>:
		From<BTreeMap<<T as subxt::Config>::Hash, ParachainHeaderProofs>>,
	sp_core::H256: From<T::Hash>,
	<T::ExtrinsicParams as ExtrinsicParams<T::Index, T::Hash>>::OtherParams:
		From<BaseExtrinsicParamsBuilder<T, T::Tip>> + Send + Sync,
	<T as subxt::Config>::AccountId: Send + Sync,
	<T as subxt::Config>::Address: Send + Sync,
	<T as light_client_common::config::Config>::AssetId: Clone,
{
	fn name(&self) -> &str {
		&*self.name
	}

	fn block_max_weight(&self) -> u64 {
		self.max_extrinsic_weight * 100 / 80
	}

	async fn estimate_weight(&self, messages: Vec<Any>) -> Result<u64, Self::Error> {
		let extrinsic = {
			// todo: put this in utils
			let signer = ExtrinsicSigner::<T, Self>::new(
				self.key_store.clone(),
				self.key_type_id.clone(),
				self.public_key.clone(),
			);

			let messages = messages
				.into_iter()
				.map(|msg| Any { type_url: msg.type_url.clone(), value: msg.value })
				.collect::<Vec<_>>();

			let tx_params = BaseExtrinsicParamsBuilder::new()
				.tip(T::Tip::from(100_000u128))
				.era(Era::Immortal, self.para_client.genesis_hash());
			let call = T::Tx::ibc_deliver(messages);
			self.para_client
				.tx()
				.create_signed(&call, &signer, tx_params.into())
				.await?
				.encoded()
				.to_vec()
		};
		let dispatch_info = TransactionPaymentApiClient::<
			H256,
			RuntimeDispatchInfo<u128, sp_weights::Weight>,
		>::query_info(&*self.para_ws_client, extrinsic.into(), None)
		.await
		.map_err(|e| Error::from(format!("Rpc Error From Estimating weight {:?}", e)))?;
		Ok(dispatch_info.weight.ref_time())
	}

	async fn finality_notifications(
		&self,
	) -> Result<
		Pin<Box<dyn Stream<Item = <Self as IbcProvider>::FinalityEvent> + Send + Sync>>,
		Error,
	> {
		match self.finality_protocol {
			FinalityProtocol::Grandpa => {
				let subscription =
					GrandpaApiClient::<JustificationNotification, sp_core::H256, u32>::subscribe_justifications(
						&*self.relay_ws_client,
					)
						.await?
						.chunks(3)
						.map(|mut notifs| notifs.remove(notifs.len() - 1)); // skip every 3 finality notifications

				let stream = subscription.filter_map(|justification_notif| {
					let encoded_justification = match justification_notif {
						Ok(JustificationNotification(sp_core::Bytes(justification))) =>
							justification,
						Err(err) => {
							log::error!("Failed to fetch Justification: {}", err);
							return futures::future::ready(None)
						},
					};

					let justification =
						match GrandpaJustification::decode(&mut &*encoded_justification) {
							Ok(j) => j,
							Err(err) => {
								log::error!("Grandpa Justification scale decode error: {}", err);
								return futures::future::ready(None)
							},
						};
					futures::future::ready(Some(Self::FinalityEvent::Grandpa(justification)))
				});

				Ok(Box::pin(Box::new(stream)))
			},
			FinalityProtocol::Beefy => {
				let subscription =
					BeefyApiClient::<JustificationNotification, sp_core::H256>::subscribe_justifications(
						&*self.relay_ws_client,
					)
						.await
						.expect("Failed to subscribe to beefy justifications");

				let stream = subscription.filter_map(|commitment_notification| {
					let encoded_commitment = match commitment_notification {
						Ok(JustificationNotification(sp_core::Bytes(commitment))) => commitment,
						Err(err) => {
							log::error!("Failed to fetch Commitment: {}", err);
							return futures::future::ready(None)
						},
					};

					let signed_commitment =
						match BeefyJustification::decode(&mut &*encoded_commitment) {
							Ok(c) => c,
							Err(err) => {
								log::error!("SignedCommitment scale decode error: {}", err);
								return futures::future::ready(None)
							},
						};
					futures::future::ready(Some(Self::FinalityEvent::Beefy(signed_commitment)))
				});

				Ok(Box::pin(Box::new(stream)))
			},
		}
	}

	async fn submit(&self, messages: Vec<Any>) -> Result<Self::TransactionId, Error> {
		let messages = messages
			.into_iter()
			.map(|msg| Any { type_url: msg.type_url.clone(), value: msg.value })
			.collect::<Vec<_>>();
		let messages_urls = messages.iter().map(|msg| msg.type_url.clone()).join(", ");
		let messages_urls_c = messages_urls.clone();
		log::debug!(target: "hyperspace_parachain", "Sending message: {messages_urls_c}");

		let call = T::Tx::ibc_deliver(messages.clone());
		let (ext_hash, block_hash) = self.submit_call(call).await?;

		log::debug!(target: "hyperspace_parachain", "Submitted extrinsic (hash: {:?}) to block {:?}", ext_hash, block_hash);

		Ok(TransactionId { ext_hash, block_hash })
	}

	async fn query_client_message(&self, update: UpdateClient) -> Result<AnyClientMessage, Error> {
		let host_height = update.height();

		let now = std::time::Instant::now();
		let block_hash = loop {
			let maybe_hash = self
				.para_client
				.rpc()
				.block_hash(Some(host_height.revision_height.into()))
				.await?;
			match maybe_hash {
				Some(hash) => break hash,
				None => {
					if now.elapsed() > Duration::from_secs(20) {
						return Err(Error::from("Timeout while waiting for block".to_owned()))
					}
					sleep(Duration::from_millis(100)).await;
				},
			}
		};

		let mut storage_key = twox_128(b"System").to_vec();
		storage_key.extend(twox_128(b"Events").to_vec());

		let event_bytes = self
			.para_client
			.rpc()
			.storage(&*storage_key, Some(block_hash))
			.await?
			.map(|e| e.0)
			.ok_or_else(|| Error::from("No events found".to_owned()))?;
		let events: Vec<T::EventRecord> = Decode::decode(&mut &*event_bytes)
			.map_err(|e| Error::from(format!("Failed to decode events: {:?}", e)))?;
		let (transaction_index, event_index) = events
			.into_iter()
			.find_map(|pallet_event| {
				let tx_index = match pallet_event.phase() {
					Phase::ApplyExtrinsic(i) => i as usize,
					other => {
						log::error!("Unexpected event phase: {:?}", other);
						return None
					},
				};
				if let Some(events) = pallet_event.ibc_events() {
					events.into_iter().enumerate().find_map(|(i, event)| {
						TryInto::<IbcEvent>::try_into(event)
							.map(|event| match event {
								IbcEvent::UpdateClient(ev_update) if ev_update == update =>
									Some((tx_index, i)),
								_ => None,
							})
							.ok()
							.flatten()
					})
				} else {
					None
				}
			})
			.ok_or_else(|| Error::from("No update client event found".to_owned()))?;

		let block = self
			.para_client
			.rpc()
			.block(Some(block_hash.into()))
			.await?
			.ok_or_else(|| Error::from(format!("Block not found for hash {:?}", block_hash)))?;

		let extrinsic_opaque =
			block.block.extrinsics.get(transaction_index).expect("Extrinsic not found");

		let unchecked_extrinsic =
			UncheckedExtrinsic::<T>::decode(&mut &*extrinsic_opaque.0.encode())
				.map_err(|e| Error::from(format!("Extrinsic decode error: {}", e)))?;

		let messages = unchecked_extrinsic
			.function
			.extract_ibc_deliver_messages()
			.ok_or_else(|| Error::Custom("failed to extract deliver messages".to_string()))?;
		let message = messages
			.get(event_index)
			.ok_or_else(|| Error::from(format!("Message index {} out of bounds", event_index)))?;
		let envelope = Ics26Envelope::<LocalClientTypes>::try_from(Any {
			type_url: message.type_url.clone(),
			value: message.value.clone(),
		});
		match envelope {
			Ok(Ics26Envelope::Ics2Msg(ClientMsg::UpdateClient(update_msg))) =>
				return Ok(update_msg.client_message),
			_ => (),
		}

		Err(Error::from("No client message found".to_owned()))
	}

	async fn get_proof_height(&self, block_height: Height) -> Height {
		block_height
	}

	async fn handle_error(&mut self, error: &anyhow::Error) -> Result<(), anyhow::Error> {
		let err_str = if let Some(rpc_err) = error.downcast_ref::<Error>() {
			match rpc_err {
				Error::RpcError(s) => s.clone(),
				_ => "".to_string(),
			}
		} else {
			error.to_string()
		};
		log::debug!(target: "hyperspace", "Handling error: {err_str}");

		if err_str.contains("MaxSlotsExceeded") {
			self.common_state.rpc_call_delay = self.common_state.rpc_call_delay * 2;
		} else if err_str.contains("RestartNeeded") || err_str.contains("restart required") {
			self.reconnect().await?;
			self.common_state.rpc_call_delay = self.common_state.rpc_call_delay * 2;
		}

		Ok(())
	}

	async fn reconnect(&mut self) -> anyhow::Result<()> {
		let relay_ws_client = Arc::new(
			WsClientBuilder::default()
				.build(&self.relay_chain_rpc_url)
				.await
				.map_err(|e| Error::from(format!("Rpc Error {:?}", e)))?,
		);
		let para_ws_client = Arc::new(
			WsClientBuilder::default()
				.build(&self.parachain_rpc_url)
				.await
				.map_err(|e| Error::from(format!("Rpc Error {:?}", e)))?,
		);

		let para_client = subxt::OnlineClient::from_rpc_client(para_ws_client.clone()).await?;
		let relay_client = subxt::OnlineClient::from_rpc_client(relay_ws_client.clone()).await?;

		self.relay_ws_client = relay_ws_client;
		self.para_ws_client = para_ws_client;
		self.relay_client = relay_client;
		self.para_client = para_client;

		log::info!(target: "hyperspace", "Reconnected to relay chain and parachain");

		Ok(())
	}

	fn common_state(&self) -> &CommonClientState {
		&self.common_state
	}

	fn common_state_mut(&mut self) -> &mut CommonClientState {
		&mut self.common_state
	}
}

#[async_trait::async_trait]
impl<T: light_client_common::config::Config + Send + Sync> MisbehaviourHandler
	for ParachainClient<T>
where
	u32: From<<<T as subxt::Config>::Header as HeaderT>::Number>,
	u32: From<<<T as subxt::Config>::Header as Header>::Number>,
	<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
		From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
	MultiSigner: From<MultiSigner>,
	<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
	<T as subxt::Config>::Signature: From<MultiSignature> + Send + Sync,
	<<T as subxt::Config>::Header as Header>::Number:
		BlockNumberOps + From<u32> + Display + Ord + sp_runtime::traits::Zero + One,
	T::Hash: From<sp_core::H256> + From<[u8; 32]>,
	BTreeMap<sp_core::H256, ParachainHeaderProofs>:
		From<BTreeMap<<T as subxt::Config>::Hash, ParachainHeaderProofs>>,
	sp_core::H256: From<T::Hash>,
	<T::ExtrinsicParams as ExtrinsicParams<T::Index, T::Hash>>::OtherParams:
		From<BaseExtrinsicParamsBuilder<T, T::Tip>> + Send + Sync,
	<T as subxt::Config>::AccountId: Send + Sync,
	<T as subxt::Config>::Address: Send + Sync,
{
	async fn check_for_misbehaviour<C: Chain>(
		&self,
		counterparty: &C,
		client_message: AnyClientMessage,
	) -> Result<(), anyhow::Error> {
		let client_message = client_message.unpack_recursive_into();
		match client_message {
			AnyClientMessage::Grandpa(ClientMessage::Header(header)) => {
				let base_header = header
					.finality_proof
					.unknown_headers
					.iter()
					.min_by_key(|h| h.number)
					.expect("unknown_headers always contain at least one header; qed");

				let common_ancestor_header = self
					.relay_client
					.rpc()
					.header(Some(base_header.parent_hash.into()))
					.await?
					.ok_or_else(|| {
						anyhow!("No header found for hash: {:?}", base_header.parent_hash)
					})?;

				let common_ancestor_block_number = u32::from(common_ancestor_header.number());
				let encoded =
					GrandpaApiClient::<JustificationNotification, H256, u32>::prove_finality(
						&*self.relay_ws_client,
						common_ancestor_block_number + 1,
					)
					.await?
					.ok_or_else(|| {
						anyhow!(
							"No justification found for block: {:?}",
							header.finality_proof.block
						)
					})?
					.0;

				let mut trusted_finality_proof =
					FinalityProof::<RelayChainHeader>::decode(&mut &encoded[..])?;
				let trusted_justification =
					GrandpaJustification::decode(&mut &*trusted_finality_proof.justification)?;
				let to_block = trusted_justification.commit.target_number;
				let from_block = (common_ancestor_block_number + 1).min(to_block);

				let trusted_base_header_hash = self
					.relay_client
					.rpc()
					.block_hash(Some(from_block.into()))
					.await?
					.ok_or_else(|| anyhow!("No hash found for block: {:?}", from_block))?;

				let base_header_hash = base_header.hash();
				if base_header_hash != trusted_base_header_hash.into() {
					log::warn!(
						"Found misbehaviour on client {}: {:?} != {:?}",
						self.client_id
							.lock()
							.unwrap()
							.as_ref()
							.map(|x| x.as_str().to_owned())
							.unwrap_or_else(|| "{unknown}".to_owned()),
						base_header_hash,
						trusted_base_header_hash
					);

					trusted_finality_proof.unknown_headers.clear();
					// TODO: parallelize this
					for i in from_block..=to_block {
						let unknown_header_hash =
							self.relay_client.rpc().block_hash(Some(i.into())).await?.ok_or_else(
								|| {
									anyhow!(
										"No block hash found for block number: {:?}",
										common_ancestor_block_number
									)
								},
							)?;
						let unknown_header = self
							.relay_client
							.rpc()
							.header(Some(unknown_header_hash))
							.await?
							.ok_or_else(|| {
								anyhow!("No header found for hash: {:?}", unknown_header_hash)
							})?;
						trusted_finality_proof
							.unknown_headers
							.push(codec::Decode::decode(&mut &*unknown_header.encode()).expect(
							"Same header struct defined in different crates, decoding cannot panic",
						));
					}

					let misbehaviour = ClientMessage::Misbehaviour(Misbehaviour {
						first_finality_proof: header.finality_proof,
						second_finality_proof: trusted_finality_proof,
					});

					counterparty
						.submit(vec![MsgUpdateAnyClient::<LocalClientTypes>::new(
							self.client_id(),
							AnyClientMessage::Grandpa(misbehaviour.clone()),
							counterparty.account_id(),
						)
						.to_any()])
						.map_err(|e| anyhow!("Failed to submit misbehaviour report: {:?}", e))
						.await?;
				}
			},
			_ => {},
		}
		Ok(())
	}
}
