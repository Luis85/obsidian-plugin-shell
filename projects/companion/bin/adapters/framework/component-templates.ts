import { isAbsolute, relative, resolve, sep } from 'node:path';
import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { parseDesignData } from '../../../scripts/contracts/json-data.ts';
import { exists, hash, readBounded, readConfiguration, readJson } from './files.ts';
import { serializeJson as json } from '../../../scripts/contracts/serialization.ts';
import { componentTemplateDocumentation } from '../../application/component-template-docs.ts';
import {
  componentTemplateCoverage,
  componentTemplateSummary,
  componentTemplateTree,
  filterComponentTemplates,
} from '../../application/component-template-catalog.ts';
import {
  componentTemplateSchema,
  type ComponentTemplateQuery,
  type ComponentTemplateType,
  type AtomicLevel,
} from '../../domain/component-template.ts';
import { documentText, openDocument } from '../../domain/document.ts';
import { instantiateComponentTemplate } from '../../domain/template-instantiation.ts';
import { loadComponentTemplates } from '../component-template-repository.ts';
import { pluginComponentTemplates } from '../../../plugins/template-contributions.ts';
import { result, requireThat, stringOption, type Context, type Request } from './contracts.ts';

async function library(context: Context) {
  return loadComponentTemplates(context.root, context.frameworkRoot, pluginComponentTemplates());
}

function queryFrom(request: Request): ComponentTemplateQuery {
  const type = stringOption(request.options, 'type');
  const atomicLevel = stringOption(request.options, 'atomic-level');
  const category = stringOption(request.options, 'category');
  const tag = stringOption(request.options, 'tag');
  const recommendedFor = stringOption(request.options, 'for');
  return {
    ...(request.command === 'templates search' && request.args[0] ? { query: request.args[0] } : {}),
    ...(type ? { templateType: type as ComponentTemplateType } : {}),
    ...(atomicLevel ? { atomicLevel: atomicLevel as AtomicLevel } : {}),
    ...(category ? { category } : {}),
    ...(tag ? { tag } : {}),
    ...(recommendedFor ? { recommendedFor } : {}),
  };
}

function selectedTemplate(entries: Awaited<ReturnType<typeof library>>, id: string) {
  const selected = entries.find(entry => entry.template.id === id);
  requireThat(selected, 'TEMPLATE_UNKNOWN', 'Component template not found; use templates list.');
  return selected;
}

export async function readComponentTemplateOperation(request: Request, context: Context) {
  if (request.command === 'templates schema') return result(request.command, componentTemplateSchema());
  const entries = await library(context);
  if (request.command === 'templates list' || request.command === 'templates search') {
    const selected = filterComponentTemplates(entries, queryFrom(request));
    return result(request.command, {
      folder: 'configs/templates',
      templates: selected.map(componentTemplateSummary),
      total: selected.length,
    });
  }
  if (request.command === 'templates coverage') {
    return result(request.command, componentTemplateCoverage(entries));
  }
  if (request.command === 'templates validate' && !request.args[0]) {
    return result(request.command, { valid: true, templates: entries.length });
  }

  const id = request.args[0];
  requireThat(id, 'TEMPLATE_REQUIRED', 'Supply a component-template ID; use templates list.');
  const selected = selectedTemplate(entries, id);
  if (request.command === 'templates tree') return result(request.command, componentTemplateTree(entries, id));
  if (request.command === 'templates validate') {
    return result(request.command, { valid: true, template: componentTemplateSummary(selected) });
  }
  return result(request.command, {
    ...componentTemplateSummary(selected),
    template: selected.template,
  });
}

function protectedPathPart(part: string): boolean {
  const normalized = part.toLowerCase();
  return part.charCodeAt(0) === 46 || normalized === 'node_modules';
}

function contained(root: string, input: string, label: string): string {
  const absolute = resolve(root, input);
  const local = relative(root, absolute);
  const parts = local.split(sep);
  requireThat(Boolean(local) && !isAbsolute(local) && !parts.includes('..')
    && !parts.some(protectedPathPart),
  'TEMPLATE_PATH', label + ' must stay inside the project and outside protected directories.');
  return parts.join('/');
}

