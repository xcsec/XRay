use self::parachain_subxt::api::{
	ibc::calls::types::{Deliver, Transfer},
	runtime_types::{
		common::ibc::RawMemo,
		frame_system::{extensions::check_nonce::CheckNonce, EventRecord},
		pallet_ibc::{events::IbcEvent as MetadataIbcEvent, TransferParams as RawTransferParams},
	},
	sudo::calls::types::Sudo,
};
use crate::{
	define_any_wrapper, define_event_record, define_events, define_head_data,
	define_ibc_event_wrapper, define_id, define_para_lifecycle, define_runtime_call,
	define_runtime_event, define_runtime_storage, define_runtime_transactions,
	define_transfer_params,
	substrate::{
		composable::parachain_subxt::api::runtime_types::primitives::currency::CurrencyId,
		unimplemented,
	},
};
use async_trait::async_trait;
use codec::{Compact, Decode, Encode};
use ibc_proto::google::protobuf::Any;
use light_client_common::config::{
	EventRecordT, IbcEventsT, LocalAddress, ParaLifecycleT, RuntimeCall, RuntimeStorage,
	RuntimeTransactions,
};
use pallet_ibc::{events::IbcEvent as RawIbcEvent, MultiAddress, Timeout, TransferParams};
use pallet_ibc_ping::SendPingParams;
use parachain_subxt::api::runtime_types::ibc_primitives::Timeout as RawTimeout;
use relaychain::api::runtime_types::polkadot_runtime_parachains::paras::ParaLifecycle;
use sp_core::{crypto::AccountId32, H256};
use subxt::{
	config::{
		extrinsic_params::Era,
		substrate::{
			AssetTip as Tip, SubstrateExtrinsicParams as ParachainExtrinsicParams,
			SubstrateExtrinsicParamsBuilder as ParachainExtrinsicsParamsBuilder,
		},
		ExtrinsicParams,
	},
	events::Phase,
	storage::{
		address::{StaticStorageMapKey, Yes},
		Address,
	},
	tx::Payload,
	Error, OnlineClient,
};

#[cfg(feature = "composable-beefy")]
use {
	crate::define_beefy_authority_set,
	crate::substrate::composable::relaychain::api::runtime_types::sp_beefy::mmr::BeefyAuthoritySet,
	light_client_common::config::BeefyAuthoritySetT,
};

#[cfg(not(feature = "composable-beefy"))]
use super::DummyBeefyAuthoritySet;

pub mod parachain_subxt {
	pub use subxt_generated::composable::parachain::*;
}

pub mod relaychain {
	pub use subxt_generated::composable::relaychain::*;
}

pub type Balance = u128;

#[derive(
	:: subxt :: ext :: codec :: Decode,
	:: subxt :: ext :: codec :: Encode,
	:: subxt :: ext :: scale_decode :: DecodeAsType,
	:: subxt :: ext :: scale_encode :: EncodeAsType,
)]
# [codec (crate = :: subxt :: ext :: codec)]
#[decode_as_type(crate_path = ":: subxt :: ext :: scale_decode")]
#[encode_as_type(crate_path = ":: subxt :: ext :: scale_encode")]
pub struct DummySendPingParamsWrapper<T>(T);
#[derive(
	:: subxt :: ext :: codec :: Decode,
	:: subxt :: ext :: codec :: Encode,
	:: subxt :: ext :: scale_decode :: DecodeAsType,
	:: subxt :: ext :: scale_encode :: EncodeAsType,
)]
# [codec (crate = :: subxt :: ext :: codec)]
#[decode_as_type(crate_path = ":: subxt :: ext :: scale_decode")]
#[encode_as_type(crate_path = ":: subxt :: ext :: scale_encode")]
pub struct FakeSendPingParams;

impl From<SendPingParams> for FakeSendPingParams {
	fn from(_: SendPingParams) -> Self {
		Self
	}
}

#[derive(Debug, Clone)]
pub enum ComposableConfig {}

define_id!(
	ComposableId,
	relaychain::api::runtime_types::polkadot_parachain_primitives::primitives::Id
);

define_head_data!(
	ComposableHeadData,
	relaychain::api::runtime_types::polkadot_parachain_primitives::primitives::HeadData,
);

define_para_lifecycle!(ComposableParaLifecycle, ParaLifecycle);

// #[cfg(feature = "composable-beefy")]
// define_beefy_authority_set!(ComposableBeefyAuthoritySet, BeefyAuthoritySet<T>);

// #[cfg(feature = "composable-beefy")]
// type ComposableBeefyAuthoritySetToUse = ComposableBeefyAuthoritySet<H256>;
#[cfg(not(feature = "composable-beefy"))]
type ComposableBeefyAuthoritySetToUse = DummyBeefyAuthoritySet;

