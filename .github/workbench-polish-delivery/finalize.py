"""Apply a hash-verified PR #5 review packet; create blobs only, never Git refs."""
import base64
import hashlib
import json
import lzma
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

BASE = '6a39dd03947e4f8da40c03dc42f4a8b5e34065b4'
TREE = '07241f1a21865b38dc02300f0b517f3246c67018'
DIGEST = '975ba80a24feadf8530c05b577065ca561a270c538fa167d8084f26e95daaf0a'
ROOT = Path.cwd()
TEMP = Path(os.environ['RUNNER_TEMP'])
HERE = ROOT / '.github/workbench-polish-delivery'
ALLOWED = set('''.fallowrc.json
docs/concepts/companion/README.md
docs/concepts/companion/WORKBENCH-POLISH-REVIEW.md
docs/concepts/companion/src/base.html
docs/concepts/companion/src/data-source-views.js
docs/concepts/companion/src/data-source.css
docs/concepts/companion/src/editor-removal.js
docs/concepts/companion/src/interaction-polish.js
docs/concepts/companion/src/reference.css
docs/concepts/companion/src/semantic-views.js
docs/concepts/companion/src/semantic.css
docs/concepts/companion/src/style-guide-actions.js
docs/concepts/companion/src/style-guide-views.js
docs/concepts/companion/src/style-guide.css
docs/concepts/companion/src/test-data-views.js
docs/concepts/companion/src/test-data.css
docs/concepts/companion/src/ui-fields.js
docs/concepts/companion/src/vault-workspace.js
docs/concepts/companion/src/workbench.css
docs/concepts/companion/src/workflow-actions.js
docs/concepts/companion/src/workflow.css
scripts/concepts/build-companion.py
scripts/concepts/run-browser-checks.py
tests/concepts/companion-consistency.browser.py
tests/tooling/companion-boundaries.checks.mjs'''.splitlines())


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def target(path):
    p = ROOT / path
    assert p.is_relative_to(ROOT)
    assert all(not parent.is_symlink() for parent in [p, *p.parents] if parent.is_relative_to(ROOT))
    return p


def manifest():
    encoded = ''.join((HERE / f'part-{i}.txt').read_text() for i in range(3))
    assert len(encoded) == 37164
    raw = lzma.decompress(base64.b64decode(encoded, validate=True), memlimit=256 * 1024 * 1024)
    assert len(raw) == 96480 and hashlib.sha256(raw).hexdigest() == DIGEST
    m = json.loads(raw)
    assert m['schema'] == 1 and m['parent'] == BASE and m['tree'] == TREE
    assert len(m['files']) == len(ALLOWED) == 25
    assert {f['path'] for f in m['files']} == ALLOWED
    assert m['output']['path'] == 'docs/concepts/companion/index.html'
    assert m['output']['bytes'] == 1490957
    assert m['output']['sha256'] == 'c77e4e45e640b58e0008722f49ff1afe58a3e2cc5f6c371c150130a543f44f0e'
    assert m['output']['after'] == '1bc13d382522f8c840f36e0b8e537f630dd85e2e'
    return m


assert os.environ['GITHUB_REPOSITORY'] == 'Luis85/obsidian-plugin-shell'
assert os.environ['GITHUB_REF'] == 'refs/heads/docs/companion-plugin-prd'
head = git('rev-parse', 'HEAD')
assert head == os.environ['GITHUB_SHA']
assert git('rev-parse', 'HEAD^') == BASE
assert git('rev-parse', 'HEAD^:') == TREE
m = manifest()
if sys.argv[1] == 'apply':
    assert not git('status', '--porcelain')
    for f in m['files']:
        p = target(f['path'])
        if f['before'] is None:
            assert not p.exists()
            data = f['content'].encode('utf-8')
        else:
            original = p.read_bytes()
            assert blob(original) == f['before'], f['path']
            lines = original.decode('utf-8').splitlines(keepends=True)
            last = len(lines)
            for start, end, replacement in reversed(f['edits']):
                assert 0 <= start <= end <= last
                lines[start:end] = [replacement]
                last = start
            data = ''.join(lines).encode('utf-8')
        assert blob(data) == f['after'], f['path']
        assert hashlib.sha256(data).hexdigest() == f['sha256'], f['path']
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
    subprocess.run(['python3', '-B', 'scripts/concepts/build-companion.py'], check=True)
    output = target(m['output']['path']).read_bytes()
    assert len(output) == m['output']['bytes']
    assert hashlib.sha256(output).hexdigest() == m['output']['sha256']
    assert blob(output) == m['output']['after']
    subprocess.run(['python3', '-B', 'tests/concepts/companion-assembly.test.py'], check=True)
    sources = sorted((ROOT / 'docs/concepts/companion/src').glob('*.js'))
    kit = sorted((ROOT / 'docs/concepts/companion/test-kit').glob('*.mjs'))
    assert len(sources) == 75 and len(kit) == 7
    for path in sources + kit:
        subprocess.run(['node', '--check', str(path)], check=True)
    for folder in ['scripts/concepts', 'tests/concepts']:
        for path in (ROOT / folder).rglob('*.py'):
            compile(path.read_bytes(), str(path), 'exec', dont_inherit=True)
    tests = sorted((ROOT / 'tests/tooling').glob('test-data-*.checks.mjs'))
    assert len(tests) == 5
    subprocess.run(['node', '--test', *map(str, tests)], check=True)
    subprocess.run(['git', 'diff', '--check'], check=True)
    (TEMP / 'workbench-polish-verified.json').write_text(json.dumps({'head': head, 'manifest': DIGEST}))
elif sys.argv[1] == 'publish':
    assert json.loads((TEMP / 'workbench-polish-verified.json').read_text()) == {'head': head, 'manifest': DIGEST}

    def post_blob(data):
        request = urllib.request.Request(
            'https://api.github.com/repos/Luis85/obsidian-plugin-shell/git/blobs',
            data=json.dumps({'content': data.decode('utf-8'), 'encoding': 'utf-8'}).encode(), method='POST',
            headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json',
                     'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json',
                     'User-Agent': 'exact-workbench-polish-delivery'})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)

    elements = []
    for f in m['files'] + [m['output']]:
        data = target(f['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == f['sha256'], f['path']
        assert blob(data) == f['after'], f['path']
        stored = post_blob(data)
        assert stored['sha'] == f['after']
        elements.append({'path': f['path'], 'mode': '100644', 'type': 'blob', 'sha': stored['sha']})
    receipt = {'parent': head, 'original_parent': BASE, 'base_tree': TREE, 'manifest_sha256': DIGEST,
               'html': m['output'], 'files': elements, 'ref_updated': False, 'commit_created': False}
    (TEMP / 'workbench-polish-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('Created 26 verified blobs; no Git tree, commit or ref updated.')
else:
    raise ValueError('Expected apply or publish')
