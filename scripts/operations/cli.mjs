#!/usr/bin/env node
import { capabilityCatalog } from './catalog.mjs';
import { handleRequest } from './protocol.mjs';
import { MAX_JSON_BYTES, parseJsonData } from '../contracts/json-data.mjs';

async function input() {
  let size = 0; const chunks = [];
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw new Error('INPUT_TOO_LARGE');
    chunks.push(chunk);
  }
  return parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}
async function run(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === 'catalog')) return capabilityCatalog();
  if (args.length === 1 && args[0] === 'makers') return capabilityCatalog().makers;
  if (args.length === 1 && args[0] === '--request') return handleRequest(await input());
  throw new Error('INVALID_ARGUMENTS');
}
try {
  const result = await run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.type === 'error') process.exitCode = 1;
} catch {
  process.stdout.write(`${JSON.stringify(handleRequest(null))}\n`);
  process.exitCode = 1;
}
