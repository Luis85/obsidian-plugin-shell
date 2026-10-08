/** Assemble the standalone CLI before replacing the last complete bin directory. */
import { chmod, cp, lstat, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assembleKit, installedCompiler } from '../../src/cli/adapters/framework/kit.ts';
import { assembleProjectCli, retainKitTemplates } from '../../src/cli/adapters/framework/cli-build.ts';
import { verifyCliArtifact } from '../../src/cli/adapters/framework/cli-artifact.ts';
import { verifyKit } from '../../src/cli/adapters/framework/kit-integrity.ts';

async function present(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function buildCli(root = process.cwd()) {
  root = resolve(root);
  const destination = join(root, 'bin'), lock = join(root, '.workbench-cli-build.lock');
  await mkdir(lock); // A concurrent build must not replace the candidate being verified.
  let scratch, retainBackup = false;
  try {
    const existing = await present(destination);
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw new Error('CLI_OUTPUT_NOT_DIRECTORY');
    // Never discard unknown files, damaged output, or edited owned assets.
    let previousKit;
    if (existing) {
      if (await present(join(destination, 'kit.json'))) previousKit = await verifyKit(root);
      else await verifyCliArtifact(root);
    }
    const generatedProject = await present(join(root, '.companion/generation.json'));
    let files = generatedProject ? await assembleProjectCli(root) : await assembleKit({ root, frameworkRoot: root }, await installedCompiler());
    if (generatedProject && previousKit) files = await retainKitTemplates(root, files, previousKit);
    scratch = await mkdtemp(join(root, '.workbench-cli-'));
    for (const file of files.filter(file => file.path.startsWith('bin/'))) {
      const path = join(scratch, file.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.bytes, { flag: 'wx' });
    }
    await chmod(join(scratch, 'bin/app'), 0o755);
    // Installed app plugins, enabled lists and edited plugin settings are user data.
    if (await present(join(destination, 'plugins'))) await cp(join(destination, 'plugins'), join(scratch, 'bin/plugins'), { recursive: true });
    const candidate = generatedProject && !previousKit ? (await verifyCliArtifact(scratch), null) : await verifyKit(scratch);
    const previous = join(scratch, 'previous-bin');
    if (existing) await rename(destination, previous);
    try { await rename(join(scratch, 'bin'), destination); }
    catch (error) {
      if (existing) {
        try { await rename(previous, destination); }
        catch (rollback) {
          retainBackup = true;
          throw new AggregateError([error, rollback], `CLI replacement failed; previous output retained at ${previous}`);
        }
      }
      throw error;
    }
    return { version: candidate?.version, sourceHash: candidate?.sourceHash, files: files.filter(file => file.path.startsWith('bin/')).length, directory: destination };
  } finally {
    if (scratch && !retainBackup) await rm(scratch, { recursive: true, force: true });
    await rm(lock, { recursive: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(await buildCli()));
}
