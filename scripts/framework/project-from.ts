/** `new --from`: any exported companion project is data, never code. It is read
 * bounded and link-free, validated by the shared project contract the concept also
 * uses, and only its identity may be overridden before the unchanged compiler plans
 * it. Nothing in the document is evaluated, imported or executed. */
import { basename, resolve } from 'node:path';
import { COMPANION_FORMAT, COMPANION_MAX_BYTES, COMPANION_VERSION, validateCompanionDocument } from '../companion/project-contract.mjs';
import { exists, hash, readBounded } from './files.ts';
import { OperationError, requireThat, stringOption, type Context, type Request } from './contracts.ts';
interface Identity { id: string; name: string; author: string; version: string; description: string }
export interface CompanionDocument { schemaVersion: number; project: Identity; [key: string]: unknown }
export interface ExportedProject { document: CompanionDocument; source: { file: string; path: string; sha256: string; schemaVersion: number } }
const reexport = 'Download the project JSON from the companion again ("Download project JSON"); do not edit it by hand.';
function contractMessage(error: unknown): string {
  return error instanceof Error ? error.message.replace(/^COMPANION_INVALID: /, '') : 'Invalid project document.';
}
function parsed(bytes: Buffer, path: string): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new OperationError('PROJECT_JSON_MALFORMED', `${path} is not valid UTF-8 JSON.`, reexport); }
}
/** A newer export gets its own code: it is not corrupt, this framework is older. */
function versionProblem(value: unknown): number | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const { kind, schemaVersion } = value as { kind?: unknown; schemaVersion?: unknown };
  return kind === COMPANION_FORMAT && typeof schemaVersion === 'number' && schemaVersion > COMPANION_VERSION ? schemaVersion : null;
}
export async function exportedProject(request: Request, context: Context, idProblem: (id: string) => string | null): Promise<ExportedProject> {
  const from = stringOption(request.options, 'from');
  requireThat(from, 'PROJECT_FILE_REQUIRED', 'Supply --from <project.json>.');
  const path = resolve(context.root, from);
  requireThat(await exists(path), 'PROJECT_FILE_NOT_FOUND', `No project JSON at ${path}. ${reexport}`);
  let bytes: Buffer;
  try { bytes = await readBounded(path, COMPANION_MAX_BYTES); }
  catch (error) {
    if (error instanceof OperationError && error.code === 'INPUT_LIMIT') throw new OperationError('INPUT_LIMIT', `${path} must be a regular file of at most 4 MB (the companion export limit).`);
    throw error;
  }
  const value = parsed(bytes, path), future = versionProblem(value);
  if (future !== null) throw new OperationError('PROJECT_VERSION_UNSUPPORTED', `${path} uses companion project schema ${future}; this framework reads schema ${COMPANION_VERSION} and earlier.`, 'Upgrade the framework, or export from a companion that matches this framework version.');
  let document: CompanionDocument;
  try { document = validateCompanionDocument(value) as CompanionDocument; }
  catch (error) { throw new OperationError('PROJECT_INVALID', `${path} is not a complete companion project export: ${contractMessage(error)}`, reexport); }
  const overrides = Object.fromEntries((['id', 'name', 'author'] as const).flatMap(key => {
    const option = stringOption(request.options, key); return option === undefined ? [] : [[key, option.trim()]];
  }));
  const customized = { ...document, project: { ...document.project, ...overrides } };
  const problem = idProblem(customized.project.id);
  if (problem) throw new OperationError('INVALID_PLUGIN_ID', `Invalid plugin ID "${customized.project.id}". ${problem}`, 'Pass --id <plugin-id>.');
  try { validateCompanionDocument(customized); }
  catch (error) { throw new OperationError('INVALID_IDENTITY', `The requested identity is not valid for this project: ${contractMessage(error)}`, 'Adjust --id, --name or --author.'); }
  return { document: customized, source: { file: basename(path), path, sha256: hash(bytes), schemaVersion: document.schemaVersion } };
}
