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

//! ICS3 verification functions, common across all four handlers of ICS3.

use crate::core::ics02_client::{
	client_consensus::ConsensusState, client_def::ClientDef, client_state::ClientState,
};

use crate::{
	core::{
		ics03_connection::{connection::ConnectionEnd, error::Error},
		ics23_commitment::commitment::CommitmentProofBytes,
		ics26_routing::context::ReaderContext,
	},
	proofs::ConsensusProof,
	Height,
};
use alloc::vec::Vec;

/// Verifies the authenticity and semantic correctness of a commitment `proof`. The commitment
/// claims to prove that an object of type connection exists on the source chain (i.e., the chain
/// which created this proof). This object must match the state of `expected_conn`.
pub fn verify_connection_proof<Ctx: ReaderContext>(
	ctx: &Ctx,
	height: Height,
	connection_end: &ConnectionEnd,
	expected_conn: &ConnectionEnd,
	proof_height: Height,
	proof: &CommitmentProofBytes,
) -> Result<(), Error> {
	// Fetch the client state (IBC client on the local/host chain).
	let client_id = connection_end.client_id();
	let client_state = ctx.client_state(client_id).map_err(Error::ics02_client)?;

	// The client must not be frozen.
	if client_state.is_frozen(ctx, client_id) {
		return Err(Error::frozen_client(client_id.clone()))
	}

	// The client must have the consensus state for the height where this proof was created.
	let consensus_state = ctx
		.consensus_state(client_id, proof_height)
		.map_err(|e| Error::consensus_state_verification_failure(proof_height, e))?;

	// A counterparty connection id of None causes `unwrap()` below and indicates an internal
	// error as this is the connection id on the counterparty chain that must always be present.
	let connection_id = connection_end
		.counterparty()
		.connection_id()
		.ok_or_else(Error::invalid_counterparty)?;

	let client_def = client_state.client_def();

	// Verify the proof for the connection state against the expected connection end.
	client_def
		.verify_connection_state(
			ctx,
			client_id,
			&client_state,
			height,
			connection_end.counterparty().prefix(),
			proof,
			consensus_state.root(),
			connection_id,
			expected_conn,
		)
		.map_err(Error::verify_connection_state)
}

/// Verifies the client `proof` from a connection handshake message, typically from a
/// `MsgConnectionOpenTry` or a `MsgConnectionOpenAck`. The `expected_client_state` argument is a
/// representation for a client of the current chain (the chain handling the current message), which
/// is running on the counterparty chain (the chain which sent this message). This method does a
/// complete verification: that the client state the counterparty stores is valid (i.e., not frozen,
/// at the same revision as the current chain, with matching chain identifiers, etc) and that the
/// `proof` is correct.
pub fn verify_client_proof<Ctx: ReaderContext>(
	ctx: &Ctx,
	height: Height,
	connection_end: &ConnectionEnd,
	expected_client_state: &Ctx::AnyClientState,
	proof_height: Height,
	proof: &CommitmentProofBytes,
) -> Result<(), Error> {
	// Fetch the local client state (IBC client running on the host chain).
	let client_id = connection_end.client_id();
	let client_state = ctx.client_state(client_id).map_err(Error::ics02_client)?;

	if client_state.is_frozen(ctx, client_id) {
		return Err(Error::frozen_client(client_id.clone()))
	}

	let consensus_state = ctx
		.consensus_state(client_id, proof_height)
		.map_err(|e| Error::consensus_state_verification_failure(proof_height, e))?;

	let client_def = client_state.client_def();

	client_def
		.verify_client_full_state(
			ctx,
			&client_state,
			height,
			connection_end.counterparty().prefix(),
			proof,
			consensus_state.root(),
			connection_end.counterparty().client_id(),
			&expected_client_state,
		)
		.map_err(|e| Error::client_state_verification_failure(client_id.clone(), e))
}

pub fn verify_consensus_proof<Ctx: ReaderContext>(
	ctx: &Ctx,
	height: Height,
	connection_end: &ConnectionEnd,
	proof: &ConsensusProof,
	host_consensus_state_proof: Vec<u8>,
) -> Result<(), Error> {
	// Fetch the client state (IBC client on the local chain).
	let client_id = connection_end.client_id();
	let client_state = ctx.client_state(client_id).map_err(Error::ics02_client)?;

	if client_state.is_frozen(ctx, client_id) {
		return Err(Error::frozen_client(client_id.clone()))
	}

	let consensus_state = ctx
		.consensus_state(client_id, height)
		.map_err(|e| Error::consensus_state_verification_failure(height, e))?;

	let client = client_state.client_def();

	let expected_consensus = if !host_consensus_state_proof.is_empty() {
		// Fetch the expected consensus state from the historical (local) header data.
		let expected_consensus = ctx
			.host_consensus_state(proof.height(), Some(host_consensus_state_proof), &client_state)
			.map_err(|e| Error::consensus_state_verification_failure(proof.height(), e))?;
		expected_consensus
	} else {
		ctx.host_consensus_state(proof.height(), None, &client_state)
			.map_err(|e| Error::consensus_state_verification_failure(proof.height(), e))?
	};

	client
		.verify_client_consensus_state(
			ctx,
			&client_state,
			height,
			connection_end.counterparty().prefix(),
			proof.proof(),
			consensus_state.root(),
			connection_end.counterparty().client_id(),
			proof.height(),
			&expected_consensus,
		)
		.map_err(|e| Error::consensus_state_verification_failure(proof.height(), e))?;

	Ok(())
}

/// Checks that `claimed_height` is within normal bounds, i.e., fresh enough so that the chain has
/// not pruned it yet, but not newer than the current (actual) height of the local chain.
pub fn check_client_consensus_height<Ctx: ReaderContext>(
	ctx: &Ctx,
	claimed_height: Height,
) -> Result<(), Error> {
	if claimed_height > ctx.host_height() {
		// Fail if the consensus height is too advanced.
		return Err(Error::invalid_consensus_height(claimed_height, ctx.host_height()))
	}

	if claimed_height < ctx.host_oldest_height() {
		// Fail if the consensus height is too old (has been pruned).
		return Err(Error::stale_consensus_height(claimed_height, ctx.host_oldest_height()))
	}

	// Height check is within normal bounds, check passes.
	Ok(())
}
