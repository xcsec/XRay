import { promises as fs } from 'fs';
import * as path from 'path';
const Web3 = require('web3');
const web3 = new Web3();

const removeX = (input: string): string => (input.startsWith('0x') ? input.substring(2) : input);

const hexify = (input: string, prepend: boolean = true): string => {
  input = input.toLowerCase().trim();
  input = removeX(input);
  input = input.replace(/[^0-9a-f]/g, '');
  return prepend ? '0x' + input : input;
};

// Define all regexes
const regexes = [
  { regex: /precomputeslot\("([^"]+)"\)/i, process: (match: string) => computeSlot(match) }, // Used for slot calculations
  { regex: /precomputeslothex\("([^"]+)"\)/i, process: (match: string) => computeSlotHex(match) }, // Not used currently
  {
    regex: /precomputekeccak256\([\s\S]*?"([^"]*)"[\s\S]*?\)/gi,
    process: (match: string) => computeKeccak256(match),
  }, // Used for event topic calculations
  { regex: /functionsig\("([^"]+)"\)/i, process: (match: string) => computeFunctionSig(match) }, // Not used currently
  { regex: /asciihex\("([^"]+)"\)/i, process: (match: string) => computeAsciiHex(match) }, // Used for encoding contract type as bytes32
];

const computeSlot = (input: string): string => {
  // Directly compute the hash
  const hash = web3.utils.soliditySha3({ type: 'string', value: input }) || '';

  // Convert hash to BN, subtract 1, and ensure correct hex formatting
  let slot = web3.utils.toHex(web3.utils.toBN(hash).sub(web3.utils.toBN(1)));

  // Pad the hex string to 64 characters, ensuring it starts with '0x'
  slot = '0x' + slot.substring(2).padStart(64, '0');

  return slot;
};

const computeSlotHex = (input: string): string => {
  const hash = web3.utils.soliditySha3({ type: 'string', value: input }) || '';
  return 'hex"' + hexify(hash.substring(2), false) + '"';
};

const computeKeccak256 = (input: string): string => {
  const keccak = web3.utils.keccak256(input);
  return keccak === null ? '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470' : keccak;
};

const computeFunctionSig = (input: string): string => {
  const hash = web3.utils.keccak256(web3.eth.abi.encodeFunctionSignature(input));
  return hash.substring(0, 10);
};

const computeAsciiHex = (input: string): string => '0x' + web3.utils.asciiToHex(input).substring(2).padStart(64, '0');

// Recursively read directory for .sol files
const readDirRecursively = async (dir: string, fileList: string[] = []): Promise<string[]> => {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      await readDirRecursively(filePath, fileList);
    } else if (file.name.endsWith('.sol')) {
      fileList.push(filePath);
    }
  }
  return fileList;
};

const processFile = async (filePath: string): Promise<void> => {
  let content = await fs.readFile(filePath, { encoding: 'utf8' });
  let offset = 0; // Tracks the current offset in content for accurate line number calculation

  for (let { regex, process } of regexes) {
    let modifiedContent = ''; // Holds the new content as we build it
    let lastMatchEnd = 0; // Tracks the end of the last match to slice correctly
    regex = new RegExp(regex.source, 'gi'); // Ensure regex is global

    let match;
    while ((match = regex.exec(content))) {
      const beforeMatch = content.slice(lastMatchEnd, match.index);
      modifiedContent += beforeMatch; // Add content before current match

      const lineNumber = beforeMatch.length > 0 ? beforeMatch.split(/\r?\n/).length + offset : 1 + offset;
      const originalText = match[0];
      const replacement = process(match[1]);

      console.log(`File: ${filePath}\nLine: ${lineNumber}\nOriginal: ${originalText}\nReplacement: ${replacement}\n`);

      modifiedContent += content.substring(match.index, regex.lastIndex).replace(originalText, replacement); // Add modified match

      lastMatchEnd = regex.lastIndex; // Update lastMatchEnd to the end of the current match

      // Update offset to current line number for next iteration
      offset += beforeMatch.split(/\r?\n/).length;
    }

    // Add any remaining content after the last match
    modifiedContent += content.slice(lastMatchEnd);

    // Update content with the modified content for the next regex
    content = modifiedContent;
  }

  await fs.writeFile(filePath, content, { encoding: 'utf8' });
};

// Your main function and other logic remains unchanged

// Main function to find and process files
const main = async () => {
  console.log('Finding .sol files...');
  const srcDir = path.join(__dirname, '../src');
  const files = await readDirRecursively(srcDir);
  console.log(`Found ${files.length} .sol files`);

  for (const file of files) {
    await processFile(file);
  }
};

main().catch(console.error);
