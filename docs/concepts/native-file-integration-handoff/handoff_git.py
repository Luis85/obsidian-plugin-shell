"""Read exact local Git blobs, never attribute-transformed archives or worktree files."""
import os
from pathlib import Path
import subprocess
import tempfile
import re
from types import MappingProxyType
from handoff_core import (BASELINE, BASELINE_TREE, File, HandoffError, MAX_FILES, MAX_FILE,
                          MAX_TOTAL, checked_path, checked_files, git_hash, require, tree_oid)


def git_env() -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith('GIT_')}
    env.update(GIT_NO_REPLACE_OBJECTS='1', GIT_NO_LAZY_FETCH='1', GIT_OPTIONAL_LOCKS='0',
               GIT_TERMINAL_PROMPT='0', GIT_ALLOW_PROTOCOL='', GIT_CONFIG_NOSYSTEM='1',
               GIT_CONFIG_GLOBAL=os.devnull)
    return env


def git(repo: Path, *args: str, input_data: bytes | None = None, limit: int = MAX_TOTAL) -> bytes:
    """Use a bounded-time, noninteractive local process; no shell, network, hooks or filters."""
    try:
        with tempfile.TemporaryFile() as output:
            result = subprocess.run(['git', '--no-replace-objects', '--no-lazy-fetch', '--no-optional-locks',
                                     '-C', str(repo), *args], input=input_data, stdout=output,
                                    stderr=subprocess.PIPE, env=git_env(), timeout=60, check=False)
            require(result.returncode == 0, 'HANDOFF_GIT_UNAVAILABLE',
                    'Required local Git history is unavailable.',
                    'Use Git 2.45+ and a clone containing the recorded baseline and all its blobs. Fetch missing history explicitly; this tool never fetches.')
            require(output.tell() <= limit, 'HANDOFF_SIZE_LIMIT', 'Git output exceeds its supported byte bound.')
            output.seek(0)
            return output.read()
    except FileNotFoundError as error:
        raise HandoffError('HANDOFF_GIT_UNAVAILABLE', 'Git is not installed.', 'Install Git 2.45+ for reconstruction; --check works without Git.') from error
    except subprocess.TimeoutExpired as error:
        raise HandoffError('HANDOFF_GIT_TIMEOUT', 'Local Git exceeded its 60-second limit.', 'Inspect local repository health before retrying.') from error


def repository(home: Path) -> Path:
    root = Path(git(home, 'rev-parse', '--show-toplevel', limit=65536).decode('utf-8').rstrip('\n')).resolve(strict=True)
    require(home.resolve().is_relative_to(root), 'HANDOFF_REPOSITORY_INVALID', 'Handoff is not inside the selected checkout.')
    return root


def entries(raw: bytes) -> list[tuple[str, str, str, int]]:
    rows = raw.split(b'\0')
    require(rows[-1] == b'' and 1 < len(rows) <= MAX_FILES + 1,
            'HANDOFF_GIT_INVALID', 'Invalid Git tree inventory.')
    result, size = [], 0
    for row in rows[:-1]:
        header, name = row.split(b'\t', 1)
        mode, kind, oid, length = header.decode('ascii').split()
        require(mode in ('100644', '100755') and kind == 'blob' and re.fullmatch('[0-9a-f]{40}', oid) is not None,
                'HANDOFF_GIT_INVALID', 'Baseline contains a link, submodule or invalid Git entry.')
        require(length.isdecimal() and int(length) <= MAX_FILE, 'HANDOFF_SIZE_LIMIT', 'Baseline blob is too large.')
        path = checked_path(name.decode('utf-8')).as_posix()
        result.append((path, mode, oid, int(length)))
        size += int(length)
    require(size <= MAX_TOTAL and len({row[0] for row in result}) == len(result),
            'HANDOFF_SIZE_LIMIT', 'Duplicate or excessive baseline inventory.')
    return result


def decode_blobs(raw: bytes, rows: list[tuple[str, str, str, int]]) -> MappingProxyType:
    files, offset = {}, 0
    for name, mode, oid, length in rows:
        end = raw.find(b'\n', offset)
        expected = f'{oid} blob {length}'.encode('ascii')
        require(end >= offset and raw[offset:end] == expected, 'HANDOFF_GIT_INVALID', 'Unexpected baseline object header.')
        offset = end + 1
        data = raw[offset:offset + length]
        require(len(data) == length and raw[offset + length:offset + length + 1] == b'\n'
                and git_hash(b'blob', data) == oid, 'HANDOFF_GIT_INVALID', 'Baseline blob bytes differ from their Git identity.')
        files[name] = File(data, mode)
        offset += length + 1
    require(offset == len(raw), 'HANDOFF_GIT_INVALID', 'Unexpected trailing Git output.')
    checked_files(files)
    return MappingProxyType(files)


def load_baseline(repo: Path, commit: str = BASELINE, expected_tree: str = BASELINE_TREE) -> MappingProxyType:
    require(re.fullmatch('[0-9a-f]{40}', commit) is not None, 'HANDOFF_GIT_INVALID', 'Invalid baseline identity.')
    raw_commit = git(repo, 'cat-file', 'commit', commit, limit=65536)
    require(git_hash(b'commit', raw_commit) == commit and raw_commit.split(b'\n', 1)[0] == b'tree ' + expected_tree.encode('ascii'),
            'HANDOFF_BASELINE_MISMATCH', 'Historical commit or tree identity does not match.')
    rows = entries(git(repo, 'ls-tree', '-r', '-l', '-z', '--full-tree', expected_tree, limit=4 * 1024 * 1024))
    request = ''.join(oid + '\n' for _, _, oid, _ in rows).encode('ascii')
    expected_size = sum(length + len(oid) + len(str(length)) + 8 for _, _, oid, length in rows)
    files = decode_blobs(git(repo, 'cat-file', '--batch', input_data=request, limit=expected_size), rows)
    require(tree_oid(files) == expected_tree, 'HANDOFF_BASELINE_MISMATCH', 'Baseline file inventory is incomplete.')
    return files
