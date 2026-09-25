import { relative, resolve, isAbsolute, sep } from 'node:path';
import { parseCompanionDocument } from '../companion/project-contract.mjs';
import { createFilePlan } from '../shared/file-plan.mjs';
import { exportDesignSystem } from './style-export.ts';
import { readBounded, readConfiguration, hash } from './files.ts';
import { object, designFile } from './configuration.ts';
import { requireThat, stringOption, type Request, type Context } from './contracts.ts';
async function styleInput(request: Request, context: Context) {
  const input = stringOption(request.options, 'input') ?? designFile;
  requireThat(input !== '-' || context.inputText !== undefined, 'STDIN_REQUIRED', 'Supply project JSON on stdin.');
  const bytes = input === '-' ? Buffer.from(context.inputText!) : await readBounded(resolve(context.root, input), 4_000_000);
  const document = object(parseCompanionDocument(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  return { system: object(document.design).designSystem, pluginId: String(object(document.project).id), inputHash: hash(bytes) };
}
export async function inspectStyles(request: Request, context: Context) {
  const input = await styleInput(request, context);
  const output = exportDesignSystem(input.system, input.pluginId, 'css');
  return { inputHash: input.inputHash, manifest: output.manifest, cssBytes: Buffer.byteLength(output.content), formats: ['css', 'json', 'markdown', 'html'] };
}
export async function styleExportPlan(request: Request, context: Context) {
  const input = await styleInput(request, context), format = stringOption(request.options, 'format') ?? 'css';
  const output = exportDesignSystem(input.system, input.pluginId, format);
  const config = await readConfiguration(context.root);
  const target = stringOption(request.options, 'out') ?? `exports/design-system.${output.extension}`;
  const path = relative(context.root, resolve(context.root, target)).split(sep).join('/');
  const protectedFolders = ['..', '.framework', '.companion', '.git', 'node_modules', '.test-vault', '.obsidian', config?.paths.testVaultFolder, config?.paths.configDirectory].filter((part): part is string => typeof part === 'string').map(part => part.toLowerCase());
  requireThat(path && !isAbsolute(path) && !path.split('/').some(part => protectedFolders.includes(part.toLowerCase())), 'STYLE_OUTPUT_PATH', 'Export into a project file outside protected and test-vault folders.');
  requireThat(path.endsWith('.' + output.extension), 'STYLE_OUTPUT_FORMAT', `Use a .${output.extension} output filename.`);
  // Reuse the same reviewed writer. Existing different bytes require a new target,
  // never an implicit takeover of application source or a previous manual export.
  const plan = await createFilePlan(context.root, [{ path, content: output.content }]);
  return { plan, hash: input.inputHash, conflicts: plan.changes.filter(change => change.status === 'update').map(change => change.path + ': existing export differs'),
    summary: { path, format, mediaType: output.mediaType, scope: output.manifest.scope, bytes: Buffer.byteLength(output.content), network: 'none' } };
}
