import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { serializeJson as json } from '../../../../scripts/contracts/serialization.ts';
import { readBounded, readJson } from './files.ts';
import { object } from './configuration.ts';
import { requireThat } from './contracts.ts';

/** One third-party package esbuild actually bundled into app.js, located by its directory below the framework root. */
export interface BundledPackage { readonly name: string; readonly directory: string }
const licenseName = /^(?:licen[cs]e|copying)(?:[.-][a-z0-9]+)?(?:\.(?:md|txt))?$/i;
const declaredPin = (pkg: Record<string, unknown>, name: string): unknown =>
  object(pkg.dependencies ?? {})[name] ?? object(pkg.devDependencies ?? {})[name];

/**
 * Third-party code bundled into app.js ships with its own license text and an exact-version notice. The package list is
 * derived from the bundle's own inputs, so a newly bundled dependency without a license file fails packaging.
 */
export async function bundledNoticeFiles(root: string, packages: readonly BundledPackage[]) {
  const framework = object(await readJson(join(root, 'package.json')));
  const files: Array<{ path: string; bytes: Buffer }> = [], notices: unknown[] = [];
  for (const { name, directory } of [...packages].sort((a, b) => a.name.localeCompare(b.name) || a.directory.localeCompare(b.directory))) {
    const pkg = object(await readJson(join(root, directory, 'package.json')));
    const { version, license } = pkg, pinned = declaredPin(framework, name);
    requireThat(pkg.name === name && typeof version === 'string', 'KIT_NOTICE_PACKAGE', `Bundled package metadata is invalid: ${name}.`);
    requireThat(pinned === undefined || pinned === version, 'KIT_NOTICE_VERSION', `Install the exact locked ${name} before packaging.`);
    const licenseFile = (await readdir(join(root, directory))).sort().find(entry => licenseName.test(entry));
    requireThat(licenseFile, 'KIT_LICENSE_MISSING', `Bundled package ${name} ships no license file; refusing an unlicensed bundle.`);
    const path = `bin/licenses/${name.replace(/^@/, 'scope__').replace('/', '__')}.LICENSE`;
    requireThat(!files.some(file => file.path === path), 'KIT_NOTICE_DUPLICATE', `Bundled package ${name} has more than one installed copy.`);
    files.push({ path, bytes: await readBounded(join(root, directory, licenseFile)) });
    notices.push({ name, version, license: typeof license === 'string' ? license : 'see license file', file: path.slice('bin/licenses/'.length) });
  }
  files.push({ path: 'bin/licenses/NOTICES.json', bytes: Buffer.from(json({ bundle: 'bin/app.js', packages: notices })) });
  return files;
}
