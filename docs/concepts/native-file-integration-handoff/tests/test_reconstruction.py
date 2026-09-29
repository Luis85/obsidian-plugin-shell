import contextlib
import io
import json
import os
from pathlib import Path
from unittest import mock
import unittest
from fixtures import GitFixture, core, objects, output, restore


class ReconstructionTests(GitFixture):
    def reconstructed(self):
        return core.compose(self.baseline(), self.snapshot)

    def test_blob_loading_ignores_export_attributes_and_preserves_modes(self):
        (self.repo / '.git/info/attributes').write_text('baseline.txt export-ignore\nexec.sh export-subst\n')
        files = self.baseline()
        self.assertEqual(files['baseline.txt'].data, b'unchanged\n')
        self.assertEqual(files['exec.sh'].mode, '100755')
        self.assertEqual(core.tree_oid(files), self.tree)

    def test_replacement_refs_do_not_change_the_baseline(self):
        (self.repo / 'baseline.txt').write_bytes(b'replaced\n')
        self.git('add', 'baseline.txt'); self.git('commit', '-qm', 'replacement fixture')
        self.git('replace', self.commit, self.git('rev-parse', 'HEAD'))
        self.assertEqual(self.baseline()['baseline.txt'].data, b'unchanged\n')

    def test_inherited_git_environment_cannot_redirect_the_repository(self):
        with mock.patch.dict(os.environ, {'GIT_DIR': str(self.temp / 'wrong'), 'GIT_WORK_TREE': str(self.temp),
                                         'GIT_TRACE': str(self.temp / 'leak.log'), 'GIT_CONFIG_COUNT': 'bad'}):
            self.assertEqual(objects.repository(self.home), self.repo)
            self.assertEqual(self.baseline()['baseline.txt'].data, b'unchanged\n')
        self.assertFalse((self.temp / 'leak.log').exists())
        self.assertEqual(objects.git_env()['GIT_ALLOW_PROTOCOL'], '')
        self.assertEqual(objects.git_env()['GIT_NO_LAZY_FETCH'], '1')

    def test_missing_baseline_is_rejected(self):
        self.assert_error('HANDOFF_GIT_UNAVAILABLE', objects.load_baseline, self.repo, '0' * 40, self.tree)

    def test_wrong_baseline_tree_is_rejected(self):
        self.assert_error('HANDOFF_BASELINE_MISMATCH', objects.load_baseline, self.repo, self.commit, '0' * 40)

    def test_invalid_mode_or_incomplete_git_output_is_rejected(self):
        for raw in [b'120000 blob ' + b'a' * 40 + b' 3\tlink\0', b'100644 blob ' + b'a' * 40 + b' 3\ta']:
            self.assert_error('HANDOFF_GIT_INVALID', objects.entries, raw)
        row = [('a', '100644', core.git_hash(b'blob', b'abc'), 3)]
        wrong = f"{row[0][2]} blob 3\n".encode() + b'xyz\n'
        self.assert_error('HANDOFF_GIT_INVALID', objects.decode_blobs, wrong, row)

    def test_modify_add_delete_preconditions_are_verified_before_writing(self):
        baseline = dict(self.baseline())
        baseline.pop(next(name for status, name in self.snapshot.records if status == 'M'))
        self.assert_error('HANDOFF_BASELINE_MISMATCH', core.compose, baseline, self.snapshot)
        baseline = dict(self.baseline())
        baseline[next(name for status, name in self.snapshot.records if status == 'A')] = core.File(b'collision')
        self.assert_error('HANDOFF_BASELINE_MISMATCH', core.compose, baseline, self.snapshot)

    def test_destination_must_be_new_and_outside_the_checkout(self):
        self.assert_error('HANDOFF_OUTPUT_EXISTS', output.destination, self.repo, self.repo)
        self.assert_error('HANDOFF_OUTPUT_INSIDE_CHECKOUT', output.destination, self.repo / 'new', self.repo)
        existing = self.temp / 'existing'; existing.write_bytes(b'keep')
        self.assert_error('HANDOFF_OUTPUT_EXISTS', output.destination, existing, self.repo)
        self.assertEqual(existing.read_bytes(), b'keep')
        alias = self.temp / 'alias'; self.link(alias, self.repo, directory=True)
        self.assert_error('HANDOFF_OUTPUT_INSIDE_CHECKOUT', output.destination, alias / 'new', self.repo)

    def test_dangling_destination_is_not_overwritten(self):
        target = self.temp / 'dangling'; self.link(target, self.temp / 'missing', directory=True)
        self.assert_error('HANDOFF_OUTPUT_EXISTS', output.destination, target, self.repo)
        self.assertTrue(target.is_symlink())

    def test_plan_does_not_create_destination_or_modify_repository(self):
        target = self.temp / 'planned'
        before = self.git('status', '--porcelain')
        with mock.patch.object(restore, 'HERE', self.home), mock.patch.object(restore, 'load_baseline', self.baseline):
            result, machine = restore.execute(['--plan', '--out', str(target), '--json'])
        self.assertEqual(result['status'], 'planned')
        self.assertTrue(machine)
        self.assertFalse(target.exists())
        self.assertEqual(before, self.git('status', '--porcelain'))
        self.assertEqual(result['reconstructedTree'], core.tree_oid(self.reconstructed()))

    def test_failed_preflight_leaves_no_output_directory(self):
        target = self.temp / 'uncreated'
        with mock.patch.object(restore, 'HERE', self.home):
            self.assert_error('HANDOFF_GIT_UNAVAILABLE', restore.execute, ['--out', str(target)])
        self.assertFalse(target.exists())

    def test_complete_restore_matches_approved_snapshot_and_writes_portable_receipt(self):
        target = self.temp / 'complete'
        before = self.git('status', '--porcelain')
        with mock.patch.object(restore, 'HERE', self.home), mock.patch.object(restore, 'load_baseline', self.baseline):
            result, _ = restore.execute(['--out', str(target), '--json'])
        receipt = json.loads((target / core.RECEIPT).read_bytes())
        self.assertEqual(receipt['status'], 'restored')
        self.assertNotIn('output', receipt)
        self.assertFalse((target / core.INCOMPLETE).exists())
        expected = self.reconstructed()
        self.assertEqual(core.scan_files(target), set(expected) | {core.RECEIPT})
        for name, file in expected.items():
            self.assertEqual((target / name).read_bytes(), file.data, name)
        self.assertEqual(result['reconstructedTree'], core.tree_oid(expected))
        self.assertEqual(before, self.git('status', '--porcelain'))
        self.assertFalse((target / '.github/workflows/native-integration-verification.yml').exists())
        if os.name != 'nt':
            self.assertTrue((target / 'exec.sh').stat().st_mode & 0o100)

    def test_mutation_after_verification_cannot_change_the_copied_bytes(self):
        name = 'src/domain/native-file.ts'
        approved = self.snapshot.files[name].data
        (self.home / 'source' / name).write_bytes(b'unverified changes')
        target = self.temp / 'snapshot'
        output.materialize(target, self.reconstructed(), {'schemaVersion': 1})
        self.assertEqual((target / name).read_bytes(), approved)

    def test_existing_racing_destination_is_not_touched(self):
        target = self.temp / 'race'
        resolved = output.destination(target, self.repo)
        target.mkdir(); (target / 'keep').write_bytes(b'keep')
        self.assert_error('HANDOFF_WRITE_FAILED', output.materialize, resolved, {'a': core.File(b'a')}, {})
        self.assertEqual(core.scan_files(target), {'keep'})

    def test_injected_existing_file_is_not_overwritten_and_incomplete_marker_remains(self):
        target = self.temp / 'file-race'
        original = output.Writer.write
        def inject(writer, name, file):
            if name == 'a':
                (writer.output / 'a').write_bytes(b'keep')
            return original(writer, name, file)
        with mock.patch.object(output.Writer, 'write', inject):
            failure = self.assert_error('HANDOFF_WRITE_FAILED', output.materialize, target, {'a': core.File(b'new')}, {})
        self.assertEqual((target / 'a').read_bytes(), b'keep')
        self.assertEqual(failure.partial_output, str(target))
        self.assertTrue((target / core.INCOMPLETE).is_file())
        self.assertFalse((target / core.RECEIPT).exists())

    def test_injected_directory_link_cannot_redirect_writes(self):
        target = self.temp / 'link-race'; outside = self.temp / 'outside'; outside.mkdir()
        original = output.Writer.write
        def inject(writer, name, file):
            if name == 'sub/a':
                self.link(writer.output / 'sub', outside, directory=True)
            return original(writer, name, file)
        with mock.patch.object(output.Writer, 'write', inject):
            self.assert_error('HANDOFF_LINK_OR_TYPE', output.materialize, target, {'sub/a': core.File(b'a')}, {})
        self.assertEqual(list(outside.iterdir()), [])
        self.assertFalse((target / core.RECEIPT).exists())

    def test_readback_detects_modified_output_before_success_receipt(self):
        target = self.temp / 'readback'
        original = output.verify_output
        def tamper(root, files, marker):
            (root / 'a').write_bytes(b'changed')
            return original(root, files, marker)
        with mock.patch.object(output, 'verify_output', tamper):
            self.assert_error('HANDOFF_OUTPUT_CHANGED', output.materialize, target, {'a': core.File(b'original')}, {})
        self.assertTrue((target / core.INCOMPLETE).exists())
        self.assertFalse((target / core.RECEIPT).exists())

    def test_disk_failure_retains_partial_output_without_success(self):
        target = self.temp / 'disk-failure'
        with mock.patch.object(output.os, 'fsync', side_effect=OSError('simulated full disk')):
            failure = self.assert_error('HANDOFF_WRITE_FAILED', output.materialize, target, {'a': core.File(b'a')}, {})
        self.assertEqual(failure.partial_output, str(target))
        self.assertFalse((target / core.RECEIPT).exists())


    def test_cancelled_write_retains_partial_output_and_uses_exit_130(self):
        target = self.temp / 'cancelled'
        original = output.Writer.write
        def cancel(writer, name, file):
            if name != core.INCOMPLETE:
                raise KeyboardInterrupt()
            return original(writer, name, file)
        capture = io.StringIO()
        with mock.patch.object(restore, 'HERE', self.home), mock.patch.object(restore, 'load_baseline', self.baseline), mock.patch.object(output.Writer, 'write', cancel), contextlib.redirect_stdout(capture):
            self.assertEqual(restore.main(['--out', str(target), '--json']), 130)
        result = json.loads(capture.getvalue())
        self.assertEqual(result['status'], 'incomplete')
        self.assertEqual(result['error']['code'], 'HANDOFF_CANCELLED')
        self.assertTrue((target / core.INCOMPLETE).exists())
        self.assertFalse((target / core.RECEIPT).exists())

    def test_binary_blob_output_uses_lengths_not_line_delimiters(self):
        data = b'\x00\xff\n\x01\r\n'
        oid = core.git_hash(b'blob', data)
        raw = f'{oid} blob {len(data)}\n'.encode() + data + b'\n'
        files = objects.decode_blobs(raw, [('binary.bin', '100644', oid, len(data))])
        self.assertEqual(files['binary.bin'].data, data)

    def test_json_success_is_one_object_and_repeated_destination_is_refused(self):
        target = self.temp / 'json'
        with mock.patch.object(restore, 'HERE', self.home), mock.patch.object(restore, 'load_baseline', self.baseline):
            first, second = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(first):
                self.assertEqual(restore.main(['--out', str(target), '--json']), 0)
            with contextlib.redirect_stdout(second):
                self.assertEqual(restore.main(['--out', str(target), '--json']), 1)
        self.assertEqual(json.loads(first.getvalue())['status'], 'restored')
        self.assertEqual(json.loads(second.getvalue())['error']['code'], 'HANDOFF_OUTPUT_EXISTS')


if __name__ == '__main__':
    unittest.main()
