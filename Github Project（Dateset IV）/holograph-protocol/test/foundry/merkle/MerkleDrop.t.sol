// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

// import {Test} from "forge-std/Test.sol";
// import {IHolographDropERC721} from "../../../src/drops/interfaces/IHolographDropERC721.sol";
// import {HolographERC721Drop} from "../../../src/drops/HolographERC721Drop.sol";
// import {HolographFeeManager} from "../../../src/drops/HolographFeeManager.sol";
// import {DummyMetadataRenderer} from "../utils/DummyMetadataRenderer.sol";
// import {HolographERC721DropProxy} from "../../../src/drops/HolographERC721DropProxy.sol";

// import {MerkleData} from "./MerkleData.sol";

// contract HolographNFTBaseTest is Test {
//   HolographERC721Drop public erc721Drop;
//   DummyMetadataRenderer public dummyRenderer = new DummyMetadataRenderer();
//   HolographFeeManager public holographFeeManager;
//   MerkleData public merkleData;
//   address public constant DEFAULT_OWNER_ADDRESS = address(0x23499);
//   address payable public constant DEFAULT_FUNDS_RECIPIENT_ADDRESS = payable(address(0x21303));
//   address payable public constant HOLOGRAPH_TREASURY_ADDRESS = payable(address(0x999));
//   address public constant mediaContract = address(0x123456);

//   // Drop properties
//   string private name;
//   string private symbol;
//   uint64 private editionSize;
//   uint16 private royaltyBPS;
//   string private description;
//   string private imageURI;
//   string private animationURI;
//   string private metadataURI;
//   string private metadataContractURI;
//   address payable private defaultAdmin;
//   address payable private fundsRecipient;
//   bytes private metadataInitializer;

//   modifier setupTestDrop() {
//     bytes[] memory setupCalls = new bytes[](0);
//     holographNFTBase.initialize({
//       _contractName: "Test NFT",
//       _contractSymbol: "TNFT",
//       _initialOwner: DEFAULT_OWNER_ADDRESS,
//       _fundsRecipient: payable(DEFAULT_FUNDS_RECIPIENT_ADDRESS),
//       _editionSize: 10,
//       _royaltyBPS: 800,
//       _setupCalls: setupCalls,
//       _metadataRenderer: dummyRenderer,
//       _metadataRendererInit: ""
//     });

//     _;
//   }

//   function setUp() public {
//     vm.prank(HOLOGRAPH_TREASURY_ADDRESS);
//     holographFeeManager = new HolographFeeManager(250, HOLOGRAPH_TREASURY_ADDRESS);
//     vm.prank(HOLOGRAPH_TREASURY_ADDRESS);

//     address impl = address(new ERC721Drop(feeManager, address(1234), FactoryUpgradeGate(address(0)), address(0)));
//     address payable newDrop = payable(address(new HolographERC721DropProxy(impl, "")));
//     holographNFTBase = ERC721Drop(newDrop);
//     merkleData = new MerkleData();
//   }

//   function test_MerklePurchaseActiveSuccess() public setupTestDrop {
//     vm.startPrank(DEFAULT_OWNER_ADDRESS);
//     holographNFTBase.setSaleConfiguration({
//       publicSaleStart: 0,
//       publicSaleEnd: 0,
//       presaleStart: 0,
//       presaleEnd: type(uint64).max,
//       publicSalePrice: 0 ether,
//       maxSalePurchasePerAddress: 0,
//       presaleMerkleRoot: merkleData.getTestSetByName("test-3-addresses").root
//     });
//     vm.stopPrank();

//     MerkleData.MerkleEntry memory item;

//     item = merkleData.getTestSetByName("test-3-addresses").entries[0];
//     vm.deal(address(item.user), 1 ether);
//     vm.startPrank(address(item.user));

//     holographNFTBase.purchasePresale{value: item.mintPrice}(1, item.maxMint, item.mintPrice, item.proof);
//     assertEq(holographNFTBase.saleDetails().maxSupply, 10);
//     assertEq(holographNFTBase.saleDetails().totalMinted, 1);
//     require(holographNFTBase.ownerOf(1) == address(item.user), "owner is wrong for new minted token");
//     vm.stopPrank();

//     item = merkleData.getTestSetByName("test-3-addresses").entries[1];
//     vm.deal(address(item.user), 1 ether);
//     vm.startPrank(address(item.user));
//     holographNFTBase.purchasePresale{value: item.mintPrice * 2}(2, item.maxMint, item.mintPrice, item.proof);
//     assertEq(holographNFTBase.saleDetails().maxSupply, 10);
//     assertEq(holographNFTBase.saleDetails().totalMinted, 3);
//     require(holographNFTBase.ownerOf(2) == address(item.user), "owner is wrong for new minted token");
//     vm.stopPrank();
//   }

