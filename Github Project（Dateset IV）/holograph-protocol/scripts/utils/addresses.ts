import { NetworkType } from '@holographxyz/networks';

type TokenSymbol = 'hETH' | 'hBNB' | 'hAVAX' | 'hMATIC' | 'hMNT';
type HTokenAddressMap = {
  [network in NetworkType]: {
    [token in TokenSymbol]?: string;
  };
};

export const hTokenAddresses: HTokenAddressMap = {
  local: {}, // To sastify the type checker
  testnet: {
    hETH: '0xB019322549D380C6bC7CbC6628ff29455fe4C1cC',
    hBNB: '0xA1a98BCE0BDb2770dAfb3588d4457887f5E19434',
    hAVAX: '0x9dA278F042213B5E8a8e18499CB3B5073d585660',
    hMATIC: '0x4Fd9Be1a583F4da78362aCf92942d01C46269dF0',
    hMNT: '0xcF26eb593C244fa62E35b08DaD45136b75690841',
  },
  mainnet: {
    hETH: '0x82904Fa267EC9588E5cD5A91Ec28ea11EA69182F',
    hAVAX: '0xA84C9B6bA6Fb90EA29AA5391AbB313483AAD1fB5',
    hBNB: '0x6B3498725726C1D5925015CF19bd79A22C55b330',
    hMNT: '0x614dcA9aCE2ceA0a89320B0C8C43549848498BD6',
    hMATIC: '0x37fD830b1219b88e845ac76fC397948d48A4eA02',
  },
};

function getHTokenAddress(network: NetworkType, token: TokenSymbol): string | undefined {
  return hTokenAddresses[network][token];
}

export { TokenSymbol, getHTokenAddress };
