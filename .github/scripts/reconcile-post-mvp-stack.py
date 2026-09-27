"""One-time, pinned reconciliation helper. Copied outside the checkout before use."""
import os
from pathlib import Path
import re
import subprocess
import sys

BASE = '931db74da3576d20b862583395cb0a1b9a4412e5'
HEADS = {'memory': '54b008c961e2a8a07792e0a0a124d58055765d06', 'compiler': '34f2366c4b7534ed717b11a5856ff2a6e7823029'}

def git(*args, check=True):
    return subprocess.run(['git', *args], check=check, text=True, capture_output=True)

def change(path, before, after):
    file = Path(path)
    text = file.read_text()
    if text.count(before) != 1:
        raise RuntimeError(f'Expected one exact replacement in {path}: {before!r}')
    file.write_text(text.replace(before, after))

def resolve_hunks(path, resolver, expected):
    file = Path(path)
    pattern = re.compile(r'^<<<<<<<[^\n]*\n(.*?)^=======\n(.*?)^>>>>>>>[^\n]*\n', re.M | re.S)
    text, count = pattern.subn(lambda match: resolver(match.group(1), match.group(2)), file.read_text())
    if count != expected or '<<<<<<<' in text or '>>>>>>>' in text:
        raise RuntimeError(f'Unexpected conflict shape in {path}: {count}')
    file.write_text(text)

kind = sys.argv[1]
head = HEADS[kind]
git('checkout', '--detach', head)
merged = git('merge', '--no-commit', '--no-ff', BASE, check=False)
print(merged.stdout, merged.stderr)
conflicts = set(git('diff', '--name-only', '--diff-filter=U').stdout.splitlines())
if kind == 'memory':
    if merged.returncode or conflicts:
        raise RuntimeError('Memory merge must be conflict-free')
    sys.exit(0)
expected = {'scripts/companion/compiler/plan.ts', 'scripts/companion/compiler/project-files.ts',
            'scripts/companion/devkit/README.md.tmpl', 'scripts/companion/read-project.mjs',
            'scripts/framework/help-text.ts', 'scripts/framework/operations.ts'}
if merged.returncode != 1 or conflicts != expected:
    raise RuntimeError(f'Conflict inventory changed: {sorted(conflicts)}')
# Retain the compiler's extracted facades. The parent's new behavior is applied
# to the actual adapters below, not discarded with a wholesale ours/theirs merge.
git('checkout', '--ours', 'scripts/companion/compiler/plan.ts', 'scripts/companion/compiler/project-files.ts')
resolve_hunks('scripts/companion/devkit/README.md.tmpl', lambda ours, theirs: theirs, 2)
resolve_hunks('scripts/framework/operations.ts', lambda ours, theirs: ours + theirs, 1)
resolve_hunks('scripts/framework/help-text.ts',
              lambda ours, theirs: theirs + ''.join(line for line in ours.splitlines(True) if "id: 'compiler'" in line), 1)
def reader_hunk(ours, theirs):
    if 'async function readBoundedJson' in ours:
        return 'async function readBoundedJson(input, parse = parseCompanionDocument) {\n'
    if 'const document = parse' in ours:
        return '    const document = parse ? parse(text) : undefined;\n'
    raise RuntimeError('Unknown reader conflict')
resolve_hunks('scripts/companion/read-project.mjs', reader_hunk, 2)
change('scripts/compiler/adapters/frontend.ts',
       "import { migrateCompanionDocument } from '../../companion/project-contract.mjs';",
       "import { authoringReader } from '../../companion/authoring-contract.ts';\nimport { SitemapError } from '../../companion/sitemap/safety.ts';")
change('scripts/compiler/adapters/frontend.ts', '()=>migrateCompanionDocument(value)', '()=>authoringReader.migrate(value)')
change('scripts/compiler/adapters/frontend.ts',
       "error instanceof Error && /^(?:COMPANION_INVALID|GENERATOR_INVALID|VISUAL_INVALID|DESIGN_SYSTEM_INVALID|COMPOSITION_INVALID|STORYMAP_INVALID|DETAIL_INVALID):/.test(error.message)",
       "error instanceof Error && (error instanceof SitemapError || /^(?:COMPANION_INVALID|GENERATOR_INVALID|VISUAL_INVALID|DESIGN_SYSTEM_INVALID|COMPOSITION_INVALID|STORYMAP_INVALID|DETAIL_INVALID):/.test(error.message))")
