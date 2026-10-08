/**
 * Whether each source project is inside the scope of the repository's lint, line-limit, coverage and analyzer gates.
 * Scopes are read statically and never executed: the shell lint exclusions from configs/lint/lint-scope.mjs, coverage
 * `include` globs from the Vitest configs under configs/testing, Fallow's ignorePatterns, and the code roots of the
 * line-limit policy. A gate a project does not configure is not reported; a project counts as covered when at least
 * one of its production files (outside tests/) is in scope. A deliberate gap is recorded in the manifest as a
 * `gateExemptions` reason, never silently skipped.
 */
import { join, posix } from 'node:path';
import { codeRoots, isWithinRoot } from '#shared/platform/project-roots.mjs';
import { isShellRepository } from '#shared/platform/repository-kind.mjs';
import type { SourceFinding, SourceGate, SourceManifest } from '../domain/source-projects.ts';
import { exists, readBounded } from './framework/files.ts';
import { OperationError } from './framework/contracts.ts';
import { codeFile, isDirectory, listFiles, readJsonFile } from './source-workspace.ts';

type InScope = (file: string) => boolean;
const matches = (file: string, glob: string): boolean => posix.matchesGlob(file, glob);
const gateNames: Record<SourceGate, string> = { lint: 'lint (ESLint/oxlint)', lineLimit: 'line limits', coverage: 'test coverage', analyzer: 'Fallow analyzer' };

async function typescript() { return (await import('typescript')).default; }
/** String literals of every array assigned to `name` (directly or through Object.freeze) in a module, from its syntax tree. */
async function stringArrays(text: string, path: string, accept: (property: string, parent: string | null) => boolean): Promise<string[][]> {
  const ts = await typescript(), source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const arrays: string[][] = [];
  const nameOf = (node: import('typescript').Node | undefined): string | null =>
    node && (ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node)) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : null;
  const visit = (node: import('typescript').Node): void => {
    if (ts.isArrayLiteralExpression(node)) {
      let holder: import('typescript').Node = node.parent;
      if (ts.isCallExpression(holder)) holder = holder.parent;
      const property = nameOf(holder), parent = holder && ts.isPropertyAssignment(holder) ? nameOf(holder.parent?.parent) : null;
      if (property !== null && accept(property, parent)) arrays.push(node.elements.filter(ts.isStringLiteralLike).map(item => item.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return arrays;
}
async function lintScope(root: string): Promise<InScope | null> {
  const configured = await exists(join(root, 'configs/lint/eslint.config.mjs')) || await exists(join(root, 'eslint.config.mjs'));
  if (!configured) return null;
  const scope = 'configs/lint/lint-scope.mjs';
  if (!isShellRepository(root) || !await exists(join(root, scope))) return () => true;
  const [rules] = await stringArrays((await readBounded(join(root, scope))).toString('utf8'), scope, property => property === 'shellLintExclusions');
  if (!rules) throw new OperationError('SOURCE_GATE_SCOPE_UNREADABLE', `${scope} has no readable shellLintExclusions list.`, 'Keep shellLintExclusions a literal array of globs.');
  // The last matching entry wins; a `!` entry re-includes a path (the rule lint-scope.mjs itself applies).
  return file => {
    let excluded = false;
    for (const rule of rules) if (matches(file, rule.replace(/^!/, ''))) excluded = !rule.startsWith('!');
    return !excluded;
  };
}
async function coverageScope(root: string): Promise<InScope | null> {
  const configs = (await listFiles(root, 'configs/testing')).filter(path => /\/vitest[^/]*\.(?:[cm]?[jt]s)$/.test(path));
  const scopes: InScope[] = [];
  for (const path of configs) {
    const text = (await readBounded(join(root, path))).toString('utf8');
    const includes = (await stringArrays(text, path, (property, parent) => property === 'include' && parent === 'coverage')).flat();
    const excludes = (await stringArrays(text, path, (property, parent) => property === 'exclude' && parent === 'coverage')).flat();
    if (includes.length) scopes.push(file => includes.some(glob => matches(file, glob)) && !excludes.some(glob => matches(file, glob)));
  }
  return scopes.length ? file => scopes.some(inScope => inScope(file)) : null;
}
async function analyzerScope(root: string): Promise<InScope | null> {
  const config = await readJsonFile(root, 'configs/quality/fallow.json') ?? await readJsonFile(root, '.fallowrc.json');
  if (!config) return null;
  const ignored = (config.value as { ignorePatterns?: unknown }).ignorePatterns;
  const patterns = Array.isArray(ignored) ? ignored.filter((item): item is string => typeof item === 'string') : [];
  return file => !patterns.some(pattern => matches(file, pattern));
}
function lineLimitScope(root: string): InScope {
  const roots = codeRoots(root);
  return file => roots.some(base => isWithinRoot(file, base));
}

/** One SOURCE_GATE_UNCOVERED finding per project and gate that reaches none of its production files without a recorded exemption. */
export async function gateFindings(root: string, manifest: SourceManifest): Promise<SourceFinding[]> {
  const scopes: Array<[SourceGate, InScope | null]> = [['lint', await lintScope(root)], ['lineLimit', lineLimitScope(root)],
    ['coverage', await coverageScope(root)], ['analyzer', await analyzerScope(root)]];
  const findings: SourceFinding[] = [];
  for (const project of manifest.projects) {
    if (!await isDirectory(root, project.path)) continue;
    const tests = `${project.path}/tests/`;
    const files = (await listFiles(root, project.path)).filter(file => codeFile.test(file) && !file.startsWith(tests));
    if (!files.length) continue;
    for (const [gate, inScope] of scopes) {
      if (!inScope || project.gateExemptions?.[gate] !== undefined || files.some(inScope)) continue;
      findings.push({ code: 'SOURCE_GATE_UNCOVERED', project: project.name, fix: 'manual',
        message: `${project.path} is outside the ${gateNames[gate]} scope; add it to that gate, or record the reason in gateExemptions.${gate} of workbench.sources.json.` });
    }
  }
  return findings;
}
