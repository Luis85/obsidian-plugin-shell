import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { commands } from '../../scripts/framework/catalog.ts';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { groups, goldenPath } from '../../scripts/framework/help-text.ts';
import { suggestions } from '../../scripts/framework/suggest.ts';
import { renderHuman } from '../../scripts/framework/terminal-render.ts';
import { terminalStyle } from '../../scripts/framework/terminal-style.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
/** The real entry point with piped (non-TTY) streams; NO_COLOR is controlled per call. */
function cli(args, env = {}) {
  const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NO_COLOR' && key !== 'FORCE_COLOR'));
  return spawnSync(process.execPath, [join(root, 'shell.mjs'), ...args], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 10_000_000, env: { ...base, ...env } });
}
function machine(args) {
  const output = cli([...args, '--json']);
  assert.equal(output.stdout.trim().split('\n').length, 1, output.stderr);
  return { exit: output.status, result: JSON.parse(output.stdout) };
}
async function scratch(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-guidance-')));
  t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}
const ansi = new RegExp(String.fromCharCode(27) + '\\[');
test('human doctor output is aligned plain text with ASCII markers and an actionable Next line', async t => {
  const dir = await scratch(t);
  for (const env of [{}, { NO_COLOR: '1' }]) {
    const output = cli(['doctor', '--root', dir], env);
    assert.equal(output.status, 0, output.stderr);
    assert.doesNotMatch(output.stdout, /[{}]/); assert.doesNotMatch(output.stdout, ansi);
    assert.match(output.stdout, /^doctor: ok$/m);
    assert.match(output.stdout, /^ {2}Root {10}/m);
    assert.match(output.stdout, /^ {2}\[warn\] CONFIG_MISSING {2}Project has not been configured\.$/m);
    assert.match(output.stdout, /^ {2}\[warn\] DEPENDENCIES_MISSING /m);
    assert.match(output.stdout, /^Next: node shell\.mjs setup$/m);
    assert.equal(output.stderr, '', 'diagnostics are shown once, inline');
  }
  const json = machine(['doctor', '--root', dir]);
  assert.deepEqual(Object.keys(json.result), ['protocolVersion', 'command', 'status', 'data', 'diagnostics']);
  assert.equal(json.result.data.next, 'setup');
});
test('rich markers and colour appear only on a TTY without NO_COLOR or a dumb terminal', () => {
  assert.deepEqual(terminalStyle({ isTTY: true }, {}), { color: true, unicode: true });
  for (const [stream, env] of [[{ isTTY: true }, { NO_COLOR: '1' }], [{ isTTY: true }, { TERM: 'dumb' }], [{ isTTY: false }, {}], [{}, {}]]) {
    assert.deepEqual(terminalStyle(stream, env), { color: false, unicode: false });
  }
  const value = { protocolVersion: 1, command: 'check', status: 'ok', diagnostics: [], data: { scope: 'shell-repository', mode: 'full', steps: [{ id: 'typecheck', command: 'vue-tsc --noEmit', status: 'passed', durationMs: 1500, exitCode: 0 }], summary: { passed: 1, failed: 0, skipped: 0, durationMs: 1500 } } };
  const rich = renderHuman(value, { color: true, unicode: true }).text, plain = renderHuman(value, { color: false, unicode: false }).text;
  assert.match(rich, /✓/); assert.match(rich, ansi);
  assert.match(plain, /^ {2}\[ok\] {3}typecheck {2}vue-tsc --noEmit {2}1\.5s$/m); assert.doesNotMatch(plain, ansi);
});
test('make list and describe render readable tables instead of raw JSON', () => {
  const list = cli(['make', 'list']);
  assert.equal(list.status, 0, list.stderr); assert.doesNotMatch(list.stdout, /[{}]/);
  assert.match(list.stdout, /^ {2}feature +implemented +Compose /m);
  assert.match(list.stdout, /^Describe one: node shell\.mjs make describe <recipe>$/m);
  assert.match(list.stdout, /^Next: node shell\.mjs make feature <name> --dry-run$/m);
  const describe = cli(['make', 'describe', 'entity']);
  assert.equal(describe.status, 0, describe.stderr);
  assert.match(describe.stdout, /^ {2}Options +--entity|^ {2}Options +.*--backend/m);
  assert.match(describe.stdout, /^Next: node shell\.mjs make entity <name> --dry-run$/m);
});
test('mistyped commands suggest the closest catalog entries, including multi-word commands', () => {
  const human = cli(['statu']);
  assert.equal(human.status, 1); assert.equal(human.stdout, 'unknown: failed\n');
  assert.match(human.stderr, /^UNKNOWN_COMMAND: Unknown command: statu\. Did you mean "status"\? Use help\.$/m);
  assert.match(human.stderr, /^Next: node shell\.mjs help status$/m);
  const status = machine(['statu']);
  assert.equal(status.exit, 1); assert.deepEqual(status.result.data.suggestions, ['status']);
  assert.equal(status.result.diagnostics[0].next, 'node shell.mjs help status');
  assert.equal(machine(['plan', 'aply', 'saved.json']).result.data.suggestions[0], 'plan apply');
  assert.deepEqual(machine(['relase', 'check']).result.data.suggestions, ['release check']);
  assert.deepEqual(machine(['chek']).result.data.suggestions, ['check']);
  assert.deepEqual(machine(['xyzzy']).result.data.suggestions, []);
  const ids = commands.map(entry => entry.id);
  assert.deepEqual(suggestions('config', ids), ['config explain', 'config get', 'config set']);
  assert.deepEqual(suggestions('stauts', ids), ['status']);
});
test('mistyped options and maker recipes suggest corrections with exit 1', () => {
  const option = machine(['status', '--jsn']);
  assert.equal(option.exit, 1); assert.equal(option.result.diagnostics[0].code, 'INVALID_OPTION');
  assert.deepEqual(option.result.data.suggestions, ['--json']);
  const scoped = machine(['check', '--fats']);
  assert.deepEqual(scoped.result.data.suggestions, ['--fast']);
  const unsupported = machine(['build', '--profile', 'x']);
  assert.match(unsupported.result.diagnostics[0].message, /--profile is not supported by build\./);
  assert.equal(unsupported.result.diagnostics[0].next, 'node shell.mjs help build');
  const recipe = machine(['make', 'describe', 'fature']);
  assert.equal(recipe.result.diagnostics[0].code, 'MAKER_UNKNOWN'); assert.match(recipe.result.diagnostics[0].message, /Did you mean "feature"\?/);
});
test('help starts with the golden path and --all lists every command by group', () => {
  const short = cli(['help']);
  assert.equal(short.status, 0, short.stderr);
  const order = [...short.stdout.matchAll(/^ {2}\d\. (\S+)/gm)].map(match => match[1]);
  assert.deepEqual(order, ['new', 'install', 'dev', 'test', 'check', 'make']);
  assert.deepEqual(order, goldenPath.map(item => item.command));
  assert.match(short.stdout, /\$ node shell\.mjs new \.\.\/my-plugin --starter blank/);
  assert.ok(!short.stdout.includes(commands.find(entry => entry.id === 'release operate').summary), 'the short tier omits maintainer summaries');
  assert.match(short.stdout, /help --all/);
  const all = cli(['help', '--all']);
  assert.equal(all.status, 0, all.stderr);
  for (const entry of commands) assert.ok(all.stdout.includes(`${entry.id}  `) && all.stdout.includes(entry.summary), entry.id);
  const grouped = groups.flatMap(group => group.commands);
  assert.deepEqual([...grouped].sort(), commands.map(entry => entry.id).sort(), 'every command belongs to exactly one group');
});
test('command help lists options with allowed values, defaults and examples', () => {
  const styles = cli(['help', 'styles', 'export']);
  assert.equal(styles.status, 0, styles.stderr);
  assert.match(styles.stdout, /--format <css\|json\|markdown\|html> +Export format\. \(default: css\)/);
  assert.match(styles.stdout, /^Examples\n {2}node shell\.mjs styles export /m);
  const profile = cli(['test', '--help']);
  assert.match(profile.stdout, /--profile <unit\|project\|browser\|native>/);
  assert.match(profile.stdout, /^Effect: process, /m);
  const check = cli(['help', 'check']);
  assert.match(check.stdout, /--fast +Typecheck plus tests related to changed files/);
  assert.match(check.stdout, /node shell\.mjs check --fast --json/);
});
test('help JSON carries the same tiers and returns isolated copies', async () => {
  const context = { root, frameworkRoot: root };
  const first = await executeOperation({ command: 'help', args: [], options: {} }, context);
  assert.equal(first.data.scope, 'golden-path'); assert.equal(first.data.protocolVersion, 1);
  assert.deepEqual(first.data.goldenPath.map(item => item.command), goldenPath.map(item => item.command));
  const check = first.data.commands.find(entry => entry.id === 'check');
  assert.equal(check.group, 'develop'); assert.ok(check.examples.length >= 1); assert.equal(check.optionHelp.fast.description.length > 0, true);
  check.examples.push('mutated'); check.optionHelp.fast.description = 'mutated'; first.data.goldenPath[0].command = 'mutated';
  const second = await executeOperation({ command: 'help', args: ['check'], options: {} }, context);
  assert.equal(second.data.scope, 'command');
  assert.ok(!second.data.commands[0].examples.includes('mutated')); assert.notEqual(second.data.commands[0].optionHelp.fast.description, 'mutated');
  assert.equal((await executeOperation({ command: 'help', args: [], options: {} }, context)).data.goldenPath[0].command, 'new');
  assert.equal((await executeOperation({ command: 'help', args: [], options: { all: true } }, context)).data.scope, 'all');
  const test = (await executeOperation({ command: 'capabilities', args: [], options: {} }, context)).data.commands.find(entry => entry.id === 'test');
  assert.deepEqual(test.optionHelp.profile.values, ['unit', 'project', 'browser', 'native']);
});
test('plans render per-file status and the exact apply follow-up', async t => {
  const dir = await scratch(t);
  const output = cli(['setup', '--root', dir, '--id', 'field-notes', '--name', 'Field Notes', '--author', 'Example', '--no-interaction']);
  assert.equal(output.status, 0, output.stderr);
  assert.match(output.stdout, /^setup: planned$/m); assert.doesNotMatch(output.stdout, /[{}]/);
  assert.match(output.stdout, /^ {4}create {2}shell\.config\.json$/m);
  assert.match(output.stdout, /^Next: rerun the same command with --apply [a-f0-9]{64} \(or --yes\) to write exactly this plan$/m);
});
test('help for new documents --from as a companion project export, not the kit-upgrade folder', () => {
  const output = cli(['help', 'new'], { NO_COLOR: '1' });
  assert.equal(output.status, 0, output.stderr);
  assert.match(output.stdout, /new <dir> \(--starter <id> \| --from <project\.json>\)/);
  assert.match(output.stdout, /--from <value>\s+Project JSON exported by the companion/);
  assert.doesNotMatch(output.stdout, /replacement kit/);
  const upgrade = cli(['help', 'framework upgrade'], { NO_COLOR: '1' });
  assert.match(upgrade.stdout, /--from <value>\s+Extracted replacement kit folder\./);
});