change('scripts/companion/sitemap/safety.ts', 'class SitemapError extends Error {', 'export class SitemapError extends Error {')
change('scripts/compiler/adapters/template-snapshot.ts', "'tsconfig.generator.json','tsconfig.framework.json'];",
       "'tsconfig.generator.json','tsconfig.framework.json','tsconfig.sitemap.json','tsconfig.authoring.json'];")
change('scripts/compiler/adapters/plugin-emitter.ts',
       "import { nativeCode } from '../../companion/compiler/native-code.ts';",
       "import { nativeCode } from '../../companion/compiler/native-code.ts';\nimport { clickdummyCode } from '../../companion/compiler/clickdummy-code.ts';")
change('scripts/compiler/adapters/plugin-emitter.ts', "  pkg.scripts['doctor'] = 'node shell.mjs doctor';",
       "  pkg.scripts['build:clickdummy'] = 'node shell.mjs clickdummy build';\n  pkg.scripts['doctor'] = 'node shell.mjs doctor';")
change('scripts/compiler/adapters/plugin-emitter.ts', "m.testRoot+'/**/*.ts',makerTests+'/**/*.ts'",
       "m.testRoot+'/**/*.ts','harness/prototype/**/*.ts',makerTests+'/**/*.ts'")
change('scripts/compiler/adapters/plugin-emitter.ts', "  await emit('http', () => httpCode(templateRoot,m,add));",
       "  await emit('http', () => httpCode(templateRoot,m,add));\n  await emit('clickdummy', () => clickdummyCode(m,add));")
change('scripts/compiler/adapters/plugin-emitter.ts', 'import { maintainerOnly, relocateFrameworkDocuments }', 'import { relocateFrameworkDocuments }')
Path('scripts/compiler/adapters/clickdummy-emitter.ts').write_text('''import type { Artifact, TemplateSnapshot } from '../domain/contracts.ts';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import { json, type Model } from '../../companion/compiler/model.ts';

/** The target packages the shared v6 browser composition; it never substitutes another renderer. */
export function clickdummyFiles(model: Model, template: TemplateSnapshot, files: Artifact[]): Artifact[] {
  const worker = '.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs';
  if (!template.skillFiles.some(file => file.path === worker)) {
    throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'lower', 'Click-dummy output requires the bundled prototype builder.'));
  }
  if (!files.some(file => file.path === 'harness/prototype/clickdummy.ts')) {
    throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'emit', 'The shared browser composition is missing.'));
  }
  const add = (path: string, content: string): Artifact => ({ path, content, ownership: 'managed', producer: 'clickdummy' });
  const pkgFile = files.find(file => file.path === 'package.json')!;
  const pkg = JSON.parse(pkgFile.content);
  pkg.scripts['build:clickdummy'] = 'node scripts/compiler/build-clickdummy.mjs';
  pkg.scripts['typecheck:clickdummy'] = 'vue-tsc --noEmit --project tsconfig.clickdummy.json';
  return [...files.filter(file => file.path !== 'package.json'), { ...pkgFile, content: json(pkg) },
    add('tsconfig.clickdummy.json', json({ extends: './tsconfig.project.json', include: [
      'harness/prototype/**/*.ts', model.sourceRoot + '/**/*.ts', model.sourceRoot + '/**/*.vue',
    ] })),
    // Preserve the compiler entry path while delegating all behavior to the parent's composition.
    add('harness/prototype/main.ts', `import './clickdummy.ts';
import { nextTick } from 'vue';
void nextTick(() => {
  if (document.querySelector('.clickdummy-preview')) document.documentElement.dataset.prototypeReady = 'true';
});
window.addEventListener('pagehide', () => { delete document.documentElement.dataset.prototypeReady; }, { once: true });
`),
    add('CLICKDUMMY.md', `# Click-dummy output

This target uses the same generated Vue pages, services, navigation and browser composition as the plugin project. Synthetic read adapters return independent schema-valid values; business writes and missing handlers fail explicitly. Preview states, surface navigation, dialogs, reset and complete project JSON export are retained. No Obsidian host or vault is opened.

Review dependency readiness in design/compiler-readiness.json. Install explicitly, then run npm run typecheck:clickdummy and npm run build:clickdummy. The shipped offline builder embeds the libraries and blocks external requests. Existing output is preserved; use node scripts/compiler/build-clickdummy.mjs --replace for a deliberate replacement.

Bundling is not browser or business acceptance. External component adapters remain explicit implementation points.
`),
  ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
''')
change('tests/tooling/compiler-targets.checks.mjs',
       'assert.ok(!entry.includes("from \'obsidian\'"));assert.match(entry,/preview never writes business data/);',
       '''assert.ok(!entry.includes("from 'obsidian'"));assert.match(entry,/import '\\.\\/clickdummy\\.ts'/);
  const shared = browser.artifacts.find(file => file.path === 'harness/prototype/clickdummy.ts');
  assert.equal(shared.content, plugin.artifacts.find(file => file.path === shared.path).content);
  const sources = browser.artifacts.find(file => file.path.endsWith('/bootstrap/clickdummy-sources.ts'));
  assert.match(sources.content, /throw new Error\\('NOT_IMPLEMENTED: Clickdummy has no business-write adapter\\.'/);
  assert.match(shared.content, /createClickdummySources/);assert.match(shared.content, /exportProject/);
  assert.match(shared.content, /designState/);assert.match(shared.content, /function reset/);''')
