import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { sourceInputs, physicalLines, lineLimit } from '../../scripts/testing/source-inputs.mjs';
import { codeLines } from '../../scripts/testing/code-lines.mjs';
test('[SRC-01] code limits exclude comments and blanks but preserve literal and mixed-line code', () => {
  assert.equal(physicalLines(''), 0); assert.equal(physicalLines('x\n'), 1);
  assert.equal(physicalLines('x\r\n\r\n'), 2);
  assert.equal(physicalLines('// comment\n\nvalue'), 3);
  assert.equal(lineLimit('src/main.ts'), 100);
  assert.equal(lineLimit('harness/style-fixture/fixture.js'), 400);
  assert.equal(lineLimit('tests/a.test.mjs'), 450);
  const cases = [
    ['a.ts', '// comment\n\n/* block\n comment */\nconst n = 1; // inline\n', 1],
    ['a.ts', '/* comment */ const n = 1; /* trailing\n only comment */\nvoid n;', 2],
    ['a.ts', 'const url = "https://host/*path*/";\nconst text = "//literal";\n// comment', 2],
    ['a.ts', String.raw`const r = /[/*]/; // trailing
const escaped = /\/\//; /* trailing */
const n = 8 / 2 / 2; // division
if (n) /[/]/.test('/'); // after control
`, 4],
    ['a.js', 'let x\n/[/*]/.test("a");\nconst y=1;\n', 3],
    ['a.js', 'while (true) {\nbreak\n/[/*]/.test("a");\nconst y=1;\n}\n', 5],
    ['a.js', 'while (true) {\ncontinue\n/[/*]/.test("a");\nconst y=1;\n}\n', 5],
    ['a.ts', 'object.return / 2 /* comment\n only comment */\nvoid 0;', 2],
    ['a.ts', 'const text = `start\n// literal\n/* literal */\n\nend`;\n// outside', 4],
    ['a.ts', 'const text = `value ${\n// interpolation comment\n({ count: 1 }).count /* tail */\n}\nend`;\n', 4],
    ['a.ts', 'const text = `outer ${`inner ${\n/* nested comment */\n1\n}`} end`;\n', 3],
    ['a.ts', '#!/usr/bin/env node\n// comment\nvoid 0;\n', 1],
    ['a.ts', '// comment\u2028void 0;\n// comment\u2029void 1;\n', 2],
    ['a.css', '/* heading\n comment */\n.x {\ncontent: "/* literal */";\nbackground: url(https://host/a);\n}\n', 4],
    ['a.css', '.a { background: url(https://example.com/*); }\n.b { color: red; }\n', 2],
    ['a.css', '.a { background: url(https://example.com/\\)/*); }\n.b { color: red; }\n', 2],
    ['a.html', '<!-- only\n comment -->\n<div title="<!-- literal -->">\nHello // content\n</div>\n', 3],
    ['a.vue', '<!-- wrapper -->\n<template>\n<!-- only comment -->\n<p>{{ "/* literal */" }}</p>\n</template>\n<script setup>\n// ignored\nconst text = `// literal`;\n</script>\n<style>\n/* ignored */\np { color: red; }\n</style>\n', 9],
    ['a.vue', '<template>\n<p>{{\n/* comment in expression */\n"value"\n}}</p>\n</template>\n', 5],
    ['a.vue', '<template>\n<div :title="(\n// JS comment\n\'value\'\n)">Text</div>\n</template>', 5],
    ['a.vue', '<template>\n<div :title="&quot;/*&quot;">\n<span>one</span>\n</div>\n</template>', 5],
    ['a.vue', '<template>\n<div :title="(\n// comment\n&quot;/*&quot;\n)">text</div>\n</template>', 5],
    ['a.vue', '<template>\n<div :title="value // comment">\n<span>one</span>\n</div>\n</template>', 5],
    ['a.vue', '<template>\n<div title="\\">\n<!-- actual comment -->\n<span>one</span>\n</div>\n</template>', 5],
    ['a.vue', '<template>\n<textarea>\n<!-- literal text -->\n</textarea>\n</template>', 5],
    ['a.vue', '<template>\n<div v-pre>{{\n// visible text\n}}</div>\n</template>', 5],
    ['a.vue', '<template>\n<div v-pre><span>{{\n// visible text\n}}</span></div>\n<p>{{\n// expression comment\n1\n}}</p>\n</template>', 8],
    ['a.tsx', 'const x = <div>\n/* user text\nanother line\n</div>;\n', 4],
    ['a.jsx', 'const x = <>\n<div title="/* value */">\n{/* comment\ncomment */}\n// visible text\n<span>{`literal /* */`}</span>\n</div>\n</>;\n// JS comment', 8],
  ];
  for (const [path, text, count] of cases) assert.equal(codeLines(text, path), count, `${path}: ${text}`);
  assert.equal(codeLines('// comment\r\n\r\nvoid 0;\r', 'a.ts'), 1);
});
test('[SRC-02] dependency-free actual source gate enforces exact 100, 400 and 450 code-line limits', async (t) => {
  const project = fileURLToPath(new URL('../../', import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), 'shell-code-limit-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const directories = new Set(['src', 'harness', 'scripts', 'tests', '.github/workflows']);
  const inventory = await sourceInputs(project);
  for (const path of inventory.roots) {
    if (directories.has(path)) await mkdir(join(dir, path), { recursive: true });
    else { await mkdir(dirname(join(dir, path)), { recursive: true }); await writeFile(join(dir, path), '{}'); }
  }
  for (const path of ['scripts/quality/check-source.mjs', 'scripts/testing/source-inputs.mjs', 'scripts/testing/code-lines.mjs', 'scripts/styles/vendor-policy.mjs', 'scripts/shared/hash.mjs']) {
    await mkdir(dirname(join(dir, path)), { recursive: true }); await writeFile(join(dir, path), await readFile(join(project, path)));
  }
  await mkdir(join(dir, 'src/locales')); for (const locale of ['en', 'de']) await writeFile(join(dir, `src/locales/${locale}.json`), '{}');
  const run = () => spawnSync(process.execPath, ['scripts/quality/check-source.mjs'], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  for (const [path, limit] of [['src/main.ts', 100], ['src/example.ts', 400], ['tests/example.mjs', 450]]) {
    const code = 'void 0; /* inline */\n'.repeat(limit); const comments = '// comment only\n\n/* block\ncomment */\n'.repeat(100);
    await writeFile(join(dir, path), code); assert.equal(run().status, 0, path);
    await writeFile(join(dir, path), comments + code); assert.equal(run().status, 0, `${path} with comments`);
    await writeFile(join(dir, path), comments + code + 'void 1;\n'); const failed = run(); assert.equal(failed.status, 1, path); assert.match(failed.stderr, /SOURCE_LINE_LIMIT/);
    await writeFile(join(dir, path), code);
  }
  for (const [path, prefix, suffix] of [['src/asi.js', 'let x\n/[/*]/.test("a");\n', ''], ['src/children.tsx', 'const element = <div>\n/* visible text\n', '</div>;'], ['src/url.css', '.a { background: url(https://example.com/*); }\n', '']]) {
    await writeFile(join(dir, path), prefix + 'meaningful;\n'.repeat(401) + suffix);
    const failed = run(); assert.equal(failed.status, 1, path); assert.match(failed.stderr, /SOURCE_LINE_LIMIT/);
    await writeFile(join(dir, path), 'void 0;');
  }
});
test('[SRC-03] hashing includes new and modified files but not clock or mtime', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shell-source-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'files')); await writeFile(join(dir, 'files/a.css'), 'a {}\n');
  const first = await sourceInputs(dir, ['files']);
  assert.equal(first.files[0].lines, 1); assert.equal(first.files[0].physicalLines, 1);
  assert.equal((await sourceInputs(dir, ['files'])).digest, first.digest);
  await writeFile(join(dir, 'files/b.css'), 'b {}\n');
  const second = await sourceInputs(dir, ['files']); assert.notEqual(second.digest, first.digest);
  await writeFile(join(dir, 'files/a.css'), 'a { color: red; }\n');
  assert.notEqual((await sourceInputs(dir, ['files'])).digest, second.digest);
});
