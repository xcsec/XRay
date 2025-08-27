import { BigNumber, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import styles from "../styles/Home.module.css";
import { addLiquidity, calculateCD } from "../utils/addLiquidity";
import {
  getCDTokensBalance,
  getEtherBalance,
  getLPTokensBalance,
  getReserveOfCDTokens,
} from "../utils/getAmounts";
import {
  getTokensAfterRemove,
  removeLiquidity,
} from "../utils/removeLiquidity";
import { swapTokens, getAmountOfTokensReceivedFromSwap } from "../utils/swap";

export default function Home() {
  /** App State */
  const [loading, setLoading] = useState(false);
  const [liquidityTab, setLiquidityTab] = useState(true);
  const zero = BigNumber.from(0);
  const web3ModalRef = useRef();
  const [walletConnected, setWalletConnected] = useState(false);

  /** State to track token/ETH amounts */
  const [ethBalance, setEtherBalance] = useState(zero); // Keeps track of the amount of Eth held by the user's account
  const [contractCDTokenReserve, setContractCDTokenReserve] = useState(zero); // Keeps track of the Crypto Dev tokens reserve balance in the Exchange contract
  const [contractEtherBalance, setContractEtherBalance] = useState(zero); // Keeps track of the ether balance in the Exchange contract
  const [cdBalance, setCDBalance] = useState(zero); // Amount of CryptoDev tokens held by the users account
  const [lpBalance, setLPBalance] = useState(zero); // Amount of LP tokens held by the users account

  /** State to track liquidity to be added or removed */
  const [addEther, setAddEther] = useState(zero); // Amount of Ether that the user wants to add to the liquidity
  const [addCDTokens, setAddCDTokens] = useState(zero); // Amount of CD tokens that the user wants to add to the liquidity
                                                        // When there is no initial liquidity and after liquidity gets added, it keeps track of the
                                                        // CD tokens that the user can add given a certain amount of ether
  const [removeEther, setRemoveEther] = useState(zero); // Amount of `Ether` that would be sent back to the user based on a certain number of `LP` tokens
  const [removeCD, setRemoveCD] = useState(zero); // Amount of `Crypto Dev` tokens that would be sent back to the user base on a certain number of `LP` tokens
  const [removeLPTokens, setRemoveLPTokens] = useState("0"); // Amount of LP tokens that the user wants to remove from liquidity

  /** State to track swap functionality */
  const [swapAmount, setSwapAmount] = useState(""); // Amount that the user wants to swap
  const [amtTokensReceivedAfterSwap, setAmtTokensReceivedAfterSwap] = useState(zero); // Amount of tokens that the user would receive after a swap completes
  const [ethSelected, setEthSelected] = useState(true); // Whether user wants to swap Eth or CD tokens
  
  /**
   * Call various functions to set up state for eth balance, LP tokens etc.
   */
  const getAmounts = async () => {
    try {
      const provider = await getProviderOrSigner(false);
      const signer = await getProviderOrSigner(true);
      const address = await signer.getAddress();
      const ethBalance = await getEtherBalance(provider, address);
      const cdBalance = await getCDTokensBalance(provider, address);
      const lpBalance = await getLPTokensBalance(provider, address);
      const contractCDTokenReserve = await getReserveOfCDTokens(provider);
      const ethBalanceContract = await getEtherBalance(provider, null, true);
      setEtherBalance(ethBalance);
      setCDBalance(cdBalance);
      setLPBalance(lpBalance);
      setContractCDTokenReserve(contractCDTokenReserve);
      setContractEtherBalance(ethBalanceContract);
    } catch (err) {
      console.error(err);
    }
  };

  /**** SWAP FUNCTIONS ****/

  /**
   * _swapTokens: Swaps  `swapAmountWei` of Eth/Crypto Dev tokens with `amtTokensReceivedAfterSwap` amount of Eth/Crypto Dev tokens.
   */
  const _swapTokens = async () => {
    try {
      const swapAmountWei = utils.parseEther(swapAmount);
      if (!swapAmountWei.eq(zero)) {
        const signer = await getProviderOrSigner(true);
        setLoading(true);

        await swapTokens(
          signer,
          swapAmountWei,
          amtTokensReceivedAfterSwap,
          ethSelected
        );
        setLoading(false);
        
        // Get all the updated amounts after the swap and reset the swap amount
        await getAmounts();
        setSwapAmount("");
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setSwapAmount("");
    }
  };

  /**
   * _getAmountOfTokensReceivedFromSwap:  Returns the number of Eth/Crypto Dev tokens that can be received
   * when the user swaps `swapAmountWei` amount of Eth/Crypto Dev tokens.
   */
  const _getAmountOfTokensReceivedFromSwap = async (swapAmount) => {
    try {
      // Convert the amount entered by the user to a BigNumber using the `parseEther` library from `ethers.js`
      const swapAmountWei = utils.parseEther(swapAmount.toString());
      if (!swapAmountWei.eq(zero)) {
        const provider = await getProviderOrSigner();
        const ethBalance = await getEtherBalance(provider, null, true);
        const amountOfTokens = await getAmountOfTokensReceivedFromSwap(
          provider,
          swapAmountWei,
          ethSelected,
          ethBalance,
          contractCDTokenReserve
        );
        setAmtTokensReceivedAfterSwap(amountOfTokens);
      } else {
        setAmtTokensReceivedAfterSwap(zero);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**** ADD LIQUIDITY FUNCTIONS ****/

  /**
   * _addLiquidity helps add liquidity to the exchange,
   * If the user is adding initial liquidity, user decides the ether and CD tokens he wants to add
   * to the exchange. If adding the liquidity after the initial liquidity has already been added
   * then we calculate the crypto dev tokens they can add, given the eth they want to add by keeping the ratios
   * constant.
   */
  const _addLiquidity = async () => {
    try {
      const addEtherWei = utils.parseEther(addEther.toString());
      if (!addCDTokens.eq(zero) && !addEtherWei.eq(zero)) {
        const signer = await getProviderOrSigner(true);
        setLoading(true);
        await addLiquidity(addCDTokens, addEtherWei, signer);
        setLoading(false);

        setAddCDTokens(zero);
        await getAmounts();
      } else {
        setAddCDTokens(zero);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setAddCDTokens(zero);
    }
  };

  /**** REMOVE LIQUIDITY FUNCTIONS ****/

  /**
   * _removeLiquidity: Removes the `removeLPTokensWei` amount of LP tokens from
   * liquidity and also the calculated amount of `ether` and `CD` tokens
   */
  const _removeLiquidity = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const removeLPTokensWei = utils.parseEther(removeLPTokens);
      setLoading(true);

      await removeLiquidity(removeLPTokensWei, signer);

      setLoading(false);
      await getAmounts();
      setRemoveCD(zero);
      setRemoveEther(zero);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setRemoveCD(zero);
      setRemoveEther(zero);
    }
  };

  /**
   * _getTokensAfterRemove: Calculates the amount of `Ether` and `CD` tokens
   * that would be returned back to user after he removes `removeLPTokenWei` amount
   * of LP tokens from the contract
   */
  const _getTokensAfterRemove = async (removeLPTokens) => {
    try {
      const provider = await getProviderOrSigner();
      const removeLPTokenWei = utils.parseEther(removeLPTokens);

      // Get the user's ETH balance
      const ethBalance = await getEtherBalance(provider, null, true);
      // Get the crypto dev token reserves from the contract
      const cryptoDevTokenReserve = await getReserveOfCDTokens(provider);

      const { removeEther, removeCD } = await getTokensAfterRemove(
        provider,
        removeLPTokenWei,
        ethBalance,
        cryptoDevTokenReserve
      );
      setRemoveEther(removeEther);
      setRemoveCD(removeCD);
    } catch (err) {
      console.error(err);
    }
  };


  /**
   * connectWallet: Connects the MetaMask wallet
   */
  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Returns a Provider or Signer object representing the Ethereum RPC with or without the
   * signing capabilities of metamask attached
   *
   * A `Provider` is needed to interact with the blockchain - reading transactions, reading balances, reading state, etc.
   *
   * A `Signer` is a special type of Provider used in case a `write` transaction needs to be made to the blockchain, which involves the connected account
   * needing to make a digital signature to authorize the transaction being sent. Metamask exposes a Signer API to allow your website to
   * request signatures from the user using Signer functions.
   *
   * @param needSigner - True if you need the signer, default false otherwise
   */
  const getProviderOrSigner = async (needSigner = false) => {
    // Connect to Metamask
    // Since we store `web3Modal` as a reference, we need to access the `current` value to get access to the underlying object
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    // If user is not connected to the Rinkeby network, let them know and throw an error
    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 4) {
      window.alert("Change the network to Rinkeby");
      throw new Error("Change network to Rinkeby");
    }

    return needSigner ? web3Provider.getSigner() : web3Provider;
  };

  // Call this effect whenever the state of `walletConnected` changes
  useEffect(() => {
    // if wallet is not connected, create a new instance of Web3Modal and connect the MetaMask wallet
    if (!walletConnected) {
      // Assign the Web3Modal class to the reference object by setting it's `current` value
      // The `current` value is persisted throughout as long as this page is open
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getAmounts();
    }
  }, [walletConnected]);

  /**
   *   renderButton: Returns a button based on the state of the dapp
   */
  const renderButton = () => {
    // If wallet is not connected, return a button which allows them to connect their wallet
    if (!walletConnected) {
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your wallet
        </button>
      );
    }

    // If we are currently waiting for something, return a loading button
    if (loading) {
      return <button className={styles.button}>Loading...</button>;
    }

    if (liquidityTab) {
      return (
        <div>
          <div className={styles.description}>
            You have:
            <br />
            {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
            {utils.formatEther(cdBalance)} Crypto Dev Tokens
            <br />
            {utils.formatEther(ethBalance)} Ether
            <br />
            {utils.formatEther(lpBalance)} Crypto Dev LP tokens
          </div>
          <div>
            {/* If reserved CD is zero, render the state for liquidity zero where we ask the user how much initial
                liquidity they want to add. If not, just render the state where liquidity is not zero, and
                we calculate based on the `ETH` amount specified by the user & how many `CD` tokens can be added */}
            {utils.parseEther(contractCDTokenReserve.toString()).eq(zero) ? (
              <div>
                <input
                  type="number"
                  placeholder="Amount of Ether"
                  onChange={(e) => setAddEther(e.target.value || "0")}
                  className={styles.input}
                />
                <input
                  type="number"
                  placeholder="Amount of CryptoDev tokens"
                  onChange={(e) =>
                    setAddCDTokens(
                      BigNumber.from(utils.parseEther(e.target.value || "0"))
                    )
                  }
                  className={styles.input}
                />
                <button className={styles.button1} onClick={_addLiquidity}>
                  Add
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="number"
                  placeholder="Amount of Ether"
                  onChange={async (e) => {
                    setAddEther(e.target.value || "0");
                    // calculate the number of CD tokens that
                    // can be added given  `e.target.value` amount of Eth
                    const addCDTokens = await calculateCD(
                      e.target.value || "0",
                      contractEtherBalance,
                      contractCDTokenReserve
                    );
                    setAddCDTokens(addCDTokens);
                  }}
                  className={styles.input}
                />
                <div className={styles.inputDiv}>
                  {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                  {`You will need ${utils.formatEther(addCDTokens)} Crypto Dev
                  Tokens`}
                </div>
                <button className={styles.button1} onClick={_addLiquidity}>
                  Add
                </button>
              </div>
            )}
            <div>
              <input
                type="number"
                placeholder="Amount of LP Tokens"
                onChange={async (e) => {
                  setRemoveLPTokens(e.target.value || "0");
                  // Calculate the amount of Ether and CD tokens that the user would receive
                  // After he removes `e.target.value` amount of `LP` tokens
                  await _getTokensAfterRemove(e.target.value || "0");
                }}
                className={styles.input}
              />
              <div className={styles.inputDiv}>
                {/* Convert BigNumber to string */}
                {`You will get ${removeCD ? utils.formatEther(removeCD) : "0"} Crypto
                Dev Tokens and ${removeEther ? utils.formatEther(removeEther) : "0"} Eth`}
              </div>
              <button className={styles.button1} onClick={_removeLiquidity}>
                Remove
              </button>
            </div>
          </div>
        </div>
      );
    } else { // Render the 'Swap' tab
      return (
        <div>
          <input
            type="number"
            placeholder="Amount"
            onChange={async (e) => {
              setSwapAmount(e.target.value || "");
              // Calculate the amount of tokens user would receive after the swap
              await _getAmountOfTokensReceivedFromSwap(e.target.value || "0");
            }}
            className={styles.input}
            value={swapAmount}
          />
          <select
            className={styles.select}
            name="dropdown"
            id="dropdown"
            onChange={async () => {
              setEthSelected(!ethSelected);
              // Initialize the values back to zero
              await _getAmountOfTokensReceivedFromSwap(0);
              setSwapAmount("");
            }}
          >
            <option value="eth">Ethereum</option>
            <option value="cryptoDevToken">Crypto Dev Token</option>
          </select>
          <br />
          <div className={styles.inputDiv}>
            {/* Convert the BigNumber to string */}
            {ethSelected
              ? `You will get ${utils.formatEther(amtTokensReceivedAfterSwap)} Crypto Dev Tokens`
              : `You will get ${utils.formatEther(amtTokensReceivedAfterSwap)} Eth`
            }
          </div>
          <button className={styles.button1} onClick={_swapTokens}>
            Swap
          </button>
        </div>
      );
    }
  };

  return (
    <div>
      <Head>
        <title>Crypto Devs</title>
        <meta name="description" content="Exchange-Dapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs Exchange!</h1>
          <div className={styles.description}>
            Exchange Ethereum &#60;&#62; Crypto Dev Tokens
          </div>
          <div>
            <button
              className={styles.button}
              onClick={() => {
                setLiquidityTab(!liquidityTab);
              }}
            >
              Liquidity
            </button>
            <button
              className={styles.button}
              onClick={() => {
                setLiquidityTab(false);
              }}
            >
              Swap
            </button>
          </div>
          {renderButton()}
        </div>
        <div>
          <img className={styles.image} src="./cryptodev.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
}