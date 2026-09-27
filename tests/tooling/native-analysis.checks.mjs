import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { archiveCommandFixture } from './archive-command-fixture.mjs';

test('native view callback recognition is heritage-scoped and still rejects unconsumed members', async () => {
  const config = JSON.parse(await readFile('.fallowrc.json', 'utf8'));
  const rule = config.usedClassMembers.find(item => item.extends === 'TextFileView');
  assert.deepEqual(rule.members, ['getIcon', 'getViewData', 'setViewData', 'save', 'disposeNativeView']);
  await archiveCommandFixture(async ({ scratch, command }) => {
    await mkdir(join(scratch, 'src/infrastructure'), { recursive: true });
    await mkdir(join(scratch, 'scripts/quality'), { recursive: true });
    await writeFile(join(scratch, 'package.json'), '{"name":"native-analysis","private":true,"type":"module"}');
    await writeFile(join(scratch, '.fallowrc.json'), JSON.stringify({ ...config, plugins: [],
      entry: ['src/main.ts', 'scripts/quality/check-analyzer.mjs'] }));
    await copyFile('scripts/quality/check-analyzer.mjs', join(scratch, 'scripts/quality/check-analyzer.mjs'));
    await symlink(resolve('node_modules'), join(scratch, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const methods = rule.members.map(name => `${name}() { return 1; }`).join('\n');
    const source = extra => `class TextFileView {}\nexport class View extends TextFileView {\n${methods}\n${extra}\nclear() { return 0; }\n}\n`;
    await writeFile(join(scratch, 'src/infrastructure/view.ts'), source(''));
    await writeFile(join(scratch, 'src/main.ts'), 'import { View } from "./infrastructure/view"; new View().clear();\n');
    const check = () => command(process.execPath, ['scripts/quality/check-analyzer.mjs'], scratch,
      { ...process.env, FALLOW_TELEMETRY_DISABLED: '1' });
    const clean = check();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    await writeFile(join(scratch, 'src/infrastructure/view.ts'), source('unconsumedMember() { return 2; }') +
      'export class Ordinary { getIcon() { return "unused"; } clear() { return 0; } }\n');
    await writeFile(join(scratch, 'src/main.ts'), 'import { View, Ordinary } from "./infrastructure/view"; new View().clear(); new Ordinary().clear();\n');
    const bad = check();
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    const report = JSON.parse(await readFile(join(scratch, 'reports/analyzer/fallow.json'), 'utf8'));
    assert.ok(report.unused_class_members.some(item => item.member_name === 'unconsumedMember'));
    assert.ok(report.unused_class_members.some(item => item.parent_name === 'Ordinary' && item.member_name === 'getIcon'));
  }, { outputRoot: resolve('reports/native-analysis') });
});
