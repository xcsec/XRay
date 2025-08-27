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

//! Light client protocols for parachains.

use crate::{error::Error, ParachainClient};
use anyhow::anyhow;
use beefy_light_client_primitives::{ClientState as BeefyPrimitivesClientState, NodesUtils};
use codec::{Decode, Encode};
use finality_grandpa::BlockNumberOps;
use finality_grandpa_rpc::GrandpaApiClient;
use grandpa_light_client_primitives::{
	justification::find_scheduled_change, FinalityProof, ParachainHeaderProofs,
	ParachainHeadersWithFinalityProof,
};
use ibc::{
	core::ics02_client::{client_state::ClientState as _, msgs::update_client::MsgUpdateAnyClient},
	events::IbcEvent,
	tx_msg::Msg,
	Height,
};
use ibc_proto::google::protobuf::Any;
use ibc_rpc::{BlockNumberOrHash, IbcApiClient};
use ics10_grandpa::client_message::{ClientMessage, Header as GrandpaHeader};
use ics11_beefy::client_message::{
	BeefyHeader, ClientMessage as BeefyClientMessage, ParachainHeadersWithProof,
};
use pallet_ibc::light_clients::{AnyClientMessage, AnyClientState};
use primitives::{
	filter_events_by_ids, mock::LocalClientTypes, query_maximum_height_for_timeout_proofs, Chain,
	IbcProvider, KeyProvider, UpdateType,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sp_consensus_grandpa::GRANDPA_ENGINE_ID;
use sp_core::H256;
use sp_runtime::{
	traits::{BlakeTwo256, IdentifyAccount, One, Verify},
	MultiSignature, MultiSigner,
};
use std::{
	collections::{BTreeMap, BTreeSet, HashMap},
	fmt::{Debug, Display},
	time::Duration,
};

use grandpa_prover::{
	GrandpaJustification, GrandpaProver, JustificationNotification, PROCESS_BLOCKS_BATCH_SIZE,
};
use subxt::config::{
	extrinsic_params::BaseExtrinsicParamsBuilder, ExtrinsicParams, Header as HeaderT, Header,
};
use tendermint_proto::Protobuf;
use tokio::task::JoinSet;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum FinalityProtocol {
	Grandpa,
	Beefy,
}

/// Finality event for parachains
#[derive(Decode, Encode, Debug)]
pub enum FinalityEvent {
	Grandpa(
		grandpa_light_client_primitives::justification::GrandpaJustification<
			polkadot_core_primitives::Header,
		>,
	),
	Beefy(beefy_primitives::SignedCommitment<u32, beefy_primitives::crypto::Signature>),
}

impl FinalityProtocol {
	pub async fn query_latest_ibc_events<T, C>(
		&self,
		source: &mut ParachainClient<T>,
		finality_event: FinalityEvent,
		counterparty: &C,
	) -> Result<Vec<(Any, Height, Vec<IbcEvent>, UpdateType)>, anyhow::Error>
	where
		T: light_client_common::config::Config + Send + Sync,
		C: Chain,
		u32: From<<<T as subxt::Config>::Header as HeaderT>::Number>,
		u32: From<<<T as subxt::Config>::Header as Header>::Number>,
		ParachainClient<T>: Chain,
		ParachainClient<T>: KeyProvider,
		<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
			From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
		MultiSigner: From<MultiSigner>,
		<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
		<T as subxt::Config>::Signature: From<MultiSignature> + Send + Sync,
		<<T as subxt::Config>::Header as Header>::Number: BlockNumberOps
			+ From<u32>
			+ Display
			+ Ord
			+ sp_runtime::traits::Zero
			+ One
			+ Send
			+ Sync,
		<T as subxt::Config>::Header: Decode + Send + Sync + Clone,
		T::Hash: From<sp_core::H256> + From<[u8; 32]>,
		sp_core::H256: From<T::Hash>,
		BTreeMap<H256, ParachainHeaderProofs>:
			From<BTreeMap<<T as subxt::Config>::Hash, ParachainHeaderProofs>>,
		<T::ExtrinsicParams as ExtrinsicParams<T::Index, T::Hash>>::OtherParams:
			From<BaseExtrinsicParamsBuilder<T, T::Tip>> + Send + Sync,
		<T as subxt::Config>::AccountId: Send + Sync,
		<T as subxt::Config>::Address: Send + Sync,
	{
		match self {
			FinalityProtocol::Grandpa =>
				query_latest_ibc_events_with_grandpa::<T, C>(source, finality_event, counterparty)
					.await,
			FinalityProtocol::Beefy =>
				query_latest_ibc_events_with_beefy::<T, C>(source, finality_event, counterparty)
					.await,
		}
	}
}

/// Query the latest events that have been finalized by the BEEFY finality protocol.
pub async fn query_latest_ibc_events_with_beefy<T, C>(
	source: &mut ParachainClient<T>,
	finality_event: FinalityEvent,
	counterparty: &C,
) -> Result<Vec<(Any, Height, Vec<IbcEvent>, UpdateType)>, anyhow::Error>
where
	T: light_client_common::config::Config + Send + Sync,
	C: Chain,
	u32: From<<<T as subxt::Config>::Header as HeaderT>::Number>
		+ From<<<T as subxt::Config>::Header as Header>::Number>,
	ParachainClient<T>: Chain + KeyProvider,
	<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
		From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
	<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
	<T as subxt::Config>::Signature: From<MultiSignature> + Send + Sync,
	<<T as subxt::Config>::Header as Header>::Number:
		From<u32> + Debug + Display + Ord + sp_runtime::traits::Zero + One,
	<T as subxt::Config>::Header: Decode,
	<T::ExtrinsicParams as ExtrinsicParams<T::Index, T::Hash>>::OtherParams:
		From<BaseExtrinsicParamsBuilder<T, T::Tip>> + Send + Sync,
	T::Hash: From<sp_core::H256>,
	sp_core::H256: From<T::Hash>,
	<T as subxt::Config>::AccountId: Send + Sync,
	<T as subxt::Config>::Address: Send + Sync,
{
	let signed_commitment = match finality_event {
		FinalityEvent::Beefy(signed_commitment) => signed_commitment,
		_ => panic!("Expected beefy signed commitment"),
	};
	let client_id = source.client_id();
	let latest_height = counterparty.latest_height_and_timestamp().await?.0;
	let response = counterparty.query_client_state(latest_height, client_id).await?;
	let client_state = response.client_state.ok_or_else(|| {
		Error::Custom("Received an empty client state from counterparty".to_string())
	})?;
	let client_state =
		AnyClientState::decode_recursive(client_state, |c| matches!(c, AnyClientState::Beefy(_)))
			.ok_or_else(|| Error::Custom(format!("Failed to decode client state")))?;
	let beefy_client_state = match &client_state {
		AnyClientState::Beefy(client_state) => BeefyPrimitivesClientState {
			latest_beefy_height: client_state.latest_beefy_height,
			mmr_root_hash: client_state.mmr_root_hash,
			current_authorities: client_state.authority.clone(),
			next_authorities: client_state.next_authority_set.clone(),
		},
		c => Err(Error::ClientStateRehydration(format!(
			"Expected AnyClientState::Beefy found: {:?}",
			c
		)))?,
	};

	if signed_commitment.commitment.validator_set_id < beefy_client_state.current_authorities.id {
		log::info!(
			"Commitment: {:#?}\nClientState: {:#?}",
			signed_commitment.commitment,
			beefy_client_state
		);
		// If validator set id of signed commitment is less than current validator set
		// id we have Then commitment is outdated and we skip it.
		log::warn!(
				"Skipping outdated commitment \n Received signed commitmment with validator_set_id: {:?}\n Current authority set id: {:?}\n Next authority set id: {:?}\n",
				signed_commitment.commitment.validator_set_id, beefy_client_state.current_authorities.id, beefy_client_state.next_authorities.id
			);
		Err(Error::HeaderConstruction("Received an outdated beefy commitment".to_string()))?
	}

	// fetch the new parachain headers that have been finalized
	let headers = source
		.query_beefy_finalized_parachain_headers_between(
			signed_commitment.commitment.block_number,
			&beefy_client_state,
		)
		.await?;

	log::info!(
		"Fetching events from {} for blocks {:?}..{:?}",
		source.name(),
		headers[0].number(),
		headers.last().unwrap().number()
	);

	// Get finalized parachain block numbers, but only those higher than the latest para
	// height recorded in the on-chain client state, because in some cases a parachain
	// block that was already finalized in a former beefy block might still be part of
	// the parachain headers in a later beefy block, discovered this from previous logs
	let finalized_blocks =
		headers.iter().map(|header| u32::from(header.number())).collect::<Vec<_>>();

	let finalized_block_numbers = finalized_blocks
		.iter()
		.filter_map(|block_number| {
			if (client_state.latest_height().revision_height as u32) < *block_number {
				Some(*block_number)
			} else {
				None
			}
		})
		.map(|h| BlockNumberOrHash::Number(h))
		.collect::<Vec<_>>();

	// 1. we should query the sink chain for any outgoing packets to the source chain
	// and return the maximum height at which we can construct non-existence proofs for
	// all these packets on the source chain
	let max_height_for_timeouts =
		query_maximum_height_for_timeout_proofs(counterparty, source).await;
	let timeout_update_required = if let Some(max_height) = max_height_for_timeouts {
		let max_height = max_height as u32;
		finalized_blocks.contains(&max_height)
	} else {
		false
	};

	let latest_finalized_block = finalized_blocks.into_iter().max().unwrap_or_default();

	let authority_set_changed =
		signed_commitment.commitment.validator_set_id == beefy_client_state.next_authorities.id;

	let is_update_required = source
		.is_update_required(
			latest_finalized_block.into(),
			client_state.latest_height().revision_height,
		)
		.await?;

	// if validator set has changed this is a mandatory update
	let update_type = match authority_set_changed || timeout_update_required || is_update_required {
		true => UpdateType::Mandatory,
		false => UpdateType::Optional,
	};

	// block_number => events
	let events: HashMap<String, Vec<IbcEvent>> = IbcApiClient::<
		u32,
		H256,
		<T as light_client_common::config::Config>::AssetId,
	>::query_events(
		&*source.para_ws_client, finalized_block_numbers
	)
	.await?;

	// header number is serialized to string
	let mut headers_with_events = events
		.iter()
		.filter_map(|(num, events)| {
			if events.is_empty() {
				None
			} else {
				str::parse::<u32>(&*num)
					.ok()
					.map(<<T as subxt::Config>::Header as Header>::Number::from)
			}
		})
		.collect::<BTreeSet<_>>();

	let events: Vec<IbcEvent> = events
		.into_values()
		.flatten()
		.filter(|e| {
			let mut channel_and_port_ids = source.channel_whitelist();
			channel_and_port_ids.extend(counterparty.channel_whitelist());
			filter_events_by_ids(
				e,
				&[source.client_id(), counterparty.client_id()],
				&[source.connection_id(), counterparty.connection_id()]
					.into_iter()
					.flatten()
					.collect::<Vec<_>>(),
				&channel_and_port_ids,
			)
		})
		.collect();

	if timeout_update_required {
		let max_height_for_timeouts = max_height_for_timeouts.unwrap();
		if max_height_for_timeouts > client_state.latest_height().revision_height {
			let max_timeout_height = <<T as subxt::Config>::Header as Header>::Number::from(
				max_height_for_timeouts as u32,
			);
			headers_with_events.insert(max_timeout_height);
		}
	}

	if is_update_required {
		headers_with_events
			.insert(<<T as subxt::Config>::Header as Header>::Number::from(latest_finalized_block));
	}

	// only query proofs for headers that actually have events or are mandatory
	let headers_with_proof = if !headers_with_events.is_empty() {
		let (headers, batch_proof) = source
			.query_beefy_finalized_parachain_headers_with_proof(
				signed_commitment.commitment.block_number,
				&beefy_client_state,
				headers_with_events.into_iter().collect(),
			)
			.await?;
		let mmr_size = NodesUtils::new(batch_proof.leaf_count).size();

		Some(ParachainHeadersWithProof {
			headers,
			mmr_size,
			leaf_indices: batch_proof.leaf_indices,
			mmr_proofs: batch_proof.items.into_iter().map(|item| item.encode()).collect(),
			leaf_count: batch_proof.leaf_count,
		})
	} else {
		None
	};

	let mmr_update = source.query_beefy_mmr_update_proof(signed_commitment).await?;

	let update_header = {
		let msg = MsgUpdateAnyClient::<LocalClientTypes> {
			client_id: source.client_id(),
			client_message: AnyClientMessage::Beefy(BeefyClientMessage::Header(BeefyHeader {
				headers_with_proof,
				mmr_update_proof: Some(mmr_update),
			})),
			signer: counterparty.account_id(),
		};
		let value = msg.encode_vec()?;
		Any { value, type_url: msg.type_url() }
	};

	// FIXME: use height from the beefy header
	Ok(vec![(update_header, Height::new(0, 0), events, update_type)])
}

async fn find_next_justification<T>(
	prover: &GrandpaProver<T>,
	from: u32,
	to: u32,
) -> anyhow::Result<Option<GrandpaJustification<T::Header>>>
where
	T: light_client_common::config::Config + Send + Sync,
	u32: From<<<T as subxt::Config>::Header as HeaderT>::Number>
		+ From<<<T as subxt::Config>::Header as Header>::Number>,
	ParachainClient<T>: Chain + KeyProvider,
	<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
		From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
	<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
	<T as subxt::Config>::Signature: From<MultiSignature> + Send + Sync,
	<<T as subxt::Config>::Header as Header>::Number:
		BlockNumberOps + From<u32> + Display + Ord + sp_runtime::traits::Zero + One + Send + Sync,
	T::Hash: From<sp_core::H256> + From<[u8; 32]>,
	sp_core::H256: From<T::Hash>,
	BTreeMap<H256, ParachainHeaderProofs>:
		From<BTreeMap<<T as subxt::Config>::Hash, ParachainHeaderProofs>>,
	<T::ExtrinsicParams as ExtrinsicParams<T::Index, T::Hash>>::OtherParams:
		From<BaseExtrinsicParamsBuilder<T, T::Tip>> + Send + Sync,
	<T as subxt::Config>::Header: Decode + Send + Sync + Clone,
	<T as subxt::Config>::AccountId: Send + Sync,
	<T as subxt::Config>::Address: Send + Sync,
{
	log::debug!(target: "hyperspace", "Trying to find next justification in blocks {from}..{to}");
	let mut join_set: JoinSet<Result<_, anyhow::Error>> = JoinSet::new();
	let heights = (from..to).collect::<Vec<_>>();
	for heights in heights.chunks(PROCESS_BLOCKS_BATCH_SIZE) {
		for height in heights.to_owned() {
			if height % 100 == 0 {
				log::debug!(target: "hyperspace", "Looking for a closer proof {height}/{to}...");
			}
			let relay_client = prover.relay_client.clone();
			let delay = prover.rpc_call_delay.as_millis();
			let duration = Duration::from_millis(rand::thread_rng().gen_range(1..delay) as u64);
			join_set.spawn(async move {
				tokio::time::sleep(duration).await;
				let Some(hash) = relay_client.rpc().block_hash(Some(height.into())).await? else {
					return Ok(None)
				};
				let Some(block) = relay_client.rpc().block(Some(hash)).await? else {
					return Ok(None)
				};
				let Some(justifications) = block.justifications else { return Ok(None) };
				for (id, justification) in justifications {
					log::info!(target: "hyperspace", "Found closer justification at {height} (suggested {to})");
					if id == GRANDPA_ENGINE_ID {
						let decoded_justification =
							GrandpaJustification::<T::Header>::decode(&mut &justification[..])?;
						return Ok(Some(decoded_justification))
					}
				}
				return Ok(None)
			});
		}
		while let Some(res) = join_set.join_next().await {
			let justification = res??;
			if justification.is_some() {
				join_set.abort_all();
				return Ok(justification)
			}
		}
	}

	Ok(None)
}

/// Query the latest events that have been finalized by the GRANDPA finality protocol.
pub async fn query_latest_ibc_events_with_grandpa<T, C>(
	source: &mut ParachainClient<T>,
	finality_event: FinalityEvent,
	counterparty: &C,
) -> Result<Vec<(Any, Height, Vec<IbcEvent>, UpdateType)>, anyhow::Error>
where
	T: light_client_common::config::Config + Send + Sync,
	C: Chain,
	u32: From<<<T as subxt::Config>::Header as HeaderT>::Number>
		+ From<<<T as subxt::Config>::Header as Header>::Number>,
	ParachainClient<T>: Chain + KeyProvider,
	<<T as light_client_common::config::Config>::Signature as Verify>::Signer:
		From<MultiSigner> + IdentifyAccount<AccountId = T::AccountId>,
	<T as subxt::Config>::Address: From<<T as subxt::Config>::AccountId>,
	<T as subxt::Config>::Signature: From<MultiSignature> + Send + Sync,
	<<T as subxt::Config>::Header as Header>::Number:
		BlockNumberOps + From<u32> + Display + Ord + sp_runtime::traits::Zero + One + Send + Sync,
	T::Hash: From<sp_core::H256> + From<[u8; 32]>,
	sp_core::H256: From<T::Hash>,
	BTreeMap<H256, ParachainHeaderProofs>:
		From<BTreeMap<<T as subxt::Config>::Hash, ParachainHeaderProofs>>,
	<T::ExtrinsicParams as ExtrinsicParams<T::Index, T::Hash>>::OtherParams:
		From<BaseExtrinsicParamsBuilder<T, T::Tip>> + Send + Sync,
	<T as subxt::Config>::Header: Decode + Send + Sync + Clone,
	<T as subxt::Config>::AccountId: Send + Sync,
	<T as subxt::Config>::Address: Send + Sync,
{
	let latest_justification = match finality_event {
		FinalityEvent::Grandpa(justification) => justification,
		_ => panic!("Expected grandpa finality event"),
	};
	let client_id = source.client_id();
	let latest_height = counterparty.latest_height_and_timestamp().await?.0;
	let response = counterparty.query_client_state(latest_height, client_id).await?;
	let any_client_state = response.client_state.ok_or_else(|| {
		Error::Custom("Received an empty client state from counterparty".to_string())
	})?;

	let AnyClientState::Grandpa(client_state) =
		AnyClientState::decode_recursive(any_client_state, |c| {
			matches!(c, AnyClientState::Grandpa(_))
		})
		.ok_or_else(|| Error::Custom(format!("Could not decode client state")))?
	else {
		unreachable!()
	};

	let prover = source.grandpa_prover();
	// prove_finality will always give us the highest block finalized by the authority set for the
	// block number passed, so we can't miss any authority set change since the session change block
	// will always be finalized.
	let next_relay_height = client_state.latest_relay_height + 1;

	let encoded = GrandpaApiClient::<JustificationNotification, H256, u32>::prove_finality(
		// we cast between the same type but different crate versions.
		&*prover.relay_ws_client.clone(),
		next_relay_height,
	)
	.await
	.map_err(|_| {
		Error::Custom(
		format!("Next relay block {} has not been finalized, previous finalized height on counterparty {}",
				next_relay_height, client_state.latest_relay_height
		)
	)
	})?
	.ok_or_else(|| anyhow!("No justification found for block: {:?}", next_relay_height))?
	.0;

	let finality_proof = FinalityProof::<T::Header>::decode(&mut &encoded[..])?;

	let mut justification =
		GrandpaJustification::<T::Header>::decode(&mut &finality_proof.justification[..])?;

	let diff = justification
		.commit
		.target_number
		.saturating_sub(client_state.latest_relay_height);
	if diff > 100 {
		// try to find a closer justification
		if let Some(new_justification) = find_next_justification(
			&prover,
			client_state.latest_relay_height + 1,
			justification.commit.target_number,
		)
		.await?
		{
			justification = new_justification;
		}
	}

	// Sometimes the returned justification doesn't contain the header for the target block
	// in the votes ancestry, so we need to fetch it manually
	if !justification.votes_ancestries.is_empty() &&
		!justification
			.votes_ancestries
			.iter()
			.any(|h| h.number().into() == justification.commit.target_number as u64)
	{
		let header = prover
			.relay_client
			.rpc()
			.header(Some(justification.commit.target_hash.into()))
			.await
			.unwrap()
			.unwrap();
		justification.votes_ancestries.push(header);
	}

	let justification = justification;

	// fetch the latest finalized parachain header
	let finalized_para_header = prover
		.query_latest_finalized_parachain_header(justification.commit.target_number)
		.await?;

	// notice the inclusive range
	let finalized_para_height = u32::from(finalized_para_header.number());
	let finalized_blocks =
		((client_state.latest_para_height + 1)..=finalized_para_height).collect::<Vec<_>>();

	if !finalized_blocks.is_empty() {
		log::info!(
			"Fetching events from {} for blocks {}..{}",
			source.name(),
			finalized_blocks[0],
			finalized_blocks.last().unwrap(),
		);
	}

	let finalized_block_numbers = finalized_blocks
		.iter()
		.map(|h| BlockNumberOrHash::Number(*h))
		.collect::<Vec<_>>();

	// 1. we should query the sink chain for any outgoing packets to the source chain
	// and return the maximum height at which we can construct non-existence proofs for
	// all these packets on the source chain
	let max_height_for_timeouts =
		query_maximum_height_for_timeout_proofs(counterparty, source).await;
	let timeout_update_required = if let Some(max_height) = max_height_for_timeouts {
		let max_height = max_height as u32;
		finalized_blocks.contains(&max_height)
	} else {
		false
	};

	// block_number => events
	let events: HashMap<String, Vec<IbcEvent>> = IbcApiClient::<
		u32,
		H256,
		<T as light_client_common::config::Config>::AssetId,
	>::query_events(
		&*source.para_ws_client, finalized_block_numbers
	)
	.await?;

	// header number is serialized to string
	let mut headers_with_events = events
		.iter()
		.filter_map(|(num, events)| {
			if events.is_empty() {
				None
			} else {
				str::parse::<u32>(&*num)
					.ok()
					.map(<<T as subxt::Config>::Header as Header>::Number::from)
			}
		})
		.collect::<BTreeSet<_>>();

	let events: Vec<IbcEvent> = events
		.into_values()
		.flatten()
		.filter(|e| {
			let mut channel_and_port_ids = source.channel_whitelist();
			channel_and_port_ids.extend(counterparty.channel_whitelist());
			let f = filter_events_by_ids(
				e,
				&[source.client_id(), counterparty.client_id()],
				&[source.connection_id(), counterparty.connection_id()]
					.into_iter()
					.flatten()
					.collect::<Vec<_>>(),
				&channel_and_port_ids,
			);
			log::trace!(target: "hyperspace", "Filtering event: {:?}: {f}", e.event_type());
			f
		})
		.collect();

	if timeout_update_required {
		let max_height_for_timeouts = max_height_for_timeouts.unwrap();
		if max_height_for_timeouts > client_state.latest_height().revision_height {
			let max_timeout_height = <<T as subxt::Config>::Header as Header>::Number::from(
				max_height_for_timeouts as u32,
			);
			headers_with_events.insert(max_timeout_height);
		}
	}

	// In a situation where the sessions last a couple hours and we don't see any ibc events during
	// a session we want to send some block updates in between the session, this would serve as
	// checkpoints so we don't end up with a very large finality proof at the session end.
	let is_update_required = source
		.is_update_required(
			latest_justification.commit.target_number.into(),
			client_state.latest_relay_height.into(),
		)
		.await?;

	// We ensure we advance the finalized latest parachain height
	if client_state.latest_para_height < finalized_para_height {
		headers_with_events.insert(finalized_para_header.number());
	}

	let ParachainHeadersWithFinalityProof { finality_proof, parachain_headers, .. } = prover
		.query_finalized_parachain_headers_with_proof::<T::Header>(
			client_state.latest_relay_height,
			justification.commit.target_number,
			Some(justification.encode()),
			headers_with_events.into_iter().collect(),
		)
		.await?;

	let target = source
		.relay_client
		.rpc()
		.header(Some(finality_proof.block.into()))
		.await?
		.ok_or_else(|| {
			Error::from("Could not find relay chain header for justification target".to_string())
		})?
		.encode();
	let target = sp_runtime::generic::Header::<u32, BlakeTwo256>::decode(&mut &*target)
		.expect("Should not panic, same struct from different crates");

	let authority_set_changed_scheduled = find_scheduled_change(&target).is_some();
	log::info!(target: "hyperspace_parachain", "authority_set_changed_scheduled = {authority_set_changed_scheduled}, timeout_update_required = {timeout_update_required}, is_update_required = {is_update_required}");
	// if validator set has changed this is a mandatory update
	let update_type =
		match authority_set_changed_scheduled || timeout_update_required || is_update_required {
			true => UpdateType::Mandatory,
			false => UpdateType::Optional,
		};

	let grandpa_header = GrandpaHeader {
		finality_proof: codec::Decode::decode(&mut &*finality_proof.encode())
			.expect("Same struct from different crates,decode should not fail"),
		parachain_headers: parachain_headers.into(),
		height: Height::new(source.para_id as u64, finalized_para_height as u64),
	};
	let height = grandpa_header.height();
	let update_header = {
		let msg = MsgUpdateAnyClient::<LocalClientTypes> {
			client_id: source.client_id(),
			client_message: AnyClientMessage::Grandpa(ClientMessage::Header(grandpa_header)),
			signer: counterparty.account_id(),
		};
		let value = msg.encode_vec()?;
		Any { value, type_url: msg.type_url() }
	};

	Ok(vec![(update_header, height, events, update_type)])
}
