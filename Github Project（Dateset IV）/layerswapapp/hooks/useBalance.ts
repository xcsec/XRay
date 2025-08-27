import useEVMBalance from "../lib/balances/evm/useEVMBalance"
import useLoopringBalance from "../lib/balances/loopring/useLoopringBalance"
import useStarknetBalance from "../lib/balances/starknet/useStarknetBalance"
import useZkSyncBalance from "../lib/balances/zksync/useZkSyncBalance"
import useSolanaBalance from "../lib/balances/solana/useSolanaBalance"
import useImxBalance from "../lib/balances/immutableX/useIMXBalances"
import { BalanceProvider } from "../Models/Balance"
import useWallet from "./useWallet"
import { useBalancesState, useBalancesUpdate } from "../context/balances"
import { Network, NetworkWithTokens, Token } from "../Models/Network"
import useQueryBalances from "../lib/balances/query/useQueryBalances"
import { useQueryState } from "../context/query"

export default function useBalanceProvider() {

    const BalanceProviders: BalanceProvider[] = [
        useQueryBalances(),
        useEVMBalance(),
        useStarknetBalance(),
        useLoopringBalance(),
        useZkSyncBalance(),
        useSolanaBalance(),
        useImxBalance()
    ]

    const { balances, gases } = useBalancesState()
    const query = useQueryState()

    const {
        setIsBalanceLoading,
        setAllBalances,
        setIsGasLoading,
        setAllGases
    } = useBalancesUpdate()

    const { getAutofillProvider } = useWallet()

    const fetchNetworkBalances = async (network: NetworkWithTokens, address?: string) => {
        const provider = getAutofillProvider(network)
        const wallet = provider?.getConnectedWallet()
        address = address || query.account || wallet?.address

        const balance = balances[address || '']?.find(b => b?.network === network?.name)
        const isBalanceOutDated = !balance || new Date().getTime() - (new Date(balance.request_time).getTime() || 0) > 10000

        if (network
            && isBalanceOutDated
            && address) {
            setIsBalanceLoading(true)

            const walletBalances = balances[address]
            const filteredBalances = walletBalances?.some(b => b?.network === network?.name) ? walletBalances?.filter(b => b?.network !== network.name) : walletBalances || []

            const provider = getBalanceProvider(network)
            const networkBalances = await provider?.getNetworkBalances({
                network: network,
                address: address,
            }) || []

            setAllBalances((data) => ({ ...data, [address]: filteredBalances?.concat(networkBalances) }))
            setIsBalanceLoading(false)
        }
    }

    const fetchBalance = async (network: Network, token: Token) => {
        const provider = getAutofillProvider(network)
        const wallet = provider?.getConnectedWallet()
        const address = query.account || wallet?.address

        const balance = balances[address || '']?.find(b => b?.network === network?.name)
        const isBalanceOutDated = !balance || new Date().getTime() - (new Date(balance.request_time).getTime() || 0) > 10000

        if (network
            && isBalanceOutDated
            && address) {
            setIsBalanceLoading(true)

            const walletBalances = balances[address]
            const filteredBalances = walletBalances?.some(b => b?.network === network?.name) ? walletBalances?.filter(b => b?.network !== network.name) : walletBalances || []

            const provider = getBalanceProvider(network)
            const balance = await provider?.getBalance({
                network: network,
                address: address,
                token
            }) || []

            setAllBalances((data) => ({ ...data, [address]: filteredBalances?.concat(balance) }))
            setIsBalanceLoading(false)
        }
    }

    const fetchGas = async (network: Network, token: Token, userDestinationAddress: string) => {

        if (!network) {
            return
        }

        const destination_address = userDestinationAddress as `0x${string}`
        const gas = gases[network.name]?.find(g => g?.token === token?.symbol)
        const isGasOutDated = !gas || new Date().getTime() - (new Date(gas.request_time).getTime() || 0) > 10000

        const provider = getAutofillProvider(network)
        const wallet = provider?.getConnectedWallet()

        if (isGasOutDated
            && token
            && wallet?.address
            && destination_address) {
            setIsGasLoading(true)
            try {
                const gasProvider = getBalanceProvider(network)
                const gas = gasProvider?.getGas && await gasProvider?.getGas({
                    address: wallet?.address as `0x${string}`,
                    network,
                    token,
                    userDestinationAddress,
                    wallet
                }) || []

                if (gas) {
                    const filteredGases = gases[network.name]?.some(b => b?.token === token?.symbol) ? gases[network.name].filter(g => g.token !== token.symbol) : gases[network.name] || []
                    setAllGases((data) => ({ ...data, [network.name]: filteredGases.concat(gas) }))
                }
            }
            catch (e) { console.log(e) }
            finally { setIsGasLoading(false) }
        }
    }

    const getBalanceProvider = (network: Network) => {
        const provider = BalanceProviders.find(provider => provider.supportedNetworks.includes(network.name))
        return provider
    }

    return {
        fetchGas,
        fetchNetworkBalances,
        fetchBalance
    }
}
