"""Pinned, immutable source snapshots shared by verification and reconstruction."""
from dataclasses import dataclass
import hashlib
import os
from pathlib import Path, PurePosixPath
import stat
import json
import re
from types import MappingProxyType
from typing import Mapping

BASELINE = '24bde52e33b2d6e212b71d86e1b1ae045a8153d6'
BASELINE_TREE = 'f80ae6ff598fc20ef7c0d89bd8290d3a903d6dae'
SOURCE_TREE = 'c0f6b4be694d15717ba7688382223b7b7ac175d7'
MANIFEST_SHA256 = '28b292a971f447c68ffa0eea35b809136efd58f8cdbf4176c9870b8f4698aaf6'
MAX_FILE = 16 * 1024 * 1024
MAX_TOTAL = 128 * 1024 * 1024
MAX_FILES = 10000
RECEIPT = '.native-handoff-receipt.json'
INCOMPLETE = '.native-handoff-incomplete'


class HandoffError(Exception):
    """A bounded user/agent diagnostic; raw subprocess output is never reported."""
    def __init__(self, code: str, message: str, hint: str = ''):
        super().__init__(message)
        self.code, self.hint = code, hint
        self.partial_output = None


def require(condition: bool, code: str, message: str, hint: str = '') -> None:
    if not condition:
        raise HandoffError(code, message, hint)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def checked_path(value: str) -> PurePosixPath:
    require(isinstance(value, str) and bool(value), 'HANDOFF_PATH_INVALID', 'Empty or non-text inventory path.')
    require(len(value) <= 1024, 'HANDOFF_PATH_INVALID', 'Inventory path is too long.')
    path = PurePosixPath(value)
    require(not path.is_absolute() and path.as_posix() == value,
            'HANDOFF_PATH_INVALID', 'Inventory paths must be canonical and relative.')
    require(len(path.parts) <= 64, 'HANDOFF_PATH_INVALID', 'Inventory path is too deep.')
    for part in path.parts:
        require(len(part) <= 255, 'HANDOFF_PATH_INVALID', 'Inventory path segment is too long.')
        invalid = part in ('.', '..') or part.lower() == '.git' or part.endswith((' ', '.'))
        invalid |= bool(re.search(r'[\x00-\x1f\x7f<>:"\\|?*]', part))
        invalid |= bool(re.fullmatch(r'(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?', part, re.I))
        require(not invalid, 'HANDOFF_PATH_INVALID', 'Unsafe or nonportable inventory path.')
    require(bool(path.parts), 'HANDOFF_PATH_INVALID', 'Inventory path cannot be the current directory.')
    return path


def identity(info: os.stat_result) -> tuple[int, int]:
    return info.st_dev, info.st_ino


def regular_info(path: Path, *, directory: bool = False) -> os.stat_result:
    info = path.lstat()
    reparse = getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0x400)
    wanted = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    require(wanted and not reparse and not stat.S_ISLNK(info.st_mode),
            'HANDOFF_LINK_OR_TYPE', 'Links, junctions and nonregular source entries are not allowed.')
    if not directory:
        require(info.st_nlink == 1, 'HANDOFF_LINK_OR_TYPE', 'Hard-linked source files are not allowed.')
    return info


def read_regular(path: Path, limit: int = MAX_FILE) -> bytes:
    before = regular_info(path)
    require(before.st_size <= limit, 'HANDOFF_SIZE_LIMIT', 'Source exceeds its supported byte bound.')
    flags = os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0)
    with os.fdopen(os.open(path, flags), 'rb') as source:
        opened = os.fstat(source.fileno())
        require(identity(before) == identity(opened), 'HANDOFF_SOURCE_CHANGED', 'Source changed while it was opened.')
        data = source.read(limit + 1)
        after = os.fstat(source.fileno())
    current = regular_info(path)
    stamps = lambda info: (identity(info), info.st_size, info.st_mtime_ns, info.st_ctime_ns)
    require(stamps(before) == stamps(opened) == stamps(after) == stamps(current),
            'HANDOFF_SOURCE_CHANGED', 'Source changed during verification.')
    require(len(data) <= limit and len(data) == before.st_size,
            'HANDOFF_SIZE_LIMIT', 'Source byte length changed or exceeds its bound.')
    return data


@dataclass(frozen=True)
class File:
    data: bytes
    mode: str = '100644'

    @property
    def oid(self) -> str:
        return git_hash(b'blob', self.data)