/** Framework- and project-owned roots: generated documentation can never be planned into them. */
const protectedRoots = ['bin', 'src', 'scripts', 'configs', 'templates', 'plugins', 'tests', 'harness', 'design', 'dist', 'node_modules'];
const receiptName = 'component-library.receipt.json';
async function docsOutput(context: Context, input: string): Promise<string> {
  const output = contained(context.root, input, 'Documentation output');
  const config = await readConfiguration(context.root);
  const configured = config ? [config.paths.codebaseFolder, config.paths.testsFolder, config.paths.testVaultFolder] : [];
  const topLevel = (path: string): string => path.toLowerCase().replace(/\/.*$/, '');
  const roots = new Set([...protectedRoots, ...configured.map(topLevel)]);
  requireThat(!roots.has(topLevel(output)), 'TEMPLATE_DOCS_PROTECTED',
    'Generated documentation cannot be written into framework or project source roots; choose a docs folder.');
  return output;
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const sha256Hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
async function receiptData(path: string): Promise<unknown> {
  try { return await readJson(path); } catch { return null; }
}
/** The receipt records the exact bytes this generator last wrote, so only unedited generated files may be replaced. */
async function previousReceipt(root: string, path: string, output: string): Promise<Map<string, string>> {
  if (!await exists(resolve(root, path))) return new Map();
  const value = await receiptData(resolve(root, path));
  const files = isRecord(value) && value.schemaVersion === 1 && isRecord(value.files) ? Object.entries(value.files) : [];
  const owned = new Map<string, string>();
  for (const [file, digest] of files) if (file.startsWith(output + '/') && sha256Hex(digest)) owned.set(file, digest);
  requireThat(files.length > 0 && owned.size === files.length, 'TEMPLATE_DOCS_RECEIPT',
    'The documentation ownership receipt is invalid; preserve and review it before regenerating.');
  return owned;
}

async function docsPlan(request: Request, context: Context) {
  const entries = await library(context);
  const output = await docsOutput(context, stringOption(request.options, 'out') ?? 'docs/generated/component-library');
  const docs = componentTemplateDocumentation(entries, output), receiptPath = output + '/' + receiptName;
  const owned = await previousReceipt(context.root, receiptPath, output);
  const preview = await createFilePlan(context.root, docs);
  // An existing file is replaced only when the receipt proves it is this generator's unedited output.
  const conflicts = preview.changes.filter(change => change.status === 'update' && owned.get(change.path) !== change.beforeHash).map(change => change.path);
  const receipt = { schemaVersion: 1, generator: 'templates docs', files: Object.fromEntries(docs.map(doc => [doc.path, hash(doc.content)])) };
  return {
    plan: await createFilePlan(context.root, [...docs, { path: receiptPath, content: json(receipt) }]),
    conflicts,
    summary: {
      source: 'configs/templates/**/*.json',
      output,
      receipt: receiptPath,
      templates: entries.length,
      files: docs.length,
      sourceOfTruth: 'json',
    },
  };
}

async function instantiatePlan(request: Request, context: Context) {
  const entries = await library(context);
  const templateId = request.args[0];
  requireThat(templateId, 'TEMPLATE_REQUIRED', 'Supply a component-template ID; use templates list.');
  const selected = selectedTemplate(entries, templateId);
  const project = contained(
    context.root,
    stringOption(request.options, 'project') ?? 'design/project.json',
    'Project path',
  );
  const bytes = await readBounded(resolve(context.root, project), 8_000_000);
  const source = parseDesignData(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const document = openDocument(source);
  const instantiated = instantiateComponentTemplate(
    document,
    entries.map(entry => entry.template),
    templateId,
    stringOption(request.options, 'name'),
  );
  return {
    plan: await createFilePlan(context.root, [{ path: project, content: documentText(document) }]),
    conflicts: [] as string[],
    summary: { template: templateId, project, instantiated, source: selected.file },
  };
}

export async function componentTemplatePlan(request: Request, context: Context) {
  if (request.command === 'templates docs') return docsPlan(request, context);
  requireThat(request.command === 'templates instantiate', 'TEMPLATE_COMMAND', 'Unsupported component-template plan command.');
  return instantiatePlan(request, context);
}
