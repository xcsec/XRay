export enum HolographERC20Event {
  bridgeIn = 1,
  bridgeOut = 2,
  afterApprove = 3,
  beforeApprove = 4,
  afterOnERC20Received = 5,
  beforeOnERC20Received = 6,
  afterBurn = 7,
  beforeBurn = 8,
  afterMint = 9,
  beforeMint = 10,
  afterSafeTransfer = 11,
  beforeSafeTransfer = 12,
  afterTransfer = 13,
  beforeTransfer = 14,
  onAllowance = 15,
}

export enum HolographERC721Event {
  bridgeIn = 1,
  bridgeOut = 2,
  afterApprove = 3,
  beforeApprove = 4,
  afterApprovalAll = 5,
  beforeApprovalAll = 6,
  afterBurn = 7,
  beforeBurn = 8,
  afterMint = 9,
  beforeMint = 10,
  afterSafeTransfer = 11,
  beforeSafeTransfer = 12,
  afterTransfer = 13,
  beforeTransfer = 14,
  beforeOnERC721Received = 15,
  afterOnERC721Received = 16,
  onIsApprovedForAll = 17,
  customContractURI = 18,
}

export enum HolographERC1155Event {}

/**
 * Generates a hexadecimal string representing the event configuration.
 * This configuration indicates which events are registered.
 *
 * Each bit in the resulting hex string corresponds to an event, where:
 * - A bit set to `1` means the event is registered.
 * - A bit set to `0` means the event is not registered.
 *
 * @param {HolographERC20Event[] | HolographERC721Event[] | HolographERC1155Event[]} config - An array of event enum values.
 *        These values represent the events to be marked as registered in the configuration.
 * @returns {string} - The event configuration as a hexadecimal string.
 */
export function ConfigureEvents(
  config: HolographERC20Event[] | HolographERC721Event[] | HolographERC1155Event[]
): string {
  // Initialize a binary string of 256 zeros. Each position can represent an event's registration status.
  let binary: string = '0'.repeat(256);

  // Iterate through the provided event enum values.
  for (let i = 0, l = config.length; i < l; i++) {
    let num: number = config[i]; // The current event enum value.

    // Replace the nth (num) zero in the binary string with a 1, marking the event as registered.
    // This is done by constructing a RegExp that captures up to the nth position and replacing the next zero with a 1.
    binary = binary.replace(new RegExp('(.{' + num + '}).{1}(.*)', 'gi'), '$11$2');
  }

  // Since event enum values start from 1 but array indices from 0, and to align with the endianness,
  // reverse the binary string to match the hexadecimal conversion expectations.
  binary = binary.split('').reverse().join('');

  // Split the binary string into chunks of 8 bits (1 byte) each, for conversion to hexadecimal.
  let byteArray: string[] = binary.match(/.{8}/g) || [];

  // Initialize the hex string with the prefix '0x' to indicate it's a hexadecimal value.
  let hex: string = '0x';

  // Convert each binary byte to its hexadecimal representation and append it to the hex string.
  for (let i = 0, l = byteArray.length; i < l; i++) {
    hex += parseInt(byteArray[i], 2).toString(16).padStart(2, '0');
  }

  // Return the compiled hexadecimal string representing the event configuration.
  return hex;
}

export function AllEventsEnabled(): string {
  return '0x' + 'ff'.repeat(32);
}
