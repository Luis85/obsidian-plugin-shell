"""Reproduce already tested Git trees; publish only an isolated transport ref."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path.cwd()
BASE = 'e14831f09b73f9a99610ea911a854f419c1bb52c'
SPECS = {
    28: ('da5dcb04931b96d906cd4bad1476eadc3c4fe996', '47a20b243533960c424934e5d6e56e1c188e07d4', '94ad035b8d46698585b5289785f58cfccef6c680'),
    30: ('6bf7c4ccedcd031b8c1ea7fbac9940ce946af504', 'b221fbcc8c1ab4b00a8ff902b09ec4d60e0f002c', '967c95508714597942e219c7af2909c40d25516c'),
    31: ('025073de389a68a394957bbbdfea164741708c4e', 'd64f2748276efcbc420231c7a41aa4e3de00989f', '43ca519d9649dceffc52b7ad593537df98166024'),
}

def git(folder, *args):
    return subprocess.check_output(['git', '-C', str(folder), '-c', 'core.hooksPath=/dev/null', *args], text=True).strip()

def edit(folder, name, before, after):
    path = folder / name
    text = path.read_text()
    assert text.count(before) == 1, name
    path.write_text(text.replace(before, after))

def reconcile28(folder):
    path = folder / 'scripts/companion/compiler/project-files.ts'
    text = path.read_text()
    text, count = re.subn(r'<<<<<<< HEAD\nimport \{ clickdummyCode \}.*?>>>>>>> ' + BASE + r'\n',
        "import { clickdummyCode } from './clickdummy-code.ts';\nimport { nativeCode } from './native-code.ts';\n", text, flags=re.S)
    assert count == 1
    text, count = re.subn(r'<<<<<<< HEAD\n(  dataCode.*?)\n=======\n.*?>>>>>>> ' + BASE,
        lambda m: m[1].replace('uiCode(m,add); hostCode', 'uiCode(m,add); nativeCode(m,add); hostCode'), text, flags=re.S)
    assert count == 1 and '<<<<<<<' not in text
    path.write_text(text)
    edit(folder, '.fallowrc.json', '          "scripts/companion/project-contract.mjs",',
         '          "scripts/companion/project-contract.mjs",\n          "scripts/companion/native-contract.mjs",')
    edit(folder, 'tests/tooling/companion-authoring-boundaries.checks.mjs',
         "files=['scripts/companion/authoring-contract.ts'", "files=['scripts/companion/native-contract.mjs','scripts/companion/authoring-contract.ts'")
    edit(folder, 'tests/tooling/companion-authoring-boundaries.checks.mjs', 'const rules=config.boundaries.rules;',
         "const rules=config.boundaries.rules;\n assert.ok(config.boundaries.zones.find(z=>z.name==='companion-authoring-contract').patterns.includes('scripts/companion/native-contract.mjs'));")

def reconcile31(folder, fixture):
    name = 'scripts/companion/compiler/project-files.ts'
    (folder / name).write_text(git(folder, 'show', SPECS[31][1] + ':' + name) + '\n')
    edit(folder, 'scripts/compiler/adapters/plugin-emitter.ts', 'import { httpCode }',
         "import { nativeCode } from '../../companion/compiler/native-code.ts';\nimport { httpCode }")
    edit(folder, 'scripts/compiler/adapters/plugin-emitter.ts', "await emit('host',",
         "await emit('native', () => nativeCode(m,add));\n  await emit('host',")
    path = folder / 'scripts/framework/catalog.ts'
    text, count = re.subn(r'<<<<<<< HEAD\n.*?=======\n(.*?)>>>>>>> ' + BASE,
        lambda m: m[1].rstrip().replace("values('input', 'vault', 'target')", "values('input', 'vault', 'target', 'output-kind')"), path.read_text(), flags=re.S)
    assert count == 1 and '<<<<<<<' not in text
    path.write_text(text)
    (folder / 'tests/fixtures/compiler/native-base-code.json').write_bytes(fixture)
    name = 'tests/tooling/compiler-compatibility.checks.mjs'
    edit(folder, name, "'tests/fixtures/compiler/legacy-code.json'", "'tests/fixtures/compiler/native-base-code.json'")
    edit(folder, name, 'retains pre-refactor emitted product bytes: ', 'matches independently captured native-capable PR5 product bytes: ')
    edit(folder, name, "const source=await readFile(join(root,expected.source),'utf8');const result=",
         "const source=await readFile(join(root,expected.source),'utf8');assert.equal(digest(source),expected.inputSha256,'pinned baseline input bytes');const result=")
    edit(folder, 'docs/development/compiler/TESTING.md', 'All nine starters and the Companion self-project must preserve those selected bytes.',
         'This original pre-native baseline remains unchanged as historical evidence. After PR34 was merged into PR5, generated bootstrap now registers native capabilities and emits a native registry even for an empty declaration. The executable equivalence gate therefore uses `native-base-code.json`, captured independently from the **unextracted PR5 generator**, commit `e14831f09b73f9a99610ea911a854f419c1bb52c`, tree `0e9808e8aeec459207acc193af63441ee62513cb`. It covers all eleven starters plus the complete Companion self-project, pins each exact input SHA-256, and compares the count and full digest of the same selected product paths. No output from the dedicated compiler under test was used to create these expectations. The native registry and changed bootstrap remain inside the comparison; they are not filtered out to make the gate pass.')

fixture_path = Path(os.environ.get('CI_REPAIR_FIXTURE', '.ci-repair/reconcile/native-base-code.json')).resolve()
assert git(ROOT, 'hash-object', str(fixture_path)) == 'b483d723f70494bb28436dd6248dfd9ecd7f1f81'
fixture = fixture_path.read_bytes()
results = []
with tempfile.TemporaryDirectory(prefix='ci-reconcile-') as temporary:
    for number, (old, repair, expected_tree) in SPECS.items():
        folder = Path(temporary) / str(number)
        start = old if number == 28 else repair
        git(ROOT, 'worktree', 'add', '--detach', str(folder), start)
        try:
            if number == 28:
                git(folder, 'merge', '--no-ff', '--no-edit', repair)
            merged = subprocess.run(['git', '-C', str(folder), '-c', 'core.hooksPath=/dev/null', 'merge', '--no-commit', '--no-ff', BASE], check=False)
            assert merged.returncode in (0, 1)
            conflicts = git(folder, 'diff', '--name-only', '--diff-filter=U').splitlines()
            assert conflicts == ({28: ['scripts/companion/compiler/project-files.ts'], 30: [], 31: ['scripts/companion/compiler/project-files.ts', 'scripts/framework/catalog.ts']}[number])
            if number == 28:
                reconcile28(folder)
            if number == 31:
                reconcile31(folder, fixture)
                git(folder, 'add', 'tests/fixtures/compiler/native-base-code.json')
            git(folder, 'add', '-u')
            git(folder, 'diff', '--cached', '--check')
            tree = git(folder, 'write-tree')
            assert tree == expected_tree, (number, tree, expected_tree)
            parents = [old, repair, BASE] if number == 28 else [repair, BASE]
            args = ['commit-tree', tree, '-m', f'fix(ci): reconcile PR{number} with merged native and Jev capabilities']
            for parent in parents:
                args.extend(['-p', parent])
            sha = git(ROOT, *args)
            git(ROOT, 'merge-base', '--is-ancestor', old, sha)
            git(ROOT, 'merge-base', '--is-ancestor', BASE, sha)
            assert not any(p.startswith('.ci-repair/') for p in git(ROOT, 'ls-tree', '-r', '--name-only', sha).splitlines())
            results.append({'pr': number, 'sha': sha, 'tree': tree, 'old': old})
        finally:
            git(ROOT, 'worktree', 'remove', '--force', str(folder))
args = ['commit-tree', git(ROOT, 'rev-parse', BASE + '^{tree}'), '-m', 'Transport for exact verified reconciled repair trees']
for result in results:
    args.extend(['-p', result['sha']])
carrier = git(ROOT, *args)
report = {'carrier': carrier, 'base': BASE, 'results': results}
if os.environ.get('CI_REPAIR_PUBLISH') == 'yes':
    target = 'refs/heads/chore/ci-repair-reconciled-20260927'
    assert not git(ROOT, 'ls-remote', '--heads', 'origin', target), 'Transport ref already exists'
    git(ROOT, 'push', 'origin', carrier + ':' + target)
output = Path(os.environ.get('RUNNER_TEMP', '/mnt/data')) / 'ci-reconciled.json'
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
