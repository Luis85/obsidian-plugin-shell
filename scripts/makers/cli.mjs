import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { parseArguments, help } from './arguments.mjs';
import { planMaker } from './plan.mjs';
import { applyFilePlan } from '../shared/file-plan.mjs';
import { runNode } from '../shared/process.mjs';

let request;
async function main() {
  request = parseArguments(process.argv.slice(2));
  if (!request.maker || request.options['--help'] || request.options['--list']) {
    console.log(request.options['--json'] ? JSON.stringify({ version: 1, recipes: ['feature', 'entity'], help }) : help); return;
  }
  const planned = await planMaker(process.cwd(), request);
  const publicPlan = { ...planned, plan: { ...planned.plan, changes: planned.plan.changes.map(({ content, ...change }) => change) }, checks: planned.checks.map(check => ({ ...check, status: 'not-run' })) };
  if (request.options['--dry-run']) { console.log(request.options['--json'] ? JSON.stringify({ status: 'planned', ...publicPlan }) : JSON.stringify({ status: 'planned', ...publicPlan }, null, 2)); return; }
  if (!request.options['--yes']) {
    if (!stdin.isTTY || request.options['--no-interaction']) throw new Error('Review --dry-run, then pass --yes for a noninteractive apply.');
    stderr.write(`${JSON.stringify(publicPlan, null, 2)}\n`);
    const prompt = createInterface({ input: stdin, output: stderr });
    try { if (!/^y(es)?$/i.test((await prompt.question('Apply this source plan? [y/N] ')).trim())) { console.log(JSON.stringify({ status: 'cancelled' })); return; } }
    finally { prompt.close(); }
  }
  const applied = await applyFilePlan(planned.plan);
  for (const check of publicPlan.checks.filter(check => check.command === 'node')) {
    try { await runNode(check.args[0], check.args.slice(1), { stdio: ['ignore', 2, 2], timeout: 180000 }); check.status = 'passed'; }
    catch (error) { check.status = 'failed'; error.report = { applied, checks: publicPlan.checks, sourcePreserved: true }; throw error; }
  }
  console.log(JSON.stringify({ status: applied.written.length ? 'applied' : 'unchanged', ...publicPlan, applied }, null, request.options['--json'] ? undefined : 2));
}
main().catch(error => { const result = { status: 'failed', error: error.message, ...(error.report ? { recovery: error.report } : {}) }; (process.argv.includes('--json') ? console.log : console.error)(JSON.stringify(result)); process.exitCode = 1; });
