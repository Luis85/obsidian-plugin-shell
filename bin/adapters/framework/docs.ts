import { result, stringOption, type Context, type Request, type ResultStatus } from './contracts.ts';
import { DOC_TYPES, fieldNames } from '../../../scripts/application-docs/domain/contracts.ts';

interface DocumentationStatus {
  conflicts: unknown[];
  missing: unknown[];
  [key: string]: unknown;
}

interface DocsDependencies {
  recoverDocuments?: (root: string, apply: boolean, recoveryHash?: string) => Promise<{ data: unknown; status: ResultStatus }>;
  documentationStatus?: (root: string, args: string[], validate: boolean) => Promise<DocumentationStatus>;
  documentationPlan?: (
    root: string,
    args: string[],
    mode: 'export' | 'import',
    options: { out?: string; resolutions?: string },
  ) => Promise<unknown>;
}

/** Schema/help stay dependency-free so an extracted CLI remains discoverable before installation. */
export async function docsRead(request: Request, context: Context, dependencies: DocsDependencies = {}) {
  if (request.command === 'docs schema') return result(request.command, {
    doc_schema: 1,
    types: [...DOC_TYPES],
    required: ['doc_schema', 'type', 'id', 'project', 'title'],
    fields: fieldNames,
    structuredBlock: 'yaml shell-data',
    unknownFrontmatter: 'preserved, never applied to runtime objects',
    payloads: {
      project: ['identity', 'settings', 'notes', 'design', 'order', 'tooling'],
      page: ['surface', 'visual'],
      component: ['library', 'visual'],
      interaction: ['actions', 'notes', 'acceptance'],
      journey: ['steps'],
    },
    validation: 'docs validate; native project validation is mandatory',
    deletion: 'never implicit',
  });

  if (request.command === 'docs recover') {
    const recoverDocuments = dependencies.recoverDocuments
      ?? (await import('../../../scripts/application-docs/adapters/recovery.ts')).recoverDocuments;
    const outcome = await recoverDocuments(
      context.root,
      request.options.yes === true && !request.options['dry-run'],
      stringOption(request.options, 'apply'),
    );
    return result(request.command, outcome.data, outcome.status);
  }

  const documentationStatus = dependencies.documentationStatus
    ?? (await import('../../../scripts/application-docs/adapters/plan.ts')).documentationStatus;
  const data = await documentationStatus(context.root, request.args, request.command === 'docs validate');
  return result(
    request.command,
    data,
    data.conflicts.length || request.command === 'docs validate' && data.missing.length ? 'blocked' : 'ok',
  );
}

export async function docsPlan(request: Request, context: Context, dependencies: DocsDependencies = {}) {
  const documentationPlan = dependencies.documentationPlan
    ?? (await import('../../../scripts/application-docs/adapters/plan.ts')).documentationPlan;
  return documentationPlan(
    context.root,
    request.args,
    request.command === 'docs export' ? 'export' : 'import',
    {
      out: stringOption(request.options, 'out'),
      resolutions: stringOption(request.options, 'resolutions'),
    },
  );
}
