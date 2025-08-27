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

use crate::packets::connection_delay::has_delay_elapsed;
use ibc::{
	core::{
		ics02_client::client_state::ClientState as ClientStateT,
		ics04_channel::{
			channel::{ChannelEnd, Order, State},
			context::calculate_block_delay,
			msgs::{
				acknowledgement::MsgAcknowledgement, recv_packet::MsgRecvPacket,
				timeout::MsgTimeout, timeout_on_close::MsgTimeoutOnClose,
			},
			packet::{Packet, TimeoutVariant},
		},
		ics23_commitment::commitment::CommitmentProofBytes,
		ics24_host::path::{
			AcksPath, ChannelEndsPath, CommitmentsPath, ReceiptsPath, SeqRecvsPath,
		},
	},
	proofs::Proofs,
	timestamp::Timestamp,
	tx_msg::Msg,
	Height,
};
use ibc_proto::google::protobuf::Any;
use pallet_ibc::light_clients::AnyClientState;
use primitives::{find_suitable_proof_height_for_client, Chain};
use std::time::Duration;
use tendermint_proto::Protobuf;

#[allow(clippy::too_many_arguments)]
pub async fn get_timeout_proof_height(
	source: &impl Chain,
	sink: &impl Chain,
	source_height: Height,
	sink_height: Height,
	sink_timestamp: Timestamp,
	latest_client_height_on_source: Height,
	packet: &Packet,
	packet_creation_height: u64,
) -> Option<Height> {
	let timeout_variant = Packet::timeout_variant(packet, &sink_timestamp, sink_height).unwrap();
	log::trace!(target: "hyperspace", "get_timeout_proof_height: {}->{}, timeout_variant={:?}, source_height={}, sink_height={}, sink_timestamp={}, latest_client_height_on_source={}, packet_creation_height={}, packet={:?}",
		source.name(), sink.name(), timeout_variant, source_height, sink_height, sink_timestamp, latest_client_height_on_source, packet_creation_height, packet);

	match timeout_variant {
		TimeoutVariant::Height =>
			find_suitable_proof_height_for_client(
				sink,
				source,
				source_height,
				sink.client_id(),
				packet.timeout_height,
				None,
				latest_client_height_on_source,
			)
			.await,
		TimeoutVariant::Timestamp => {
			// Get approximate number of blocks contained in this timestamp so we can have a lower
			// bound for where to start our search
			// We offset the sink height when this packet was created with the approximate number of
			// blocks contained in the difference in timestamp at packet creation until timeout
			let height = Height::new(source_height.revision_number, packet_creation_height);
			log::trace!(
				target: "hyperspace",
				"Querying client state at {height}"
			);
			let sink_client_state =
				source.query_client_state(height, sink.client_id()).await.ok()?;
			let sink_client_state =
				AnyClientState::try_from(sink_client_state.client_state?).ok()?;
			let height = sink_client_state.latest_height();
			let timestamp_at_creation =
				sink.query_timestamp_at(height.revision_height).await.ok()?;
			// may underflow if the user have chosen timeout less than the block timestamp at which
			// the packet was created, so we use `saturating_sub`
			let period =
				packet.timeout_timestamp.nanoseconds().saturating_sub(timestamp_at_creation);
			let period = Duration::from_nanos(period);
			let start_height = height.revision_height +
				calculate_block_delay(period, sink.expected_block_time()).saturating_sub(1);
			let start_height = Height::new(sink_height.revision_number, start_height);
			find_suitable_proof_height_for_client(
				sink,
				source,
				source_height,
				sink.client_id(),
				start_height,
				Some(packet.timeout_timestamp),
				latest_client_height_on_source,
			)
			.await
		},
		TimeoutVariant::Both => {
			// Get approximate number of blocks contained in this timestamp so we can have a lower
			// bound for where to start our search
			let sink_client_state = source
				.query_client_state(
					Height::new(source_height.revision_number, packet_creation_height),
					sink.client_id(),
				)
				.await
				.ok()?;
			let sink_client_state =
				AnyClientState::try_from(sink_client_state.client_state?).ok()?;
			let height = sink_client_state.latest_height();
			let timestamp_at_creation =
				sink.query_timestamp_at(height.revision_height).await.ok()?;
			// may underflow if the user have chosen timeout less than the block timestamp at which
			// the packet was created, so we use `saturating_sub`
			let period =
				packet.timeout_timestamp.nanoseconds().saturating_sub(timestamp_at_creation);
			let period = Duration::from_nanos(period);
			let start_height = height.revision_height +
				calculate_block_delay(period, sink.expected_block_time()).saturating_sub(1);
			let start_height = if start_height < packet.timeout_height.revision_height {
				packet.timeout_height
			} else {
				Height::new(packet.timeout_height.revision_number, start_height)
			};
			find_suitable_proof_height_for_client(
				sink,
				source,
				source_height,
				sink.client_id(),
				start_height,
				Some(packet.timeout_timestamp),
				latest_client_height_on_source,
			)
			.await
		},
	}
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum VerifyDelayOn {
	Source,
	Sink,
}

#[allow(clippy::too_many_arguments)]
pub async fn verify_delay_passed(
	source: &impl Chain,
	sink: &impl Chain,
	source_timestamp: Timestamp,
	source_height: Height,
	sink_timestamp: Timestamp,
	sink_height: Height,
	connection_delay: Duration,
	proof_height: Height,
	verify_delay_on: VerifyDelayOn,
) -> Result<bool, anyhow::Error> {
	log::trace!(target: "hyperspace", "Verifying delay passed for source: {source_height}, {source_timestamp}, sink: {sink_height}, {sink_timestamp}, connection delay: {}, proof height: {proof_height}, verify delay on: {verify_delay_on:?}", connection_delay.as_secs());
	match verify_delay_on {
		VerifyDelayOn::Source => {
			let actual_proof_height = sink.get_proof_height(proof_height).await;
			if let Ok((source_client_update_height, source_client_update_time)) = source
				.query_client_update_time_and_height(sink.client_id(), actual_proof_height)
				.await
			{
				let block_delay =
					calculate_block_delay(connection_delay, source.expected_block_time());
				has_delay_elapsed(
					source_timestamp,
					source_height,
					source_client_update_time,
					source_client_update_height, // shouldn't be the latest.
					connection_delay,
					block_delay,
				)
			} else {
				log::trace!(target: "hyperspace", "Failed to get client update time and height for source client for height {}", actual_proof_height);
				Ok(false)
			}
		},
		VerifyDelayOn::Sink => {
			let actual_proof_height = source.get_proof_height(proof_height).await;
			log::info!(
				"Checking proof height on {} as {}:{}",
				sink.name(),
				proof_height,
				actual_proof_height
			);
			let _cs = sink
				.query_client_consensus(sink_height, source.client_id(), actual_proof_height)
				.await
				.unwrap()
				.consensus_state
				.unwrap_or_else(|| {
					panic!(
						"query_client_consensus for {} at height {} is not found",
						source.client_id(),
						actual_proof_height
					)
				});
			if let Ok((sink_client_update_height, sink_client_update_time)) = sink
				.query_client_update_time_and_height(source.client_id(), actual_proof_height)
				.await
			{
				let block_delay =
					calculate_block_delay(connection_delay, sink.expected_block_time());
				has_delay_elapsed(
					sink_timestamp,
					sink_height,
					sink_client_update_time,
					sink_client_update_height,
					connection_delay,
					block_delay,
				)
			} else {
				log::trace!(target: "hyperspace", "Failed to get client update time and height for sink client for height {}", actual_proof_height);
				Ok(false)
			}
		},
	}
}

pub async fn construct_timeout_message(
	source: &impl Chain,
	sink: &impl Chain,
	sink_channel_end: &ChannelEnd,
	packet: Packet,
	next_sequence_recv: u64,
	proof_height: Height,
) -> Result<Any, anyhow::Error> {
	let path_type = if sink_channel_end.ordering == Order::Ordered {
		KeyPathType::SeqRecv
	} else {
		KeyPathType::ReceiptPath
	};
	let key = get_key_path(path_type, &packet).into_bytes();

	let proof_unreceived = sink.query_proof(proof_height, vec![key]).await?;
	let proof_unreceived = CommitmentProofBytes::try_from(proof_unreceived)?;
	let msg = if sink_channel_end.state == State::Closed {
		let channel_key = get_key_path(KeyPathType::ChannelPath, &packet).into_bytes();
		let proof_closed = sink.query_proof(proof_height, vec![channel_key]).await?;
		let proof_closed = CommitmentProofBytes::try_from(proof_closed)?;
		let actual_proof_height = sink.get_proof_height(proof_height).await;
		let msg = MsgTimeoutOnClose {
			packet,
			next_sequence_recv: next_sequence_recv.into(),
			proofs: Proofs::new(
				proof_unreceived,
				None,
				None,
				Some(proof_closed),
				actual_proof_height,
			)?,
			signer: source.account_id(),
		};
		let value = msg.encode_vec()?;
		Any { value, type_url: msg.type_url() }
	} else {
		let actual_proof_height = sink.get_proof_height(proof_height).await;
		log::debug!(target: "hyperspace", "actual_proof_height={actual_proof_height}");
		let msg = MsgTimeout {
			packet,
			next_sequence_recv: next_sequence_recv.into(),
			proofs: Proofs::new(proof_unreceived, None, None, None, actual_proof_height)?,
			signer: source.account_id(),
		};
		let value = msg.encode_vec()?;
		Any { value, type_url: msg.type_url() }
	};
	Ok(msg)
}

pub async fn construct_recv_message(
	source: &impl Chain,
	sink: &impl Chain,
	packet: Packet,
	proof_height: Height,
) -> Result<Any, anyhow::Error> {
	let key = get_key_path(KeyPathType::CommitmentPath, &packet).into_bytes();
	let proof = source.query_proof(proof_height, vec![key]).await?;
	let commitment_proof = CommitmentProofBytes::try_from(proof)?;
	let actual_proof_height = source.get_proof_height(proof_height).await;
	let msg = MsgRecvPacket {
		packet,
		proofs: Proofs::new(commitment_proof, None, None, None, actual_proof_height)?,
		signer: sink.account_id(),
	};
	let value = msg.encode_vec()?;
	let msg = Any { value, type_url: msg.type_url() };
	Ok(msg)
}

pub async fn construct_ack_message(
	source: &impl Chain,
	sink: &impl Chain,
	packet: Packet,
	ack: Vec<u8>,
	proof_height: Height,
) -> Result<Any, anyhow::Error> {
	let key = get_key_path(KeyPathType::AcksPath, &packet);
	log::debug!(target: "hyperspace", "query proof for acks path: {:?}", key);
	let proof = source.query_proof(proof_height, vec![key.into_bytes()]).await?;
	let commitment_proof = CommitmentProofBytes::try_from(proof)?;
	let actual_proof_height = source.get_proof_height(proof_height).await;
	let msg = MsgAcknowledgement {
		packet,
		proofs: Proofs::new(commitment_proof, None, None, None, actual_proof_height)?,
		acknowledgement: ack.into(),
		signer: sink.account_id(),
	};
	let value = msg.encode_vec()?;
	let msg = Any { value, type_url: msg.type_url() };
	Ok(msg)
}

pub enum KeyPathType {
	SeqRecv,
	ReceiptPath,
	CommitmentPath,
	AcksPath,
	ChannelPath,
}

pub fn get_key_path(key_path_type: KeyPathType, packet: &Packet) -> String {
	match key_path_type {
		KeyPathType::SeqRecv => {
			format!("{}", SeqRecvsPath(packet.destination_port.clone(), packet.destination_channel))
		},
		KeyPathType::ReceiptPath => {
			format!(
				"{}",
				ReceiptsPath {
					port_id: packet.destination_port.clone(),
					channel_id: packet.destination_channel,
					sequence: packet.sequence
				}
			)
		},
		KeyPathType::CommitmentPath => {
			format!(
				"{}",
				CommitmentsPath {
					port_id: packet.source_port.clone(),
					channel_id: packet.source_channel,
					sequence: packet.sequence
				}
			)
		},
		KeyPathType::AcksPath => {
			format!(
				"{}",
				AcksPath {
					port_id: packet.destination_port.clone(),
					channel_id: packet.destination_channel,
					sequence: packet.sequence
				}
			)
		},
		KeyPathType::ChannelPath => {
			format!(
				"{}",
				ChannelEndsPath(packet.destination_port.clone(), packet.destination_channel)
			)
		},
	}
}
