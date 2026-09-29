"""Verify the immutable handoff or reconstruct its historical alternative outside this checkout."""
import sys
# Checks and plans must not leave __pycache__ beside archived sources.
sys.dont_write_bytecode = True
import argparse
import json
from pathlib import Path
from handoff_core import (BASELINE, BASELINE_TREE, MANIFEST_SHA256, SOURCE_TREE, HandoffError,
                          compose, require, tree_oid, verify_source)
from handoff_git import load_baseline, repository
from handoff_output import destination, materialize

HERE = Path(__file__).resolve().parent


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise HandoffError('HANDOFF_ARGUMENT_INVALID', message[:300], 'Run restore.py --help for supported options.')


def report(snapshot) -> dict:
    return {'schemaVersion': 1, 'status': 'verified', 'baselineCommit': BASELINE,
            'baselineTree': BASELINE_TREE, 'sourceTree': SOURCE_TREE, 'manifestSha256': MANIFEST_SHA256,
            'sourceFiles': len(snapshot.files), 'historicalDeletions': 1,
            'sourceBytes': sum(len(file.data) for file in snapshot.files.values()),
            'nativeAcceptance': 'not-run', 'implementation': 'archived-alternative'}


def execute(argv=None) -> tuple[dict, bool]:
    parser = Parser(description=__doc__, allow_abbrev=False)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--check', action='store_true', help='Verify exact source bytes without Git or writes (default)')
    group.add_argument('--out', type=Path, help='Reconstruct into a NEW directory outside the checkout; requires local Git history')
    parser.add_argument('--plan', action='store_true', help='With --out, validate complete reconstruction without creating the destination')
    parser.add_argument('--json', action='store_true', help='Emit exactly one machine-readable result or error object')
    args = parser.parse_args(argv)
    require(not args.plan or args.out is not None, 'HANDOFF_ARGUMENT_INVALID', '--plan requires --out.')
    snapshot = verify_source(HERE)
    result = report(snapshot)
    if args.out is not None:
        repo = repository(HERE)
        output = destination(args.out, repo)
        files = compose(load_baseline(repo), snapshot)
        result.update(status='planned', output=str(output), reconstructedFiles=len(files),
                      reconstructedBytes=sum(len(file.data) for file in files.values()), reconstructedTree=tree_oid(files))
        if not args.plan:
            # Recheck the destination after baseline loading; do not use it as an overwrite target.
            output = destination(output, repo)
            portable = {key: value for key, value in result.items() if key != 'output'}
            result = {**materialize(output, files, portable), 'output': str(output)}
    return result, args.json


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    try:
        result, machine = execute(argv)
    except (HandoffError, OSError, ValueError, KeyError, TypeError, KeyboardInterrupt) as error:
        failure = error if isinstance(error, HandoffError) else HandoffError(
            'HANDOFF_CANCELLED' if isinstance(error, KeyboardInterrupt) else 'HANDOFF_REJECTED',
            'Operation cancelled.' if isinstance(error, KeyboardInterrupt) else 'A required file, directory or source record could not be read.',
            'Check the handoff files, output parent and local filesystem permissions.')
        result = {'schemaVersion': 1, 'status': 'rejected', 'error': {'code': failure.code,
                  'message': str(failure), 'hint': failure.hint}}
        if failure.partial_output is not None:
            result.update(status='incomplete', partialOutput=failure.partial_output)
        if '--json' in argv:
            print(json.dumps(result, sort_keys=True))
        else:
            print(f'{failure.code}: {failure}', file=sys.stderr)
            if failure.hint:
                print(failure.hint, file=sys.stderr)
            if failure.partial_output:
                print('Partial output retained: ' + failure.partial_output, file=sys.stderr)
        return 130 if failure.code == 'HANDOFF_CANCELLED' else 1
    if machine:
        print(json.dumps(result, sort_keys=True))
    else:
        print(f"Verified {result['sourceFiles']} source files and one historical deletion.")
        if result['status'] in ('planned', 'restored'):
            print(f"{result['status'].capitalize()}: {result['output']} ({result['reconstructedFiles']} files)")
            print('Reconstructed tree: ' + result['reconstructedTree'])
        print('No dependencies installed, Git refs modified, or plugin activated.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
