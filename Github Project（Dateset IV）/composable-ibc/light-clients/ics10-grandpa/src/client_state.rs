// Copyright (C) 2022 ComposableFi.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use crate::{
	client_def::GrandpaClient,
	client_message::RelayChainHeader,
	error::Error,
	proto::{Authority as RawAuthority, ClientState as RawClientState},
};
use alloc::{format, string::ToString, vec::Vec};
use anyhow::anyhow;
use core::{marker::PhantomData, time::Duration};
use ibc::{
	core::{
		ics02_client::{
			client_consensus::ConsensusState,
			client_state::{ClientType, Status},
		},
		ics24_host::identifier::{ChainId, ClientId},
		ics26_routing::context::ReaderContext,
	},
	Height,
};
use ibc_proto::google::protobuf::Any;
use light_client_common::RelayChain;
use serde::{Deserialize, Serialize};
use sp_consensus_grandpa::AuthorityList;
use sp_core::{ed25519::Public, H256};
use tendermint_proto::Protobuf;

/// Protobuf type url for GRANDPA ClientState
pub const GRANDPA_CLIENT_STATE_TYPE_URL: &str = "/ibc.lightclients.grandpa.v1.ClientState";

#[derive(PartialEq, Clone, Debug, Default, Eq)]
pub struct ClientState<H> {
	/// Relay chain
	pub relay_chain: RelayChain,
	// Latest relay chain height
	pub latest_relay_height: u32,
	/// Latest relay chain block hash
	pub latest_relay_hash: H256,
	/// Block height when the client was frozen due to a misbehaviour
	pub frozen_height: Option<Height>,
	/// latest parachain height
	pub latest_para_height: u32,
	/// ParaId of associated parachain
	pub para_id: u32,
	/// Id of the current authority set.
	pub current_set_id: u64,
	/// authorities for the current round
	pub current_authorities: AuthorityList,
	/// phantom type.
	pub _phantom: PhantomData<H>,
}

impl<H> From<ClientState<H>> for grandpa_client_primitives::ClientState {
	fn from(client_state: ClientState<H>) -> grandpa_client_primitives::ClientState {
		grandpa_client_primitives::ClientState {
			current_authorities: client_state.current_authorities,
			current_set_id: client_state.current_set_id,
			latest_relay_hash: client_state.latest_relay_hash,
			latest_relay_height: client_state.latest_relay_height,
			latest_para_height: client_state.latest_para_height,
			para_id: client_state.para_id,
		}
	}
}

impl<H: Clone> Protobuf<RawClientState> for ClientState<H> {}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpgradeOptions {
	latest_relay_hash: H256,
}

impl<H: Clone> ClientState<H> {
	/// Verify that the client is at a sufficient height and unfrozen at the given height
	pub fn verify_height(&self, height: Height) -> Result<(), Error> {
		let latest_para_height = Height::new(self.para_id.into(), self.latest_para_height.into());
		if latest_para_height < height {
			return Err(Error::Custom(format!(
				"Insufficient height, known height: {latest_para_height}, given height: {height}"
			)))
		}

		match self.frozen_height {
			Some(frozen_height) if frozen_height <= height =>
				Err(Error::Custom(format!("Client has been frozen at height {frozen_height}"))),
			_ => Ok(()),
		}
	}

	pub fn to_any(&self) -> Any {
		Any {
			type_url: GRANDPA_CLIENT_STATE_TYPE_URL.to_string(),
			value: self.encode_vec().unwrap(),
		}
	}
}

impl<H> ClientState<H> {
	pub fn latest_height(&self) -> Height {
		Height::new(self.para_id.into(), self.latest_para_height.into())
	}

	pub fn chain_id(&self) -> ChainId {
		ChainId::new(self.relay_chain.to_string(), self.para_id as u64)
	}

	pub fn client_type() -> ClientType {
		"10-grandpa".to_string()
	}

	pub fn frozen_height(&self) -> Option<Height> {
		self.frozen_height
	}

	pub fn upgrade(
		mut self,
		_upgrade_height: Height,
		upgrade_options: UpgradeOptions,
		_chain_id: ChainId,
	) -> Self {
		self.frozen_height = None;
		// Upgrade the client state
		self.latest_relay_hash = upgrade_options.latest_relay_hash;

		self
	}

	/// Check if the state is expired when `elapsed` time has passed since the latest consensus
	/// state timestamp
	pub fn expired(&self, elapsed: Duration) -> bool {
		elapsed > self.relay_chain.trusting_period()
	}

