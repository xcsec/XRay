// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@layerzero-contracts/lzApp/NonblockingLzApp.sol";
import "@chainlink/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title LayerZeroSwap_Mumbai
 * @dev This contract sends a cross-chain message from Mumbai to Sepolia to transfer ETH in return for deposited MATIC.
 */
contract LayerZeroSwap_Mumbai is NonblockingLzApp {

    // State variables for the contract    
    uint16 public destChainId;
    bytes payload;
    address payable deployer;
    address payable contractAddress = payable(address(this));

    // To track balance of contract on Scroll Sepolia
    int public scrollSepoliaBalance;

    // Interface for LayerZero endpoint
    ILayerZeroEndpoint internal immutable endpoint;

    // Interface for Chainlink price feed contracts
    AggregatorV3Interface internal immutable ethUsdPriceFeed;
    AggregatorV3Interface internal immutable maticUsdPriceFeed;

    /**
     * @dev Constructor that initializes the contract with the LayerZero endpoint.
     * @param _sourceLzEndpoint Address of the LayerZero endpoint on Mumbai testnet:
     * 0xf69186dfBa60DdB133E91E9A4B5673624293d8F8
     * @param _ethUsdPriceFeed Chainlink price feed address for ETH/USD feed on Mumbai testnet:
     * 0x7d7356bF6Ee5CDeC22B216581E48eCC700D0497A
     * @param _maticUsdPriceFeed Chainlink price feed address for MATIC/USD feed on Mumbai testnet:
     * 0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada
     * @notice The destChainId is being hardcoded under an if condition. This is an innefficient approach.
     * Not fit for production. This is only for demo purposes.
     */
    constructor(address _sourceLzEndpoint, address _ethUsdPriceFeed, address _maticUsdPriceFeed) NonblockingLzApp(_sourceLzEndpoint) {
        deployer = payable(msg.sender);
        endpoint = ILayerZeroEndpoint(_sourceLzEndpoint);
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        maticUsdPriceFeed = AggregatorV3Interface(_maticUsdPriceFeed);

        // If Source == Sepolia, then Destination Chain = Mumbai
        if (_sourceLzEndpoint == 0x6098e96a28E02f27B1e6BD381f870F1C8Bd169d3) destChainId = 10109;

        // If Source == Mumbai, then Destination Chain = Sepolia
        if (_sourceLzEndpoint == 0xf69186dfBa60DdB133E91E9A4B5673624293d8F8) destChainId = 10214;
    }

    /**
     * @dev Allows users to swap to ETH.
     * 
     */
    function swapTo_ETH() public payable {
        require(msg.value > 0, "Please send at least some MATIC");

        bytes memory trustedRemote = trustedRemoteLookup[destChainId];
        require(trustedRemote.length != 0, "LzApp: destination chain is not a trusted source");
        _checkPayloadSize(destChainId, payload.length);

        //Getting the latest price of MATIC/USD and ETH/USD
        (,int MATIC_USD,,,) = maticUsdPriceFeed.latestRoundData();
        (,int ETH_USD,,,) =  ethUsdPriceFeed.latestRoundData();

        //Using the price feeds to calculate the value of MATIC in ETH
        //This will yield the value of ETH in terms of Wei
        int MATIC_ETH = ((MATIC_USD * (10**18))/ETH_USD);
        int value = (int256(msg.value) * MATIC_ETH)/ 10**18;

        require(scrollSepoliaBalance > value, "Not enough ETH in Scroll Sepolia contract right now");

        // The message is encoded as bytes and stored in the "payload" variable.
        payload = abi.encode(msg.sender, value, address(this).balance);

        endpoint.send{value: 5 ether}(destChainId, trustedRemote, payload, contractAddress, address(0x0), bytes(""));
    }

    /**
     * @dev Internal function to handle incoming LayerZero messages.
     */
    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal override {

        (address Receiver, int Value , uint crossBalance) = abi.decode(_payload, (address, int, uint));
        scrollSepoliaBalance = int(crossBalance);
        address payable recipient = payable(Receiver);        

        (,int ValueInMatic,,,) =  maticUsdPriceFeed.latestRoundData();
        int ValueToTransfer = (Value *(10**18))/ValueInMatic;

        recipient.transfer(uint(ValueToTransfer));
    }

    // Fallback function to receive ether
    receive() external payable {}

    /**
     * @dev Allows the owner to withdraw all funds from the contract.
     */
    function withdrawAll() external onlyOwner {
        deployer.transfer(address(this).balance);
    }
}
