/** Reproducible dependency-free release CLI; runtime and templates are packaged below bin/. */
import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve, isAbsolute, sep, posix, basename } from 'node:path';
import type { OnLoadArgs, OnLoadResult, Plugin, PluginBuild } from 'esbuild';
import type TS from 'typescript';
import { requireThat } from './contracts.ts';
import type { BundledPackage } from './docs-vendor.ts';

type Typescript = typeof TS;
type Location = 'url' | 'dirname';
type Edit = readonly [start: number, end: number, kind: Location];

/** `import.meta.url` or `import.meta.dirname` as a real expression, never text inside a string or comment. */
function moduleLocation(ts: Typescript, node: TS.Node): Location | undefined {
  if (!ts.isPropertyAccessExpression(node) || !ts.isMetaProperty(node.expression)) return undefined;
  if (node.expression.keywordToken !== ts.SyntaxKind.ImportKeyword) return undefined;
  if (node.name.text === 'url') return 'url';
  return node.name.text === 'dirname' ? 'dirname' : undefined;
}

function locationEdits(ts: Typescript, content: string, file: string): Edit[] {
  const kind = file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, false, kind);
  const edits: Edit[] = [];
  const visit = (node: TS.Node): void => {
    const location = moduleLocation(ts, node);
    if (location) edits.push([node.getStart(source), node.end, location]);
    else ts.forEachChild(node, visit);
  };
  visit(source);
  return edits;
}

/**
 * Rebase each real `import.meta.url` / `import.meta.dirname` expression in one module. The syntax tree leaves the
 * same text inside strings, template literals and comments alone: those are generated-project source, not this module.
 */
function rebaseModuleLocations(ts: Typescript, content: string, file: string): string {
  const edits = locationEdits(ts, content, file);
  const target = file, folder = posix.dirname(file) + '/';
  for (const [start, end, kind] of [...edits].reverse()) {
    content = content.slice(0, start) + (kind === 'dirname'
      ? '__kitFileURLToPath(new URL(' + JSON.stringify(folder) + ', __kitTemplateRoot))'
      : 'new URL(' + JSON.stringify(target) + ', __kitTemplateRoot).href') + content.slice(end);
  }
  return edits.some(([, , kind]) => kind === 'dirname') ? "import { fileURLToPath as __kitFileURLToPath } from 'node:url';\n" + content : content;
}

/** A Workbench plugin's config.json is editable kit data (enable/disable), not bundled code: read it beside app.js. */
function pluginConfig(root: string, { path }: OnLoadArgs): OnLoadResult | undefined {
  const file = relative(root, path).split(sep).join('/');
  if (!/^plugins\/[^/]+\/config\.json$/.test(file)) return undefined;
  return { loader: 'js', contents: "import { readFileSync } from 'node:fs';\nexport default JSON.parse(readFileSync(new URL(" +
    JSON.stringify('./' + file) + ", import.meta.url), 'utf8'));\n" };
}

const insideDependencies = (path: string): boolean => path === 'node_modules' || path.startsWith('node_modules' + sep);
const outsideRoot = (path: string): boolean => path === '..' || path.startsWith('..' + sep) || isAbsolute(path);

async function frameworkSource(ts: Typescript, root: string, { path }: OnLoadArgs): Promise<OnLoadResult | undefined> {
  const relativePath = relative(root, path);
  if (!relativePath || insideDependencies(relativePath) || outsideRoot(relativePath)) return undefined;
  const file = relativePath.split(sep).join('/');
  let content = await readFile(path, 'utf8');
  if (content.includes('import.meta')) content = rebaseModuleLocations(ts, content, file);
  return { contents: content, loader: path.endsWith('.ts') ? 'ts' : 'js', resolveDir: resolve(path, '..') };
}

/** Rebase module-relative data references from the bundled file to the separately shipped template tree. */
function templateLocations(ts: Typescript, root: string): Plugin {
  return {
    name: 'release-template-locations',
    setup(builder: PluginBuild) {
      builder.onResolve({ filter: /^typescript$/ }, () => ({ path: './tools/typescript.js', external: true }));
      builder.onLoad({ filter: /[\\/]plugins[\\/][^\\/]+[\\/]config\.json$/ }, args => pluginConfig(root, args));
      builder.onLoad({ filter: /\.(?:[cm]?js|ts)$/ }, args => frameworkSource(ts, root, args));
    },
  };
}