//   function test_MerklePurchaseAndPublicSalePurchaseLimits() public setupTestDrop {
//     vm.startPrank(DEFAULT_OWNER_ADDRESS);
//     holographNFTBase.setSaleConfiguration({
//       publicSaleStart: 0,
//       publicSaleEnd: type(uint64).max,
//       presaleStart: 0,
//       presaleEnd: type(uint64).max,
//       publicSalePrice: 0.1 ether,
//       maxSalePurchasePerAddress: 1,
//       presaleMerkleRoot: merkleData.getTestSetByName("test-2-prices").root
//     });
//     vm.stopPrank();

//     MerkleData.MerkleEntry memory item;

//     item = merkleData.getTestSetByName("test-2-prices").entries[0];
//     vm.deal(address(item.user), 1 ether);
//     vm.startPrank(address(item.user));

//     vm.expectRevert(IHolographDropERC721.Presale_TooManyForAddress.selector);
//     holographNFTBase.purchasePresale{value: item.mintPrice * 3}(3, item.maxMint, item.mintPrice, item.proof);

//     holographNFTBase.purchasePresale{value: item.mintPrice * 1}(1, item.maxMint, item.mintPrice, item.proof);
//     holographNFTBase.purchasePresale{value: item.mintPrice * 1}(1, item.maxMint, item.mintPrice, item.proof);
//     assertEq(holographNFTBase.saleDetails().totalMinted, 2);
//     require(holographNFTBase.ownerOf(1) == address(item.user), "owner is wrong for new minted token");

//     vm.expectRevert(IHolographDropERC721.Presale_TooManyForAddress.selector);
//     holographNFTBase.purchasePresale{value: item.mintPrice * 1}(1, item.maxMint, item.mintPrice, item.proof);

//     holographNFTBase.purchase{value: 0.1 ether}(1);
//     require(holographNFTBase.ownerOf(3) == address(item.user), "owner is wrong for new minted token");
//     vm.expectRevert(IHolographDropERC721.Purchase_TooManyForAddress.selector);
//     holographNFTBase.purchase{value: 0.1 ether}(1);
//     vm.stopPrank();
//   }

//   function test_MerklePurchaseAndPublicSaleEditionSizeZero() public {
//     bytes[] memory setupCalls = new bytes[](0);
//     holographNFTBase.initialize({
//       _contractName: "Test NFT",
//       _contractSymbol: "TNFT",
//       _initialOwner: DEFAULT_OWNER_ADDRESS,
//       _fundsRecipient: payable(DEFAULT_FUNDS_RECIPIENT_ADDRESS),
//       _editionSize: 0,
//       _royaltyBPS: 800,
//       _setupCalls: setupCalls,
//       _metadataRenderer: dummyRenderer,
//       _metadataRendererInit: ""
//     });

//     vm.startPrank(DEFAULT_OWNER_ADDRESS);
//     holographNFTBase.setSaleConfiguration({
//       publicSaleStart: 0,
//       publicSaleEnd: type(uint64).max,
//       presaleStart: 0,
//       presaleEnd: type(uint64).max,
//       publicSalePrice: 0.1 ether,
//       maxSalePurchasePerAddress: 1,
//       presaleMerkleRoot: merkleData.getTestSetByName("test-2-prices").root
//     });
//     vm.stopPrank();

//     MerkleData.MerkleEntry memory item;

//     item = merkleData.getTestSetByName("test-2-prices").entries[0];
//     vm.deal(address(item.user), 1 ether);
//     vm.startPrank(address(item.user));

//     vm.expectRevert(IHolographDropERC721.Mint_SoldOut.selector);
//     holographNFTBase.purchasePresale{value: item.mintPrice}(1, item.maxMint, item.mintPrice, item.proof);
//     vm.stopPrank();
//   }

//   function test_MerklePurchaseInactiveFails() public setupTestDrop {
//     vm.startPrank(DEFAULT_OWNER_ADDRESS);
//     // block.timestamp returning zero allows sales to go through.
//     vm.warp(100);
//     holographNFTBase.setSaleConfiguration({
//       publicSaleStart: 0,
//       publicSaleEnd: 0,
//       presaleStart: 0,
//       presaleEnd: 0,
//       publicSalePrice: 0 ether,
//       maxSalePurchasePerAddress: 0,
//       presaleMerkleRoot: merkleData.getTestSetByName("test-3-addresses").root
//     });
//     vm.stopPrank();
//     vm.deal(address(0x10), 1 ether);

//     vm.startPrank(address(0x10));
//     MerkleData.MerkleEntry memory item = merkleData.getTestSetByName("test-3-addresses").entries[0];
//     vm.expectRevert(IHolographDropERC721.Presale_Inactive.selector);
//     holographNFTBase.purchasePresale{value: item.mintPrice}(1, item.maxMint, item.mintPrice, item.proof);
//   }
// }
