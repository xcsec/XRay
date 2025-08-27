task('deposit-eth:optimism', 'Deposits ether from optimism l1 into l2.')
  .addParam('target', 'The address of the receiver')
  .setAction(async (taskArgs) => {
    const { L2BridgeFactory } = require('@ericnordelo/cross-chain-bridge-helpers');
    const { providers, BigNumber } = require('ethers');

    const sender = await ethers.getContract('SenderOptimismL1');
    const target = taskArgs.target;

    // get providers urls
    const ARBITRUM_L1_RPC = hre.config.networks.rinkeby.url;
    const ARBITRUM_L2_RPC = hre.config.networks.arbitrum.url;

    const l1Provider = new providers.JsonRpcProvider(ARBITRUM_L1_RPC);
    const l2Provider = new providers.JsonRpcProvider(ARBITRUM_L2_RPC);

    // get the bridge helper
    const bridge = L2BridgeFactory.get('Arbitrum-L1L2-Rinkeby');
    await bridge.loadProviders({ l1Provider, l2Provider });

    // the calldata for depositing is not a contract call
    const calldata = '0x';

    // get the crossChainTxParams for the CrossChainEnabled._sendCrossChainMessage
    const crossChainTxParams = await bridge.getCrossChainTxConfigBytes(
      sender.address,
      target,
      calldata,
      BigNumber.from(10)
    );

    // deposits 10 wei cross-chain into optimism l2
    const tx = await sender.sendCrossChainMessage(target, calldata, crossChainTxParams, {
      value: '10',
    });

    console.log('Transaction sent: ' + tx.hash);
  });

// task('withdraw-eth:optimism', 'Withdraw ether from optimism l2 into l1.')
//   .addParam('target', 'The address of the receiver')
//   .setAction(async (taskArgs) => {
//     const { L2BridgeFactory } = require('@ericnordelo/cross-chain-bridge-helpers');
//     const { providers, BigNumber } = require('ethers');

//     const sender = await ethers.getContract('SenderArbitrumL1');
//     const params = web3.eth.abi.encodeParameters(['string'], [taskArgs.greeting]);
//     const greeter = taskArgs.target;

//     // get providers urls
//     const OPTIMISM_L1_RPC = hre.config.networks.kovan.url;
//     const OPTIMISM_L2_RPC = hre.config.networks.optimism.url;

//     const l1Provider = new providers.JsonRpcProvider(OPTIMISM_L1_RPC);
//     const l2Provider = new providers.JsonRpcProvider(OPTIMISM_L2_RPC);

//     // get the bridge helper
//     const bridge = L2BridgeFactory.get('Optimism-L1L2-Kovan');
//     await bridge.loadProviders({ l1Provider, l2Provider });

//     // the calldata for setGreeting: function id plus encoded parameters
//     const calldata = '0xa4136862' + params.slice(2);

//     // get the crossChainTxParams for the CrossChainEnabled._sendCrossChainMessage
//     const crossChainTxParams = await bridge.getCrossChainTxConfigBytes(
//       sender.address,
//       greeter,
//       calldata,
//       BigNumber.from(0)
//     );

//     // this value is required to have enough balance in the contract to deposit for the cross-chain call
//     const tx = await sender.sendCrossChainMessage(greeter, calldata, crossChainTxParams);

//     console.log('Transaction sent: ' + tx.tx);
//   });

module.exports = {};