define_runtime_storage!(
	ComposableRuntimeStorage,
	ComposableHeadData,
	ComposableId,
	ComposableParaLifecycle,
	ComposableBeefyAuthoritySetToUse,
	parachain_subxt::api::storage().timestamp().now(),
	|x| relaychain::api::storage().paras().heads(x),
	|x| relaychain::api::storage().paras().para_lifecycles(x),
	relaychain::api::storage().paras().parachains(),
	relaychain::api::storage().grandpa().current_set_id(),
	{
		#[cfg(feature = "composable-beefy")]
		{
			relaychain::api::storage().beefy().validator_set_id()
		}
		#[cfg(not(feature = "composable-beefy"))]
		unimplemented("relaychain::api::storage().beefy().validator_set_id()")
	},
	{
		#[cfg(feature = "composable-beefy")]
		{
			relaychain::api::storage().beefy().authorities()
		}
		#[cfg(not(feature = "composable-beefy"))]
		unimplemented::<Address<StaticStorageMapKey, (), Yes, Yes, ()>>(
			"relaychain::api::storage().beefy().authorities()",
		)
	},
	{
		#[cfg(feature = "composable-beefy")]
		{
			relaychain::api::storage().mmr_leaf().beefy_next_authorities()
		}
		#[cfg(not(feature = "composable-beefy"))]
		unimplemented::<Address<StaticStorageMapKey, (), Yes, Yes, ()>>(
			"relaychain::api::storage().mmr_leaf().beefy_next_authorities()",
		)
	},
	relaychain::api::storage().babe().epoch_start()
);

define_transfer_params!(
	TransferParamsWrapper,
	TransferParams<AccountId32>,
	RawTransferParams<T>,
	RawTimeout,
	parachain_subxt::api::runtime_types::pallet_ibc::MultiAddress<T>
);

define_any_wrapper!(AnyWrapper, parachain_subxt::api::runtime_types::pallet_ibc::Any);

define_runtime_transactions!(
	ComposableRuntimeTransactions,
	Deliver,
	Transfer,
	Sudo,
	DummySendPingParamsWrapper<FakeSendPingParams>,
	ComposableParaRuntimeCall,
	FakeSendPingParams,
	TransferParams<AccountId32>,
	TransferParamsWrapper,
	DummySendPingParamsWrapper,
	parachain_subxt::api::runtime_types::pallet_ibc::Any,
	RawMemo,
	|x| parachain_subxt::api::tx().ibc().deliver(x),
	|x, y, z, w| parachain_subxt::api::tx().ibc().transfer(x, CurrencyId(y), z, w),
	|x| parachain_subxt::api::tx().sudo().sudo(x),
	|_: DummySendPingParamsWrapper<FakeSendPingParams>| unimplemented("ping is not implemented"),
	|| unimplemented("ibc_increase_counters is not implemented")
);

define_ibc_event_wrapper!(IbcEventWrapper, MetadataIbcEvent,);

define_event_record!(
	ComposableEventRecord,
	EventRecord<<<ComposableConfig as light_client_common::config::Config>::ParaRuntimeEvent as AsInner>::Inner, H256>,
	IbcEventWrapper,
	parachain_subxt::api::runtime_types::frame_system::Phase,
	parachain_subxt::api::runtime_types::pallet_ibc::pallet::Event,
	parachain_subxt::api::runtime_types::composable_runtime::RuntimeEvent
);

define_events!(ComposableEvents, parachain_subxt::api::ibc::events::Events, IbcEventWrapper);

define_runtime_event!(
	ComposableParaRuntimeEvent,
	parachain_subxt::api::runtime_types::composable_runtime::RuntimeEvent
);

define_runtime_call!(
	ComposableParaRuntimeCall,
	parachain_subxt::api::runtime_types::composable_runtime::RuntimeCall,
	AnyWrapper,
	parachain_subxt::api::runtime_types::pallet_ibc::pallet::Call
);

#[async_trait]
impl light_client_common::config::Config for ComposableConfig {
	type AssetId = u128;
	type Signature = <Self as subxt::Config>::Signature;
	type Address = <Self as subxt::Config>::Address;
	type Tip = Tip;
	type ParaRuntimeCall = ComposableParaRuntimeCall;
	type ParaRuntimeEvent = ComposableParaRuntimeEvent;
	type Events = ComposableEvents;
	type EventRecord = ComposableEventRecord;
	type Storage = ComposableRuntimeStorage;
	type Tx = ComposableRuntimeTransactions;
	type SignedExtra = (Era, CheckNonce, Compact<Balance>, Option<Self::AssetId>);

	async fn custom_extrinsic_params(
		client: &OnlineClient<Self>,
	) -> Result<
		<Self::ExtrinsicParams as ExtrinsicParams<Self::Index, Self::Hash>>::OtherParams,
		Error,
	> {
		let params =
			ParachainExtrinsicsParamsBuilder::new().era(Era::Immortal, client.genesis_hash());
		Ok(params)
	}
}

impl subxt::Config for ComposableConfig {
	type Index = u32;
	type Hash = H256;
	type Hasher = subxt::config::substrate::BlakeTwo256;
	type AccountId = AccountId32;
	type Address = sp_runtime::MultiAddress<Self::AccountId, u32>;
	type Header =
		subxt::config::substrate::SubstrateHeader<u32, subxt::config::substrate::BlakeTwo256>;
	type Signature = sp_runtime::MultiSignature;
	type ExtrinsicParams = ParachainExtrinsicParams<Self>;
}
