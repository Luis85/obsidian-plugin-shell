import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Shared starter-domain fixtures. Only reviewed starter data (configs/starters) and in-test definitions are read;
// no consumer-owned source (src/features, src/bootstrap, package.json, plugins/registry.ts) shapes an assertion.
const frameworkRoot = resolve(import.meta.dirname, '../..');
export const shipped = async id => JSON.parse(await readFile(join(frameworkRoot, 'configs/starters', id + '.json'), 'utf8'));
export const code = async pending => { try { await pending; return 'resolved'; } catch (error) { return error.code ?? error.message; } };
export const request = (command, args = [], options = {}) => ({ command, args, options });

/** A complete data-only file starter exercising every input type, both file encodings and one process. */
export function fileStarter(overrides = {}) {
  return {
    schemaVersion: 1, id: 'note-pack', name: 'Note pack', version: '1.2.3', category: 'Utility', level: 'Foundation',
    summary: 'Writes a note pack.', outcome: 'A small project.', includes: ['Notes'], implementation: ['Files'], tags: ['notes'],
    inputs: [
      { id: 'id', label: 'ID', type: 'string', required: true },
      { id: 'name', label: 'Name', type: 'string', required: true },
      { id: 'count', label: 'Count', type: 'integer', required: false, default: 2, choices: [1, 2, 3] },
      { id: 'flag', label: 'Flag', type: 'boolean', required: false, default: true },
      { id: 'author', label: 'Author', type: 'string', required: false },
    ],
    generator: { kind: 'files' },
    files: [
      { path: '{{id}}/README.md', content: '# {{name|html}}\ncount={{count|json}} flag={{flag}}\n' },
      { path: 'package.json', json: { name: '{{id}}', private: true, scripts: { hello: 'node tools/hello.mjs npm' }, list: ['{{name}}', 1, true, null] } },
      { path: 'tools/hello.mjs', content: "import { appendFile } from 'node:fs/promises';\nawait appendFile('order.txt', process.argv.slice(2).join(' ') + '\\n');\n" },
    ],
    processes: [
      { id: 'hello', label: 'Hello', description: 'Writes hello.', dependsOn: [], steps: [{ runner: 'node', script: 'tools/hello.mjs', args: ['{{id}}'], cwd: '.', timeout: 10000 }] },
      { id: 'again', label: 'Again', description: 'Runs after hello.', dependsOn: ['hello'], steps: [{ runner: 'npm', args: ['run', 'hello'], cwd: '.', timeout: 60000 }] },
    ],
    firstRun: ['again'], nextSteps: ['Open {{name}}'],
    ...overrides,
  };
}

/** A real, canonical temporary starter workspace holding the supplied definitions under configs/starters. */
export async function workspace(check, definitions = [fileStarter()]) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'starters-')));
  try {
    await mkdir(join(root, 'configs/starters'), { recursive: true });
    for (const definition of definitions) await writeFile(join(root, 'configs/starters', definition.id + '.json'), JSON.stringify(definition, null, 2) + '\n');
    return await check({ root, frameworkRoot });
  } finally { await rm(root, { recursive: true, force: true }); }
}
