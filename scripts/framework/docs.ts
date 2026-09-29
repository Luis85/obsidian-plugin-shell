import { result, stringOption, type Context, type Request } from './contracts.ts';
import { DOC_TYPES, fieldNames } from '../application-docs/domain/contracts.ts';
/** Schema/help stay dependency-free so an extracted CLI remains discoverable before installation. */
export async function docsRead(request: Request, context: Context) {
  if (request.command === 'docs schema') return result(request.command, {
    doc_schema: 1, types: [...DOC_TYPES], required: ['doc_schema', 'type', 'id', 'project', 'title'], fields: fieldNames,
    structuredBlock: 'yaml shell-data', unknownFrontmatter: 'preserved, never applied to runtime objects',
    payloads: { project: ['identity', 'settings', 'notes', 'design', 'order', 'tooling'], page: ['surface', 'visual'],
      component: ['library', 'visual'], interaction: ['actions', 'notes', 'acceptance'], journey: ['steps'] },
    validation: 'docs validate; native project validation is mandatory', deletion: 'never implicit',
  });
  if (request.command === 'docs recover') {
    const { recoverDocuments } = await import('../application-docs/adapters/recovery.ts');
    const outcome = await recoverDocuments(context.root, request.options.yes === true && !request.options['dry-run'], stringOption(request.options, 'apply'));
    return result(request.command, outcome.data, outcome.status);
  }
  const { documentationStatus } = await import('../application-docs/adapters/plan.ts');
  const data = await documentationStatus(context.root, request.args, request.command === 'docs validate');
  return result(request.command, data, data.conflicts.length || request.command === 'docs validate' && data.missing.length ? 'blocked' : 'ok');
}
export async function docsPlan(request: Request, context: Context) {
  const { documentationPlan } = await import('../application-docs/adapters/plan.ts');
  return documentationPlan(context.root, request.args, request.command === 'docs export' ? 'export' : 'import', {
    out: stringOption(request.options, 'out'), resolutions: stringOption(request.options, 'resolutions'),
  });
}
