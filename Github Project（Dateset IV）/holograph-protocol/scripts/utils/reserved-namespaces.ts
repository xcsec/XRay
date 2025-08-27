import Web3 from 'web3';
const web3 = new Web3();

const reservedNamespaces: string[] = [
  'HolographGeneric',
  'HolographERC20',
  'HolographERC721',
  'HolographDropERC721',
  'HolographDropERC721V2',
  'HolographDropERC1155',
  'HolographERC1155',
  'CxipERC721',
  'CxipERC1155',
  'HolographRoyalties',
  'DropsPriceOracleProxy',
  'EditionsMetadataRendererProxy',
  'DropsMetadataRendererProxy',
  'hToken',
];

const reservedNamespaceHashes: string[] = reservedNamespaces.map((nameSpace: string) => {
  return '0x' + web3.utils.asciiToHex(nameSpace).substring(2).padStart(64, '0');
});

export { reservedNamespaces, reservedNamespaceHashes };