/** Bundled node_modules packages; esbuild uses `/` paths, absolute when a Windows junction crosses drives. */
function bundledPackages(inputs: readonly string[]): BundledPackage[] {
  const found = new Map<string, BundledPackage>();
  for (const input of inputs) {
    // Greedy prefix: the innermost package owns a file inside a nested node_modules install.
    const match = /^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//.exec(input);
    if (match?.[1] && match[2]) found.set(match[1], { name: match[2], directory: match[1] });
  }
  return [...found.values()].sort((a, b) => a.directory.localeCompare(b.directory));
}

export async function bundleReleaseCli(frameworkRoot: string): Promise<{ bytes: Buffer; tools: Array<{ path: string; bytes: Buffer }>; packages: BundledPackage[] }> {
  // esbuild reports symlink-resolved module paths (macOS tmpdir is /var -> /private/var); compare against the same form.
  const root = await realpath(resolve(frameworkRoot));
  const { build } = await import('esbuild');
  const ts = (await import('typescript')).default;
  const result = await build({
    absWorkingDir: root,
    entryPoints: [resolve(root, 'src/cli/app.ts')],
    outfile: resolve(root, 'bin/app.js'),
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
    packages: 'bundle', legalComments: 'inline', sourcemap: false, logLevel: 'silent', metafile: true,
    // Whitespace only: identifiers, syntax and inline legal notices are unchanged. It keeps the single bundled file
    // well inside the 8 MB per-file limit that every kit reader enforces.
    minifyWhitespace: true,
    // Bundled CommonJS dependencies (yaml's node build) require Node built-ins; ESM output needs a real require.
    banner: { js: "import { createRequire as __kitCreateRequire } from 'node:module';\nconst require = __kitCreateRequire(import.meta.url);\nimport { existsSync as __kitExists } from 'node:fs';\nconst __kitTemplateRoot = new URL(__kitExists(new URL('./template/package.json', import.meta.url)) ? './template/' : '../', import.meta.url);" },
    // Project build/browser tools and the framework packager require a project install; CLI authoring tools ship below bin/.
    external: ['node:*', 'esbuild', 'vite', '@playwright/test', 'playwright-core'],
    plugins: [templateLocations(ts, root)],
  });
  const [output, ...rest] = result.outputFiles ?? [];
  requireThat(output !== undefined && rest.length === 0 && basename(output.path) === 'app.js', 'KIT_BUNDLE', 'Release build must emit one app.js.');
  requireThat(output.contents.length <= 8_000_000, 'KIT_BUNDLE', 'Bundled CLI exceeds the verified per-file archive limit.');
  const tools: Array<{ path: string; bytes: Buffer }> = [];
  const inputs = Object.keys(result.metafile.inputs);
  if (Object.values(result.metafile.outputs).some(output => output.imports.some(input => input.path === './tools/typescript.js'))) {
    const compiler = await build({ absWorkingDir: root, stdin: { contents: "import ts from 'typescript'; export default ts;", resolveDir: root },
      // Minify the vendor compiler as well as whitespace so generated applications stay within the unchanged
      // first-run input budget. License comments remain inline; authoring behavior is exercised from this artifact.
      bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22', minify: true, legalComments: 'inline', metafile: true,
      banner: { js: "import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url'; import { dirname } from 'node:path'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);" } });
    const bytes = Buffer.from(compiler.outputFiles[0]!.contents);
    requireThat(bytes.length <= 8_000_000, 'KIT_BUNDLE', 'Bundled TypeScript exceeds the verified per-file archive limit.');
    tools.push({ path: 'bin/tools/typescript.js', bytes });
    inputs.push(...Object.keys(compiler.metafile.inputs));
  }
  return { bytes: Buffer.from(output.contents), tools, packages: bundledPackages(inputs) };
}
