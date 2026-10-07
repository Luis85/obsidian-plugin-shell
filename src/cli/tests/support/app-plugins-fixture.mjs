/** Shared fixture for app plugin (bin/plugins) checks: a disposable framework root, plugin folders and invocation capture. */
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PassThrough, Writable } from 'node:stream';
import { main } from '../../app.ts';
import { executeOperation } from '../../adapters/framework/operations.ts';

export const manifestFor = (id, extra = {}) => ({ id, name: 'Hello World', version: '1.0.0', minAppVersion: '0.4.0', apiVersion: 1,
  description: 'Greets.', author: 'Tester', category: 'tool', tags: ['greeting'], ...extra });
const greeter = `const { Plugin } = require('workbench');
module.exports = class Greeter extends Plugin {
  async onload() {
    this.settings = await this.loadData();
    this.addCommand({ id: 'greet', name: 'Greet', options: { values: ['who'], booleans: ['loud'] }, execute: async request => {
      this.settings.count = (this.settings.count ?? 0) + 1;
      await this.saveData(this.settings);
      const text = this.settings.greeting + ', ' + (request.flags.who ?? 'world') + '!';
      return { message: request.flags.loud ? text.toUpperCase() : text, count: this.settings.count, app: this.app.version };
    } });
    this.addStudioAction({ id: 'wave', label: 'Wave', run: () => {} });
    this.register(() => process.emit('app-plugin-test', this.manifest.id + ':cleanup'));
  }
  onunload() { process.emit('app-plugin-test', this.manifest.id + ':onunload'); }
};
`;
export async function frameworkRoot(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'app-plugins-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '0.4.0' }));
  await mkdir(join(root, 'bin/plugins'), { recursive: true });
  return root;
}
export async function install(root, id, { source = greeter, manifest = manifestFor(id), settings = { greeting: 'Hello' } } = {}) {
  const folder = join(root, 'bin/plugins', id);
  await mkdir(folder, { recursive: true });
  if (source !== null) await writeFile(join(folder, 'main.js'), source);
  if (manifest !== null) await writeFile(join(folder, 'manifest.json'), JSON.stringify(manifest));
  if (settings !== null) await writeFile(join(folder, 'settings.json'), JSON.stringify(settings));
  return folder;
}
export const enable = (root, ids) => writeFile(join(root, 'bin/plugins/community-plugins.json'), JSON.stringify(ids));
function sink() {
  const chunks = [];
  const stream = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  return Object.assign(stream, { text: () => chunks.join('') });
}
export async function run(root, argv) {
  const input = new PassThrough(); input.end();
  const output = sink(), error = sink();
  const status = await main(argv, root, { input, output, error, env: { CI: 'true' } });
  return { status, stdout: output.text(), stderr: error.text() };
}
export const operation = (root, command, args = [], options = {}) => executeOperation({ command, args, options }, { root, frameworkRoot: root });
