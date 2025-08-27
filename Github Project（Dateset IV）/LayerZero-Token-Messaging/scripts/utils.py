from brownie import accounts
import yaml

from eth_abi.packed import encode_packed
from eth_abi import encode
from web3 import Web3

from rlp import encode
from web3.types import HexBytes
from web3.datastructures import AttributeDict
from eth_utils import to_bytes

#print(Web3.to_hex(text="Another message for Base.")[2:].ljust(64, '0'))

LZ_DEFAULT_LIBRARY_VERSION = 0
LZ_CONFIG_TYPE_ORACLE = 6
LZ_DEFAULT_RELAYER_INDEX = 1
LZ_DEFAULT_RELAYER_VALUE = 200000
LOCAL_ENVIRONMENT_NETWORKS = ["development", "solidity-local"]
GAS_LIMIT = 300000
TOKEN_MAX_SUPPLY = 21000
NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

def get_account(chain):
    if chain in LOCAL_ENVIRONMENT_NETWORKS:
        return accounts[0]
    else:
        return accounts.load("airdrop-account")
    
def add_contract(chain, address):
    with open ('brownie-config.yaml') as file:
        data = yaml.load(file, Loader=yaml.FullLoader)

    layerZero = data["networks"][chain]["layerZero"]
    if (layerZero["lzContracts"] is None):
        layerZero["lzContracts"] = []
    if address not in layerZero["lzContracts"]:
        layerZero["lzContracts"].append(address)
        with open("brownie-config.yaml", "w") as file:
            yaml.dump(data, file)
    
def show_brownie_config():
    with open ('brownie-config.yaml') as file:
        data = yaml.load(file, Loader=yaml.FullLoader)
    print(data)

def get_relayer_hex(version: int, value: int) -> str:
    adapterParams = encode_packed(['uint16', 'uint256'], [version, value])
    return Web3.toHex(adapterParams)

def get_input_data_hex(methodID: int, name: int, type: int, message: str) -> str:
    hex_message = Web3.toHex(text=message)[2:].ljust(64, '0')
    data = encode_packed(['uint32', 'uint256', 'uint256'], [methodID, name, type])
    return Web3.toHex(data) + hex_message

def get_encoded_tx_data(nonce: int, gasPrice: int, gasLimit: int, value: int, to: str, input: str) -> str:
    tx = AttributeDict({'nonce': nonce, 'gasPrice': gasPrice, 'gasLimit': gasLimit, 'value': value, 'to': to, 'input': HexBytes(input)})
    to_as_bytes = to_bytes(hexstr=tx["to"])
    return Web3.toHex(encode([tx['nonce'], tx['gasPrice'], tx['gasLimit'], tx['value'], to_as_bytes, tx['input']]))

def get_lzoracle_config(address: str) -> str:
    return "0x" + address[2:].rjust(64, '0')