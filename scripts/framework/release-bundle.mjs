/** Reproducible dependency-free release CLI; all templates remain source data under .framework/template. */
import { readFile } from 'node:fs/promises';
import { relative, resolve, isAbsolute, sep, posix, basename } from 'node:path';
import { requireThat } from './contracts.ts';

/**
 * Rebase each real `import.meta.url` / `import.meta.dirname` expression in one module. The syntax tree leaves the
 * same text inside strings, template literals and comments alone: those are generated-project source, not this module.
 */
function rebaseModuleLocations(ts, content, file) {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, false, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const edits = [];
  const visit = node => {
    if (ts.isPropertyAccessExpression(node) && ts.isMetaProperty(node.expression) && node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
        (node.name.text === 'url' || node.name.text === 'dirname')) edits.push([node.getStart(source), node.end, node.name.text]);
    else ts.forEachChild(node, visit);
  };
  visit(source);
  const target = '../template/' + file, folder = '../template/' + posix.dirname(file) + '/';
  for (const [start, end, kind] of edits.reverse()) {
    content = content.slice(0, start) + (kind === 'dirname'
      ? '__kitFileURLToPath(new URL(' + JSON.stringify(folder) + ', import.meta.url))'
      : 'new URL(' + JSON.stringify(target) + ', import.meta.url).href') + content.slice(end);
  }
  return edits.some(([, , kind]) => kind === 'dirname') ? "import { fileURLToPath as __kitFileURLToPath } from 'node:url';\n" + content : content;
}

/** Rebase module-relative data references from the bundled file to the separately shipped template tree. */
export async function bundleReleaseCli(frameworkRoot) {
  const root = resolve(frameworkRoot);
  const { build } = await import('esbuild');
  const ts = (await import('typescript')).default;
  const result = await build({
    absWorkingDir: root,
    entryPoints: [resolve(root, 'scripts/framework/release-entry.ts')],
    outfile: resolve(root, '.framework/compiled/app.js'),
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
    packages: 'bundle', legalComments: 'inline', sourcemap: false, logLevel: 'silent',
    // Bundled CommonJS dependencies (yaml's node build) require Node built-ins; ESM output needs a real require.
    banner: { js: "import { createRequire as __kitCreateRequire } from 'node:module';\nconst require = __kitCreateRequire(import.meta.url);" },
    // These are maintainer-only/optional tools. Regular extracted-kit commands never load them.
    external: ['node:*', 'typescript', 'esbuild'],
    plugins: [{
      name: 'release-template-locations',
      setup(builder) {
        builder.onLoad({ filter: /\.(?:[cm]?js|ts)$/ }, async ({ path }) => {
          const relativePath = relative(root, path);
          if (!relativePath || relativePath === 'node_modules' || relativePath.startsWith('node_modules' + sep) ||
              relativePath === '..' || relativePath.startsWith('..' + sep) || isAbsolute(relativePath)) return;
          const file = relativePath.split(sep).join('/');
          let content = await readFile(path, 'utf8');
          if (content.includes('import.meta')) content = rebaseModuleLocations(ts, content, file);
          return { contents: content, loader: path.endsWith('.ts') ? 'ts' : 'js', resolveDir: resolve(path, '..') };
        });
      },
    }],
  });
  const output = result.outputFiles ?? [];
  requireThat(output.length === 1 && basename(output[0].path) === 'app.js', 'KIT_BUNDLE', 'Release build must emit one app.js.');
  requireThat(output[0].contents.length <= 8_000_000, 'KIT_BUNDLE', 'Bundled CLI exceeds the verified per-file archive limit.');
  return Buffer.from(output[0].contents);
}
