import { isAbsolute, relative, resolve, sep } from 'node:path';
import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { parseDesignData } from '../../../scripts/contracts/json-data.ts';
import { readBounded } from './files.ts';
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

function contained(root: string, input: string, label: string): string {
  const absolute = resolve(root, input);
  const local = relative(root, absolute);
  requireThat(Boolean(local) && !isAbsolute(local) && !local.split(sep).includes('..')
    && !local.split(sep).some(part => ['.git', '.framework', '.obsidian', 'node_modules'].includes(part.toLowerCase())),
  'TEMPLATE_PATH', label + ' must stay inside the project and outside protected directories.');
  return local.split(sep).join('/');
}

async function docsPlan(request: Request, context: Context) {
  const entries = await library(context);
  const output = contained(
    context.root,
    stringOption(request.options, 'out') ?? 'docs/generated/component-library',
    'Documentation output',
  );
  const docs = componentTemplateDocumentation(entries, output);
  return {
    plan: await createFilePlan(context.root, docs),
    conflicts: [] as string[],
    summary: {
      source: 'configs/templates/**/*.json',
      output,
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
