"""One-shot exact Data Sources delivery; creates Git objects, never branch refs."""
import base64
import hashlib
import json
import lzma
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

REPO = 'Luis85/obsidian-plugin-shell'
PARENT = '3e697660f4328ac6e32d4029418ff149ca01a0cd'
TREE = 'dc11271de1e6c1b06e291f84d478ca83e7eeac1c'
DIGEST = '36001fe0cbd25a9faebf9952b5abca763634c5c00276212d07a174ae938215b8'
ROOT = Path.cwd()
TEMP = Path(os.environ['RUNNER_TEMP'])
TRANSPORT = ROOT / '.github/data-source-delivery'
ALLOWED = set('''docs/concepts/companion/DATA-SOURCES-VERIFICATION.md
docs/concepts/companion/DATA-SOURCES.md
docs/concepts/companion/src/data-source-actions.js
docs/concepts/companion/src/data-source-flow.js
docs/concepts/companion/src/data-source-generation.js
docs/concepts/companion/src/data-source-model.js
docs/concepts/companion/src/data-source-views.js
docs/concepts/companion/src/data-source.css
tests/concepts/companion-data-sources.browser.py
.fallowrc.json
docs/concepts/companion/README.md
docs/concepts/companion/src/canvas-actions.js
docs/concepts/companion/src/canvas-model.js
docs/concepts/companion/src/design-actions.js
docs/concepts/companion/src/design-dialogs.js
docs/concepts/companion/src/design-model.js
docs/concepts/companion/src/design-plan.js
docs/concepts/companion/src/flow-edge.js
docs/concepts/companion/src/flow-model.js
docs/concepts/companion/src/flow-runtime.js
docs/concepts/companion/src/flow-views.js
docs/concepts/companion/src/interaction-polish.js
docs/concepts/companion/src/product-plan.js
docs/concepts/companion/src/reference-model.js
docs/concepts/companion/src/reference-views.js
docs/concepts/companion/src/semantic-actions.js
docs/concepts/companion/src/spatial-model.js
docs/concepts/companion/src/spatial-runtime.js
docs/concepts/companion/src/workflow-views.js
docs/product/COMPANION-PLUGIN-PRD.md
scripts/concepts/build-companion.py
scripts/concepts/run-browser-checks.py
tests/tooling/companion-boundaries.checks.mjs'''.splitlines())


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def regular(path):
    assert path.resolve().is_relative_to(ROOT.resolve())
    for part in [path, *path.parents]:
        assert not part.is_symlink(), str(path)
        if part == ROOT:
            break


assert os.environ['GITHUB_REPOSITORY'] == REPO
assert os.environ['GITHUB_REF'] == 'refs/heads/docs/companion-plugin-prd'
assert git('rev-parse', 'HEAD') == os.environ['GITHUB_SHA']
assert git('rev-parse', 'HEAD^') == PARENT
assert git('rev-parse', 'HEAD^:') == TREE
encoded = ''.join((TRANSPORT / str(i)).read_text(encoding='utf-8') for i in range(7))
raw = lzma.decompress(base64.b64decode(encoded, validate=True))
assert hashlib.sha256(raw).hexdigest() == DIGEST
manifest = json.loads(raw)
assert manifest['schema'] == 1 and manifest['parent'] == PARENT and manifest['base_tree'] == TREE
assert len(manifest['files']) == len(ALLOWED) and {item['path'] for item in manifest['files']} == ALLOWED
assert manifest['output'] == {'path': 'docs/concepts/companion/index.html', 'sha256': 'a7848e4599ee2a216843686b20cf4b9618702193ca53c63a206d524cd4613da1'}

if sys.argv[1] == 'apply':
    assert not git('status', '--porcelain')
    for item in manifest['files']:
        path = ROOT / item['path']
        regular(path)
        if item['before'] is None:
            assert not path.exists(), item['path']
            data = item['content'].encode('utf-8')
        else:
            original = path.read_bytes()
            assert blob(original) == item['before'], item['path']
            text = original.decode('utf-8')
            end_limit = len(text)
            for start, end, replacement in reversed(item['edits']):
                assert 0 <= start <= end <= end_limit, item['path']
                text = text[:start] + replacement + text[end:]
                end_limit = start
            data = text.encode('utf-8')
        assert blob(data) == item['after'], item['path']
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    subprocess.run(['python3', '-B', 'scripts/concepts/build-companion.py'], check=True)
    output = (ROOT / manifest['output']['path']).read_bytes()
    assert len(output) == 1308354 and hashlib.sha256(output).hexdigest() == manifest['output']['sha256']
    subprocess.run(['python3', '-B', 'tests/concepts/companion-assembly.test.py'], check=True)
    scripts = sorted((ROOT / 'docs/concepts/companion/src').glob('*.js'))
    assert len(scripts) == 64
    for path in scripts:
        subprocess.run(['node', '--check', str(path)], check=True)
    for folder in ['scripts/concepts', 'tests/concepts']:
        for path in (ROOT / folder).rglob('*.py'):
            regular(path)
            compile(path.read_bytes(), str(path), 'exec', dont_inherit=True)
    subprocess.run(['git', 'diff', '--check'], check=True)
    (TEMP / 'data-source-verified.json').write_text(json.dumps({'head': git('rev-parse', 'HEAD'), 'manifest': DIGEST}))
    print('Verified all 34 delivered files, exact HTML, 10 assembly tests and 64 authored JavaScript files.')
elif sys.argv[1] == 'publish':
    verified = json.loads((TEMP / 'data-source-verified.json').read_text())
    assert verified == {'head': git('rev-parse', 'HEAD'), 'manifest': DIGEST}

    def post(resource, value):
        assert resource in ('blobs', 'trees', 'commits')
        request = urllib.request.Request(
            'https://api.github.com/repos/' + REPO + '/git/' + resource,
            data=json.dumps(value).encode('utf-8'), method='POST',
            headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
                     'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
                     'Content-Type': 'application/json', 'User-Agent': 'exact-data-source-delivery'})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)

    entries = []
    for item in manifest['files'] + [manifest['output']]:
        path = ROOT / item['path']
        regular(path)
        data = path.read_bytes()
        if 'after' in item:
            assert blob(data) == item['after'], item['path']
        else:
            assert hashlib.sha256(data).hexdigest() == item['sha256']
        result = post('blobs', {'content': data.decode('utf-8'), 'encoding': 'utf-8'})
        assert result['sha'] == blob(data)
        original = git('ls-tree', PARENT, '--', item['path'])
        mode = original.split(' ', 1)[0] if original else '100644'
        assert mode in ('100644', '100755')
        entries.append({'path': item['path'], 'mode': mode, 'type': 'blob', 'sha': result['sha']})
    tree = post('trees', {'base_tree': TREE, 'tree': entries})
    candidate = post('commits', {'message': manifest['message'], 'tree': tree['sha'], 'parents': [verified['head']]})
    receipt = {'commit': candidate['sha'], 'tree': tree['sha'], 'parent': verified['head'],
               'baseline': PARENT, 'manifest_sha256': DIGEST, 'output': manifest['output'],
               'files': entries, 'ref_updated': False}
    (TEMP / 'data-source-delivery-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('Created verified candidate ' + candidate['sha'] + '; no branch reference updated.')
else:
    raise ValueError('Expected apply or publish')
