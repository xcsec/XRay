import { FC } from "react";
import { useSwapDataState } from "../../../../context/swap";
import KnownInternalNames from "../../../../lib/knownIds";
import ImtblxWalletWithdrawStep from "./ImtblxWalletWithdrawStep";
import StarknetWalletWithdrawStep from "./StarknetWalletWithdraw";
import TransferFromWallet from "./WalletTransfer";
import ZkSyncWalletWithdrawStep from "./ZKsyncWalletWithdraw";
import SolanaWalletWithdrawStep from "./SolanaWalletWithdraw";
import LoopringWalletWithdraw from "./Loopring";
import { Network, Token } from "../../../../Models/Network";

//TODO have separate components for evm and none_evm as others are sweepless anyway
export const WalletTransferContent: FC = () => {
    const { swapResponse } = useSwapDataState();
    const { swap, deposit_actions } = swapResponse || {};

    const { source_network } = swap || {};
    const source_network_internal_name = source_network?.name;

    const sourceIsImmutableX = swap?.source_network?.name?.toUpperCase() === KnownInternalNames.Networks.ImmutableXMainnet?.toUpperCase()
        || swap?.source_network.name === KnownInternalNames.Networks.ImmutableXGoerli?.toUpperCase()
        || swap?.source_network.name === KnownInternalNames.Networks.ImmutableXSepolia?.toUpperCase();

    const sourceIsZkSync = swap?.source_network?.name?.toUpperCase() === KnownInternalNames.Networks.ZksyncMainnet?.toUpperCase();

    const sourceIsStarknet = swap?.source_network?.name?.toUpperCase() === KnownInternalNames.Networks.StarkNetMainnet?.toUpperCase()
        || swap?.source_network.name === KnownInternalNames.Networks.StarkNetGoerli?.toUpperCase()
        || swap?.source_network.name === KnownInternalNames.Networks.StarkNetSepolia?.toUpperCase();

    const sourceIsLoopring = swap?.source_network?.name?.toUpperCase() === KnownInternalNames.Networks.LoopringMainnet?.toUpperCase()
        || swap?.source_network?.name?.toUpperCase() === KnownInternalNames.Networks.LoopringGoerli?.toUpperCase()
        || swap?.source_network?.name?.toUpperCase() === KnownInternalNames.Networks.LoopringSepolia?.toUpperCase();

    const sourceIsSolana = source_network_internal_name?.toUpperCase() === KnownInternalNames.Networks.SolanaMainnet?.toUpperCase()
        || source_network_internal_name?.toUpperCase() === KnownInternalNames.Networks.SolanaDevnet?.toUpperCase();

    const depositAddress = deposit_actions?.find(da => true)?.to_address;
    const amount = deposit_actions?.find(da => true)?.amount || 0;
    const callData = deposit_actions?.find(da => true)?.call_data;

    if (sourceIsImmutableX)
        return <ImtblxWalletWithdrawStep
            amount={amount}
            depositAddress={depositAddress}
            network={swap?.source_network}
            token={swap?.source_token}
            swapId={swap?.id}
        />;
    else if (sourceIsStarknet)
        return <StarknetWalletWithdrawStep
            network={swap?.source_network}
            token={swap?.source_token}
            swapId={swap?.id}
            callData={callData}
        />;
    else if (sourceIsZkSync)
        return <ZkSyncWalletWithdrawStep
            amount={amount}
            depositAddress={depositAddress}
            network={swap?.source_network}
            token={swap?.source_token}
            swapId={swap?.id}
            sequenceNumber={swap.metadata.sequence_number}
        />;
    else if (sourceIsLoopring)
        return <LoopringWalletWithdraw
            amount={amount}
            depositAddress={depositAddress}
            network={swap?.source_network}
            token={swap?.source_token}
            swapId={swap?.id}
            callData={callData}
        />;
    else if (sourceIsSolana)
        return <SolanaWalletWithdrawStep
            amount={amount}
            depositAddress={depositAddress}
            network={swap?.source_network}
            token={swap?.source_token}
            swapId={swap?.id}
        />;
    else
        return <>
            {
                swap &&
                <TransferFromWallet
                    sequenceNumber={swap?.metadata.sequence_number}
                    swapId={swap.id}
                    network={swap.source_network}
                    token={swap.source_token}
                    depositAddress={depositAddress}
                    userDestinationAddress={swap.destination_address}
                    amount={amount}
                />
            }
        </>;
};


export type WithdrawPageProps = {
    depositAddress?: `0x${string}`
    amount?: number
    swapId?: string
    userDestinationAddress?: string
    sequenceNumber?: number
    network?: Network
    token?: Token
    callData?: string
}