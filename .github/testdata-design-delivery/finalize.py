"""One-shot exact-source delivery for PR #5; never updates Git refs."""
import base64
import hashlib
import json
import lzma
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

BASE = 'e413ec628b4227c4b8dc8b6ec3d12b8487533557'
TREE = 'f45cc11a63dcb2032410485b5d27230571d6df87'
DIGEST = '2b1a33e02e82bcb8571d1fa9ea5b35af564ed44199374720ad5ba85c33965f77'
ROOT = Path.cwd()
TEMP = Path(os.environ['RUNNER_TEMP'])
HERE = ROOT / '.github/testdata-design-delivery'
ALLOWED = set('''.fallowrc.json
.github/workflows/companion-concept-verification.yml
.gitignore
docs/concepts/companion/DESIGN-SYSTEM.md
docs/concepts/companion/README.md
docs/concepts/companion/TEST-DATA-DESIGN-VERIFICATION.md
docs/concepts/companion/TEST-DATA.md
docs/concepts/companion/src/base.html
docs/concepts/companion/src/data-source-actions.js
docs/concepts/companion/src/data-source-model.js
docs/concepts/companion/src/data-source-views.js
docs/concepts/companion/src/design-model.js
docs/concepts/companion/src/design-plan.js
docs/concepts/companion/src/editor-removal.js
docs/concepts/companion/src/interaction-polish.js
docs/concepts/companion/src/style-guide-actions.js
docs/concepts/companion/src/style-guide-export.js
docs/concepts/companion/src/style-guide-model.js
docs/concepts/companion/src/style-guide-views.js
docs/concepts/companion/src/style-guide.css
docs/concepts/companion/src/test-data-actions.js
docs/concepts/companion/src/test-data-export.js
docs/concepts/companion/src/test-data-model.js
docs/concepts/companion/src/test-data-views.js
docs/concepts/companion/src/test-data.css
docs/concepts/companion/src/vault-preparation.js
docs/concepts/companion/src/vault-project.js
docs/concepts/companion/src/vault-workspace.js
docs/concepts/companion/test-kit/adapters.mjs
docs/concepts/companion/test-kit/cli.mjs
docs/concepts/companion/test-kit/client.mjs
docs/concepts/companion/test-kit/engine.mjs
docs/concepts/companion/test-kit/faker-provider.mjs
docs/concepts/companion/test-kit/server.mjs
docs/concepts/companion/test-kit/storage.mjs
docs/product/COMPANION-PLUGIN-PRD.md
scripts/concepts/build-companion.py
scripts/concepts/run-browser-checks.py
tests/concepts/companion-assembly.test.py
tests/concepts/companion-style-guide.browser.py
tests/concepts/companion-test-data.browser.py
tests/tooling/companion-boundaries.checks.mjs
tests/tooling/test-data-client.checks.mjs
tests/tooling/test-data-engine.checks.mjs
tests/tooling/test-data-fixture.mjs
tests/tooling/test-data-server.checks.mjs
tests/tooling/test-data-storage.checks.mjs'''.splitlines())


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
    encoded = ''.join((HERE / f'part-{i}.txt').read_text() for i in range(7))
    assert len(encoded) == 87072
    raw = lzma.decompress(base64.b64decode(encoded, validate=True), memlimit=256 * 1024 * 1024)
    assert len(raw) == 242916 and hashlib.sha256(raw).hexdigest() == DIGEST
    m = json.loads(raw)
    assert m['schema'] == 1 and m['parent'] == BASE and m['tree'] == TREE
    assert len(m['files']) == len(ALLOWED) == 47
    assert {f['path'] for f in m['files']} == ALLOWED
    assert m['output'] == {'path': 'docs/concepts/companion/index.html', 'bytes': 1481550, 'sha256': '3ec17ce8523657cb8db2c13e1c03e8e849ac43bb51a8de3f3afeba363b0e3910'}
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
    subprocess.run(['python3', '-B', 'tests/concepts/companion-assembly.test.py'], check=True)
    sources = sorted((ROOT / 'docs/concepts/companion/src').glob('*.js'))
    kit = sorted((ROOT / 'docs/concepts/companion/test-kit').glob('*.mjs'))
    assert len(sources) == 74 and len(kit) == 7
    for path in sources + kit:
        subprocess.run(['node', '--check', str(path)], check=True)
    tests = sorted((ROOT / 'tests/tooling').glob('test-data-*.checks.mjs'))
    assert len(tests) == 4
    subprocess.run(['node', '--test', *map(str, tests)], check=True)
    subprocess.run(['git', 'diff', '--check'], check=True)
    (TEMP / 'testdata-design-verified.json').write_text(json.dumps({'head': head, 'manifest': DIGEST}))
elif sys.argv[1] == 'publish':
    assert json.loads((TEMP / 'testdata-design-verified.json').read_text()) == {'head': head, 'manifest': DIGEST}

    def post(resource, value):
        assert resource in ('blobs', 'trees', 'commits')
        request = urllib.request.Request(
            'https://api.github.com/repos/Luis85/obsidian-plugin-shell/git/' + resource,
            data=json.dumps(value).encode(), method='POST',
            headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json',
                     'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json',
                     'User-Agent': 'exact-testdata-design-delivery'})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)

    elements = []
    for f in m['files'] + [m['output']]:
        data = target(f['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == f['sha256'], f['path']
        stored = post('blobs', {'content': data.decode('utf-8'), 'encoding': 'utf-8'})
        assert stored['sha'] == blob(data)
        elements.append({'path': f['path'], 'mode': '100644', 'type': 'blob', 'sha': stored['sha']})
    tree = post('trees', {'base_tree': TREE, 'tree': elements})
    commit = post('commits', {'message': m['message'], 'tree': tree['sha'], 'parents': [head]})
    receipt = {'commit': commit['sha'], 'tree': tree['sha'], 'parent': head, 'original_parent': BASE,
               'manifest_sha256': DIGEST, 'html': m['output'], 'files': elements, 'ref_updated': False}
    (TEMP / 'testdata-design-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('Created verified candidate ' + commit['sha'] + '; no Git ref updated.')
else:
    raise ValueError('Expected apply or publish')
