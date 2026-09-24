"""One-shot hash-bound review delivery; creates objects, never updates refs."""
import ast
import base64
import hashlib
import json
import os
import subprocess
import sys
import urllib.request
import zlib
from pathlib import Path

PARENT = 'e72c3a6eb56f9fbb107679e41c1094d4900dab21'
TREE = 'bbfc4083e4e7b627704ab9209ea0836e46bce177'
DIGEST = '020061bcf368232cc9a7e533be77568c6e47261efed64a2dff93e1ee269ed722'
ROOT = Path.cwd()
TEMP = Path(os.environ['RUNNER_TEMP'])
TRANSPORT = ROOT / '.github/editors-delivery'
ALLOWED = set('''.fallowrc.json
docs/concepts/companion/EDITORS-REVIEW.md
docs/concepts/companion/EDITORS-VERIFICATION.md
docs/concepts/companion/README.md
docs/concepts/companion/src/base.html
docs/concepts/companion/src/canvas-actions.js
docs/concepts/companion/src/canvas-model.js
docs/concepts/companion/src/canvas-pointer.js
docs/concepts/companion/src/connection-actions.js
docs/concepts/companion/src/connection-menu.js
docs/concepts/companion/src/connection-model.js
docs/concepts/companion/src/connection-views.js
docs/concepts/companion/src/data-source-actions.js
docs/concepts/companion/src/data-source-flow.js
docs/concepts/companion/src/data-source-views.js
docs/concepts/companion/src/data-source.css
docs/concepts/companion/src/design-dialogs.js
docs/concepts/companion/src/editor-removal.js
docs/concepts/companion/src/editor-selection.js
docs/concepts/companion/src/flow-actions.js
docs/concepts/companion/src/flow-model.js
docs/concepts/companion/src/flow-runtime.js
docs/concepts/companion/src/flow-views.js
docs/concepts/companion/src/interaction-polish.js
docs/concepts/companion/src/reference-actions.js
docs/concepts/companion/src/reference-content.js
docs/concepts/companion/src/reference-model.js
docs/concepts/companion/src/reference-views.js
docs/concepts/companion/src/semantic-actions.js
docs/concepts/companion/src/semantic-interaction.js
docs/concepts/companion/src/semantic-views.js
docs/concepts/companion/src/spatial-runtime.js
scripts/concepts/build-companion.py
scripts/concepts/run-browser-checks.py
tests/concepts/companion-data-sources.browser.py
tests/concepts/companion-editors.browser.py
tests/tooling/companion-boundaries.checks.mjs'''.splitlines())

def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()

def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def manifest():
    parts = [(TRANSPORT / str(i)).read_text() for i in range(6)]
    # Correct one known transport-only transcription; the original independently
    # recorded payload hash and every source/output hash must still match.
    wrong = 'pnHgZ3EUplXnJpHgZ3EUplXnJp5IqKcr2xy6NKjm8gwhwybW+vUpAi'
    assert parts[3].count(wrong) == 1
    parts[3] = parts[3].replace(wrong, 'pnHgZ3EUplXnJp5ESpAi')
    raw = zlib.decompress(base64.b64decode(''.join(parts), validate=True))
    assert hashlib.sha256(raw).hexdigest() == DIGEST
    result = json.loads(raw)
    assert result['schema'] == 1 and result['parent'] == PARENT and result['tree'] == TREE
    assert len(result['files']) == len(ALLOWED) and {f['path'] for f in result['files']} == ALLOWED
    assert result['output']['path'] == 'docs/concepts/companion/index.html'
    return result

assert os.environ['GITHUB_REPOSITORY'] == 'Luis85/obsidian-plugin-shell'
assert os.environ['GITHUB_REF'] == 'refs/heads/docs/companion-plugin-prd'
assert git('rev-parse', 'HEAD') == os.environ['GITHUB_SHA']
assert git('rev-parse', 'HEAD^') == PARENT
assert git('rev-parse', 'HEAD^:') == TREE
m = manifest()
files = m['files'] + [m['output']]
if sys.argv[1] == 'apply':
    assert not git('status', '--porcelain')
    for f in m['files']:
        path = ROOT / f['path']
        assert not path.is_symlink()
        if f['before'] is None:
            assert not path.exists()
            data = f['content'].encode()
        else:
            before = path.read_bytes()
            assert blob(before) == f['before'], f['path']
            lines = before.decode().splitlines(keepends=True)
            for start, end, replacement in reversed(f['edits']):
                assert 0 <= start <= end <= len(lines)
                lines[start:end] = [replacement]
            data = ''.join(lines).encode()
        assert blob(data) == f['after'] and hashlib.sha256(data).hexdigest() == f['sha256'], f['path']
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    subprocess.run(['python3', '-B', 'scripts/concepts/build-companion.py'], check=True)
    data = (ROOT / m['output']['path']).read_bytes()
    assert len(data) == m['output']['bytes'] and hashlib.sha256(data).hexdigest() == m['output']['sha256']
    subprocess.run(['python3', '-B', 'tests/concepts/companion-assembly.test.py'], check=True)
    for path in sorted((ROOT / 'docs/concepts/companion/src').glob('*.js')):
        subprocess.run(['node', '--check', str(path)], check=True)
    for folder in ('scripts/concepts', 'tests/concepts'):
        for path in (ROOT / folder).glob('*.py'):
            ast.parse(path.read_text(), filename=str(path))
    subprocess.run(['git', 'diff', '--check'], check=True)
    (TEMP / 'editors-verified.json').write_text(json.dumps({'head': git('rev-parse', 'HEAD'), 'manifest': DIGEST}))
elif sys.argv[1] == 'publish':
    verified = json.loads((TEMP / 'editors-verified.json').read_text())
    assert verified == {'head': git('rev-parse', 'HEAD'), 'manifest': DIGEST}
    def post(resource, payload):
        assert resource in ('blobs', 'trees', 'commits')
        request = urllib.request.Request('https://api.github.com/repos/Luis85/obsidian-plugin-shell/git/' + resource,
            data=json.dumps(payload).encode(), method='POST', headers={
                'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'exact-editor-review-delivery'})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    entries = []
    for f in files:
        data = (ROOT / f['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == f['sha256'] and blob(data) == f['after'], f['path']
        saved = post('blobs', {'encoding': 'utf-8', 'content': data.decode()})
        assert saved['sha'] == f['after']
        entries.append({'path': f['path'], 'mode': '100644', 'type': 'blob', 'sha': saved['sha']})
    tree = post('trees', {'base_tree': TREE, 'tree': entries})
    commit = post('commits', {'message': m['message'], 'tree': tree['sha'], 'parents': [verified['head']]})
    receipt = {'commit': commit['sha'], 'tree': tree['sha'], 'parent': verified['head'], 'baseline': PARENT,
        'manifest_sha256': DIGEST, 'files': entries, 'html': m['output'], 'ref_updated': False}
    (TEMP / 'editors-delivery-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('Verified candidate commit ' + commit['sha'] + '; no branch ref updated.')
else:
    raise ValueError('Expected apply or publish')
