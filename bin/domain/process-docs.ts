import type { FormField } from './form.ts';
import { ruleText } from './process-rules.ts';
import { processRulesFor } from './process-engine.ts';
import { processSeverities, type ProcessDefinition, type ProcessDoc, type ProcessRule, type ProcessStep } from './process.ts';
/** Generated process documentation: deterministic Markdown from the definition; the adapter owns markers and files. */
export interface ProcessDocsContext {
  /** Contents of doc files below configs/processes/docs, by their `file` value. */
  files: ReadonlyMap<string, string>;
  /** Relative Markdown href for a repository path such as docs/development/BUSINESS-PROCESSES.md. */
  link: (target: string) => string;
  fields: (step: ProcessStep) => readonly FormField[];
}
const wikilink = /\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
/** `[[docs/development/X]]` resolves to `docs/development/X.md`; a target keeps an explicit extension. */
function wikilinkTarget(raw: string): string {
  const target = raw.trim();
  return /\.[A-Za-z0-9]+$/.test(target) ? target : target + '.md';
}
/** Repository targets of every wikilink in a Markdown text, in order of appearance. */
export function processWikilinks(text: string): string[] {
  return [...text.matchAll(wikilink)].map(match => wikilinkTarget(match[1]!));
}
function linked(text: string, link: ProcessDocsContext['link']): string {
  return text.replace(wikilink, (_match, target: string, heading: string | undefined, label: string | undefined) =>
    `[${(label ?? target).trim()}](${link(wikilinkTarget(target))}${heading ?? ''})`);
}
const cell = (value: string) => value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim() || '—';
const code = (value: string) => '`' + value.replace(/`/g, "'") + '`';
function table(header: string[], rows: string[][]): string[] {
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(cell).join(' | ')} |`)];
}
function docText(doc: ProcessDoc | undefined, context: ProcessDocsContext): string[] {
  if (!doc) return [];
  const parts = [doc.text, doc.file ? context.files.get(doc.file) : undefined].filter((part): part is string => Boolean(part?.trim()));
  return parts.flatMap(part => [linked(part.trim(), context.link), '']);
}
const roleTitle = (definition: ProcessDefinition, id: string) => definition.roles.find(role => role.id === id)?.title ?? id;
function transitionText(step: ProcessStep): string {
  if (step.terminal) return `ends${step.outcome ? ` (${step.outcome})` : ''}`;
  return (step.next ?? []).map(item => `${code(item.to)}${item.when ? ` if ${code(ruleText(item.when))}` : ''}`).join('; ');
}
function inputsText(step: ProcessStep, context: ProcessDocsContext): string {
  if (step.form) return `form ${code(step.form)}`;
  const fields = context.fields(step);
  return fields.length ? fields.map(field => field.label).join('; ') : 'confirmation';
}
function overview(definition: ProcessDefinition, context: ProcessDocsContext): string[] {
  return [`# ${definition.title}`, '',
    `> Business process ${code(definition.id)} · version ${definition.version} · ${definition.status} · owner: ${roleTitle(definition, definition.owner)}`, '',
    '## Purpose', '', definition.purpose, '', ...docText(definition.doc, context)];
}
function roles(definition: ProcessDefinition): string[] {
  const steps = (id: string) => definition.steps.filter(step => step.actor === id).map(step => step.title).join('; ');
  return ['## Roles', '', ...table(['Role', 'ID', 'Responsibilities', 'Steps'], definition.roles.map(role => [role.title, code(role.id), role.description ?? '', steps(role.id)])), ''];
}
function stepsTable(definition: ProcessDefinition, context: ProcessDocsContext): string[] {
  return ['## Steps', '', ...table(['#', 'Step', 'Actor', 'Inputs', 'Outputs', 'Next'], definition.steps.map((step, index) => [String(index + 1),
    `${step.title} (${code(step.id)})`, roleTitle(definition, step.actor), inputsText(step, context), (step.outputs ?? []).map(code).join(', '), transitionText(step)])), ''];
}
const nodeId = (id: string) => 'step_' + id.replace(/-/g, '_');
const mermaidLabel = (value: string) => '"' + value.replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ') + '"';
function flowchart(definition: ProcessDefinition): string[] {
  const nodes = definition.steps.map(step => `  ${nodeId(step.id)}${step.terminal ? `([${mermaidLabel(step.title)}])` : `[${mermaidLabel(step.title)}]`}`);
  const links = definition.steps.flatMap(step => (step.next ?? []).map(item => {
    const label = item.label ?? (item.when ? ruleText(item.when) : '');
    return `  ${nodeId(step.id)} -->${label ? `|${mermaidLabel(label)}|` : ''} ${nodeId(item.to)}`;
  }));
  return ['## Flow', '', '```mermaid', 'flowchart TD', ...nodes, ...links, '```', ''];
}
const scopeText = (rule: ProcessRule) => rule.steps ? rule.steps.map(code).join(', ') : 'whole process';
function conditionText(rule: ProcessRule): string {
  return `${rule.when ? `when ${code(ruleText(rule.when))}, ` : ''}require ${code(ruleText(rule.require))}`;
}
function rules(definition: ProcessDefinition): string[] {
  if (!definition.rules.length) return ['## Business rules', '', 'No business rules.', ''];
  const groups = processSeverities.flatMap(severity => {
    const items = definition.rules.filter(rule => rule.severity === severity);
    return items.length ? [`### ${severity[0]!.toUpperCase()}${severity.slice(1)}`, '',
      ...table(['Rule', 'Statement', 'Scope', 'Condition', 'Rationale'], items.map(rule => [code(rule.id), rule.statement, scopeText(rule), conditionText(rule), rule.rationale ?? ''])), ''] : [];
  });
  return ['## Business rules', '', 'Block rules stop a transition, warn rules need an explicit acknowledgement and info rules are recorded.', '', ...groups];
}
function stepDetail(definition: ProcessDefinition, step: ProcessStep, index: number, context: ProcessDocsContext): string[] {
  const applying = processRulesFor(definition, step.id).map(rule => `- ${rule.severity} ${code(rule.id)}: ${rule.statement}`);
  const fields = context.fields(step).map(field => `- ${field.label} (${field.kind}${field.required ? ', required' : ''})`);
  return [`### ${index + 1}. ${step.title}`, '', `Actor: ${roleTitle(definition, step.actor)}. Next: ${transitionText(step)}.`, '',
    ...step.description ? [step.description, ''] : [], ...fields.length ? ['Inputs:', '', ...fields, ''] : [],
    ...docText(step.doc, context), ...applying.length ? ['Rules checked here:', '', ...applying, ''] : [],
    ...definition.rules.filter(rule => rule.steps?.includes(step.id)).flatMap(rule => docText(rule.doc, context))];
}
function references(definition: ProcessDefinition): string[] {
  const entries = Object.entries(definition.references ?? {}).flatMap(([kind, items]) => items?.length ? [`- ${kind}: ${items.map(code).join(', ')}`] : []);
  return entries.length ? ['## Project references', '', ...entries, ''] : [];
}
function related(definition: ProcessDefinition, context: ProcessDocsContext): string[] {
  const docs = [definition.doc, ...definition.steps.map(step => step.doc), ...definition.rules.map(rule => rule.doc)];
  const files = [...new Set(docs.flatMap(doc => doc?.file ? [doc.file] : []))];
  const links = [...new Set(docs.flatMap(doc => [doc?.text ?? '', doc?.file ? context.files.get(doc.file) ?? '' : '']).flatMap(processWikilinks))];
  if (!files.length && !links.length) return [];
  return ['## Related documentation', '', ...files.map(file => `- Source notes: ${code('configs/processes/docs/' + file)}`),
    ...links.map(target => `- [${target}](${context.link(target)})`), ''];
}
/** The generated block body: overview, roles, steps, Mermaid flow, rules by severity, step details and linked docs. */
export function renderProcessDocs(definition: ProcessDefinition, context: ProcessDocsContext): string {
  const lines = [...overview(definition, context), ...roles(definition), ...stepsTable(definition, context), ...flowchart(definition), ...rules(definition),
    '## Step details', '', ...definition.steps.flatMap((step, index) => stepDetail(definition, step, index, context)), ...references(definition), ...related(definition, context),
    `Generated from ${code(`configs/processes/${definition.id}.json`)} by ${code(`node bin/app process docs --name ${definition.id}`)}. Edit the definition, not this block.`];
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
