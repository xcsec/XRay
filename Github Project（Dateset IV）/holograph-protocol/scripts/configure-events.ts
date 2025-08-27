import yargs from 'yargs/yargs';

import { hideBin } from 'yargs/helpers';
import { ConfigureEvents, HolographERC20Event, HolographERC721Event } from './utils/events';

interface EventNameToEnumValueMap {
  [key: string]: HolographERC20Event | HolographERC721Event;
}

const eventNameToEnumValue: EventNameToEnumValueMap = {
  // HolographERC20Event mappings
  'HolographERC20Event.bridgeIn': HolographERC20Event.bridgeIn,
  'HolographERC20Event.bridgeOut': HolographERC20Event.bridgeOut,
  'HolographERC20Event.afterApprove': HolographERC20Event.afterApprove,
  'HolographERC20Event.beforeApprove': HolographERC20Event.beforeApprove,
  'HolographERC20Event.afterOnERC20Received': HolographERC20Event.afterOnERC20Received,
  'HolographERC20Event.beforeOnERC20Received': HolographERC20Event.beforeOnERC20Received,
  'HolographERC20Event.afterBurn': HolographERC20Event.afterBurn,
  'HolographERC20Event.beforeBurn': HolographERC20Event.beforeBurn,
  'HolographERC20Event.afterMint': HolographERC20Event.afterMint,
  'HolographERC20Event.beforeMint': HolographERC20Event.beforeMint,
  'HolographERC20Event.afterSafeTransfer': HolographERC20Event.afterSafeTransfer,
  'HolographERC20Event.beforeSafeTransfer': HolographERC20Event.beforeSafeTransfer,
  'HolographERC20Event.afterTransfer': HolographERC20Event.afterTransfer,
  'HolographERC20Event.beforeTransfer': HolographERC20Event.beforeTransfer,
  'HolographERC20Event.onAllowance': HolographERC20Event.onAllowance,

  // HolographERC721Event mappings
  'HolographERC721Event.bridgeIn': HolographERC721Event.bridgeIn,
  'HolographERC721Event.bridgeOut': HolographERC721Event.bridgeOut,
  'HolographERC721Event.afterApprove': HolographERC721Event.afterApprove,
  'HolographERC721Event.beforeApprove': HolographERC721Event.beforeApprove,
  'HolographERC721Event.afterApprovalAll': HolographERC721Event.afterApprovalAll,
  'HolographERC721Event.beforeApprovalAll': HolographERC721Event.beforeApprovalAll,
  'HolographERC721Event.afterBurn': HolographERC721Event.afterBurn,
  'HolographERC721Event.beforeBurn': HolographERC721Event.beforeBurn,
  'HolographERC721Event.afterMint': HolographERC721Event.afterMint,
  'HolographERC721Event.beforeMint': HolographERC721Event.beforeMint,
  'HolographERC721Event.afterSafeTransfer': HolographERC721Event.afterSafeTransfer,
  'HolographERC721Event.beforeSafeTransfer': HolographERC721Event.beforeSafeTransfer,
  'HolographERC721Event.afterTransfer': HolographERC721Event.afterTransfer,
  'HolographERC721Event.beforeTransfer': HolographERC721Event.beforeTransfer,
  'HolographERC721Event.beforeOnERC721Received': HolographERC721Event.beforeOnERC721Received,
  'HolographERC721Event.afterOnERC721Received': HolographERC721Event.afterOnERC721Received,
  'HolographERC721Event.onIsApprovedForAll': HolographERC721Event.onIsApprovedForAll,
  'HolographERC721Event.customContractURI': HolographERC721Event.customContractURI,
};

