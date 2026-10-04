/** Reads `.github/workflows` (and the local composite actions they call) into normalized workflow models. Parsing uses the pinned `yaml` library with inert settings only. */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { actionDirectory, expandLocalActions, normalizeAction, referencedActions, type LocalAction } from '../../domain/ci-composite.ts';
import { CiError, normalizeWorkflow, type CiWorkflow } from '../../domain/ci-workflow.ts';
import { exists, readBounded } from './files.ts';
export const workflowDirectory = '.github/workflows';
const workflowFile = /^[\w.-]+\.ya?ml$/;
const stemOf = (file: string): string => file.replace(/\.ya?ml$/, '');
type ParseDocument = typeof import('yaml').parseDocument;
/** Loaded on demand so every other CLI command still starts before `yaml` is installed. */
export async function workflowParser(): Promise<ParseDocument> { return (await import('yaml')).parseDocument; }
/** Strict YAML 1.2 (core schema): duplicate keys, custom tags and excessive alias expansion are refused. */
function parseYaml(file: string, text: string, parseDocument: ParseDocument, code: string): unknown {
  const document = parseDocument(text, { strict: true, uniqueKeys: true, prettyErrors: false, version: '1.2', schema: 'core', resolveKnownTags: false });
  const problem = document.errors[0] ?? document.warnings[0];
  if (problem) throw new CiError(code, `${file}: ${problem.message.split('\n')[0] ?? 'invalid YAML'}`);
  try { return document.toJS({ maxAliasCount: 100 }); }
  catch { throw new CiError(code, `${file}: YAML aliases exceed the supported expansion limit.`); }
}
export function parseWorkflowText(file: string, text: string, parseDocument: ParseDocument): CiWorkflow {
  return normalizeWorkflow(file, stemOf(file), parseYaml(file, text, parseDocument, 'CI_WORKFLOW_INVALID'));
}
/** `.github/actions/<name>/action.yml` (or `.yaml`), read bounded, UTF-8 and without following links; absent means not loaded. */
async function readAction(root: string, name: string, parseDocument: ParseDocument): Promise<LocalAction | undefined> {
  for (const file of ['action.yml', 'action.yaml']) {
    const relative = `${actionDirectory}/${name}/${file}`, path = join(root, actionDirectory, name, file);
    if (!await exists(path)) continue;
    const bytes = await readBounded(path, 262_144);
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new CiError('CI_ACTION_INVALID', `${relative}: not valid UTF-8.`); }
    return normalizeAction(relative, parseYaml(relative, text, parseDocument, 'CI_ACTION_INVALID'));
  }
  return undefined;
}
/** Expands the local composite actions a workflow calls; a missing action leaves its step external with a note. */
export async function withLocalActions(root: string, workflow: CiWorkflow, parseDocument: ParseDocument): Promise<CiWorkflow> {
  const actions = new Map<string, LocalAction>();
  for (const name of referencedActions(workflow)) {
    const action = await readAction(root, name, parseDocument);
    if (action) actions.set(name, action);
  }
  return expandLocalActions(workflow, actions);
}
async function files(root: string): Promise<string[]> {
  const directory = join(root, workflowDirectory);
  if (!await exists(directory)) return [];
  return (await readdir(directory)).filter(name => workflowFile.test(name)).sort();
}
async function readWorkflow(root: string, file: string): Promise<CiWorkflow> {
  const text = (await readBounded(join(root, workflowDirectory, file), 1_048_576)).toString('utf8'), parseDocument = await workflowParser();
  return withLocalActions(root, parseWorkflowText(file, text, parseDocument), parseDocument);
}
export async function loadWorkflows(root: string): Promise<CiWorkflow[]> {
  const loaded: CiWorkflow[] = [];
  for (const file of await files(root)) loaded.push(await readWorkflow(root, file));
  return loaded;
}
/** Loads only the selected workflow, so an unrelated broken file never blocks a job; unknown stems list the candidates. */
export async function loadWorkflow(root: string, stem: string): Promise<{ workflow?: CiWorkflow; stems: string[] }> {
  const names = await files(root), file = names.find(name => stemOf(name) === stem);
  return { stems: names.map(stemOf), ...(file ? { workflow: await readWorkflow(root, file) } : {}) };
}
