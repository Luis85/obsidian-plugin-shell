import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixedSource, collectAssets, retainCandidate, validateRetained, sha256, assetNames } from './candidate.mjs';
import { stableVersion } from './prepare.mjs';

async function rehearse({ root = process.cwd(), commit, version }) {
  root = resolve(root); fixedSource(root, commit);
  if (process.version !== 'v24.21.0' || !process.env.npm_execpath) throw new Error('QUALIFIED_NODE_AND_NPM_REQUIRED');
  const npm = process.env.npm_execpath;
  const npmVersion = spawnSync(process.execPath, [npm, '--version'], { encoding: 'utf8', windowsHide: true });
  if (npmVersion.status !== 0 || npmVersion.stdout.trim() !== '11.19.1') throw new Error('QUALIFIED_NPM_REQUIRED');
  // verify builds once; all later operations copy and hash its retained dist bytes.
  const result = spawnSync(process.execPath, [npm, 'run', 'verify'], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error('QUALIFICATION_FAILED');
  fixedSource(root, commit);
  const { bytes } = await collectAssets(root, join(root, 'dist'), version);
  const qualification = { command: 'verify', status: 'passed', sourceCommit: commit, node: process.version, npm: npmVersion.stdout.trim(),
    assetHashes: Object.fromEntries(assetNames.map(name => [name, sha256(bytes[name])])),
    completedAt: new Date().toISOString(), scopes: ['static', 'unit', 'coverage', 'artifact', 'harness-build'],
    notRun: ['served-browser', 'native-host', 'mobile', 'publication'] };
  const output = join(root, 'reports/release', `${version}-${commit}`);
  await retainCandidate({ root, input: join(root, 'dist'), output, commit, version, qualification });
  await validateRetained(output, commit, version);
  return { output, commit, version, status: 'rehearsed', publication: 'not-authorized' };
}
export function parseRehearsalArguments(args) {
  const options = {}; const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`); seen.add(flag);
    if (flag === '--help') options.help = true;
    else if (['--commit', '--version', '--check'].includes(flag)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
      options[flag.slice(2)] = value;
    } else throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
  }
  if (!args.length) return { help: true };
  if (options.help) { if (args.length !== 1) throw new Error('HELP_MUST_BE_USED_ALONE'); return options; }
  if (!/^[a-f0-9]{40}$/.test(options.commit ?? '')) throw new Error('FIXED_COMMIT_REQUIRED');
  stableVersion(options.version); return options;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseRehearsalArguments(process.argv.slice(2));
    if (options.help) { console.log('npm run release:rehearse -- --commit <full-HEAD-SHA> --version X.Y.Z [--check <retained-directory>]\nWithout --check: require clean fixed source, run verify once, retain assets. With --check: read-only integrity validation; no rebuild or publication.'); process.exit(0); }
    if (options.check) console.log(JSON.stringify(await validateRetained(resolve(options.check), options.commit, options.version), null, 2));
    else console.log(JSON.stringify(await rehearse(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
