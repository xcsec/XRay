// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

// Enable ABI encoder v2
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

contract lzCrossChainTokenMessaging is ERC20, NonblockingLzApp
{
    // The maximum amount of tokens that can be minted.
    uint256 private maxSupply;
    // The amount of tokens available to be minted.
    uint256 private availableSupply;
    // The last message received by this contract address.
    string private message;
    
    constructor(address _lzEndpoint, uint256 _initialSupply) NonblockingLzApp(_lzEndpoint) ERC20("Westoken", "WEST")
    {
        maxSupply = _initialSupply * 10 ** decimals();
        availableSupply = maxSupply;
    }

    //
    // LAYERZERO
    //
    /**
     * @dev This function sends a message cross-chain through the LayerZero protocol. 
     *
     * @param _dstChainId The destination chain id of the other chain contract.
     * @param _message The message to be sent.
     * @param _nativeFee The amount of native fee for the transaction.
     * @param _relayerParams The parameters set for the relayer.
     *
     */
    function send(
        uint16 _dstChainId, 
        string memory _message, 
        uint256 _nativeFee,
        bytes memory _relayerParams
    ) public payable onlyOwner
    {
        // The encoded message.
        bytes memory payload = abi.encode(_message);
        _lzSend(_dstChainId, payload, payable(msg.sender), address(0x0), _relayerParams, _nativeFee);
    }

    /**
     * @dev This function gets the message received from the destination chain and updates the main message
     *      in this contract.
     *
     * @param _payload The received encrypted message.
     *
     */
    function _nonblockingLzReceive(
        uint16, 
        bytes memory, 
        uint64, 
        bytes memory _payload
    ) internal override 
    {
       message = abi.decode(_payload, (string));
    }

    /**
     * @dev This function is responsible to make a trusted conection between the twin contracts published at 
     *      the origin and destination chains. It can only be called by the contract owner.
     *
     * @param _dstChainId The destination chain id of the other chain contract.
     * @param _otherContract The contract address from the other chain.
     *
     */
    function trustAddress(
        uint16 _dstChainId, 
        address _otherContract
    ) public onlyOwner 
    {
        trustedRemoteLookup[_dstChainId] = abi.encodePacked(_otherContract, address(this));
    }

    /**
     * @dev This function is used to estimate the amount of fees necessary for the LayerZero cross-chain 
     *      message bridge transaction to go through. The default relayer adapterParams is 
     *      0x00010000000000000000000000000000000000000000000000000000000000030d40.
     *
     * @param _message The message used for the cross-chain message bridge transaction.
     * @param _dstChainId The destination chain id of the other chain contract.
     * @param _relayerParams The parameters set for the relayer.
     * @return uint256 The calculated total amount of fees.
     *
     */
    function estimateFees(
        string memory _message, 
        uint16 _dstChainId, 
        bytes memory _relayerParams
    ) public view onlyOwner returns(uint256, uint256) 
    {
        // The messege to be sent.
        bytes memory payload = abi.encode(_message);
        // The hardcoded default relayer.
        // It returns only the first position of the tuple (gass fee in WEI unit), since the ZRO token 
        // is yet to be launched and nowadays the required native token is ETH.
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, false, _relayerParams);
    }

    /**
     * @dev A function that returns the message received cross-chain through LayerZero.
     *
     * @return string The message in string format.
     *
     */
    function getReceivedMessage() view public onlyOwner returns(string memory)
    {
        return message;
    }

    //
    // TOKEN
    //
    /**
     * @dev A function that burns the token in the sender's wallet and send it back to the token contract. 
     *
     * @param _amount The amount of tokens to be burned.
     *
     */
    function burn(uint256 _amount) public onlyOwner
    {
        uint256 amount = _amount * 10 ** decimals();
        require(amount <= balanceOf(msg.sender), "The amount must be less or equal than the wallet's balance.");
        require((amount + availableSupply) <= maxSupply);
        _burn(msg.sender, amount);
        availableSupply += amount;
    }

    /**
     * @dev A function that mints the token to the sender's wallet. 
     *
     * @param _amount The amount of tokens to be minted.
     *
     */
    function mint(uint256 _amount) public onlyOwner
    {
        uint256 amount = _amount * 10 ** decimals();
        require(amount <= availableSupply, "The amount is higher than the circulating supply.");
        _mint(msg.sender, amount);
        availableSupply -= amount;
    }

    /**
     * @dev A function that returns the token balance of the sender's wallet. 
     *
     * @return uint256 The token balance from the sender's wallet.
     *
     */
    function getBalance() external view returns(uint256)
    {
        return balanceOf(msg.sender);
    }

    //
    // TOKENOMICS
    //
    /**
     * @dev A function that returns the created token total supply. 
     *
     * @return uint256 The full amount of tokens in total supply.
     *
     */
    function getMaxSupply() view public returns(uint256)
    {
        return maxSupply;
    }

    /**
     * @dev A function that returns the created token circulating supply. 
     *
     * @return uint256 The full amount of tokens in circulating supply.
     *
     */
    function getAvailableSupply() view public returns(uint256)
    {
        return availableSupply;
    }

    /**
     * @dev A function that increases supply. 
     *
     * @param _amount The amount of tokens to be added to supply.
     *
     */
    function increaseSupply(uint256 _amount) public onlyOwner
    {
        uint256 amount = _amount * 10 ** decimals();
        maxSupply += amount;
        availableSupply += amount;
    }

    /**
     * @dev A function that burns tokens from supply. 
     *
     * @param _amount The amount of tokens to be burned from supply.
     *
     */
    function burnSupply(uint256 _amount) public onlyOwner
    {
        uint256 amount = _amount * 10 ** decimals();
        require(availableSupply >= amount, "The selected burn amount is higher than the circulating supply.");
        require(maxSupply >= amount, "The selected burn amount is higher than the total supply.");
        maxSupply -= amount;
        availableSupply -= amount;      
    }
}