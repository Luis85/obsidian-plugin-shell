const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { prototypeSkillFiles, prototypeSkillRoot, prototypeCodexSkillPath } from '../../bin/adapters/framework/prototype-skill.ts';

// The shipped prototype skill reader (prototype-skill.ts): one integrity-locked package plus one allowlisted adapter.
const windows = process.platform === 'win32';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inventoryName = 'PACKAGE-INVENTORY.json';
const baseFiles = { 'SKILL.md': '# Skill\n', 'scripts/prototype.mjs': 'export {};\n', 'references/guide.md': 'Guide\n' };
const adapterText = '# Codex adapter\n';
const record = (path, text) => ({ path, bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) });
function inventory(files, extra = {}) {
  return { kind: 'agent-skill-package-inventory', schemaVersion: 1, files: Object.entries(files).map(([path, text]) => record(path, text)), ...extra };
}
async function put(root, path, content) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}
/** Writes a skill package; `inventoryValue` replaces the generated inventory, `adapter` writes the Codex entrypoint. */
async function workspace(run, { files = baseFiles, inventoryValue, adapter, skill = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'prototype-skill-'));
  try {
    if (skill) {
      for (const [path, text] of Object.entries(files)) await put(root, `${prototypeSkillRoot}/${path}`, text);
      const value = inventoryValue === undefined ? inventory(files) : inventoryValue;
      if (value !== null) await put(root, `${prototypeSkillRoot}/${inventoryName}`, typeof value === 'string' ? value : JSON.stringify(value));
    }
    if (adapter !== undefined) await put(root, prototypeCodexSkillPath, adapter);
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const rejects = (root, message) => assert.rejects(prototypeSkillFiles(root), { message });
const listed = { entrypoints: [record(prototypeCodexSkillPath, adapterText)] };

test('a kit without the skill ships nothing, but an orphan Codex adapter is refused', async () => {
  await workspace(async root => assert.deepEqual(await prototypeSkillFiles(root), []), { skill: false });
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_INCOMPLETE: Codex adapter without canonical skill'), { skill: false, adapter: adapterText });
});

test('the package is read sorted, without caches, and with its listed adapter', async () => {
  await workspace(async root => {
    await put(root, `${prototypeSkillRoot}/__pycache__/x.pyc`, 'cache');
    const files = await prototypeSkillFiles(root);
    assert.deepEqual(files.map(file => file.path), [`${prototypeSkillRoot}/${inventoryName}`, `${prototypeSkillRoot}/SKILL.md`,
      `${prototypeSkillRoot}/references/guide.md`, `${prototypeSkillRoot}/scripts/prototype.mjs`]);
    assert.equal(files[1].bytes.toString('utf8'), '# Skill\n');
  });
  await workspace(async root => {
    const files = await prototypeSkillFiles(root);
    assert.deepEqual(files[0], { path: prototypeCodexSkillPath, bytes: Buffer.from(adapterText) });
    assert.equal(files.length, 5);
  }, { inventoryValue: inventory(baseFiles, listed), adapter: adapterText });
});

test('the skill folder and its files must be real, safe, bounded text', async () => {
  await workspace(async root => {
    await put(root, '.claude', 'not a folder');
    await rejects(root, 'PROTOTYPE_SKILL_LINK');
  }, { skill: false });
  // Windows cannot create reserved device names or keep a trailing dot, so only the portable names run there.
  for (const name of ['bad name.md', '.hidden', ...(windows ? [] : ['CON.md', 'trailing.'])]) {
    await workspace(root => rejects(root, 'PROTOTYPE_SKILL_PATH: ' + name), { files: { ...baseFiles, [name]: 'x' } });
  }
  await workspace(async root => {
    await symlink(join(root, prototypeSkillRoot, 'references'), join(root, prototypeSkillRoot, 'linked'), windows ? 'junction' : 'dir');
    await rejects(root, 'PROTOTYPE_SKILL_LINK: linked');
  });
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_FILE: font.ttf'), { files: { ...baseFiles, 'font.ttf': 'x' } });
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_LIMIT'), { files: { ...baseFiles, 'big.md': 'x'.repeat(1_000_001) } });
  const many = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`many/${String(index).padStart(3, '0')}.md`, 'x']));
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_LIMIT'), { files: { ...baseFiles, ...many } });
  const heavy = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`heavy/${index}.md`, 'x'.repeat(950_000)]));
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_LIMIT'), { files: { ...baseFiles, ...heavy } });
  await workspace(async root => {
    await writeFile(join(root, prototypeSkillRoot, 'SKILL.md'), Buffer.from([0xff, 0xfe]));
    await assert.rejects(prototypeSkillFiles(root), { code: 'ERR_ENCODING_INVALID_ENCODED_DATA' });
  });
});

