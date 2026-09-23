"""Apply the user's hash-reviewed concept patch; never perform template setup."""
import gzip
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path.cwd().resolve()
TRANSFER = ROOT / '.concept-transfer'
manifest = json.loads((TRANSFER / 'manifest.json').read_text())
expected = set(manifest['paths'])
allowed = ('docs/concepts/companion/', 'scripts/concepts/', 'tests/concepts/')
assert expected and all(path.startswith(allowed) and '..' not in Path(path).parts for path in expected)

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode().strip()

def digest(data):
    return hashlib.sha256(data).hexdigest()

# A staging commit may add only the transport and this one-shot workflow.
assert git('rev-parse', 'HEAD^') == manifest['baseline'], 'Baseline advanced'
compressed = b''.join((TRANSFER / f'part-{i:02d}').read_bytes() for i in range(16))
assert len(compressed) == 34237 and digest(compressed) == manifest['gzip_sha256'], 'Transport integrity mismatch'
patch = gzip.decompress(compressed)
assert len(patch) == manifest['patch_bytes'] and digest(patch) == manifest['patch_sha256'], 'Patch integrity mismatch'
text = patch.decode('utf-8')
entries = []
for section in text.split('diff --git ')[1:]:
    lines = section.splitlines()
    match = re.fullmatch(r'a/(\S+) b/(\S+)', lines[0])
    assert match and match[1] == match[2] and match[1] in expected, 'Unapproved path'
    path = match[1]
    index = next((re.fullmatch(r'index ([0-9a-f]{40})\.\.([0-9a-f]{40})(?: 100644)?', line) for line in lines if line.startswith('index ')), None)
    assert index, 'Missing full object identity'
    assert not any(line.startswith(('deleted file mode', 'old mode', 'new mode', 'rename from', 'rename to')) for line in lines)
    assert f'+++ b/{path}' in lines, 'Unexpected destination'
    assert index[2] != '0' * 40, 'Unexpected deletion'
    file = ROOT / path
    assert file.resolve().is_relative_to(ROOT) and not file.is_symlink(), 'Unsafe destination'
    for parent in file.parents:
        if parent == ROOT:
            break
        assert not parent.is_symlink(), 'Linked parent'
    if index[1] == '0' * 40:
        assert not file.exists(), 'New file already exists'
    else:
        assert file.is_file() and git('hash-object', path) == index[1], f'Changed preimage: {path}'
    entries.append((path, index[2]))
assert len(entries) == len(expected) and {p for p, _ in entries} == expected, 'Incomplete or duplicate paths'
patch_file = TRANSFER / 'reviewed.patch'
patch_file.write_bytes(patch)
subprocess.run(['git', 'apply', '--unidiff-zero', '--check', '--index', str(patch_file)], cwd=ROOT, check=True)
subprocess.run(['git', 'apply', '--unidiff-zero', '--index', str(patch_file)], cwd=ROOT, check=True)
for path, sha in entries:
    assert git('hash-object', path) == sha, f'Changed output: {path}'
subprocess.run(['python3', 'scripts/concepts/build-companion.py'], cwd=ROOT, check=True)
html = (ROOT / 'docs/concepts/companion/index.html').read_bytes()
assert len(html) == 1112611 and digest(html) == manifest['html_sha256'], 'HTML differs from tested artifact'
subprocess.run(['git', 'add', 'docs/concepts/companion/index.html'], cwd=ROOT, check=True)
print(json.dumps({'status': 'passed', 'files': len(entries), 'html_bytes': len(html), 'html_sha256': digest(html), 'scope': 'Exact source and HTML reconstruction; browser evidence was executed separately'}))
