#!/usr/bin/env node
// Standalone source entry, also useful before the PR5 integration patch is applied.
// Run with Node >=22.13: node --experimental-strip-types scripts/handout.mjs ...
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { prepareHandout, inspectHandout } from './framework/handout-workspace.ts';
import { HANDOUT_PATH, HandoutError } from './framework/handout-model.ts';
const args = process.argv.slice(2);
const command = args.shift();
let root = process.cwd(), prds, machine = false, write = false;
try {
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new HandoutError('HANDOUT_ARGUMENT', 'Repeated option: ' + arg);
    seen.add(arg);
    if (arg === '--root' || arg === '--prds') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new HandoutError('HANDOUT_ARGUMENT', 'Missing option value.');
      if (arg === '--root') root = resolve(value); else prds = value;
    } else if (arg === '--json') machine = true;
    else if (arg === '--write') write = true;
    else if (arg === '--dry-run') { /* Explicitly accepted, mutually exclusive with --write. */ }
    else throw new HandoutError('HANDOUT_ARGUMENT', 'Unknown option: ' + arg);
  }
  if (write && seen.has('--dry-run')) throw new HandoutError('HANDOUT_ARGUMENT', '--write and --dry-run are mutually exclusive.');
  if (!['generate', 'validate', 'inspect'].includes(command)) throw new HandoutError('HANDOUT_ARGUMENT', 'Use generate, validate or inspect; refresh uses the integrated reviewed-plan command.');
  if (write && command !== 'generate') throw new HandoutError('HANDOUT_ARGUMENT', 'Validation and inspection never write.');
  let data, status;
  if (command === 'generate') {
    const prepared = await prepareHandout(root, { prds });
    status = prepared.entries.length ? 'planned' : 'unchanged';
    if (write && prepared.entries.length) {
      // Exclusive create: no overwrite flag or arbitrary output path is supported.
      await writeFile(join(resolve(root), HANDOUT_PATH), prepared.entries[0].content, { encoding: 'utf8', flag: 'wx' });
      status = 'applied';
    }
    data = { ...prepared.summary, ...(status === 'planned' ? { markdown: prepared.entries[0]?.content } : {}) };
  } else {
    data = await inspectHandout(root, { prds });
    status = data.ready ? 'ok' : 'blocked';
    if (command === 'validate') { const { answers, ...summary } = data; data = summary; }
    process.exitCode = status === 'blocked' ? 1 : 0;
  }
  const outcome = { protocolVersion: 1, command: 'handout ' + command, status, data, diagnostics: data.diagnostics ?? [] };
  if (machine) console.log(JSON.stringify(outcome));
  else if (command === 'generate') console.log(`${status}: ${HANDOUT_PATH}\n${status === 'planned' ? 'Use --write for exclusive creation, or the integrated reviewed-plan command.\n' : ''}${data.markdown ?? ''}`);
  else console.log(`${status}: ${data.requiredAnswered}/${data.requiredTotal} required items reviewed. Execution authorized: no.\n` + data.diagnostics.map(item => `${item.code}${item.id ? ' [' + item.id + ']' : ''}: ${item.message}`).join('\n'));
} catch (error) {
  console.log(JSON.stringify({ protocolVersion: 1, command: 'handout ' + (command ?? 'unknown'), status: 'failed', data: null, diagnostics: [{ code: error.code ?? 'HANDOUT_FAILED', message: error.message }] }));
  process.exitCode = 1;
}
