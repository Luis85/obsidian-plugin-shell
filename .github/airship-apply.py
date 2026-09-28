"""One-shot, hash-bound transport of locally tested integration edits. Removed after delivery."""
import hashlib
import json
import os
from pathlib import Path
import subprocess


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


assert os.environ['GITHUB_REPOSITORY'] == 'Luis85/obsidian-plugin-shell'
assert os.environ['GITHUB_REF'] == 'refs/heads/feat/generated-project-airship'
assert git('rev-parse', 'HEAD') == os.environ['GITHUB_SHA'], 'Branch advanced; do not overwrite concurrent work'
assert not git('status', '--porcelain'), 'Checkout is not clean'
edits = json.loads(Path('.github/airship-line-edits.json').read_text())
hashes = json.loads(Path('.github/airship-file-hashes.json').read_text())
prepared = {}
for name, operation in edits.items():
    path = Path(name)
    assert not path.is_absolute() and '..' not in path.parts and not name.startswith('.github/')
    before = path.read_bytes()
    assert hashlib.sha256(before).hexdigest() == operation['sha256'], name + ' precondition'
    lines = before.decode('utf-8').splitlines(keepends=True)
    for start, end, replacement in reversed(operation['changes']):
        assert 0 <= start <= end <= len(lines)
        lines[start:end] = [replacement]
    after = ''.join(lines).encode('utf-8')
    assert hashlib.sha256(after).hexdigest() == hashes[name], name + ' target'
    prepared[name] = after
for name, digest in hashes.items():
    data = prepared.get(name, Path(name).read_bytes())
    assert hashlib.sha256(data).hexdigest() == digest, name + ' delivery mismatch'
for name, data in prepared.items():
    Path(name).write_bytes(data)
git('add', '--', *prepared)
assert set(git('diff', '--cached', '--name-only').splitlines()) == set(prepared)
git('diff', '--cached', '--check')
git('config', 'user.name', 'github-actions[bot]')
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
git('commit', '-m', 'feat(airship): wire validated opt-in through compiler and shared CLI')
git('push', 'origin', 'HEAD:refs/heads/feat/generated-project-airship')
print('Published exact hash-verified implementation:', git('rev-parse', 'HEAD'))
