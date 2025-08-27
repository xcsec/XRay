import { useSwapDataState } from "../../../../context/swap"
import NetworkGas from "./WalletTransfer/networkGas"
import { WalletTransferContent } from "./WalletTransferContent"

const WalletTransferWrapper = () => {
    const { swapResponse } = useSwapDataState()
    const { swap, deposit_actions } = swapResponse || {}
    const { source_network } = swap || {}

    const transfer_action = deposit_actions?.find(a => true)
    const { fee_token } = transfer_action || {}

    return <div className='border-secondary-500 rounded-md border bg-secondary-700 p-3'>
        {
            source_network && fee_token &&
            <NetworkGas network={source_network} token={fee_token} />
        }
        <WalletTransferContent />
    </div>
}

export default WalletTransferWrapper
