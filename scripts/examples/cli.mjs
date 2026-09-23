import { stdin, stderr } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { planExampleRemoval } from './plan.mjs';
import { applyFilePlan } from '../shared/file-plan.mjs';

const args = process.argv.slice(2);
async function main() {
  if (args.some(arg => !['--dry-run', '--yes', '--no-interaction', '--json', '--help'].includes(arg)) || new Set(args).size !== args.length) throw new Error('Unknown or repeated example-removal option');
  if (args.includes('--help')) {
    console.log('npm run examples:remove -- --dry-run [--json]\nReview the hash-bound deletion/replacement plan, then apply with --yes --no-interaction. Edited examples conflict; consumer features, notes and data are preserved. Requires installed TypeScript. Run verify and test:e2e afterward.'); return;
  }
  const planned = await planExampleRemoval(process.cwd());
  const publicPlan = { ...planned, plan: { ...planned.plan, changes: planned.plan.changes.map(({ content, ...entry }) => entry) } };
  if (args.includes('--dry-run')) { console.log(JSON.stringify(publicPlan, null, args.includes('--json') ? undefined : 2)); return; }
  if (!args.includes('--yes')) {
    if (!stdin.isTTY || args.includes('--no-interaction')) throw new Error('Review --dry-run, then pass --yes to apply.');
    stderr.write(`${JSON.stringify(publicPlan, null, 2)}\n`);
    const prompt = createInterface({ input: stdin, output: stderr });
    try { if (!/^y(es)?$/i.test((await prompt.question('Remove the reviewed example files? [y/N] ')).trim())) { console.log(JSON.stringify({ status: 'cancelled' })); return; } }
    finally { prompt.close(); }
  }
  const applied = await applyFilePlan(planned.plan);
  console.log(JSON.stringify({ ...publicPlan, status: applied.written.length ? 'applied' : 'unchanged', applied, verification: 'not-run' }, null, args.includes('--json') ? undefined : 2));
}
main().catch(error => { console.error(JSON.stringify({ status: 'failed', error: error.message, recovery: error.report })); process.exitCode = 1; });
