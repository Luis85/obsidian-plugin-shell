import { getPath } from '../domain/form-model.ts';
import { readGeneratedBlock, requireIntactBlock, wrapGeneratedBlock, type GeneratedBlockFormat } from '../domain/generated-block.ts';
import { testWorkflowJson, type TestWorkflowDefinition } from '../domain/test-workflow.ts';
import { renderTestWorkflowDocs, testWorkflowFrontmatter, type TestWorkflowDataRow, type TestWorkflowRunRecord } from '../domain/test-workflow-docs.ts';
import { hash } from './framework/files.ts';
import { testWorkflowDocsFolder } from './test-workflow-catalog.ts';
import { guardedText } from './user-settings.ts';
/**
 * A workflow's documentation note: machine-owned frontmatter, then one generated block between hash-stamped markers,
 * then hand-written text. The recorded hash covers the frontmatter and the block, so editing either is detected and
 * regeneration refuses; everything after the frontmatter and outside the markers is kept byte for byte.
 */
const noteFormat: GeneratedBlockFormat = { marker: 'workflow', code: 'WORKFLOW', command: 'workflow docs' };
export interface TestWorkflowNote { path: string; content: string; state: 'missing' | 'current' | 'stale'; generatedHash: string; run?: TestWorkflowRunRecord }
const testWorkflowNotePath = (id: string) => `${testWorkflowDocsFolder}/${id}.md`;
/** yaml is loaded on first use, so `node bin/app` starts before dependencies are installed. */
type Yaml = typeof import('yaml');
const frontmatterText = (yaml: Yaml, values: Record<string, string | string[]>) => `---\n${yaml.stringify(values, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---`;
const digestOf = (frontmatter: string, body: string) => hash(frontmatter + '\n' + body);
/** Leading `---` … `---` lines of the text before the block, and the hand-written rest. */
function splitFrontmatter(before: string[]): { frontmatter: string; rest: string[] } {
  const end = before[0] === '---' ? before.indexOf('---', 1) : -1;
  return end < 0 ? { frontmatter: '', rest: before } : { frontmatter: before.slice(0, end + 1).join('\n'), rest: before.slice(end + 1) };
}
function runOf(yaml: Yaml, frontmatter: string): TestWorkflowRunRecord | undefined {
  const values: unknown = yaml.parse(frontmatter.slice(4, -3));
  const [lastRun, at, summary, definition, screenshots] = ['lastRun', 'lastRunAt', 'lastRunSummary', 'lastRunDefinition', 'lastRunScreenshots'].map(key => getPath(values, key));
  if ((lastRun !== 'passed' && lastRun !== 'failed') || ![at, summary, definition].every(item => typeof item === 'string')) return undefined;
  const paths = Array.isArray(screenshots) ? screenshots.map(String) : [];
  return { result: lastRun, at: String(at), summary: String(summary), definition: String(definition), ...paths.length ? { screenshots: paths } : {} };
}
/** The current note's parts after its hash was verified; an unmarked or edited note is refused here. */
function verified(yaml: Yaml, current: string, path: string): { rest: string[]; after: string[]; run?: TestWorkflowRunRecord } {
  const found = readGeneratedBlock(current, path, noteFormat), parts = splitFrontmatter(found.before);
  requireIntactBlock(found, digestOf(parts.frontmatter, found.body), path, noteFormat);
  const run = parts.frontmatter ? runOf(yaml, parts.frontmatter) : undefined;
  return { rest: parts.rest, after: found.after, ...run ? { run } : {} };
}
/**
 * The expected note text for a definition. `run` replaces the recorded run; otherwise the one in the current, verified
 * note is carried forward while it belongs to this exact definition. A new note gets a Notes section later regenerations keep.
 */
export async function testWorkflowNote(root: string, definition: TestWorkflowDefinition, rows: readonly TestWorkflowDataRow[], run?: TestWorkflowRunRecord): Promise<TestWorkflowNote> {
  const path = testWorkflowNotePath(definition.id), current = await guardedText(root, path), yaml = await import('yaml');
  const kept = current.content === null ? undefined : verified(yaml, current.content, path);
  const recorded = run ?? (kept?.run?.definition === hash(testWorkflowJson(definition)) ? kept.run : undefined);
  const frontmatter = frontmatterText(yaml, testWorkflowFrontmatter(definition, recorded)), body = renderTestWorkflowDocs(definition, rows, recorded);
  const block = wrapGeneratedBlock(body, digestOf(frontmatter, body), noteFormat);
  const content = kept ? [frontmatter, ...kept.rest, block, ...kept.after].join('\n')
    : `${frontmatter}\n${block}\n\n## Notes\n\nHand-written notes outside the generated block are kept when this note is regenerated.\n`;
  const state = current.content === null ? 'missing' : current.content === content ? 'current' : 'stale';
  return { path, content, state, generatedHash: hash(body), ...recorded ? { run: recorded } : {} };
}
/** Markdown notes in the workflow docs folder that no definition owns (a README.md index is allowed). */
export function testWorkflowOrphans(files: readonly string[], ids: ReadonlySet<string>): string[] {
  return files.filter(file => file.endsWith('.md') && file !== 'README.md' && !ids.has(file.slice(0, -3))).map(file => `${testWorkflowDocsFolder}/${file}`);
}
