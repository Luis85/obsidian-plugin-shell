import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { main } from '../../bin/adapters/framework-cli.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
function capture(isTTY = false) {
  let text = '';
  // A real stream: interactive prompts attach readline listeners to the error channel.
  const stream = new PassThrough();
  stream.isTTY = isTTY; stream.on('data', chunk => { text += String(chunk); });
  return { stream, read: () => text };
}
/** Runs the composition root in process; `answers` feed a TTY session line by line. */
async function run(argv, { answers, stdin } = {}) {
  const output = capture(Boolean(answers)), error = capture(Boolean(answers));
  let input;
  if (answers) {
    // Each prompt opens its own readline, so answer one prompt at a time; running out ends the input (a cancel).
    input = new PassThrough(); input.isTTY = true;
    const pending = [...answers];
    error.stream.on('data', chunk => {
      if (!/(?:: |\] )$/.test(String(chunk))) return;
      setImmediate(() => pending.length ? input.write(pending.shift() + '\n') : input.end());
    });
  } else input = Readable.from(stdin === undefined ? [] : [stdin]);
  const code = await main(argv, frameworkRoot, { input, output: output.stream, error: error.stream, env: { CI: 'true', NO_COLOR: '1' } });
  return { code, stdout: output.read(), stderr: error.read() };
}
async function withRoot(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-cli-')));
  try { await check(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('generation shares the canonical help, argument validation and result protocol', async () => {
  const help = await run(['generate', '--help']);
  assert.equal(help.code, 0); assert.match(help.stdout, /generate/);
  assert.doesNotMatch(help.stdout, /--vault|--target/);
  for (const option of ['target', 'vault']) {
    const result = await run(['generate', '--' + option, 'out', '--json']);
    assert.equal(result.code, 1); assert.equal(result.stderr, '');
    const response = JSON.parse(result.stdout);
    assert.equal(response.protocolVersion, 1);
    assert.equal(response.status, 'failed');
    assert.equal(response.diagnostics[0].code, 'INVALID_OPTION');
    assert.match(response.diagnostics[0].message, new RegExp('--' + option));
  }
});

test('human output renders results and exit codes follow the result status', async () => {
  const version = await run(['version']);
  assert.equal(version.code, 0); assert.match(version.stdout, /^version: ok/); assert.ok(!version.stdout.trim().startsWith('{'));
  const unknown = await run(['unknown-command']);
  assert.equal(unknown.code, 1); assert.match(unknown.stderr, /UNKNOWN_COMMAND/);
  await withRoot(async root => {
    const blocked = await run(['release', 'check', '--root', root, '--json']);
    assert.equal(blocked.code, 1); assert.equal(JSON.parse(blocked.stdout).status, 'blocked');
  });
});

test('stdin input, starter listing and --from paths resolve without touching the project', async () => {
  const project = await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8');
  const inspected = await run(['project', 'inspect', '--input', '-', '--json'], { stdin: project });
  assert.equal(inspected.code, 0, inspected.stderr); assert.equal(JSON.parse(inspected.stdout).command, 'project inspect');
  const listed = await run(['new', '--list', '--json']);
  assert.equal(listed.code, 0, listed.stderr); assert.ok(Array.isArray(JSON.parse(listed.stdout).data.starters));
  await withRoot(async root => {
    const conflict = await run(['new', join(root, 'out'), '--from', 'export.json', '--starter', 'blank', '--json']);
    assert.equal(conflict.code, 1); assert.equal(JSON.parse(conflict.stdout).diagnostics[0].code, 'SOURCE_CONFLICT');
  });
});

test('a support report that cannot be collected degrades to the unavailable report', async () => {
  const report = await run(['support', 'report', '--root', join(tmpdir(), 'no-such-project-root'), '--json']);
  const value = JSON.parse(report.stdout);
  assert.equal(value.command, 'support report'); assert.equal(value.diagnostics[0].code, 'SUPPORT_UNAVAILABLE'); assert.equal(report.code, 1);
});

test('interactive sessions run reads directly and cancel unapproved plans', async () => {
  const version = await run(['version'], { answers: [] });
  assert.equal(version.code, 0); assert.match(version.stdout, /version: ok/);
  await withRoot(async root => {
    await writeFile(join(root, 'project.json'), await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8'));
    const dry = await run(['setup', '--input', 'project.json', '--root', root, '--dry-run', '--no-airship', '--no-mcp'], { answers: [] });
    assert.equal(dry.code, 0, dry.stderr); assert.match(dry.stdout, /setup: planned/);
    const declined = await run(['setup', '--input', 'project.json', '--root', root, '--no-airship', '--no-mcp'], { answers: ['n'] });
    assert.equal(declined.code, 130, declined.stdout + declined.stderr);
    const created = await run(['new', join(root, 'made'), '--starter', 'blank', '--id', 'made-app', '--name', 'Made', '--author', 'Team', '--no-airship'], { answers: ['', '', '', '', 'n'] });
    assert.equal(created.code, 130, created.stdout + created.stderr);
  });
});
