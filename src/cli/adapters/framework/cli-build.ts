/** Rebuild the compiled authoring CLI in a generated source project; its own source tree supplies template data. */
import { join } from 'node:path';
import { hash, readBounded, readJson } from './files.ts';
import { object } from './configuration.ts';
import { cliArtifact } from './cli-artifact.ts';
import { bundledNoticeFiles } from './docs-vendor.ts';
import { bundleReleaseCli } from './release-bundle.ts';
import { serializeJson } from '#shared/contracts/serialization.ts';
import type { ArchiveFile } from './zip.ts';
import type { Kit, KitFile } from './kit-integrity.ts';

export async function assembleProjectCli(root: string): Promise<ArchiveFile[]> {
  const pkg = object(await readJson(join(root, 'package.json')));
  const bundle = await bundleReleaseCli(root);
  const files: ArchiveFile[] = [
    { path: 'bin/app', bytes: await readBounded(join(root, 'src/cli/launcher.mjs')) },
    { path: 'bin/app.js', bytes: bundle.bytes }, ...bundle.tools,
    { path: 'bin/package.json', bytes: Buffer.from(serializeJson({ name: String(pkg.name) + '-cli', version: pkg.version, type: 'module', private: true })) },
    { path: 'bin/README.md', bytes: Buffer.from('# Project CLI\n\nRun `node bin/app help` from the project root. The compiled authoring tools use this project’s templates and configuration.\n') },
    { path: 'bin/LICENSE', bytes: await readBounded(join(root, 'LICENSE')) },
    ...await bundledNoticeFiles(root, bundle.packages),
  ];
  files.push({ path: 'bin/cli.json', bytes: cliArtifact(files).bytes });
  return files;
}

/** Recompiling a generated project's runtime must retain its verified upstream template and upgrade support. */
export async function retainKitTemplates(root: string, runtime: ArchiveFile[], previous: Kit): Promise<ArchiveFile[]> {
  const files = [...runtime];
  for (const file of previous.files.filter(file => file.path.startsWith('bin/template/'))) {
    files.push({ path: file.path, bytes: await readBounded(join(root, file.path), 8_000_000) });
  }
  const bootstrap = previous.bootstrap.map(file => {
    const replacement = runtime.find(item => item.path === file.path);
    return replacement ? { path: file.path, hash: hash(replacement.bytes) } : file;
  });
  const bootstrapPaths = new Set(bootstrap.map(file => file.path));
  const records: KitFile[] = files.filter(file => !bootstrapPaths.has(file.path))
    .map(file => ({ path: file.path, hash: hash(file.bytes), bytes: file.bytes.length }))
    .sort((a, b) => a.path < b.path ? -1 : 1);
  const manifest: Kit = { schemaVersion: 3, version: previous.version, compilerVersion: previous.compilerVersion,
    sourceHash: hash(serializeJson({ files: records, bootstrap })), files: records, bootstrap };
  files.push({ path: 'bin/kit.json', bytes: Buffer.from(serializeJson(manifest)) });
  return files;
}
