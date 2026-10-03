const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundleReleaseCli } from '../../bin/adapters/framework/release-bundle.ts';

// The release bundler (release-bundle.ts): one app.js whose real module locations point into the shipped template tree.
const banner = "import { createRequire as __kitCreateRequire } from 'node:module';\nconst require = __kitCreateRequire(import.meta.url);\n";
const sources = {
  'bin/app.ts': "import { here, dir } from './data.ts';\nimport plain from './plain.js';\nimport js from './meta.mjs';\n" +
    "import config from '../plugins/demo/config.json';\nimport nested from '../nested/plugins/demo/config.json';\n" +
    "import { outside } from '../../outside.mjs';\nimport fake from 'fake';\n" +
    'console.log(here, dir, plain, js, config, nested, outside, fake, import.meta.env);\n',
  'bin/data.ts': "export const here: string = import.meta.url;\nexport const dir = import.meta.dirname;\n" +
    "export const text = 'import.meta.url';\n// import.meta.dirname in a comment\n",
  'bin/plain.js': 'export default 1;\n',
  'bin/meta.mjs': 'export default `${import.meta.url}` + "import.meta.dirname";\n',
  'plugins/demo/config.json': '{"enabled":true}\n',
  'nested/plugins/demo/config.json': '{"nested":true}\n',
  'node_modules/fake/package.json': '{"name":"fake","type":"module","main":"index.js"}\n',
  'node_modules/fake/index.js': 'export default import.meta.url;\n',
};
// Exact bytes of the fixture bundle. The release bundle is whitespace-minified (identifiers, syntax and legal
// notices unchanged), so module boundaries are no longer annotated; the rebased locations are what matters.
const expected = banner + "import{fileURLToPath as __kitFileURLToPath}from\"node:url\";var here=new URL(\"./template/bin/data.ts\",import.meta.url).href;var dir=__kitFileURLToPath(new URL(\"./template/bin/\",import.meta.url));var plain_default=1;var meta_default=`${new URL(\"./template/bin/meta.mjs\",import.meta.url).href}import.meta.dirname`;import{readFileSync}from\"node:fs\";var config_default=JSON.parse(readFileSync(new URL(\"./plugins/demo/config.json\",import.meta.url),\"utf8\"));var config_default2={nested:true};var outside=import.meta.url;var fake_default=import.meta.url;console.log(here,dir,plain_default,meta_default,config_default,config_default2,outside,fake_default,import.meta.env);\n";

async function framework(files, run) {
  const base = await mkdtemp(join(tmpdir(), 'release-bundle-'));
  try {
    const root = join(base, 'framework');
    for (const [path, text] of Object.entries(files)) {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), text);
    }
    await writeFile(join(base, 'outside.mjs'), 'export const outside = import.meta.url;\n');
    await run(root);
  } finally { await rm(base, { recursive: true, force: true }); }
}

test('release bundle rebases real module locations and plugin configs only inside the framework root', () => framework(sources, async root => {
  const bundle = await bundleReleaseCli(root);
  assert.ok(Buffer.isBuffer(bundle));
  assert.equal(bundle.toString('utf8'), expected);
}));

test('release bundle rebases the same locations when the framework root is reached through a symlink', () => framework(sources, async root => {
  // macOS temp directories live under the /var -> /private/var symlink; esbuild reports the real paths.
  const linked = join(root, '..', 'linked-framework');
  await symlink(root, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await bundleReleaseCli(linked)).toString('utf8'), expected);
}));

test('release bundle keeps other meta properties and adds no URL helper without dirname', () => framework({
  'bin/app.ts': "import { here } from './data.mjs';\nexport const value: number = 1;\nconsole.log(here, value);\n",
  'bin/data.mjs': 'export const here = import.meta.url;\nexport function Made() { return new.target; }\n',
}, async root => {
  assert.equal((await bundleReleaseCli(root)).toString('utf8'), banner + "var here=new URL(\"./template/bin/data.mjs\",import.meta.url).href;var value=1;console.log(here,value);export{value};\n");
}));

test('release bundle refuses a CLI above the archive limit and surfaces build failures', async () => {
  await framework({ 'bin/app.ts': 'export default "' + 'a'.repeat(8_000_001) + '";\n' }, async root => {
    await assert.rejects(bundleReleaseCli(root), { code: 'KIT_BUNDLE', message: 'Bundled CLI exceeds the verified per-file archive limit.' });
  });
  await framework({ 'bin/app.ts': "import missing from './missing.ts';\nconsole.log(missing);\n" }, async root => {
    await assert.rejects(bundleReleaseCli(root), error => error instanceof Error && /missing\.ts/.test(error.message));
  });
});
