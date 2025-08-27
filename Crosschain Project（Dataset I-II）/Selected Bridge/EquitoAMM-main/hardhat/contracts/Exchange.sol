// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Exchange is ERC20 {
    address cryptoDevTokenAddress;

    constructor(address _cryptoDevToken) ERC20("CryptoDev LP Token", "CDLP") {
        require(_cryptoDevToken != address(0), "CryptoDev token address must not be empty");
        cryptoDevTokenAddress = _cryptoDevToken;
    }

    function getReserve() public view returns(uint256) {
        return ERC20(cryptoDevTokenAddress).balanceOf(address(this));
    }

    function addLiquidity(uint256 _amount) public payable returns(uint) {
        uint256 liquidity;
        uint256 ethBalance = address(this).balance;
        uint256 cryptoDevTokenReserve = getReserve();
        ERC20 cryptoDevToken = ERC20(cryptoDevTokenAddress);

        if(cryptoDevTokenReserve == 0) {
            // If the reserve is empty, intake any user supplied value for
            // `Ether` and `Crypto Dev` tokens because there is no ratio currently
            cryptoDevToken.transferFrom(msg.sender, address(this), _amount);

            // Take the current ethBalance and mint `ethBalance` amount of LP tokens to the user.
            // `liquidity` provided is equal to `ethBalance` because this is the first time user
            // is adding `Eth` to the contract, so whatever `Eth` contract has is equal to the one supplied
            // by the user in the current `addLiquidity` call
            // `liquidity` tokens that need to be minted to the user on `addLiquidity` call should always be proportional
            // to the eth specified by the user
            liquidity = ethBalance;
            _mint(msg.sender, liquidity);
        } else {
            // Reserve is not empty, so take all ETH provided, and calculate the amount of CryptoDev tokens we will accept
            // in order to maintain the current liquidity ratio (so we don't impact swap price due to increased liquidity)
            uint256 ethReserve = ethBalance - msg.value; // Eth reserve is the contract balance before this transaction's ETH liquidity was provided

            // Calculate the ratio
            // Ratio: `(cryptoDevTokenAmount user can add) = (Eth Sent by the user * cryptoDevTokenReserve / Eth Reserve)`
            uint256 cryptoDevTokenAmount = (msg.value * cryptoDevTokenReserve / ethReserve);
            require(_amount >= cryptoDevTokenAmount, "Minimum amount of CryptoDev tokens required for this liquidity pair has not been met");

            // Transfer only (cryptoDevTokenAmount user can add) amount of `Crypto Dev tokens` from users account to this contract
            cryptoDevToken.transferFrom(msg.sender, address(this), cryptoDevTokenAmount);

            // Calculate, and mint the relevant number of Liquidity Provider (LP) tokens
            // The amount of LP tokens should be proportional to the liquidity of ether added by the user
            // LP Tokens = (totalSupply of LP tokens in contract * (eth sent by the user)) / (eth reserve in the contract)
            liquidity = (totalSupply() * msg.value) / ethReserve;
            _mint(msg.sender, liquidity);
        }

        return liquidity;
    }

    // Removes liquidity from the exchange - provided `_amount` is the amount of LP tokens the user wants to 'cash in'
    function removeLiquidity(uint256 _amount) public returns(uint256, uint256) {
        require(_amount > 0, "Amount of liquidity to withdraw must be greater than zero");
        uint256 ethReserve = address(this).balance;
        uint256 totalSupply = totalSupply();

        // The amount of Eth that would be sent back to the user is based on a ratio:
        // (Eth sent back to the user) = (Current Eth reserve * amount of LP tokens that user wants to withdraw) / Total supply of `LP` tokens
        uint256 ethAmount = (ethReserve * _amount) / totalSupply;

        // The amount of Crypto Dev token that would be sent back to the user is based on a ratio:
        // (Crypto Dev sent back to the user) = (Current Crypto Dev token reserve * amount of LP tokens user wants to withdraw) / Total supply of `LP` tokens
        uint256 cryptoDevTokenAmount = (getReserve() * _amount) / totalSupply;

        // Burn the LP tokens that are being returned by the user, and return the calculated amounts of ETH and CryptoDev tokens to the caller's address
        _burn(msg.sender, _amount);
        payable(msg.sender).transfer(ethAmount);
        ERC20(cryptoDevTokenAddress).transfer(msg.sender, cryptoDevTokenAmount);
        return (ethAmount, cryptoDevTokenAmount);
    }

    // Calculate the amount of ETH/CryptoDev tokens that would be returned to the user in the swap
    function getAmountOfTokens(uint256 inputAmount, uint256 inputReserve, uint256 outputReserve) public pure returns(uint256) {
        require(inputReserve > 0 && outputReserve > 0, "Invalid provided input/output reserve");
        uint256 inputAmountWithFee = (inputAmount * 99) / 100;

        // Clever predetermined formula gives us the numerator and denominator for the swap
        uint256 numerator = inputAmountWithFee * outputReserve;
        uint256 denominator = inputReserve + inputAmountWithFee;
        return numerator / denominator;
    }

    function ethToCryptoDevToken(uint _minTokens) public payable {
        uint256 tokenReserve = getReserve();
        // Call `getAmountOfTokens` to get the amount of crypto dev tokens that would be returned to the user after the swap
        // The `inputReserve` we're sending is `address(this).balance - msg.value` instead of just `address(this).balance`
        // because `address(this).balance` already contains the `msg.value` user has sent in this function call
        uint256 tokensBought = getAmountOfTokens(
            msg.value,
            address(this).balance,
            tokenReserve
        );
        require(tokensBought >= _minTokens, "Calculated token output does not meet provided minimum token amount");

        // Finish the swap; ETH has already been sent to the contract in the function call
        ERC20(cryptoDevTokenAddress).transfer(msg.sender, tokensBought);
    }

    function cryptoDevTokenToEther(uint256 _tokensSold, uint256 _minEth) public {
        uint256 tokenReserve = getReserve();
        uint256 ethBought = getAmountOfTokens(
            _tokensSold,
            tokenReserve,
            address(this).balance
        );
        require(ethBought >= _minEth, "Calculated ETH output does not meet provided minimum ETH amount");

        // Make the swap
        ERC20(cryptoDevTokenAddress).transferFrom(msg.sender, address(this), _tokensSold);
        payable(msg.sender).transfer(ethBought);
    }
}