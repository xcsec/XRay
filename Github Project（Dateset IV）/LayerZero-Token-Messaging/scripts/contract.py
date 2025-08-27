from brownie import network, config, lzCrossChainTokenMessaging
from scripts.utils import LOCAL_ENVIRONMENT_NETWORKS

def get_contract() -> lzCrossChainTokenMessaging:
    active_network = network.show_active()
    if active_network in LOCAL_ENVIRONMENT_NETWORKS:
        print(f'This operation requires a testnet network.')
        return None
    return lzCrossChainTokenMessaging.at(config["networks"][active_network]["layerZero"].get("lzContracts")[-1])