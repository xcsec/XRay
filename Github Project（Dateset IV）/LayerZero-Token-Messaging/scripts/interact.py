import scripts.utils as Utils
from scripts.contract import get_contract
from web3 import Web3
from brownie import network, config, web3

def menu(account, contract, active_chain, dstChain):

    option = ''

    while (option != 'q'):

        print("\n**************************************************")
        print(  "*                      MENU                      *")
        print(  "*                                                *")
        print(  "* 1) Send Message                                *")
        print(  "* 2) Mint Token                                  *")
        print(  "* 3) Burn Token                                  *")
        print(  "* 4) Burn Token Supply                           *")
        print(  "* 5) Increase Token Supply                       *")
        print(  "* q) Exit the program                            *")
        print(  "*                                                *")
        print(  "**************************************************")
        print(f"\n  {contract.symbol()} Available Supply: {int(contract.getAvailableSupply() / (10 ** contract.decimals()))}")
        print(f"  {contract.symbol()} Max Supply: {int(contract.getMaxSupply() / (10 ** contract.decimals()))}")
        print(f"  {contract.symbol()} Wallet Supply: {int(contract.getBalance({'from': account}) / (10 ** contract.decimals()))}")
        print(f"  Last Received Message: \"{contract.getReceivedMessage({'from': account})}\"")
        option = input('\nChoose a menu option: ')

        try:

            tx = None

            if (option.isnumeric()):

                if (int(option) == 1):
                    tx = send_msg(account, contract, active_chain, dstChain)
                elif (int(option) == 2):
                    amount = input('\nChoose the amount to be minted: ')
                    tx = mint(account, contract, amount)            
                elif (int(option) == 3):
                    amount = input('\nChoose the amount to be burned: ')
                    tx = burn(account, contract, amount)
                elif (int(option) == 4):
                    amount = input('\nChoose the amount to be burned from the supply: ')
                    tx = burnSupply(account, contract, amount)   
                elif (int(option) == 5):
                    amount = input('\nChoose the amount to be added to the supply: ')
                    tx = increaseSupply(account, contract, amount)

                total_fee = totalFeeCalculator(active_chain, tx)

                if tx != None:
                    
                    print(f'Total tx fee = {total_fee}.')

        except ValueError as exception:

            print(exception)

def mint(account, contract, amount):

    return contract.mint(amount, {"from": account})

def burn(account, contract, amount):

    return contract.burn(amount, {"from": account})

def burnSupply(account, contract, amount):
    
    return contract.burnSupply(amount, {"from": account})

def increaseSupply(account, contract, amount):
    
    return contract.increaseSupply(amount, {"from": account})

def send_msg(account, contract, active_chain, dstChain):

    destChainID = config["networks"][dstChain]["layerZero"].get("lzChainId")
    oracleAddress = config["networks"][active_chain]["layerZero"].get("zkLightClientOracle")
    relayerParams = Utils.get_relayer_hex(Utils.LZ_DEFAULT_RELAYER_INDEX, Utils.LZ_DEFAULT_RELAYER_VALUE)        

    if (oracleAddress != None):

        zkLightClientOracleParams = Utils.get_lzoracle_config(oracleAddress)
        print('Configuring the LayerZero Oracle...')
        oracleConfig = contract.getConfig(Utils.LZ_DEFAULT_LIBRARY_VERSION, destChainID, Utils.NULL_ADDRESS, Utils.LZ_CONFIG_TYPE_ORACLE, {"from": account})

        if (oracleConfig != zkLightClientOracleParams):

            contract.setConfig(Utils.LZ_DEFAULT_LIBRARY_VERSION, destChainID, Utils.LZ_CONFIG_TYPE_ORACLE, zkLightClientOracleParams, {"from": account})

    else:

        print('Default oracle selected.')

    print('Initiating cross-chain message bridge...')

    if contract is not None:

        balance = int(contract.getBalance({"from": account}) / (10 ** contract.decimals()))
        message = f'The wallet in {active_chain} has a total of {balance} WEST tokens.'
        print(f'Message to be sent: {message}.')

        tx_fee = contract.estimateFees(message, destChainID, relayerParams, {"from": account})[0]
        print (f'Transaction fee (WEI): {tx_fee}')

        gas_price = web3.eth.gas_price
        input_data = Utils.get_input_data_hex(1719217057, 32, 25, message)
        encoded_tx_data = Utils.get_encoded_tx_data(account.nonce, gas_price, Utils.GAS_LIMIT, tx_fee, config["networks"][dstChain]["layerZero"].get("lzContracts")[-1], input_data)

        estimated_fee = (Utils.GAS_LIMIT * gas_price)
        #usdFee = (contract.WEIinUSD(estimated_fee) / (10 ** 26))
        confirmation = input(f'\r The estimated tx fee is {Web3.fromWei(estimated_fee, "ether")} ETH. Confirm transaction (y/N)? ')

        if (confirmation == 'y' or confirmation == 'Y'):

            return contract.send(destChainID, message, tx_fee, relayerParams, {"from": account, "gas_limit": Utils.GAS_LIMIT, "value": tx_fee, "allow_revert": True})
        
        else:

            print('Operation cancelled.')

    else:

        print('Contract not found.')

    return None

def totalFeeCalculator(active_chain, tx) -> int:

    total_fee = 0

    if tx != None:

        gas_price = web3.eth.getTransaction(tx.txid).gasPrice
        gas_used = web3.eth.getTransactionReceipt(tx.txid).gasUsed
        l1_fee = Web3.toInt(hexstr=web3.eth.getTransactionReceipt(tx.txid).l1Fee) if (active_chain == 'Scroll' or active_chain == 'Base') else 0

        total_fee = int(l1_fee + (gas_price * gas_used) / (10 ** 26))
    
    return total_fee

# brownie run scripts/interact.py main Polygon --network Base
def main(dstChain):

    active_chain = network.show_active()
    account = Utils.get_account(active_chain)  
    contract = get_contract()
    menu(account, contract, active_chain, dstChain)
