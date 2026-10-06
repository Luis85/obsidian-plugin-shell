import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeReleaseOperation, authorizationDigest } from './execute.mjs';
import { createGitHubRemote } from './github-remote.mjs';

export function parseOperationArguments(args) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) return { help: true };
  const options = {}; const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error('DUPLICATE_ARGUMENT');
    seen.add(flag);
    if (flag === '--execute') options.execute = true;
    else if (flag === '--input' || flag === '--authorize') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('MISSING_ARGUMENT_VALUE');
      options[flag.slice(2)] = value;
    } else throw new Error('UNKNOWN_ARGUMENT');
  }
  if (!options.input) throw new Error('INPUT_FILE_REQUIRED');
  if (Boolean(options.execute) !== Boolean(options.authorize)) throw new Error('EXECUTION_REQUIRES_EXPLICIT_AUTHORIZATION_DIGEST');
  if (options.authorize && !/^[a-f0-9]{64}$/.test(options.authorize)) throw new Error('INVALID_AUTHORIZATION_DIGEST');
  return options;
}

export async function readOperationInput(path) {
  path = resolve(path);
  const input = JSON.parse(await readFile(path, 'utf8'));
  const keys = ['repository', 'candidateDirectory', 'commit', 'version', 'mode', 'acceptance', 'review', 'platforms'];
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(key => !keys.includes(key))) throw new Error('INVALID_OPERATION_INPUT');
  if (typeof input.candidateDirectory !== 'string' || !input.candidateDirectory.trim()) throw new Error('CANDIDATE_DIRECTORY_REQUIRED');
  return { ...input, candidateDirectory: resolve(dirname(path), input.candidateDirectory) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOperationArguments(process.argv.slice(2));
    if (options.help) {
      console.log('npm run release:operate -- --input <operation.json>\nDefault: authenticated read-only discovery and an exact candidate plan.\nAfter separate authorization: --execute --authorize <authorizationDigest from reviewed plan>.\nDraft creates/uploads; promote publishes an existing complete draft with a matching tag and native evidence.\nNever rebuilds, overwrites assets, creates tags explicitly or retries uncertain writes.');
    } else {
      const input = await readOperationInput(options.input);
      const result = await executeReleaseOperation(input, {
        remote: createGitHubRemote(), execute: options.execute === true,
        authorize: async binding => authorizationDigest(binding) === options.authorize ? binding : null,
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.status === 'uncertain') process.exitCode = 2;
    }
  } catch (error) {
    // Do not echo parsed input, gh output, credential data or arbitrary file contents.
    const code = /^([A-Z][A-Z_0-9]*)(?::|$)/.exec(error.message)?.[1] ?? 'RELEASE_OPERATION_FAILED';
    console.error(JSON.stringify({ status: 'failed', error: code, lockPath: error.lockPath, localCleanup: error.localCleanup })); process.exitCode = 1;
  }
}
