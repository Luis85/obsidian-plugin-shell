"""No-overwrite reconstruction; a completion receipt is written only after readback."""
import json
import os
from pathlib import Path
from typing import Mapping
from handoff_core import (File, HandoffError, INCOMPLETE, RECEIPT, checked_path, identity,
                          regular_info, read_regular, require, scan_files, tree_oid)


def destination(value: Path, repo: Path) -> Path:
    requested = value.absolute()
    require(not requested.exists() and not requested.is_symlink(), 'HANDOFF_OUTPUT_EXISTS',
            'Output must not already exist.', 'Choose a new directory; existing files are never replaced.')
    parent = requested.parent.resolve(strict=True)
    regular_info(parent, directory=True)
    output = parent / requested.name
    checked_path(output.name)
    require(not output.is_relative_to(repo.resolve()), 'HANDOFF_OUTPUT_INSIDE_CHECKOUT',
            'Choose a new directory outside this checkout.')
    require(not output.exists() and not output.is_symlink(), 'HANDOFF_OUTPUT_EXISTS', 'Output must not already exist.')
    return output


class Writer:
    """Own only a freshly reserved root; refuse changed roots, links and pre-existing files."""
    def __init__(self, output: Path, parent_identity: tuple[int, int]):
        self.output = output
        self.parent_identity = parent_identity
        self.root_identity = identity(regular_info(output, directory=True))

    def guard(self) -> None:
        require(identity(regular_info(self.output.parent, directory=True)) == self.parent_identity
                and identity(regular_info(self.output, directory=True)) == self.root_identity,
                'HANDOFF_OUTPUT_CHANGED', 'The reconstruction directory changed; writes stopped.')

    def write(self, name: str, file: File) -> None:
        self.guard()
        path = self.output / checked_path(name)
        folder = self.output
        for part in path.relative_to(self.output).parts[:-1]:
            folder /= part
            try:
                folder.mkdir(mode=0o700)
            except FileExistsError:
                pass
            regular_info(folder, directory=True)
        self.guard()
        # xb refuses existing files, hard links and dangling symbolic links on every platform.
        with path.open('xb') as stream:
            stream.write(file.data)
            stream.flush()
            if os.name != 'nt':
                os.fchmod(stream.fileno(), 0o755 if file.mode == '100755' else 0o644)
            os.fsync(stream.fileno())
            written_identity = identity(os.fstat(stream.fileno()))
        require(identity(regular_info(path)) == written_identity,
                'HANDOFF_OUTPUT_CHANGED', 'An output file changed while being written.')
        self.guard()


def verify_output(output: Path, files: Mapping[str, File], marker: bytes) -> None:
    require(scan_files(output) == set(files) | {INCOMPLETE}, 'HANDOFF_OUTPUT_CHANGED',
            'Reconstruction has missing or unexpected entries.')
    require(read_regular(output / INCOMPLETE) == marker, 'HANDOFF_OUTPUT_CHANGED', 'Reconstruction marker changed.')
    for name, file in files.items():
        path = output / name
        require(read_regular(path) == file.data, 'HANDOFF_OUTPUT_CHANGED', 'Reconstructed bytes differ: ' + name)
        if os.name != 'nt':
            executable = bool(regular_info(path).st_mode & 0o111)
            require(executable == (file.mode == '100755'), 'HANDOFF_OUTPUT_CHANGED', 'Executable mode differs: ' + name)


def materialize(output: Path, files: Mapping[str, File], receipt: dict) -> dict:
    """Preflight happens before this function. Partial output is retained, never blindly retried."""
    reserved = False
    try:
        parent_identity = identity(regular_info(output.parent, directory=True))
        output.mkdir(mode=0o700)
        reserved = True
        writer = Writer(output, parent_identity)
        marker = b'Incomplete reconstruction. Do not build; inspect the failure and choose a new destination.\n'
        writer.write(INCOMPLETE, File(marker))
        for name, file in sorted(files.items()):
            writer.write(name, file)
        writer.guard()
        verify_output(output, files, marker)
        complete = {**receipt, 'status': 'restored', 'reconstructedTree': tree_oid(files)}
        writer.write(RECEIPT, File((json.dumps(complete, indent=2, sort_keys=True) + '\n').encode('utf-8')))
        writer.guard()
        require(read_regular(output / INCOMPLETE) == marker, 'HANDOFF_OUTPUT_CHANGED', 'Reconstruction marker changed.')
        (output / INCOMPLETE).unlink()
        writer.guard()
        return complete
    except (OSError, HandoffError, KeyboardInterrupt) as error:
        failure = error if isinstance(error, HandoffError) else HandoffError(
            'HANDOFF_CANCELLED' if isinstance(error, KeyboardInterrupt) else 'HANDOFF_WRITE_FAILED',
            'Reconstruction stopped before completion.',
            'Partial output is retained for inspection. Do not build or retry into that directory; choose a new destination.')
        if reserved:
            failure.partial_output = str(output)
        if failure is error:
            raise
        raise failure from error
