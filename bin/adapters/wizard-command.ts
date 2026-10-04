import { resolve } from 'node:path';
import { option, type Arguments } from '../domain/command-options.ts';
import { requireSketch } from '../domain/errors.ts';
import { formValueIssues } from '../domain/form-values.ts';
import { hookNames } from '../presentation/wizards/registry.ts';
import { catalogIssues, catalogSummary, loadCatalog } from './wizard-catalog.ts';
import { readData } from './storage.ts';
import type { CommandContext } from './commands.ts';
/**
 * `wizard` and `form`: discover, inspect and check the data-driven definitions in configs/wizards and configs/forms.
 * `form validate` checks a complete value without prompting. Running a definition is interactive only.
 */
export async function definitionCommand(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const catalog = await loadCatalog(), issues = catalogIssues(catalog, hookNames()), kind = args.command;
  const table: ReadonlyMap<string, unknown> = kind === 'wizard' ? catalog.wizards : catalog.forms;
  if (args.action === 'list' || args.action === 'check') {
    const summary = catalogSummary(catalog);
    return { ...(args.action === 'list' ? summary : { root: summary.root, wizards: summary.wizards.length, forms: summary.forms.length }),
      issues, status: issues.length ? 'failed' : 'ok' };
  }
  const name = option(args, 'name');
  requireSketch(args.action === 'show' || args.action === 'validate', 'DEFINITION_COMMAND',
    `Use ${kind} list, ${kind} show --name <id>, ${kind} check${kind === 'form' ? ', form validate --name <id> --input <values.json>' : ''}, or run node bin/app ${kind} --name <id> in a terminal.`);
  requireSketch(table.has(name), 'DEFINITION_UNKNOWN', `Unknown ${kind} ${name || '(missing --name)'}; use ${kind} list.`);
  if (args.action === 'show') return { definition: table.get(name), issues };
  requireSketch(kind === 'form', 'DEFINITION_COMMAND', 'Only forms can be validated against a value.');
  const input = option(args, 'input');
  requireSketch(input, 'MAKER_INPUT_REQUIRED', 'Use --input <values.json> with form validate.');
  const found = formValueIssues(catalog.forms.get(name)!, await readData(resolve(context.root, input)), id => catalog.forms.get(id));
  return { form: name, valid: !found.length, issues: found, status: found.length ? 'failed' : 'ok' };
}
