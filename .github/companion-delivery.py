"""One-shot exact delivery of the already reviewed PR #5 package; no ref writes."""
import base64
import bz2
import hashlib
import json
import os
import subprocess
import sys
import urllib.request
import zlib
from pathlib import Path

ORIGINAL = '5d998f5de40e36e59382fa17d019c06879da02c3'
BASE_TREE = '6886ecc5fba7a91a11796f4be58787b0816f31f8'
MANIFEST = '7ee5405e60e3bdd61afe874e2708d22e4986e5982df09bdbb22c5eb3757af4c1'
PACKED = 'bf1a42e235e8ed47cb2cfe85db259372e51466c614bd3e633acb87fbfbbc82b6'
BLOBS = '''9c45b59f75890624d6ff503a42df482f18f476df
cc4d73f47560f52ca16b2c9dc202bf9d94ffdfb6
a22950f38bd21fe79a0d7d47505585cbd2a81321
df15a1ea3609774dd3a6204e9f6498263b8770e9
2165c8426b14302f60cfa416626806bb58942634
31d0d95e47f6c135013e1229e18653151dbf091e
ae74626b9f748bc472f6bf93c718bc5200039d87'''.split()
TAIL = '6303a70ca00068d4d2a4889859842dbe4be5880c'
TEMP = Path(os.environ['RUNNER_TEMP'])
ROOT = Path.cwd()
HELPERS = {'.github/companion-delivery.py', '.github/workflows/companion-delivery.yml'}
API = 'https://api.github.com/repos/Luis85/obsidian-plugin-shell/git/'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def request(resource, value=None):
    allowed = resource in ('blobs', 'trees', 'commits') if value is not None else resource.startswith('blobs/')
    assert allowed
    token = os.environ['GH_WRITE_TOKEN' if value is not None else 'GH_READ_TOKEN']
    req = urllib.request.Request(API + resource,
        data=json.dumps(value).encode() if value is not None else None,
        method='POST' if value is not None else 'GET',
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def read_blob(sha):
    item = request('blobs/' + sha)
    assert item['sha'] == sha and item['encoding'] == 'base64'
    data = base64.b64decode(item['content'])
    assert blob(data) == sha
    return data


def load_manifest():
    raw = (TEMP / 'delivery-manifest.json').read_bytes()
    assert digest(raw) == MANIFEST
    value = json.loads(raw)
    assert value['schema'] == 1 and value['parent'] == ORIGINAL and len(value['files']) == 47
    assert len({file['path'] for file in value['files']}) == 47
    assert value['output']['path'] == 'docs/concepts/companion/index.html'
    for file in value['files']:
        path = Path(file['path'])
        assert not path.is_absolute() and '..' not in path.parts and file['mode'] == '100644'
        assert path.parts[0] in ('.fallowrc.json', 'docs', 'scripts', 'tests')
    return value


assert os.environ['GITHUB_REPOSITORY'] == 'Luis85/obsidian-plugin-shell'
assert os.environ['GITHUB_REF'] == 'refs/heads/docs/companion-plugin-prd'
mode = sys.argv[1]
if mode == 'recover':
    rows = {}
    for sha in BLOBS:
        for line in read_blob(sha).decode().splitlines():
            group, part, crc, encoded = line.split(':', 3)
            group, part = int(group), int(part)
            # Only the original systematic data rows are needed. The unused
            # recovery/parity rows are not part of the reviewed payload.
            if part >= 12:
                continue
            data = base64.b64decode(encoded, validate=True)
            assert len(data) == 256 and f'{zlib.crc32(data):08x}' == crc
            assert (group, part) not in rows
            rows[group, part] = data
    assert set(rows) == {(group, part) for group in range(21) for part in range(12)}
    tail = base64.b64decode(b''.join(read_blob(TAIL).split()), validate=True)
    packed = b''.join(rows[key] for key in sorted(rows)) + tail
    assert len(packed) == 70982 and digest(packed) == PACKED
    raw = bz2.decompress(packed)
    assert len(raw) == 277025 and digest(raw) == MANIFEST
    (TEMP / 'delivery-manifest.json').write_bytes(raw)
    print('Recovered exact reviewed manifest:', MANIFEST)
elif mode == 'apply':
    m = load_manifest()
    assert git('rev-parse', 'HEAD') == os.environ['GITHUB_SHA']
    assert git('rev-parse', ORIGINAL + '^{tree}') == BASE_TREE
    assert set(git('diff', '--name-only', ORIGINAL, 'HEAD').splitlines()) == HELPERS
    assert not git('status', '--porcelain')
    prepared = []
    for file in m['files']:
        path = ROOT / file['path']
        assert path.resolve().is_relative_to(ROOT) and not path.is_symlink()
        if file['before'] is None:
            assert not path.exists(), file['path']
            data = file['content'].encode()
        else:
            before = path.read_bytes()
            assert blob(before) == file['before'], file['path']
            lines = before.decode().splitlines(keepends=True)
            for start, end, replacement in reversed(file['edits']):
                assert 0 <= start <= end <= len(lines)
                lines[start:end] = [replacement]
            data = ''.join(lines).encode()
        assert blob(data) == file['after'] and digest(data) == file['sha256'], file['path']
        prepared.append((path, data))
    for path, data in prepared:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    subprocess.run(['python3', '-B', 'scripts/concepts/build-companion.py'], check=True)
    output = (ROOT / m['output']['path']).read_bytes()
    assert len(output) == m['output']['bytes'] and digest(output) == m['output']['sha256']
    subprocess.run(['python3', '-B', 'tests/concepts/companion-assembly.test.py'], check=True)
    files = sorted((ROOT / 'docs/concepts/companion/src').glob('*.js'))
    assert len(files) == 57
    for path in files:
        subprocess.run(['node', '--check', str(path)], check=True)
    subprocess.run(['git', 'diff', '--check'], check=True)
    (TEMP / 'delivery-verified.json').write_text(json.dumps({'head': git('rev-parse', 'HEAD'), 'manifest': MANIFEST}))
    print('Verified exact 48-file delivery, ten assembly tests and 57 JavaScript inputs.')
elif mode == 'publish':
    m = load_manifest()
    head = git('rev-parse', 'HEAD')
    assert head == os.environ['GITHUB_SHA']
    assert json.loads((TEMP / 'delivery-verified.json').read_text()) == {'head': head, 'manifest': MANIFEST}
    files = m['files'] + [m['output']]
    elements = []
    for file in files:
        data = (ROOT / file['path']).read_bytes()
        assert digest(data) == file['sha256'], file['path']
        result = request('blobs', {'content': data.decode(), 'encoding': 'utf-8'})
        assert result['sha'] == blob(data)
        elements.append({'path': file['path'], 'mode': '100644', 'type': 'blob', 'sha': result['sha']})
    # Base on the unchanged original tree so neither temporary helper survives.
    tree = request('trees', {'base_tree': BASE_TREE, 'tree': elements})
    commit = request('commits', {'message': m['message'], 'tree': tree['sha'], 'parents': [head]})
    receipt = {'commit': commit['sha'], 'tree': tree['sha'], 'parent': head, 'original_parent': ORIGINAL,
               'manifest_sha256': MANIFEST, 'output': m['output'], 'files': elements, 'ref_updated': False}
    (TEMP / 'delivery-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('Verified candidate commit:', commit['sha'], '; branch not updated.')
else:
    raise ValueError('Expected recover, apply or publish')
