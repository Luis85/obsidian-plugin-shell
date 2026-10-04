/** What of the framework repository a generated project receives. A generated project is a product: the
 * framework's own backlog, PRDs, increment handoffs, reviews, research, milestone plans and evidence records, its repo-specific
 * prototype skill and its maintainer-only npm scripts are not copied, so an agent asked "what should I build?"
 * can only find this project's BRIEF.md, design/ and docs/project-tasks/. The framework reference docs that
 * remain live under docs/framework/ behind a banner. Policy lives here; framework-docs.ts applies it. */
import { posix } from 'node:path';

const underFolder = (path: string, folder: string) => path === folder || path.startsWith(folder + '/');
/** Whole folders that only describe the framework's own work; docs/_archive holds its retired plans, reviews and records. */
const maintainerFolders = ['docs/_archive', 'docs/tasks', 'docs/prds', 'docs/reviews', 'docs/research', 'docs/superpowers', 'docs/product',
  'docs/requirements', 'docs/increments', 'docs/memory', 'docs/testing/evidence', 'docs/project-setup/evidence', 'docs/development/compiler',
  '.claude/skills/companion-prototype-design', '.agents/skills/companion-prototype-design'];
/** Dated records, milestone plans, reviews, ledgers, release/maintenance and Hindsight (project memory tool) notes. */
const developmentRecord = /^docs\/development\/(?:ITERATION-|ACCEPTANCE-CLOSURE-|HINDSIGHT|MAINTENANCE-|RELEASE-|MILESTONE-|PR\d+-|PUBLISHED-DISTRIBUTION-|SCRIPTS-CONSOLIDATION|TEMPLATE-READINESS-|SHELL-CAPABILITY-INVENTORY|LOCAL-MCP|EXTRACTED-KIT-SETUP|DELIVERY-PIPELINE|DELIVER-A-CHANGE|CUT-AND-PUBLISH-A-RELEASE|WORKFLOWS\.md$|[A-Z0-9-]+-(?:PLAN|REVIEW(?:-[A-Z])?|CHECKPOINT|RESEARCH|EXCEPTION)\.md$)/;
/** docs/testing keeps only how-to guides for the product test loop; everything else is a qualification record. */
const testingGuides = new Set(['OBSIDIAN-TEST-KIT', 'OBSIDIAN-DEV-LOOP', 'TEST-STRATEGY', 'TEST-CONCEPT', 'TEST-SUITES', 'HARNESS-STYLES']);
const testingRecord = (path: string) => /^docs\/testing\/[^/]+\.md$/.test(path) && !testingGuides.has(posix.basename(path, '.md'));
const planData = /^docs\/testing\/(?!test-plan\.json$)[a-z-]+-plan\.json$/;
/** True for repository paths a generated project must not receive. */
export function frameworkOnlyPath(path: string): boolean {
  return maintainerFolders.some(folder => underFolder(path, folder)) || developmentRecord.test(path) || testingRecord(path) || planData.test(path);
}
const referenceFolders = ['architecture', 'development', 'testing', 'tooling', 'security', 'design', 'project-setup', 'user-manual'];
/** Where a kept framework Markdown document lives in a generated project, or null when it keeps its path. */
export function referenceDocPath(path: string): string | null {
  const [docs, folder] = path.split('/');
  return docs === 'docs' && folder !== undefined && referenceFolders.includes(folder) && path.endsWith('.md') && !frameworkOnlyPath(path)
    ? 'docs/framework/' + path.slice('docs/'.length) : null;
}
export const frameworkBanner = '> **Framework reference — not this project\'s backlog or instructions; follow ./AGENTS.md**';
/** Adds the banner above the first heading (after any YAML front matter); an existing banner is kept as is. */
export function withBanner(text: string): string {
  if (text.includes(frameworkBanner)) return text;
  const front = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text)?.[0] ?? '';
  return front + frameworkBanner + '\n\n' + text.slice(front.length);
}
const docReference = /docs\/(?:architecture|development|testing|tooling|security|design|project-setup|user-manual)\/[A-Za-z0-9_./-]*\.md/g;
/** Rewrites mentions of kept framework docs (inline code or product text) to their relocated path. */
export function rewriteDocReferences(text: string): string {
  return text.replace(docReference, match => referenceDocPath(match) ?? match);
}
/** npm scripts that maintain the framework itself (its compiler, release process, suites, memory tool, prototype
 * skill and qualification evidence). The scripts' sources may stay in the tree; the generated package.json
 * does not advertise them, so the product's script list is the product's daily loop and gates. */
const maintainerScripts = [/^release:/, /^test:release$/, /^evidence$/, /^qualify:/, /^maintenance:status$/, /^measure:assets$/,
  /^memory$/, /^test:memory/, /^typecheck:memory$/, /^test:mutation$/, /^test:baseline$/, /^check:repository$/, /^check:test-quality$/,
  /^typecheck:(?:compiler|generator|authoring|framework)$/, /^check:compiler-architecture$/, /^debug:compiler$/, /^test:compiler/,
  /^test:(?:generator|visual|runtime|tooling|cli|cli:journey|companion|companion:browser|test-data|makers|native-tooling|setup|quality|airship|prototypes|prototypes:python|framework-cli|setup-policy)$/,
  /^companion:/, /^prototype:/, /^framework:/, /^test:maker/, /^test:coverage:maker$/, /^increment:new$/, /^do[rd]$/];
/** True for a framework-maintainer script that a generated project does not receive. */
export function maintainerScript(name: string): boolean {
  return maintainerScripts.some(pattern => pattern.test(name));
}