	pub fn with_frozen_height(self, h: Height) -> Result<Self, Error> {
		if h == Height::zero() {
			return Err(Error::Custom(
				"ClientState frozen height must be greater than zero".to_string(),
			))
		}
		Ok(Self { frozen_height: Some(h), ..self })
	}
}

impl<H> ibc::core::ics02_client::client_state::ClientState for ClientState<H>
where
	H: grandpa_client_primitives::HostFunctions<Header = RelayChainHeader>,
{
	type UpgradeOptions = UpgradeOptions;
	type ClientDef = GrandpaClient<H>;

	fn chain_id(&self) -> ChainId {
		self.chain_id()
	}

	fn client_def(&self) -> Self::ClientDef {
		GrandpaClient::default()
	}

	fn client_type(&self) -> ClientType {
		Self::client_type()
	}

	fn latest_height(&self) -> Height {
		self.latest_height()
	}

	fn status<Ctx: ReaderContext>(&self, ctx: &Ctx, client_id: &ClientId) -> Status {
		if self.frozen_height.is_some() {
			return Status::Frozen
		}

		// get latest consensus state from clientStore to check for expiry
		let consensus_state = match ctx.consensus_state(client_id, self.latest_height()) {
			Ok(consensus_state) => consensus_state,
			Err(_) => {
				// if the client state does not have an associated consensus state for its latest
				// height then it must be expired
				return Status::Expired
			},
		};

		let elapsed = ctx
			.host_timestamp()
			.duration_since(&consensus_state.timestamp())
			.unwrap_or_else(|| Duration::from_secs(0));

		if self.expired(elapsed) {
			return Status::Expired
		}

		Status::Active
	}

	fn frozen_height(&self) -> Option<Height> {
		self.frozen_height()
	}

	fn upgrade(
		self,
		upgrade_height: Height,
		upgrade_options: UpgradeOptions,
		chain_id: ChainId,
	) -> Self {
		self.upgrade(upgrade_height, upgrade_options, chain_id)
	}

	fn expired(&self, elapsed: Duration) -> bool {
		self.expired(elapsed)
	}

	fn encode_to_vec(&self) -> Result<Vec<u8>, tendermint_proto::Error> {
		self.encode_vec()
	}
}

impl<H> TryFrom<RawClientState> for ClientState<H> {
	type Error = Error;

	fn try_from(raw: RawClientState) -> Result<Self, Self::Error> {
		let current_authorities = raw
			.current_authorities
			.into_iter()
			.map(|set| {
				let id = Public::try_from(&*set.public_key)
					.map_err(|_| anyhow!("Invalid ed25519 public key"))?;
				Ok((id.into(), set.weight))
			})
			.collect::<Result<_, Error>>()?;

		let relay_chain = RelayChain::from_i32(raw.relay_chain)?;
		if raw.latest_relay_hash.len() != 32 {
			Err(anyhow!("Invalid ed25519 public key lenght: {}", raw.latest_relay_hash.len()))?
		}
		let mut fixed_bytes = [0u8; 32];
		fixed_bytes.copy_from_slice(&*raw.latest_relay_hash);
		let latest_relay_hash = H256::from(fixed_bytes);

		Ok(Self {
			frozen_height: raw.frozen_height.map(|height| Height::new(raw.para_id.into(), height)),
			relay_chain,
			latest_para_height: raw.latest_para_height,
			para_id: raw.para_id,
			current_set_id: raw.current_set_id,
			current_authorities,
			latest_relay_hash,
			latest_relay_height: raw.latest_relay_height,
			_phantom: Default::default(),
		})
	}
}

impl<H> From<ClientState<H>> for RawClientState {
	fn from(client_state: ClientState<H>) -> Self {
		RawClientState {
			latest_relay_height: client_state.latest_relay_height,
			latest_relay_hash: client_state.latest_relay_hash.as_bytes().to_vec(),
			current_set_id: client_state.current_set_id,
			frozen_height: client_state
				.frozen_height
				.map(|frozen_height| frozen_height.revision_height),
			relay_chain: client_state.relay_chain as i32,
			para_id: client_state.para_id,
			latest_para_height: client_state.latest_para_height,
			current_authorities: client_state
				.current_authorities
				.into_iter()
				.map(|(id, weight)| RawAuthority {
					public_key: <sp_consensus_grandpa::AuthorityId as AsRef<[u8]>>::as_ref(&id)
						.to_vec(),
					weight,
				})
				.collect(),
		}
	}
}
