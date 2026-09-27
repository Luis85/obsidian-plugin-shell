#!/usr/bin/env python3
"""Validate delivery structure/hashes and make a deterministic fresh ZIP. No execution."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import zipfile

SKIP = {'.git', 'node_modules', '__pycache__', '.cache', '.vite', '.pytest_cache'}
PROTECTED = {'.obsidian', '.dev-vault', '.test-vault'}
FONTS = {'.woff', '.woff2', '.ttf', '.otf', '.eot'}
SECRET_SUFFIXES = {'.pem', '.key', '.p12', '.pfx'}
REQUIRED = {
    'prototype.html', 'companion.project.json', 'prototype.manifest.json',
    'design-brief.md', 'execution-prompt.md', 'README.md', 'INTEGRATION.md',
    'THIRD-PARTY-NOTICES.md', 'integration-map.json', 'source/package.json',
    'source/package-lock.json', 'tests/prototype.journeys.mjs', 'evidence/verification.json',
}
MAX_FILE = 64_000_000
MAX_TOTAL = 256_000_000

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def safe_path(path: Path) -> Path:
    path = Path(os.path.abspath(path))
    for ancestor in [*reversed(path.parents), path]:
        if ancestor.is_symlink():
            raise ValueError(f'Symlink refused: {ancestor}')
    return path

def portable(name: str) -> bool:
    reserved = re.compile(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', re.I)
    return all(part not in ('', '.', '..') and not re.search(r'[<>:"\\|?*\x00-\x1f]', part)
               and not part.endswith(('.', ' ')) and not reserved.match(part)
               for part in name.split('/'))

def scan(root: Path) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    total = 0
    folded: set[str] = set()
    for directory, dirs, names in os.walk(root, followlinks=False):
        for name in dirs + names:
            entry = Path(directory) / name
            if entry.is_symlink():
                raise ValueError(f'Symlink refused: {entry.relative_to(root)}')
        if any(name in PROTECTED for name in dirs):
            raise ValueError('Personal/test vault directories must be removed before packaging')
        dirs[:] = sorted(name for name in dirs if name not in SKIP)
        for name in sorted(names):
            file = Path(directory) / name
            relative = file.relative_to(root).as_posix()
            if not portable(relative) or relative.casefold() in folded:
                raise ValueError(f'Unsafe or case-colliding path: {relative}')
            folded.add(relative.casefold())
            if name.startswith('.env') or name in {'.npmrc', '.netrc', 'id_rsa', 'id_ed25519', 'credentials.json'}:
                raise ValueError(f'Review/remove credential-bearing file: {relative}')
            if file.suffix.lower() in FONTS | SECRET_SUFFIXES:
                raise ValueError(f'Font/key binaries are not distributable: {relative}')
            metadata = file.stat()
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > MAX_FILE:
                raise ValueError(f'Not a bounded regular file: {relative}')
            data = file.read_bytes()
            if len(data) != metadata.st_size:
                raise ValueError(f'File changed during read: {relative}')
            total += len(data)
            if total > MAX_TOTAL:
                raise ValueError('Package exceeds 256 MB safety bound')
            files[relative] = data
    return files

def validate(files: dict[str, bytes]) -> dict:
    missing = REQUIRED - files.keys()
    if missing:
        raise ValueError(f'Missing required artifacts: {", ".join(sorted(missing))}')
    if 'PACKAGE-INVENTORY.json' in files:
        raise ValueError('Reserved generated receipt PACKAGE-INVENTORY.json already exists')
    manifest = json.loads(files['prototype.manifest.json'])
    if manifest.get('kind') != 'obsidian-prototype-package' or manifest.get('schemaVersion') != 1:
        raise ValueError('Unsupported prototype package manifest')
    if not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', manifest.get('slug', '')) or not portable(manifest['slug']):
        raise ValueError('Invalid manifest slug')
    mode = manifest.get('mode')
    if mode not in {'new-plugin', 'new-feature', 'improvement'}:
        raise ValueError('Invalid prototype mode')
    if manifest.get('status') not in {'verified', 'incomplete'}:
        raise ValueError('Explicit verified/incomplete status required')
    repo = manifest.get('repository', {})
    if repo.get('name') != 'Luis85/obsidian-plugin-shell' or not re.fullmatch(r'[0-9a-f]{40}', repo.get('commit', '')):
        raise ValueError('Actual repository name and commit required')
    for key, expected in [('project', 'companion.project.json'), ('artifact', 'prototype.html')]:
        entry = manifest.get(key, {})
        if entry.get('path') != expected or entry.get('sha256') != digest(files[expected]):
            raise ValueError(f'{key} path/hash mismatch')
    source = manifest.get('source', {})
    if source.get('path') != 'source' or not isinstance(source.get('packageManager'), str) or not source['packageManager'].strip():
        raise ValueError('Source path and packageManager required')
    package = json.loads(files['source/package.json'])
    lock = json.loads(files['source/package-lock.json'])
    if package.get('packageManager') != source['packageManager']:
        raise ValueError('Source and manifest packageManager must match')
    if not isinstance(lock.get('packages'), dict) or '' not in lock['packages']:
        raise ValueError('An actual npm lockfile with root package is required')
    for key in ['dependencies', 'devDependencies', 'optionalDependencies']:
        if package.get(key, {}) != lock['packages'][''].get(key, {}):
            raise ValueError(f'Source package/lock mismatch: {key}')
        for name, version in package.get(key, {}).items():
            if not isinstance(version, str) or re.match(r'^(?:workspace:|file:|link:|/|[A-Za-z]:)', version):
                raise ValueError(f'Nonportable dependency: {name}')
    dependencies = {**package.get('dependencies', {}), **package.get('devDependencies', {})}
    for required in ['vue', 'pinia', '@nuxt/ui', 'typescript']:
        version = dependencies.get(required, '')
        if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?', version):
            raise ValueError(f'Exact required stack dependency missing: {required}')
    if not isinstance(package.get('scripts', {}).get('prototype:build'), str) or not package['scripts']['prototype:build'].strip():
        raise ValueError('Source needs an executable prototype:build script')
    if not any(name.startswith('source/') and name.endswith('.vue') for name in files):
        raise ValueError('Actual Vue SFC sources required')
    if not any(name.startswith('source/') and name.endswith('.ts') for name in files):
        raise ValueError('Actual TypeScript sources required')
    report = json.loads(files['evidence/verification.json'])
    if not isinstance(report.get('checks'), list) or not report['checks']:
        raise ValueError('Nonempty explicit verification check records required')
    statuses = {'passed', 'failed', 'blocked', 'not-run', 'skipped'}
    if any(not isinstance(check, dict) or check.get('status') not in statuses for check in report['checks']):
        raise ValueError('Invalid verification status')
    if manifest['status'] == 'verified' and any(check['status'] != 'passed' for check in report['checks']):
        raise ValueError('Unpassed required checks cannot be called verified')
    if mode != 'new-plugin':
        changes = {'changes/baseline-reference.json', 'changes/change-set.json', 'changes/regression-cases.md'}
        if not changes <= files.keys():
            raise ValueError('Existing feature/improvement requires baseline/change/regression artifacts')
    return manifest

def package(root: Path, output: Path) -> dict:
    root, output = safe_path(root), safe_path(output)
    if not root.is_dir():
        raise ValueError('Root must be an existing directory')
    if output == root or root in output.parents:
        raise ValueError('ZIP must be outside the prototype directory')
    if not output.parent.is_dir():
        raise ValueError('Output parent must exist')
    files = scan(root)
    manifest = validate(files)
    receipt = {'kind': 'prototype-package-inventory', 'schemaVersion': 1,
               'status': 'structure-and-hashes-only-not-execution-proof',
               'files': [{'path': p, 'bytes': len(b), 'sha256': digest(b)} for p, b in sorted(files.items())]}
    files['PACKAGE-INVENTORY.json'] = (json.dumps(receipt, indent=2) + '\n').encode()
    created = False
    try:
        # x mode prevents replacing an existing artifact, even when another process wins a race.
        with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            created = True
            for name, data in sorted(files.items()):
                info = zipfile.ZipInfo(f"{manifest['slug']}/{name}", date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                archive.writestr(info, data)
    except BaseException:
        if created:
            output.unlink(missing_ok=True)
        raise
    return {'file': output.name, 'files': len(files), 'sha256': digest(output.read_bytes()),
            'status': 'packaged-not-execution-proof', 'prototypeStatus': manifest['status']}

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    options = parser.parse_args()
    try:
        print(json.dumps(package(options.root, options.output), indent=2))
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error

if __name__ == '__main__':
    main()