with Path('tests/tooling/compiler-targets.checks.mjs').open('a') as file:
    file.write('''

test('v6 authoring routes survive compiler analysis, emission and both output targets', async () => {
  const { migrateAuthoringDocument } = await import('../../scripts/companion/authoring-contract.ts');
  const document = migrateAuthoringDocument(JSON.parse(source)).document;
  const surface = document.design.nodes.find(node => !['group','action','modal'].includes(node.kind));
  document.design.sitemap = { schema: 1, routes: [{ id: 'compiler-route', surface: surface.id, path: '/capture/:recordId' }], journeys: [] };
  const text = JSON.stringify(document);
  for (const outputKind of ['plugin', 'clickdummy']) {
    const result = await compileProject({ source: text, template, outputKind });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.deepEqual(result.model.document, document);
    assert.deepEqual(JSON.parse(result.artifacts.find(file => file.path === 'design/project.json').content), document);
    assert.match(result.artifacts.find(file => file.path === 'harness/prototype/clickdummy.ts').content, /capture\\/:recordId/);
    assert.ok(result.artifacts.some(file => file.path === 'tsconfig.sitemap.json'));
    assert.ok(result.artifacts.some(file => file.path === 'tsconfig.authoring.json'));
  }
  assert.equal(JSON.stringify(document), text);
});
test('typed authoring validation failures are schema diagnostics, never internal compiler defects', async () => {
  const { migrateAuthoringDocument } = await import('../../scripts/companion/authoring-contract.ts');
  for (const mutate of [
    document => { document.schemaVersion = document.design.schema = 7; },
    document => { document.design.sitemap = { schema: 1, routes: [{ id: 'bad', surface: 'absent', path: '/bad' }], journeys: [] }; },
  ]) {
    const document = migrateAuthoringDocument(JSON.parse(source)).document; mutate(document);
    const result = await compileProject({ source: JSON.stringify(document), template });
    assert.equal(result.status, 'failed'); assert.deepEqual(result.artifacts, []);
    assert.ok(result.diagnostics.some(item => item.code === 'COMPILER_SCHEMA_INVALID'), JSON.stringify(result.diagnostics));
    assert.ok(result.diagnostics.every(item => item.code !== 'COMPILER_INTERNAL_ERROR'));
  }
});
''')
change('tests/tooling/compiler-compatibility.checks.mjs', 'tests/fixtures/compiler/native-base-code.json', 'tests/fixtures/compiler/post-mvp-base-code.json')
change('tests/tooling/compiler-compatibility.checks.mjs', 'matches independently captured native-capable PR5 product bytes: ', 'matches independently captured post-MVP PR5 product bytes: ')
change('tests/tooling/compiler-compatibility.checks.mjs', "file.path.startsWith(model.testRoot+'/')||", "file.path.startsWith(model.testRoot+'/')||file.path.startsWith('harness/prototype/')||")
# The baseline is produced by the unchanged parent generator in a separate worktree,
# not by the refactored implementation under test. Historical fixtures remain untouched.
base_root = Path(os.environ['RUNNER_TEMP']) / 'post-mvp-parent'
git('worktree', 'add', '--detach', str(base_root), BASE)
try:
    (base_root / 'node_modules').symlink_to(Path.cwd() / 'node_modules', target_is_directory=True)
    generator = r'''
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const base = process.argv[2], target = process.argv[3];
const { projectFiles } = await import(pathToFileURL(resolve(base,'scripts/companion/compiler/project-files.ts')).href);
const { projectModel } = await import(pathToFileURL(resolve(base,'scripts/companion/compiler/model.ts')).href);
const { authoringReader } = await import(pathToFileURL(resolve(base,'scripts/companion/authoring-contract.ts')).href);
const historical = JSON.parse(await readFile('tests/fixtures/compiler/native-base-code.json','utf8'));
const digest = value => createHash('sha256').update(value).digest('hex');
const cases = [];
for (const item of historical.cases) {
  const source = await readFile(resolve(base,item.source),'utf8');
  const model = projectModel(authoringReader.migrate(JSON.parse(source)).document);
  const files = await projectFiles(base,model);
  const selected = files.filter(file => file.path.startsWith(model.sourceRoot+'/') || file.path.startsWith(model.testRoot+'/') || file.path.startsWith('harness/prototype/') || ['src/main.ts','src/bootstrap/features.ts','design/project.json','design/traceability.json'].includes(file.path));
  cases.push({source:item.source,inputSha256:digest(source),files:selected.length,sha256:digest(JSON.stringify(selected.map(file=>[file.path,digest(file.content)])))});
}
await writeFile(target,JSON.stringify({schemaVersion:1,sourceCommit:process.env.BASE_SHA,scope:'Independent unchanged parent generator; product sources/tests, browser composition, native composition, canonical JSON and traceability',cases},null,2)+'\n');
console.log(JSON.stringify({status:'captured-independent-parent',sourceCommit:process.env.BASE_SHA,cases:cases.length}));
'''
    subprocess.run(['node', '--input-type=module', '-', str(base_root), str(Path.cwd() / 'tests/fixtures/compiler/post-mvp-base-code.json')],
                   input=generator, text=True, check=True, env={**os.environ, 'BASE_SHA': BASE})
