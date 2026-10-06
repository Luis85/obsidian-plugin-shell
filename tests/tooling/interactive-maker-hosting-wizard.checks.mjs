import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { guidedStarter } from '../../src/cli/presentation/terminal/starter-terminal.ts';
import { guidedSetup } from '../../src/cli/presentation/terminal/setup-terminal.ts';
import { setupDefaults } from '../../src/cli/presentation/wizards/framework-setup.ts';
import { hostingNote } from '../../src/cli/presentation/wizards/hosting.ts';
import { wizardRegistry } from '../../src/cli/presentation/wizards/registry.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
const context = { root: frameworkRoot, frameworkRoot };
function scripted(answers) {
  const asked = [], written = [];
  return { asked, written, prompt: async question => { asked.push(question); assert.ok(answers.length, `Unscripted question: ${question}`); return answers.shift(); }, write: text => { written.push(text); } };
}
const starter = options => ({ command: 'new', args: ['target'], options: { starter: 'blank', id: 'plain-app', name: 'Plain App', author: 'Team', airship: false, ...options } });
/** The blank starter's own inputs come first; their defaults are accepted. */
const inputs = ['', '', '', ''];
const hostingQuestions = asked => asked.filter(question => /^(Hosting platform|Azure DevOps)/.test(question));

test('the new-starter hosting steps ask only for Azure DevOps details that no flag supplied', async () => {
  // An organization flag pre-selects Azure DevOps; only the project and repository are asked.
  const flagged = scripted([...inputs, '', 'Demo', '']);
  const given = await guidedStarter(starter({ 'azure-organization': 'https://dev.azure.com/contoso' }), context, flagged.prompt, flagged.write);
  assert.match(hostingQuestions(flagged.asked)[0], /^Hosting platform .*\[azure-devops\]: $/);
  assert.deepEqual(hostingQuestions(flagged.asked).slice(1), ['Azure DevOps project: ', 'Azure DevOps repository [Demo]: ']);
  assert.deepEqual([given.options.hosting, given.options['azure-organization'], given.options['azure-project'], given.options['azure-repository']],
    ['azure-devops', 'https://dev.azure.com/contoso', 'Demo', undefined], 'a repository equal to the project is not stored twice');
  // A blank organization without a remote default records the platform only.
  const later = scripted([...inputs, 'azure-devops', '']);
  const recorded = await guidedStarter(starter({}), context, later.prompt, later.write);
  assert.deepEqual(hostingQuestions(later.asked).slice(1), ['Azure DevOps organization URL (https://dev.azure.com/<organization>), blank to add later: ']);
  assert.equal(recorded.options.hosting, 'azure-devops');
  assert.ok(['azure-organization', 'azure-project', 'azure-repository'].every(flag => recorded.options[flag] === undefined));
  // A blank project is asked again; it is required once an organization is known.
  const retry = scripted([...inputs, 'AZURE-DEVOPS', 'https://dev.azure.com/contoso', '', 'Menus', 'menu-repo']);
  const asked = await guidedStarter(starter({}), context, retry.prompt, retry.write);
  assert.equal(retry.asked.filter(question => question === 'Azure DevOps project: ').length, 2);
  assert.deepEqual([asked.options.hosting, asked.options['azure-project'], asked.options['azure-repository']], ['azure-devops', 'Menus', 'menu-repo']);
});

test('the setup hosting question is only asked for a new design and its note names the stored platform', async () => {
  const dependencies = { ...setupDefaults, readConfiguration: async () => ({}), readOriginUrl: async () => assert.fail('No origin is read without a new design') };
  const existing = scripted([]);
  const kept = await guidedSetup({ command: 'setup', args: [], options: { 'no-airship': true, 'no-mcp': true } }, context, existing.prompt, existing.write, dependencies);
  assert.deepEqual(existing.asked, []); assert.equal(kept.options.hosting, undefined);
  assert.ok(existing.written.some(text => text.startsWith('Hosting is unchanged (node bin/app hosting show).')));
  assert.match(hostingNote({ hosting: 'none' }, false), /^No hosting platform: generate emits no CI pipeline/);
  assert.match(hostingNote({}, true), /^GitHub hosting: /);
});

test('hosting actions fail closed without prepared state or a target for the answers', () => {
  const step = { id: 'apply', kind: 'action', action: 'hosting.apply', with: { into: 'missing' } };
  const run = (name, state, with_) => wizardRegistry.actions[name]({ state, step: { ...step, ...(with_ ? { with: with_ } : {}) }, options: context, ui: {} });
  assert.throws(() => run('hosting.platform', {}), /hosting\.prepare first/);
  assert.throws(() => run('hosting.apply', { hosting: { ask: false } }), /with\.into naming the request options/);
  const state = { hosting: { ask: false }, setup: {} };
  run('hosting.apply', state, { into: 'setup' });
  assert.deepEqual(state.setup, {}, 'an unasked question changes no option');
});