test('the inventory must list every file exactly once with matching bytes and hashes', async () => {
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_INVENTORY: missing inventory'), { inventoryValue: null });
  const format = 'PROTOTYPE_SKILL_INVENTORY: count or format';
  for (const value of [[], { ...inventory(baseFiles), kind: 'other' }, { ...inventory(baseFiles), schemaVersion: 2 },
    { ...inventory(baseFiles), files: {} }, { ...inventory(baseFiles), files: inventory(baseFiles).files.slice(1) }]) {
    await workspace(root => rejects(root, format), { inventoryValue: value });
  }
  const files = inventory(baseFiles).files;
  for (const first of ['text', { path: 1 }, { path: 'bad name' }, { path: inventoryName }, { ...files[1], path: 'SCRIPTS/prototype.mjs' }]) {
    const value = { ...inventory(baseFiles), files: [files[1], first, files[2]] };
    await workspace(root => rejects(root, 'PROTOTYPE_SKILL_INVENTORY: path'), { inventoryValue: value });
  }
  for (const [changed, path] of [[{ ...files[0], path: 'missing.md' }, 'missing.md'], [{ ...files[0], bytes: 1 }, 'SKILL.md'],
    [{ ...files[0], sha256: sha('other') }, 'SKILL.md']]) {
    await workspace(root => rejects(root, 'PROTOTYPE_SKILL_INTEGRITY: ' + path), { inventoryValue: { ...inventory(baseFiles), files: [changed, ...files.slice(1)] } });
  }
  for (const omitted of ['SKILL.md', 'scripts/prototype.mjs']) {
    const rest = Object.fromEntries(Object.entries(baseFiles).filter(([path]) => path !== omitted));
    await workspace(root => rejects(root, 'PROTOTYPE_SKILL_INCOMPLETE'), { files: rest });
  }
});

test('the Codex adapter is listed only by an exact one-entry allowlist with matching bytes', async () => {
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_INVENTORY: unlisted Codex entrypoint'), { adapter: adapterText });
  for (const entrypoints of [{}, [], [record('other/SKILL.md', adapterText)], [null], [...listed.entrypoints, ...listed.entrypoints]]) {
    await workspace(root => rejects(root, 'PROTOTYPE_SKILL_INVENTORY: entrypoint allowlist'),
      { inventoryValue: inventory(baseFiles, { entrypoints }), adapter: adapterText });
  }
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_ENTRYPOINT_MISSING: ' + prototypeCodexSkillPath), { inventoryValue: inventory(baseFiles, listed) });
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_INTEGRITY: ' + prototypeCodexSkillPath),
    { inventoryValue: inventory(baseFiles, listed), adapter: adapterText + 'changed' });
  await workspace(root => rejects(root, 'PROTOTYPE_SKILL_LIMIT: ' + prototypeCodexSkillPath),
    { inventoryValue: inventory(baseFiles, listed), adapter: 'x'.repeat(16_001) });
  await workspace(async root => {
    await put(root, '.agents', 'not a folder');
    await rejects(root, 'PROTOTYPE_SKILL_LINK: ' + prototypeCodexSkillPath);
  }, { inventoryValue: inventory(baseFiles, listed) });
  await workspace(async root => {
    await mkdir(join(root, prototypeCodexSkillPath), { recursive: true });
    await rejects(root, 'PROTOTYPE_SKILL_LINK: ' + prototypeCodexSkillPath);
  }, { inventoryValue: inventory(baseFiles, listed) });
  await workspace(async root => {
    await put(root, 'real/SKILL.md', adapterText);
    await mkdir(join(root, '.agents/skills'), { recursive: true });
    await symlink(join(root, 'real'), join(root, '.agents/skills/companion-prototype-design'), windows ? 'junction' : 'dir');
    await rejects(root, 'PROTOTYPE_SKILL_LINK: ' + prototypeCodexSkillPath);
  }, { inventoryValue: inventory(baseFiles, listed) });
  await workspace(async root => {
    await writeFile(join(root, prototypeCodexSkillPath), Buffer.from([0xc3]));
    await assert.rejects(prototypeSkillFiles(root), { code: 'ERR_ENCODING_INVALID_ENCODED_DATA' });
  }, { inventoryValue: inventory(baseFiles, { entrypoints: [record(prototypeCodexSkillPath, 'Ã')] }), adapter: adapterText });
});
