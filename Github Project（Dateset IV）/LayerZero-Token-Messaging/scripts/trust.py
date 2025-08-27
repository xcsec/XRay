from brownie import config, network
import scripts.utils as Utils
from scripts.contract import get_contract

def trust_contract(dstChain):
    active_chain = network.show_active()
    account = Utils.get_account(active_chain)
    contract = get_contract()
    if contract is not None:
        contract.trustAddress(
            config["networks"][dstChain]["layerZero"].get("lzChainId"),
            config["networks"][dstChain]["layerZero"].get("lzContracts")[-1], 
            {"from": account})
        
def main(dstChain):
    trust_contract(dstChain)