finally:
    git('worktree', 'remove', '--force', str(base_root))
Path('docs/development/compiler/POST-MVP-INTEGRATION.md').write_text('''# Compiler integration after PR28

The compiler remains the single parse/migrate/validate/resolve/lower/emit pipeline. Its input adapter now uses the shared authoring reader: v6 routes and journeys remain intact, while v1–v5 input retains the existing normalization and loss report. Typed authoring errors become schema diagnostics, not internal compiler defects.

The parent browser composition is emitted by the pure plugin adapter for both output targets. The compiler clickdummy entry is only a compatibility alias; it does not replace the preview, synthetic services, dialogs, reset, visual states or JSON export. Authoring and sitemap TypeScript configurations remain in generated workspaces.

`tests/fixtures/compiler/post-mvp-base-code.json` is independently captured by executing the untouched parent generator at `931db74da3576d20b862583395cb0a1b9a4412e5` in a separate worktree. Product source/test bytes and browser composition are compared with the refactored compiler. Earlier fixtures remain historical references, not silently overwritten expectations. The focused target tests additionally cover v6 routes, invalid typed authoring data and identical shared browser code.

Generation remains distinct from build, browser/native acceptance and release authorization. Current hosted checks, not this document, determine qualification of the final commit.
''')
git('add', '--update')
git('add', 'tests/fixtures/compiler/post-mvp-base-code.json', 'docs/development/compiler/POST-MVP-INTEGRATION.md')
if git('diff', '--name-only', '--diff-filter=U').stdout.strip():
    raise RuntimeError('Unresolved conflict remains')
git('diff', '--check', '--cached')
print('Explicit post-MVP reconciliation prepared; qualification and publication are separate.')
