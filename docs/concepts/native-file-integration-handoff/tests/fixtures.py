"""Real local Git fixture; its commit is not historical-production qualification."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

HOME = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOME))
import handoff_core as core
import handoff_git as objects
import handoff_output as output
import restore


class SourceFixture(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.temp = Path(temp.name).resolve()
        self.repo = self.temp / 'repo'
        self.home = self.repo / 'handoff'
        self.home.mkdir(parents=True)
        shutil.copyfile(HOME / 'MANIFEST.json', self.home / 'MANIFEST.json')
        shutil.copytree(HOME / 'source', self.home / 'source')

    def link(self, path, target, directory=False):
        try:
            path.symlink_to(target, target_is_directory=directory)
        except OSError as error:
            if sys.platform == 'win32' and error.winerror == 1314:
                self.skipTest('Windows host does not grant symbolic-link creation privilege.')
            raise

    def assert_error(self, code, function, *args):
        with self.assertRaises(core.HandoffError) as caught:
            function(*args)
        self.assertEqual(caught.exception.code, code)
        return caught.exception


class GitFixture(SourceFixture):
    def git(self, *args):
        result = subprocess.run(['git', '-C', str(self.repo), *args], capture_output=True, check=True)
        return result.stdout.decode('utf-8').strip()

    def setUp(self):
        super().setUp()
        self.snapshot = core.verify_source(self.home)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Handoff tests')
        self.git('config', 'user.email', 'handoff-tests@example.invalid')
        self.git('config', 'core.autocrlf', 'false')
        names = []
        for status, name in self.snapshot.records:
            if status in ('M', 'D'):
                path = self.repo / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(('Original fixture content: ' + name + '\n').encode())
                names.append(name)
        for name, data in [('baseline.txt', b'unchanged\n'), ('exec.sh', b'#!/bin/sh\ntrue\n'),
                           ('.gitattributes', b'baseline.txt export-ignore\n')]:
            (self.repo / name).write_bytes(data)
            names.append(name)
        self.git('add', '--', *names)
        self.git('update-index', '--chmod=+x', 'exec.sh')
        self.git('commit', '-qm', 'Synthetic local baseline for restoration tests')
        self.commit = self.git('rev-parse', 'HEAD')
        self.tree = self.git('rev-parse', 'HEAD^{tree}')

    def baseline(self, repo=None):
        return objects.load_baseline(repo or self.repo, self.commit, self.tree)
