import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { parseArguments, help, builtinRecipes } from './arguments.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { applyFilePlan } from '../shared/file-plan.mjs';
import { runNode } from '../shared/process.mjs';

let request;
async function main() {
  request = parseArguments(process.argv.slice(2));
  if (!request.maker && stdin.isTTY && !request.options['--no-interaction'] && !request.options['--list'] && !request.options['--help'] && !request.options['--json']) {
    const prompt = createInterface({ input: stdin, output: stderr });
    try {
      stderr.write(`${help}\n`);
      const maker = (await prompt.question('Recipe: ')).trim();
      if (!maker) return;
      const name = (await prompt.question('Name: ')).trim();
      const args = [maker, name];
      if (!['feature', 'locale', 'maker'].includes(maker)) args.push('--feature', (await prompt.question('Existing feature owner: ')).trim());
      if (maker === 'listener') args.push('--event', (await prompt.question('Existing event name in this feature: ')).trim());
      if (maker === 'style') args.push('--view', (await prompt.question('Existing view name in this feature: ')).trim());
      request = parseArguments(args);
    } finally { prompt.close(); }
  }
  if (!request.maker || request.options['--help'] || request.options['--list']) {
    let custom = [];
    try { const registry = await import(pathToFileURL(resolve('scripts/makers/custom/registry.mjs')).href); custom = registry.customMakers.map(({ name, description, version }) => ({ name, description, version })); }
    catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
    console.log(request.options['--json'] ? JSON.stringify({ version: 2, recipes: builtinRecipes, custom, help }) : `${help}${custom.length ? '\nLocal custom recipes: ' + custom.map(entry => entry.name).join(', ') : ''}`); return;
  }
  const { planMaker } = await import('./plan.mjs');
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
