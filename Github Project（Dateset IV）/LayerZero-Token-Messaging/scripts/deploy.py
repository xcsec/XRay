from brownie import network, config, lzCrossChainTokenMessaging
import scripts.utils as Utils
    
def deploy():
    active_chain = network.show_active()
    account = Utils.get_account(active_chain)
    if active_chain in Utils.LOCAL_ENVIRONMENT_NETWORKS:
        print(f'This type of deployment requires a testnet network.')
        return
    print(f'Running deployment in {config["networks"][active_chain]["layerZero"].get("lzEndpoint")}.')
    tx = lzCrossChainTokenMessaging.deploy(
        config["networks"][active_chain]["layerZero"].get("lzEndpoint"), Utils.TOKEN_MAX_SUPPLY,
        {"from": account}, publish_source=config["networks"][active_chain].get("verify"))
    
    Utils.add_contract(active_chain, tx.address)

def main():
    deploy()