def git_hash(kind: bytes, data: bytes) -> str:
    return hashlib.sha1(kind + b' ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()


def checked_files(files: Mapping[str, File]) -> None:
    require(0 < len(files) <= MAX_FILES, 'HANDOFF_SIZE_LIMIT', 'Invalid source file count.')
    require(sum(len(file.data) for file in files.values()) <= MAX_TOTAL,
            'HANDOFF_SIZE_LIMIT', 'Source snapshot exceeds its total byte bound.')
    canonical, leaves = {}, set()
    for name, file in files.items():
        path = checked_path(name)
        require(file.mode in ('100644', '100755') and len(file.data) <= MAX_FILE,
                'HANDOFF_LINK_OR_TYPE', 'Invalid file mode or byte bound.')
        for i in range(1, len(path.parts) + 1):
            part = '/'.join(path.parts[:i])
            previous = canonical.setdefault(part.casefold(), part)
            require(previous == part, 'HANDOFF_PATH_COLLISION', 'Case-colliding source paths.')
        leaves.add(name)
    for name in leaves:
        require(not any(parent.as_posix() in leaves for parent in PurePosixPath(name).parents),
                'HANDOFF_PATH_COLLISION', 'A file collides with a source directory.')


def tree_oid(files: Mapping[str, File]) -> str:
    checked_files(files)
    root = {}
    for name, file in files.items():
        node = root
        parts = PurePosixPath(name).parts
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = file

    def encode(node):
        result = bytearray()
        for name, item in sorted(node.items(), key=lambda pair: (pair[0] + ('/' if isinstance(pair[1], dict) else '')).encode('utf-8')):
            mode, oid = ('40000', encode(item)) if isinstance(item, dict) else (item.mode, item.oid)
            result.extend(mode.encode('ascii') + b' ' + name.encode('utf-8') + b'\0' + bytes.fromhex(oid))
        return git_hash(b'tree', bytes(result))
    return encode(root)


def scan_files(root: Path) -> set[str]:
    """Inspect directories too, so an unused directory link cannot disappear from the inventory."""
    regular_info(root, directory=True)
    found = set()
    for directory, dirs, names in os.walk(root, followlinks=False):
        for name in dirs:
            regular_info(Path(directory) / name, directory=True)
            checked_path((Path(directory) / name).relative_to(root).as_posix())
        for name in names:
            path = Path(directory) / name
            regular_info(path)
            relative = path.relative_to(root).as_posix()
            checked_path(relative)
            found.add(relative)
            require(len(found) <= MAX_FILES, 'HANDOFF_SIZE_LIMIT', 'Too many source entries.')
    return found


@dataclass(frozen=True)
class Snapshot:
    files: Mapping[str, File]
    records: tuple[tuple[str, str], ...]


def verify_source(home: Path) -> Snapshot:
    raw = read_regular(home / 'MANIFEST.json', 64 * 1024)
    require(digest(raw) == MANIFEST_SHA256, 'HANDOFF_MANIFEST_MISMATCH',
            'The reviewed manifest has changed.', 'Restore MANIFEST.json from the PR before retrying.')
    manifest = json.loads(raw)
    records = tuple((row['status'], row['path']) for row in manifest['files'])
    files = {}
    expected = {name for status, name in records if status != 'D'}
    require(scan_files(home / 'source') == expected, 'HANDOFF_INVENTORY_MISMATCH',
            'Missing or extra source files.', 'Restore the exact source directory; do not edit the archived implementation in place.')
    for row in manifest['files']:
        if row['status'] == 'D':
            continue
        name = checked_path(row['path']).as_posix()
        data = read_regular(home / 'source' / name)
        require(len(data) == row['bytes'] and digest(data) == row['sha256'],
                'HANDOFF_SOURCE_MISMATCH', 'Source digest mismatch: ' + name)
        files[name] = File(data)
    require(tree_oid(files) == SOURCE_TREE, 'HANDOFF_SOURCE_MISMATCH', 'Archived source tree differs from its reviewed identity.')
    return Snapshot(MappingProxyType(files), records)


def compose(baseline: Mapping[str, File], overlay: Snapshot) -> Mapping[str, File]:
    files = dict(baseline)
    for status, name in overlay.records:
        require((name in files) == (status in ('M', 'D')), 'HANDOFF_BASELINE_MISMATCH',
                'The baseline does not match the recorded overlay operation: ' + name)
        if status == 'D':
            del files[name]
        else:
            mode = files[name].mode if status == 'M' else '100644'
            files[name] = File(overlay.files[name].data, mode)
    checked_files(files)
    require(not ({RECEIPT, INCOMPLETE} & set(files)), 'HANDOFF_PATH_COLLISION', 'Reconstruction receipt path collision.')
    return MappingProxyType(files)
