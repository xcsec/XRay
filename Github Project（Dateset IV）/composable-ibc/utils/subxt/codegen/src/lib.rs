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

use anyhow::anyhow;
use codec::{Decode, Input};
use jsonrpsee::{
	async_client::ClientBuilder,
	client_transport::ws::{Uri, WsTransportClientBuilder},
	core::{client::ClientT, Error},
	rpc_params,
};
use std::{env, fs, path::Path};
use subxt_codegen::{CratePath, DerivesRegistry, TypeSubstitutes};

use subxt_metadata::Metadata;

pub async fn fetch_metadata_ws(url: &str) -> anyhow::Result<Vec<u8>> {
	let (sender, receiver) = WsTransportClientBuilder::default()
		.build(url.parse::<Uri>().unwrap())
		.await
		.map_err(|e| Error::Transport(e.into()))?;

	let client = ClientBuilder::default()
		.max_notifs_per_subscription(4096)
		.build_with_tokio(sender, receiver);

	let metadata: String = client.request("state_getMetadata", rpc_params![]).await?;
	Ok(hex::decode(metadata.trim_start_matches("0x"))?)
}

pub fn codegen<I: Input>(encoded: &mut I) -> anyhow::Result<String> {
	let metadata = <Metadata as Decode>::decode(encoded)?;
	let generator = subxt_codegen::RuntimeGenerator::new(metadata);
	let item_mod = syn::parse_quote!(
		pub mod api {}
	);
	let crate_path = CratePath::default();
	// add any derives you want here:
	let p = Vec::<String>::new()
		.iter()
		.map(|raw| syn::parse_str(raw))
		.collect::<Result<Vec<_>, _>>()?;
	// let mut derives = DerivesRegistry::new();
	let mut derives = DerivesRegistry::with_default_derives(&crate_path);
	derives.extend_for_all(p, []);
	let type_subsitutes = TypeSubstitutes::with_default_substitutes(&crate_path);

	let runtime_api = generator
		.generate_runtime(item_mod, derives, type_subsitutes, crate_path, false)
		.map_err(|e| anyhow!("{}", e))?;
	Ok(format!("{runtime_api}"))
}

/// This will generate the relevant subxt code for the given rpc url and write it to
/// $OUT_DIR/filename.
pub async fn build_script(url: &'static str, file_name: &'static str) -> anyhow::Result<()> {
	let metadata = fetch_metadata_ws(url).await?;
	let code = codegen(&mut &metadata[..])?;
	let out_dir = env::var_os("OUT_DIR").unwrap();
	let dest_path = Path::new(&out_dir).join(format!("{file_name}.rs"));
	fs::write(dest_path, code)?;
	Ok(())
}
