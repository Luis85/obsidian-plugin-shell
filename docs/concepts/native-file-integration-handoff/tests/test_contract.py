import contextlib
import io
import json
import os
import subprocess
import sys
from pathlib import Path
from unittest import mock
from types import SimpleNamespace
import unittest
from fixtures import SourceFixture, HOME, core, restore


class ContractTests(SourceFixture):
    def test_reviewed_snapshot_and_full_manifest_identity(self):
        snapshot = core.verify_source(self.home)
        self.assertEqual(len(snapshot.files), 48)
        self.assertEqual(len(snapshot.records), 49)
        self.assertEqual(core.tree_oid(snapshot.files), core.SOURCE_TREE)
        self.assertEqual(core.digest((self.home / 'MANIFEST.json').read_bytes()), core.MANIFEST_SHA256)
        with self.assertRaises(TypeError):
            snapshot.files['changed'] = core.File(b'changed')

    def test_changed_provenance_is_not_accepted_as_original_manifest(self):
        path = self.home / 'MANIFEST.json'
        value = json.loads(path.read_bytes())
        value['sourceArchiveSha256'] = '0' * 64
        path.write_text(json.dumps(value))
        self.assert_error('HANDOFF_MANIFEST_MISMATCH', core.verify_source, self.home)

    def test_changed_source_is_rejected(self):
        path = self.home / 'source/src/domain/native-file.ts'
        path.write_bytes(path.read_bytes() + b'\n// tamper\n')
        self.assert_error('HANDOFF_SOURCE_MISMATCH', core.verify_source, self.home)

    def test_missing_source_is_rejected(self):
        (self.home / 'source/src/domain/native-file.ts').unlink()
        self.assert_error('HANDOFF_INVENTORY_MISMATCH', core.verify_source, self.home)

    def test_extra_source_is_rejected(self):
        (self.home / 'source/extra.txt').write_bytes(b'extra')
        self.assert_error('HANDOFF_INVENTORY_MISMATCH', core.verify_source, self.home)

    def test_historical_deletion_cannot_be_reintroduced(self):
        deleted = self.home / 'source/.github/workflows/native-integration-verification.yml'
        deleted.parent.mkdir(parents=True)
        deleted.write_bytes(b'unexpected')
        self.assert_error('HANDOFF_INVENTORY_MISMATCH', core.verify_source, self.home)

    def test_extra_directory_link_is_not_invisible(self):
        self.link(self.home / 'source/extra-directory', self.temp, directory=True)
        self.assert_error('HANDOFF_LINK_OR_TYPE', core.verify_source, self.home)

    def test_source_file_link_is_rejected(self):
        path = self.home / 'source/src/domain/native-file.ts'
        saved = self.temp / 'saved'; path.rename(saved)
        self.link(path, saved)
        self.assert_error('HANDOFF_LINK_OR_TYPE', core.verify_source, self.home)

    def test_manifest_link_is_rejected(self):
        path = self.home / 'MANIFEST.json'; saved = self.temp / 'saved'; path.rename(saved)
        self.link(path, saved)
        self.assert_error('HANDOFF_LINK_OR_TYPE', core.verify_source, self.home)

    def test_hardlink_is_rejected(self):
        path = self.home / 'source/src/domain/native-file.ts'
        os.link(path, self.temp / 'shared')
        self.assert_error('HANDOFF_LINK_OR_TYPE', core.verify_source, self.home)

    @unittest.skipUnless(hasattr(os, 'mkfifo'), 'FIFO is a POSIX-only negative fixture.')
    def test_fifo_is_rejected_without_opening(self):
        os.mkfifo(self.home / 'source/fifo')
        self.assert_error('HANDOFF_LINK_OR_TYPE', core.verify_source, self.home)

    def test_read_bound_is_checked_before_open(self):
        path = self.temp / 'data'; path.write_bytes(b'1234')
        self.assert_error('HANDOFF_SIZE_LIMIT', core.read_regular, path, 3)

    def test_portable_paths_reject_traversal_devices_and_control_characters(self):
        for value in ['', '.', '..', '../out', '/out', 'a//b', 'a/./b', 'a/../b', 'a/',
                      'C:/out', 'C:out', '\\\\server\\share', 'a\\b', 'x:stream', '.GIT/config',
                      'aux.txt', 'COM1', 'lpt9.md', 'con', 'a. ', 'a.', 'a\nname', 'a\x00b']:
            with self.subTest(path=value):
                self.assert_error('HANDOFF_PATH_INVALID', core.checked_path, value)
        self.assertEqual(core.checked_path('docs/a-file.md').as_posix(), 'docs/a-file.md')

    def test_case_and_file_directory_conflicts_are_rejected(self):
        for files in [{'Foo/a': core.File(b''), 'foo/b': core.File(b'')},
                      {'a': core.File(b''), 'a/b': core.File(b'')}]:
            self.assert_error('HANDOFF_PATH_COLLISION', core.checked_files, files)

    def test_verified_bytes_are_an_immutable_snapshot_not_a_read_later_path(self):
        snapshot = core.verify_source(self.home)
        name = 'src/domain/native-file.ts'; approved = snapshot.files[name].data
        (self.home / 'source' / name).write_bytes(b'changed after verification')
        self.assertEqual(snapshot.files[name].data, approved)
        self.assert_error('HANDOFF_SOURCE_MISMATCH', core.verify_source, self.home)

    def test_default_check_and_json_are_read_only(self):
        result = subprocess.run([sys.executable, str(HOME / 'restore.py'), '--json'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual(value['status'], 'verified')
        self.assertEqual(value['nativeAcceptance'], 'not-run')
        self.assertEqual(result.stderr, '')
        self.assertFalse((HOME / '__pycache__').exists())

    def test_json_argument_errors_are_single_bounded_objects(self):
        for args in [['--out', '--json'], ['--plan', '--json'], ['--che', '--json'], ['--unknown-' + 'x' * 500, '--json']]:
            with self.subTest(args=args[:1]):
                capture, errors = io.StringIO(), io.StringIO()
                with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(errors):
                    self.assertEqual(restore.main(args), 1)
                value = json.loads(capture.getvalue())
                self.assertEqual(value['error']['code'], 'HANDOFF_ARGUMENT_INVALID')
                self.assertLess(len(capture.getvalue()), 800)
                self.assertEqual(errors.getvalue(), '')


    def test_cancelled_preflight_is_a_bounded_json_diagnostic(self):
        capture = io.StringIO()
        with mock.patch.object(restore, 'verify_source', side_effect=KeyboardInterrupt()), contextlib.redirect_stdout(capture):
            self.assertEqual(restore.main(['--check', '--json']), 130)
        value = json.loads(capture.getvalue())
        self.assertEqual(value['error']['code'], 'HANDOFF_CANCELLED')
        self.assertNotIn('partialOutput', value)

    def test_json_corrupt_source_has_no_success_prefix_or_traceback(self):
        (self.home / 'MANIFEST.json').write_bytes(b'{}')
        capture, errors = io.StringIO(), io.StringIO()
        with mock.patch.object(restore, 'HERE', self.home), contextlib.redirect_stdout(capture), contextlib.redirect_stderr(errors):
            self.assertEqual(restore.main(['--check', '--json']), 1)
        self.assertEqual(json.loads(capture.getvalue())['error']['code'], 'HANDOFF_MANIFEST_MISMATCH')
        self.assertEqual(errors.getvalue(), '')

    def stat_copy(self, info, ctime):
        return SimpleNamespace(st_dev=info.st_dev, st_ino=info.st_ino, st_size=info.st_size,
                               st_mtime_ns=info.st_mtime_ns, st_ctime_ns=ctime)

    def test_stable_ctime_is_compared_within_each_stat_api_not_across_apis(self):
        path = self.temp / 'different-ctime'; path.write_bytes(b'unchanged')
        original = core.os.fstat
        def by_handle(fd):
            info = original(fd)
            return self.stat_copy(info, info.st_ctime_ns + 100)
        with mock.patch.object(core.os, 'fstat', by_handle):
            self.assertEqual(core.read_regular(path), b'unchanged')

    def test_changed_handle_ctime_still_rejects_a_read(self):
        path = self.temp / 'handle-ctime'; path.write_bytes(b'unchanged')
        original = core.os.fstat; calls = 0
        def by_handle(fd):
            nonlocal calls
            calls += 1
            return self.stat_copy(original(fd), calls)
        with mock.patch.object(core.os, 'fstat', by_handle):
            self.assert_error('HANDOFF_SOURCE_CHANGED', core.read_regular, path)

    def test_changed_path_ctime_still_rejects_a_read(self):
        path = self.temp / 'path-ctime'; path.write_bytes(b'unchanged')
        original = core.regular_info; calls = 0
        def by_path(value):
            nonlocal calls
            calls += 1
            return self.stat_copy(original(value), calls)
        with mock.patch.object(core, 'regular_info', by_path):
            self.assert_error('HANDOFF_SOURCE_CHANGED', core.read_regular, path)


if __name__ == '__main__':
    unittest.main()
