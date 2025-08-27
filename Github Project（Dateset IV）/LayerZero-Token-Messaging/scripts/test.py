from eth_abi.packed import encode_packed
from eth_utils import to_bytes
from web3 import Web3

def adapterParams(version: int, value: int) -> str:

    adapterParams = encode_packed(['uint16', 'uint256'], [version, value])
    return Web3.to_hex(adapterParams)

def lzOracleConfig(address: str) -> str:

    return "0x" + address[2:].rjust(64, '0')

def main():

    print(adapterParams(1, 200000))
    print(lzOracleConfig('0x40b237EDdb5B851C60630446ca120A1D5c7B6253'))

if __name__ == '__main__':
    main()