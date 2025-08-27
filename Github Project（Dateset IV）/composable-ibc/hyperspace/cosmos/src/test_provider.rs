use super::client::CosmosClient;
use crate::error::Error;
use core::pin::Pin;
use futures::{Stream, StreamExt};
use ibc::{
	applications::transfer::{msgs::transfer::MsgTransfer, PrefixedCoin},
	core::ics24_host::identifier::ChannelId,
	tx_msg::Msg,
};
use primitives::TestProvider;
use tendermint_rpc::{
	event::{Event, EventData},
	query::{EventType, Query},
	SubscriptionClient,
};

#[async_trait::async_trait]
impl<H> TestProvider for CosmosClient<H>
where
	H: Clone + Send + Sync + 'static,
{
	/// Initiate an ibc transfer on chain.
	async fn send_transfer(&self, msg: MsgTransfer<PrefixedCoin>) -> Result<(), Self::Error> {
		let hash = self.submit_call(vec![msg.to_any()]).await?;
		log::info!(target: "hyperspace_cosmos", "🤝 Transfer transaction confirmed with hash: {:?}", hash);
		Ok(())
	}

	/// Send a packet on an ordered channel
	async fn send_ordered_packet(
		&self,
		_channel_id: ChannelId,
		_timeout: pallet_ibc::Timeout,
	) -> Result<(), Self::Error> {
		Err(Error::Custom("send_ordered_packet is not implemented yet".to_string()))
	}

	/// Returns a stream that yields chain Block number
	async fn subscribe_blocks(&self) -> Pin<Box<dyn Stream<Item = u64> + Send + Sync>> {
		let ws_client = self.rpc_client.clone();

		let subscription = ws_client.subscribe(Query::from(EventType::NewBlock)).await.unwrap();
		log::info!(target: "hyperspace_cosmos", "🛰️ Subscribed to {} listening to finality notifications", self.name);
		let stream = subscription.filter_map(|event| {
			let event = event.unwrap();
			let get_height = |event: &Event| {
				let Event { data, events: _, query: _ } = &event;
				let height = match &data {
					EventData::NewBlock { block, .. } =>
						block.as_ref().unwrap().header.height.value(),
					_ => unreachable!(),
				};
				height
			};
			futures::future::ready(Some(get_height(&event)))
		});
		Box::pin(stream)
	}

	async fn increase_counters(&mut self) -> Result<(), Self::Error> {
		unimplemented!()
	}
}