/**
 * Generates the configuration for the specified events as 32 bytes hex string.
 * Example usage:
 *
 * npx ts-node scripts/configure-events.ts --events HolographERC721Event.beforeSafeTransfer HolographERC721Event.beforeTransfer HolographERC721Event.onIsApprovedForAll HolographERC721Event.customContractURI
 *
 */
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('events', {
      type: 'array',
      describe: 'List of events to configure',
      demandOption: true,
    })
    .coerce('events', (arg: string[]) => {
      return arg.map((event: string) => {
        const enumValue = eventNameToEnumValue[event];
        if (typeof enumValue === 'undefined') {
          throw new Error(`Event name "${event}" is not recognized.`);
        }
        return enumValue;
      });
    })
    .parseSync();

  const events = argv.events as (HolographERC20Event | HolographERC721Event)[];

  if (!events || events.length === 0) {
    console.error('No events specified. Use the --events flag to specify events.');
    process.exit(1);
  }

  const eventConfigHex = ConfigureEvents(events as any);
  console.log('Events configured:', eventConfigHex);

  for (const eventEnumValue of events) {
    const eventName = getEventNameByValue(eventEnumValue, true); // Assuming true for HolographERC721Event
    const isRegistered = isEventRegistered(eventConfigHex, eventEnumValue);
    if (eventName) {
      console.log(`${eventName} is ${isRegistered ? 'registered' : 'not registered'}.`);
    } else {
      console.log(`Event with enum value ${eventEnumValue} is not recognized.`);
    }
  }

  console.log('Events configured successfully.');
}

/**
 * Retrieves the event name based on its numeric value and a flag indicating the event type.
 *
 * This function iterates over the `eventNameToEnumValue` mapping, which associates event names with their numeric values and types.
 * It attempts to find an event name that matches both the provided numeric value and the type indicated by `isERC721`.
 * If such an event name is found, it is returned; otherwise, the function returns `undefined`.
 *
 * @param {number} eventValue - The numeric value of the event to search for. This value corresponds to the enum value of the event.
 * @param {boolean} isERC721 - A boolean flag indicating whether to search for an ERC721 event. If `true`, the function looks for an ERC721 event; if `false`, it looks for an ERC20 event.
 * @returns {string | undefined} - The name of the event if found, otherwise `undefined`.
 */
function getEventNameByValue(eventValue: number, isERC721: boolean): string | undefined {
  // Iterate over each entry in the eventNameToEnumValue mapping
  for (const [key, value] of Object.entries(eventNameToEnumValue)) {
    // Check if the current entry's value matches the provided eventValue
    // and if the key (event name) starts with the appropriate prefix based on isERC721
    if (value === eventValue && key.startsWith(isERC721 ? 'HolographERC721Event' : 'HolographERC20Event')) {
      // If a matching entry is found, return the event name
      return key;
    }
  }
  // If no matching entry is found, return undefined
  return undefined;
}

/**
 * Checks if a specific event is registered within a given event configuration.
 *
 * This function performs bitwise operations on a hexadecimal string representing
 * the event configuration. Each bit in this configuration corresponds to the registration
 * status (registered or not registered) of an event, where a bit set to 1 indicates the event
 * is registered, and a bit set to 0 indicates it is not registered.
 *
 * @param {string} eventConfigHex - The event configuration in hexadecimal string format.
 *                                  This string is converted to a bigint to perform bitwise operations.
 * @param {HolographERC721Event | HolographERC20Event} eventName - The enum value of the event,
 *                                  which also represents the position of the event's bit in the configuration.
 * @returns {boolean} - True if the event is registered (its corresponding bit is set to 1); otherwise, false.
 */
function isEventRegistered(eventConfigHex: string, eventName: HolographERC721Event | HolographERC20Event): boolean {
  // Convert the hexadecimal string to a bigint to perform bitwise operations.
  const eventConfig: bigint = BigInt(eventConfigHex);

  // Perform a right bitwise shift (>>) on eventConfig by the numeric value of eventName.
  // This operation shifts the bits of eventConfig to the right by the number of positions specified by eventName.
  // The effect is to isolate the bit corresponding to the specified event at the least significant bit position (rightmost bit).
  //
  // Example:
  // If eventName is 2, and eventConfig binary representation is ...100 (4 in decimal),
  // shifting right by 2 positions results in ...001 (1 in decimal).
  //
  // Then, perform a bitwise AND (&) with BigInt(1).
  // This operation compares the isolated bit (the least significant bit after the shift) to 1.
  // If the isolated bit is 1 (meaning the event is registered), the result of the AND operation will be 1 (true).
  // If the isolated bit is 0 (the event is not registered), the result will be 0 (false).
  //
  // Finally, compare the result of the AND operation to BigInt(1) to determine if the event is registered.
  // If the comparison is true, the specified event is registered; otherwise, it is not.
  return ((eventConfig >> BigInt(eventName)) & BigInt(1)) === BigInt(1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
