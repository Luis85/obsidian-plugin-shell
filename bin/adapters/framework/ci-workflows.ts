/** Reads `.github/workflows` into normalized workflow models. Parsing uses the pinned `yaml` library with inert settings only. */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CiError, normalizeWorkflow, type CiWorkflow } from '../../domain/ci-workflow.ts';
import { exists, readBounded } from './files.ts';
export const workflowDirectory = '.github/workflows';
const workflowFile = /^[\w.-]+\.ya?ml$/;
const stemOf = (file: string): string => file.replace(/\.ya?ml$/, '');
type ParseDocument = typeof import('yaml').parseDocument;
/** Loaded on demand so every other CLI command still starts before `yaml` is installed. */
export async function workflowParser(): Promise<ParseDocument> { return (await import('yaml')).parseDocument; }
/** Strict YAML 1.2 (core schema): duplicate keys, custom tags and excessive alias expansion are refused. */
export function parseWorkflowText(file: string, text: string, parseDocument: ParseDocument): CiWorkflow {
  const document = parseDocument(text, { strict: true, uniqueKeys: true, prettyErrors: false, version: '1.2', schema: 'core', resolveKnownTags: false });
  const problem = document.errors[0] ?? document.warnings[0];
  if (problem) throw new CiError('CI_WORKFLOW_INVALID', `${file}: ${problem.message.split('\n')[0] ?? 'invalid YAML'}`);
  let data: unknown;
  try { data = document.toJS({ maxAliasCount: 100 }); }
  catch { throw new CiError('CI_WORKFLOW_INVALID', `${file}: YAML aliases exceed the supported expansion limit.`); }
  return normalizeWorkflow(file, stemOf(file), data);
}
async function files(root: string): Promise<string[]> {
  const directory = join(root, workflowDirectory);
  if (!await exists(directory)) return [];
  return (await readdir(directory)).filter(name => workflowFile.test(name)).sort();
}
async function readWorkflow(root: string, file: string): Promise<CiWorkflow> {
  const text = (await readBounded(join(root, workflowDirectory, file), 1_048_576)).toString('utf8');
  return parseWorkflowText(file, text, await workflowParser());
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
