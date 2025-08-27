# Cross Chain Bridge Examples

This repository is intended to be a set of examples of how to use [@ericnordelo/cross-chain-bridge-helpers](https://github.com/ericnordelo/cross-chain-bridge-helpers) package together with the Openzeppelin `CrossChainEnabled` abstraction to send cross-chain messages over different bridges.

For now it only support Arbitrum and Optimism L1-L2 bridges.

## How to use this package?

1. Clone the repository :

   ```sh
   $ git clone git@github.com:ericnordelo/cross-chain-bridge-examples.git
   ```

2. Get inside the directory and run `yarn install`

   ```sh
   $ cd cross-chain-bridge-examples && yarn install
   ```

3. Create a `.env` file following the `.env.example` provided in the repo

   ```sh
    MNEMONIC=
    ALCHEMY_ARBITRUM_RPC=
    ALCHEMY_OPTIMISM_RPC=
    INFURA_API_KEY=
   ```

4. If you want to use different providers, feel free to change the name of the environment variables, and update the `hardhat.config.js` file.

## TS helpers summary (@ericnordelo/cross-chain-bridge-helpers)

### Generic usage on any project

1. Install the package:

   ```sh
   $ yarn add @ericnordelo/cross-chain-bridge-helpers
   ```

2. Import the `L2BridgeFactory` class, and load the providers after getting the instance:

   ```js
    import { L2BridgeFactory } from '@ericnordelo/cross-chain-bridge-helpers';

    (...)

    const bridge = L2BridgeFactory.get('Arbitrum-L1L2');
    await bridge.loadProviders({ l1Provider, l2Provider });
   ```

3. The providers should be loaded separately. This gives you the power to integrate with different frameworks and enviroments, just passing the providers through (ex: hardhat). For now, the library requires using `ethers` providers. Here is an example:

   ```js
   import { L2BridgeFactory } from '@ericnordelo/cross-chain-bridge-helpers';
   import { providers } from 'ethers';
   import { config } from 'dotenv';

   config({ path: './path/to/.env' });

   const l1Provider = new providers.JsonRpcProvider(process.env.ARBITRUM_L1_RPC);
   const l2Provider = new providers.JsonRpcProvider(process.env.ARBITRUM_L2_RPC);

   const bridge = L2BridgeFactory.get('Arbitrum-L1L2-Rinkeby');
   await bridge.loadProviders({ l1Provider, l2Provider });
   ```

4. Now, you can use either the `getCrossChainTxConfigParameters` or the `getCrossChainTxConfigBytes` helpers, that will return the appropriate parameters from the selected bridge:

   ```ts
    async getCrossChainTxConfigParameters(
      sender: string,
      destAddr: string,
      l2CallDataHex: string,
      l2CallValue: BigNumber,
    ) : Promise<object>;

    async getCrossChainTxConfigBytes(
      sender: string,
      destAddr: string,
      l2CallDataHex: string,
      l2CallValue: BigNumber,
    ): Promise<string>;
   ```

5. The `getCrossChainTxConfigBytes` result, can be used as bridgeConfig in the Openzeppelin library.

6. These are the accepted bridges in the current version:

   ```ts
   export type Bridge =
     | 'Arbitrum-L1L2'
     | 'Arbitrum-L2L1'
     | 'Optimism-L1L2'
     | 'Optimism-L2L1'
     | 'Arbitrum-L1L2-Rinkeby'
     | 'Arbitrum-L2L1-Rinkeby'
     | 'Optimism-L1L2-Kovan'
     | 'Optimism-L2L1-Kovan';
   ```

### Usage in this repository

Being this repository a set of predefined examples, this plugin is already imported, and used in different tasks that you can find inside the `tasks` folder in the source directory.

## Examples

We are going to use two contracts to test the message delivery: a Greeter.sol and a Sender.sol.

The Greeter's purpose is to store a message (string), and return it through a getter. This is the contract we are going to use to receive the message, changing the greeting message with cross-chain calls:

```ts
  contract Greeter {
    string private _greeting;

    constructor(string memory greeting_) {
        _greeting = greeting_;
    }

    function greet() public view returns (string memory) {
        return _greeting;
    }

    function setGreeting(string memory greeting_) public payable {
        _greeting = greeting_;
    }
  }
```

The Sender, as the name suggest is used to deliver the cross-chain message, and is the one that is going to implement the extensions from the Openzeppelin cross-chain library:

```ts
  import "../crosschain/arbitrum/CrossChainEnabledArbitrumL1.sol";

  contract SenderArbitrumL1 is CrossChainEnabledArbitrumL1 {
      // solhint-disable-next-line no-empty-blocks
      constructor(address bridge_) CrossChainEnabledArbitrumL1(bridge_) {}

      function sendCrossChainMessage(
          address destination,
          bytes memory data,
          bytes memory crossChainTxParams
      ) external payable {
          _sendCrossChainMessage(destination, data, crossChainTxParams);
      }
  }
```

The code above is a specific example for Arbitrum L1 to L2 channel, but different implementations are used for different bridges. The `CrossChainEnabledArbitrumL1` is one specific implementation of the `CrossChainEnabled` abstraction:

```ts
  abstract contract CrossChainEnabled {
      /**
       * @dev Throws if the current function call is not the result of a
       * cross-chain execution.
       */
      modifier onlyCrossChain() {
          if (!_isCrossChain()) revert NotCrossChainCall();
          _;
      }

      /**
       * @dev Throws if the current function call is not the result of a
       * cross-chain execution initiated by `account`.
       */
      modifier onlyCrossChainSender(address expected) {
          address actual = _crossChainSender();
          if (expected != actual) revert InvalidCrossChainSender(actual, expected);
          _;
      }

      /**
       * @dev Returns whether the current function call is the result of a
       * cross-chain message.
       */
      function _isCrossChain() internal view virtual returns (bool);

      /**
       * @dev Returns the address of the sender of the cross-chain message that
       * triggered the current function call.
       *
       * IMPORTANT: Should revert with `NotCrossChainCall` if the current function
       * call is not the result of a cross-chain message.
       */
      function _crossChainSender() internal view virtual returns (address);

      /**
       * @dev Sends a generic cross-chain message through a bridge.
       *
       * IMPORTANT: The structure of the crossChainTxParams is defined in the implementations
       * and can be built using the SDKs of the corresponding bridge most of the times.
       *
       * @param destination The address of the cross-chain target contract.
       * @param data The calldata of the cross-chain call.
       * @param crossChainTxParams An ABI encoded struct representing the configuration required
       * for the message to be sent through the bridge.
       */
      function _sendCrossChainMessage(
          address destination,
          bytes memory data,
          bytes memory crossChainTxParams
      ) internal virtual;
  }
```

This abstraction (and therefore the implementations) also provide us with modifiers to check sender in the receiver (we will add this check to the Greeter in the example 2).

### Example 1 (send message from arbitrum l1 to l2)

1. Deploy the `Greeter` in the Abitrum L2 (we are using testnets of course):

   ```sh
   $ hh deploy --network arbitrum --tags greeter
   ```

- For this step you need ETH in Arbitrum, you can follow [this guide](https://docs.handle.fi/how-to-guides/arbitrum-l2-testnet-rinkeby) to get some.

- In this guide I will be using `hh` instead of `npx hardhat`. If you dont have the former configured, just use the latter.

2. Deploy the Sender in the Abitrum L1 (Rinkeby):

   ```sh
    $ hh deploy --network rinkeby --tags sender_arbitrum_l1
   ```

3. Run the `greet` task to get the Greeter message before cross-chain call.

   ```sh
    $ hh greet --network arbitrum
   ```

4. Run the task for sending the message from Arbitrum L1 to L2, using the address of the deployed `Greeter` as the `target`, and any message you want:

   ```sh
    $ hh send-message:arbitrum-l1-to-l2 --target \
         [greeter_address_in_l2] --greeting \
         'Hellow World!' --network rinkeby
   ```

5. Wait between 2 and 5 minutes for the message to be executed in l2 (this depends on the Arbitrum Sequencer implementation).

6. Run the `greet` task again to get the updated message (if is not updated wait a little longer).

   ```sh
    $ hh greet --network arbitrum
   ```

#### Checking the Task code

```ts
task('send-message:arbitrum-l1-to-l2', 'Sends a cross-chain message from Arbitrum l1 to l2.')
  .addParam('target', 'The address of the contract to call')
  .addParam('greeting', 'The string representing the greeting')
  .setAction(async (taskArgs) => {
    const { L2BridgeFactory } = require('@ericnordelo/cross-chain-bridge-helpers');
    const { providers, BigNumber } = require('ethers');

    const sender = await ethers.getContract('SenderArbitrumL1');
    const params = web3.eth.abi.encodeParameters(['string'], [taskArgs.greeting]);
    const greeter = taskArgs.target;

    // get providers urls
    const ARBITRUM_L1_RPC = hre.config.networks.rinkeby.url;
    const ARBITRUM_L2_RPC = hre.config.networks.arbitrum.url;

    const l1Provider = new providers.JsonRpcProvider(ARBITRUM_L1_RPC);
    const l2Provider = new providers.JsonRpcProvider(ARBITRUM_L2_RPC);

    // get the bridge helper
    const bridge = L2BridgeFactory.get('Arbitrum-L1L2-Rinkeby');
    await bridge.loadProviders({ l1Provider, l2Provider });

    // the calldata for setGreeting: function id plus encoded parameters
    const calldata = '0xa4136862' + params.slice(2);

    // get the crossChainTxParams for the CrossChainEnabled._sendCrossChainMessage
    const crossChainTxParams = await bridge.getCrossChainTxConfigBytes(
      sender.address,
      greeter,
      calldata,
      BigNumber.from(0)
    );

    // this value is required to have enough balance in the contract to deposit for the cross-chain call
    const tx = await sender.sendCrossChainMessage(greeter, calldata, crossChainTxParams, {
      value: '1747850031751',
    });

    console.log('Transaction sent: ' + tx.hash);
  });
```

In a general overview, we are using the providers from hardhat to instantiate the `L2Bridge`, and we are using this instance to get the `crossChainTxParams` config required for this bridge.

Then we are calling the sendCrossChainMessage with the `target`, the `calldata`, and the configuration for sending the message through the bridge (`crossChainTxParams`).

This config bytes give us flexibility to send different configurations required from different bridges.

The rest of the code should be self explanatory if you are experienced with `hardhat` and Ethereum development.

### Example 2 (send message from optimism l1 to l2)

For this example we are going to use a different Greeter: `GreeterOptimismL2`.

```ts
 import "./crosschain/optimism/CrossChainEnabledOptimismL2.sol";

 contract GreeterOptimismL2 is CrossChainEnabledOptimismL2 {
     string private _greeting;

     constructor(address bridge_, string memory greeting_) CrossChainEnabledOptimismL2(bridge_) {
         _greeting = greeting_;
     }

     function greet() public view returns (string memory) {
         return _greeting;
     }

     function setGreeting(string memory greeting_) public payable onlyCrossChain {
         _greeting = greeting_;
     }
 }
```

The main difference is that we are extending from the `CrossChainEnabledOptimismL2`, and the purpose of this is to how the usage of the `onlyCrossChain` modifier provided in the `CrossChainEnabled` abstraction.

By just extending the class, and adding the modifier, you can make sure that calls not coming from l1 are going to revert.

You can try to call the setGreeting function directly in Optimism, and the call must revert with the custom error: `NotCrossChainCall()`.

There is a task for this too (should be called only after deploying the contract to Optimism):

```sh
 $ hh set-greeting:optimism-l2 --network optimism
```

This call should fail in the gas estimation, because of the modifier.

Let's go back to the example:

1. Deploy the `GreeterOptimismL2` in the L2 (we are using testnets of course):

   ```sh
   $ hh deploy --network optimism --tags greeter_optimism_l2
   ```

- For this step you need ETH in Optimism testnet, you should be able to get some [at this faucet](https://kovan.optifaucet.com/).

2. Deploy the Sender in the Optimism L1 (Kovan):

   ```sh
    $ hh deploy --network kovan --tags sender_optimism_l1
   ```

3. Run the `greet:optimism-l2` task to get the GreeterOptimismL2 message before cross-chain call.

   ```sh
    $ hh greet:optimism-l2 --network optimism
   ```

4. Run the task for sending the message from Optimism L1 to L2, using the address of the deployed `GreeterOptimismL2` as the `target`, and any message you want:

   ```sh
    $ hh send-message:optimism-l1-to-l2 --target \
         [greeter_optimism_l2_address] --greeting \
         'Hellow World!' --network rinkeby
   ```

5. Wait between 1 and 3 minutes for the message to be executed in l2.

6. Run the `greet:optimism-l2` task again to get the updated message (if is not updated wait a little longer).

   ```sh
    $ hh greet:optimism-l2 --network optimism
   ```

#### Checking the Task code

```ts
task('send-message:optimism-l1-to-l2', 'Sends a cross-chain message from Optimism l1 to l2.')
  .addParam('target', 'The address of the contract to call')
  .addParam('greeting', 'The string representing the greeting')
  .setAction(async (taskArgs) => {
    const { L2BridgeFactory } = require('@ericnordelo/cross-chain-bridge-helpers');
    const { providers, BigNumber } = require('ethers');

    const sender = await ethers.getContract('SenderOptimismL1');
    const params = web3.eth.abi.encodeParameters(['string'], [taskArgs.greeting]);
    const greeter = taskArgs.target;

    // get providers urls
    const OPTIMISM_L1_RPC = hre.config.networks.kovan.url;
    const OPTIMISM_L2_RPC = hre.config.networks.optimism.url;

    const l1Provider = new providers.JsonRpcProvider(OPTIMISM_L1_RPC);
    const l2Provider = new providers.JsonRpcProvider(OPTIMISM_L2_RPC);

    // get the bridge helper
    const bridge = L2BridgeFactory.get('Optimism-L1L2-Kovan');
    await bridge.loadProviders({ l1Provider, l2Provider });

    // the calldata for setGreeting: function id plus encoded parameters
    const calldata = '0xa4136862' + params.slice(2);

    // get the crossChainTxParams for the CrossChainEnabled._sendCrossChainMessage
    const crossChainTxParams = await bridge.getCrossChainTxConfigBytes(
      sender.address,
      greeter,
      calldata,
      BigNumber.from(0)
    );

    // sends the cross-chain message to update the greeting
    const tx = await sender.sendCrossChainMessage(greeter, calldata, crossChainTxParams);

    console.log('Transaction sent: ' + tx.hash);
  });
```

You can see that the task is quite similar to the one for sending the message from Optimism L1 to L2. This is the power of the `@ericnordelo/cross-chain-bridge-helpers` package and the `CrossChainEnabled` abstraction combined.

### NOTES:

- In Optimism you can't deposit ETH and execute a call to a Smart Contract at the same time (calling a payable function with value greater than 0). You can call a function without passing value, but if you pass a value, the calldata is ignored, and only the deposit is executed. The reason behind this is the Optimism design itself. Is not a decision from the designers of this Plugin.
