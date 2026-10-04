const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleReleaseCli } from '../../bin/adapters/framework/release-bundle.ts';
import { bundledNoticeFiles } from '../../bin/adapters/framework/docs-vendor.ts';

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
  // Canonical temp root: macOS tmpdir() lives under the /var symlink, which input-path checks correctly refuse.
  const base = await mkdtemp(join(await realpath(tmpdir()), 'release-bundle-'));
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
  assert.ok(Buffer.isBuffer(bundle.bytes));
  assert.equal(bundle.bytes.toString('utf8'), expected);
  // Third-party inputs come from the bundle's own metafile; nothing outside node_modules is reported.
  assert.deepEqual(bundle.packages, [{ name: 'fake', directory: 'node_modules/fake' }]);
}));

test('release bundle rebases the same locations when the framework root is reached through a symlink', () => framework(sources, async root => {
  // macOS temp directories live under the /var -> /private/var symlink; esbuild reports the real paths.
  const linked = join(root, '..', 'linked-framework');
  await symlink(root, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await bundleReleaseCli(linked)).bytes.toString('utf8'), expected);
}));

test('release bundle keeps other meta properties and adds no URL helper without dirname', () => framework({
  'bin/app.ts': "import { here } from './data.mjs';\nexport const value: number = 1;\nconsole.log(here, value);\n",
  'bin/data.mjs': 'export const here = import.meta.url;\nexport function Made() { return new.target; }\n',
}, async root => {
  assert.equal((await bundleReleaseCli(root)).bytes.toString('utf8'), banner + "var here=new URL(\"./template/bin/data.mjs\",import.meta.url).href;var value=1;console.log(here,value);export{value};\n");
}));

test('release bundle refuses a CLI above the archive limit and surfaces build failures', async () => {
  await framework({ 'bin/app.ts': 'export default "' + 'a'.repeat(8_000_001) + '";\n' }, async root => {
    await assert.rejects(bundleReleaseCli(root), { code: 'KIT_BUNDLE', message: 'Bundled CLI exceeds the verified per-file archive limit.' });
  });
  await framework({ 'bin/app.ts': "import missing from './missing.ts';\nconsole.log(missing);\n" }, async root => {
    await assert.rejects(bundleReleaseCli(root), error => error instanceof Error && /missing\.ts/.test(error.message));
  });
});

test('bundled third-party packages each ship a license and exact-version notice, failing closed without one', () => framework({
  ...sources,
  'package.json': JSON.stringify({ dependencies: { fake: '1.0.0' } }),
  'node_modules/fake/package.json': '{"name":"fake","version":"1.0.0","license":"MIT","type":"module","main":"index.js"}\n',
}, async root => {
  const { packages } = await bundleReleaseCli(root);
  await assert.rejects(bundledNoticeFiles(root, packages), { code: 'KIT_LICENSE_MISSING' });
  await writeFile(join(root, 'node_modules/fake/LICENSE.md'), 'fake license');
  const files = await bundledNoticeFiles(root, packages);
  assert.deepEqual(files.map(file => file.path), ['bin/licenses/fake.LICENSE', 'bin/licenses/NOTICES.json']);
  assert.equal(files[0].bytes.toString('utf8'), 'fake license');
  assert.deepEqual(JSON.parse(files[1].bytes.toString('utf8')).packages, [{ name: 'fake', version: '1.0.0', license: 'MIT', file: 'fake.LICENSE' }]);
  await writeFile(join(root, 'package.json'), JSON.stringify({ devDependencies: { fake: '1.0.1' } }));
  await assert.rejects(bundledNoticeFiles(root, packages), { code: 'KIT_NOTICE_VERSION' });
  await assert.rejects(bundledNoticeFiles(root, [{ name: 'other', directory: 'node_modules/fake' }]), { code: 'KIT_NOTICE_PACKAGE' });
}));

test('every node_modules package bundled into the real release CLI has a shipped notice; installed-only tools stay external', { timeout: 120000 }, async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const { bytes, packages } = await bundleReleaseCli(root);
  const files = await bundledNoticeFiles(root, packages);
  const notices = JSON.parse(files.find(file => file.path === 'bin/licenses/NOTICES.json').bytes.toString('utf8')).packages;
  assert.ok(packages.length > 0);
  assert.deepEqual(notices.map(notice => notice.name).sort(), packages.map(entry => entry.name).sort());
  for (const notice of notices) assert.ok(files.some(file => file.path === 'bin/licenses/' + notice.file && file.bytes.length > 0), notice.name);
  for (const external of ['prettier', 'typescript', 'esbuild']) assert.ok(!packages.some(entry => entry.name === external), external + ' must stay an installed external');
  assert.match(bytes.toString('utf8'), /import\("prettier"\)/, 'makers load the installed prettier on first use');
});
