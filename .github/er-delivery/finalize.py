"""One-shot exact-source delivery. Creates objects; never moves refs or publishes releases."""
import ast
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

REPO = 'Luis85/obsidian-plugin-shell'
PARENT = 'cf516b0062f7a44d2b31f27e95fefbf15fd73d3f'
TREE = 'd8e99db3168fcd5482e723c2c961df67ecd422de'
MANIFEST = '9268098a393769ad16f1b2f5d59c61bd499af173fd18a2d90a97d00458ea122f'
ROOT = Path.cwd()
SCRATCH = Path(os.environ['RUNNER_TEMP']) / 'er-delivery'
PREFIX = 'docs/concepts/companion/'
ALLOWED = {PREFIX + p for p in ['ER-EDITOR-REVIEW.md', 'ER-EDITOR-VERIFICATION.md', 'README.md', 'SEMANTIC-LAYER.md', 'src/semantic-actions.js', 'src/semantic-geometry.js', 'src/semantic-interaction.js', 'src/semantic-model.js', 'src/semantic-runtime.js', 'src/semantic-views.js', 'src/semantic.css']}
ALLOWED.update(['.fallowrc.json', 'scripts/concepts/build-companion.py', 'scripts/concepts/run-browser-checks.py', 'tests/concepts/companion-er-polish.browser.py', 'tests/concepts/companion-semantic.browser.py', 'tests/tooling/companion-boundaries.checks.mjs'])


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def api(resource, value=None):
    assert resource in ('blobs', 'trees', 'commits') or resource.startswith('blobs/')
    request = urllib.request.Request('https://api.github.com/repos/' + REPO + '/git/' + resource, data=json.dumps(value).encode() if value is not None else None, method='POST' if value is not None else 'GET', headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'er-exact-source-delivery'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def verify_file(entry):
    raw = (ROOT / entry['path']).read_bytes()
    assert len(raw) == entry['bytes'] and digest(raw) == entry['sha256'] and blob(raw) == entry['blob'], entry['path']
    return raw


assert os.environ['GITHUB_REPOSITORY'] == REPO
assert os.environ['GITHUB_REF'] == 'refs/heads/docs/companion-plugin-prd'
assert git('rev-parse', 'HEAD') == os.environ['GITHUB_SHA']
assert git('rev-parse', 'HEAD^') == PARENT
assert git('rev-parse', 'HEAD^:') == TREE
raw = (ROOT / '.github/er-delivery/manifest.json').read_bytes()
assert digest(raw) == MANIFEST
manifest = json.loads(raw)
assert manifest['schema'] == 1 and manifest['parent'] == PARENT and manifest['tree'] == TREE
assert len(manifest['files']) == len(ALLOWED) and {f['path'] for f in manifest['files']} == ALLOWED
assert manifest['output']['path'] == PREFIX + 'index.html'
files = manifest['files'] + [manifest['output']]
mode = sys.argv[1]
if mode == 'recover':
    SCRATCH.mkdir(exist_ok=False)
    for sha in sorted({f[k] for f in manifest['files'] for k in ('source_blob', 'base_blob') if k in f}):
        result = api('blobs/' + sha)
        assert result['sha'] == sha and result['encoding'] == 'base64'
        data = base64.b64decode(result['content'])
        assert blob(data) == sha
        (SCRATCH / sha).write_bytes(data)
    print('Recovered eight exact reviewed source blobs, with no branch mutation.')
elif mode == 'apply':
    assert not git('status', '--porcelain')
    assert 'GH_TOKEN' not in os.environ
    for f in manifest['files']:
        target = ROOT / f['path']
        assert not any(p.is_symlink() for p in [target, *target.parents])
        if f['before'] is None:
            assert not target.exists(), f['path']
            data = b''
        else:
            data = target.read_bytes()
            assert digest(data) == f['before'], f['path']
        if 'source_blob' in f:
            data = (SCRATCH / f['source_blob']).read_bytes()
            assert blob(data) == f['source_blob']
        else:
            if 'base_blob' in f:
                data = (SCRATCH / f['base_blob']).read_bytes()
                assert blob(data) == f['base_blob']
            lines = data.decode('utf-8').splitlines(keepends=True)
            for start, end, text in reversed(f['edits']):
                assert 0 <= start <= end <= len(lines)
                lines[start:end] = [text]
            data = ''.join(lines).encode('utf-8')
        assert digest(data) == f['sha256'] and blob(data) == f['blob'] and len(data) == f['bytes'], f['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    subprocess.run(['python3', '-B', 'scripts/concepts/build-companion.py'], check=True)
    for f in files:
        verify_file(f)
    subprocess.run(['python3', '-B', 'tests/concepts/companion-assembly.test.py'], check=True)
    for path in sorted((ROOT / PREFIX / 'src').glob('*.js')):
        subprocess.run(['node', '--check', str(path)], check=True)
    for folder in ('scripts/concepts', 'tests/concepts'):
        for path in sorted((ROOT / folder).glob('*.py')):
            ast.parse(path.read_text(), filename=str(path))
    subprocess.run(['git', 'diff', '--check'], check=True)
    (SCRATCH / 'verified.json').write_text(json.dumps({'head': git('rev-parse', 'HEAD'), 'manifest': MANIFEST}))
elif mode == 'publish':
    assert json.loads((SCRATCH / 'verified.json').read_text()) == {'head': git('rev-parse', 'HEAD'), 'manifest': MANIFEST}
    elements = []
    for f in files:
        data = verify_file(f)
        response = api('blobs', {'content': data.decode('utf-8'), 'encoding': 'utf-8'})
        assert response['sha'] == f['blob']
        elements.append({'path': f['path'], 'mode': '100644', 'type': 'blob', 'sha': response['sha']})
    # Rebuild on the original tree: no temporary delivery files are retained.
    tree = api('trees', {'base_tree': TREE, 'tree': elements})
    commit = api('commits', {'message': 'feat(concept): polish ER routing, alignment and semantic authoring\n\nFix clipped SVG connectors and facing ports; add bounded orthogonal routing, cardinality explanations, guidelines, non-drag alignment, canonical keyboard moves, typed entry aids and complete interaction-state feedback.\n\nRetain research, 18-perspective review, 66 new browser regression assertions and exact assembly inputs. No root runtime, dependency, vendor or production threshold changes.', 'tree': tree['sha'], 'parents': [git('rev-parse', 'HEAD')]})
    receipt = {'commit': commit['sha'], 'tree': tree['sha'], 'parent': git('rev-parse', 'HEAD'), 'baseline': PARENT, 'manifest_sha256': MANIFEST, 'files': files, 'ref_updated': False}
    (SCRATCH / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('Verified candidate commit: ' + commit['sha'] + '. No branch ref updated.')
else:
    raise ValueError('Expected recover, apply or publish')
