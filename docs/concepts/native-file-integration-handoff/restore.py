"""Verify or reconstruct the recovered alternative without modifying this checkout."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import tarfile
import tempfile

BASELINE = '24bde52e33b2d6e212b71d86e1b1ae045a8153d6'
INVENTORY = 'c5585ea87132145a185ff4445b9ab70d157cf927271455d5c86b70c8da9a546e'
HERE = pathlib.Path(__file__).resolve().parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def checked_path(value):
    path = pathlib.PurePosixPath(value)
    if not value or path.is_absolute() or any(p in ('..', '.git') for p in path.parts) or '\\' in value:
        raise ValueError('Unsafe inventory path')
    if path.as_posix() != value:
        raise ValueError('Noncanonical inventory path')
    return path


def verify():
    manifest = json.loads((HERE / 'MANIFEST.json').read_text(encoding='utf-8'))
    if manifest.get('schemaVersion') != 1 or manifest.get('baselineCommit') != BASELINE:
        raise ValueError('Unexpected source manifest')
    records = manifest['files']
    listing = ''.join(f"{r['status']} {r.get('sha256', '-')} {r.get('bytes', 0)} {r['path']}\n"
                      for r in sorted(records, key=lambda item: item['path']))
    if len(records) != 49 or digest(listing.encode()) != INVENTORY:
        raise ValueError('Reviewed inventory mismatch')
    expected = set()
    for record in records:
        relative = checked_path(record['path'])
        source = HERE / 'source' / relative
        if any(parent.is_symlink() for parent in [source, *source.parents]):
            raise ValueError('Source links are not allowed')
        if record['status'] == 'D':
            if source.exists():
                raise ValueError('Deleted source unexpectedly exists')
            continue
        if not source.is_file():
            raise ValueError('Missing source: ' + record['path'])
        data = source.read_bytes()
        if len(data) != record['bytes'] or digest(data) != record['sha256']:
            raise ValueError('Source digest mismatch: ' + record['path'])
        expected.add(record['path'])
    actual = {p.relative_to(HERE / 'source').as_posix() for p in (HERE / 'source').rglob('*') if not p.is_dir()}
    if actual != expected:
        raise ValueError('Unexpected source inventory')
    return records


def restore(destination, records):
    repo = pathlib.Path(subprocess.check_output(['git', '-C', str(HERE), 'rev-parse', '--show-toplevel'], text=True).strip()).resolve()
    subprocess.run(['git', '-C', str(repo), 'cat-file', '-e', BASELINE + '^{commit}'], check=True)
    output = destination.absolute()
    if output.exists() or output.is_symlink():
        raise ValueError('Output must not already exist')
    parent = output.parent.resolve(strict=True)
    output = parent / output.name
    if output == repo or repo in output.parents:
        raise ValueError('Choose a new directory outside this checkout')
    # Reserve only a new directory; retain it on failure for inspection, never remove user files.
    output.mkdir()
    with tempfile.TemporaryFile() as archive:
        subprocess.run(['git', '-C', str(repo), 'archive', '--format=tar', BASELINE], stdout=archive, check=True)
        archive.seek(0)
        with tarfile.open(fileobj=archive) as bundle:
            members = bundle.getmembers()
            for member in members:
                checked_path(member.name.rstrip('/'))
                if not (member.isfile() or member.isdir()):
                    raise ValueError('Historical archive contains a nonregular entry')
            bundle.extractall(output, members=members, filter='data')
    for record in records:
        target = output / checked_path(record['path'])
        if record['status'] == 'D':
            target.unlink(missing_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((HERE / 'source' / record['path']).read_bytes())
    print('Restored historical source into ' + str(output))
    print('No dependencies installed, Git refs modified, or plugin activated.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--check', action='store_true', help='Verify exact source bytes without writing')
    group.add_argument('--out', type=pathlib.Path, help='Restore a new directory outside the checkout (requires full Git history)')
    args = parser.parse_args()
    records = verify()
    print('Verified 48 source files and one historical deletion.')
    if args.out:
        restore(args.out, records)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError, tarfile.TarError) as error:
        print('HANDOFF_REJECTED: ' + str(error), file=sys.stderr)
        sys.exit(1)
