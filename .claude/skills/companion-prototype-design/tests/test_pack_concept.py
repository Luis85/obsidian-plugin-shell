"""Synthetic package-fixture tests; not a compiled prototype or real integration claim."""
import importlib.util
import errno
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location('packer', Path(__file__).parents[1] / 'scripts/pack-concept.py')
PACKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKER)

class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'prototype'
        self.root.mkdir()
        for name in PACKER.REQUIRED:
            self.write(name, 'synthetic fixture, not a real compiled prototype\n')
        self.write('prototype.html', '<!doctype html><title>fixture</title>')
        self.write('companion.project.json', '{"synthetic":true}')
        self.write('source/src/presentation/components/FixturePanel.vue', '<template><p>Fixture</p></template>')
        self.write('source/src/domain/fixture.ts', 'export const fixture = true;')
        self.dependencies = {'vue': '3.5.43', 'pinia': '4.0.3', '@nuxt/ui': '4.11.2'}
        self.package = {'packageManager': 'npm@11.19.1', 'scripts': {'prototype:build': 'node fixture.mjs'},
                        'dependencies': self.dependencies, 'devDependencies': {'typescript': '6.0.3'}}
        self.write('source/package.json', json.dumps(self.package))
        self.write('source/package-lock.json', json.dumps({'lockfileVersion': 3, 'packages': {'': {
            'dependencies': self.dependencies, 'devDependencies': {'typescript': '6.0.3'}}}}))
        self.write('evidence/verification.json', json.dumps({'checks': [{'status': 'not-run', 'name': 'synthetic-only'}]}))
        self.manifest = {'kind': 'obsidian-prototype-package', 'schemaVersion': 1, 'slug': 'fixture', 'mode': 'new-plugin',
            'repository': {'name': 'Luis85/obsidian-plugin-shell', 'commit': 'a' * 40},
            'project': {'path': 'companion.project.json', 'sha256': PACKER.digest((self.root/'companion.project.json').read_bytes())},
            'artifact': {'path': 'prototype.html', 'sha256': PACKER.digest((self.root/'prototype.html').read_bytes())},
            'source': {'path': 'source', 'packageManager': 'npm@11.19.1'}, 'status': 'incomplete'}
        self.update_manifest()

    def symlink(self, path, target, directory=False):
        try:
            path.symlink_to(target, target_is_directory=directory)
        except OSError as error:
            if error.errno in (errno.EACCES, errno.EPERM) or getattr(error, 'winerror', None) == 1314:
                self.skipTest('Host does not grant symlink privilege')
            raise

    def test_read_only_inspection_returns_the_same_inventory_without_writes(self):
        before = sorted(str(p.relative_to(self.root)) for p in self.root.rglob('*'))
        result = PACKER.inspect(self.root)
        self.assertEqual(result['slug'], 'fixture')
        self.assertEqual(result['prototypeStatus'], 'incomplete')
        self.assertEqual(len(result['files']), len(PACKER.scan(self.root)))
        self.assertEqual(before, sorted(str(p.relative_to(self.root)) for p in self.root.rglob('*')))

    def write(self, name, content):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8')

    def update_manifest(self):
        self.write('prototype.manifest.json', json.dumps(self.manifest))

    def pack(self, name='out.zip'):
        return PACKER.package(self.root, self.base/name)

    def test_deterministic_inventory_and_hashes(self):
        a, b = self.pack('a.zip'), self.pack('b.zip')
        self.assertEqual(a['sha256'], b['sha256'])
        with zipfile.ZipFile(self.base/'a.zip') as archive:
            inventory = json.loads(archive.read('fixture/PACKAGE-INVENTORY.json'))
            for item in inventory['files']:
                self.assertEqual(PACKER.digest(archive.read('fixture/'+item['path'])), item['sha256'])
        self.assertEqual(a['prototypeStatus'], 'incomplete')

    def test_existing_zip_is_preserved(self):
        self.pack()
        original = (self.base/'out.zip').read_bytes()
        with self.assertRaises(FileExistsError): self.pack()
        self.assertEqual(original, (self.base/'out.zip').read_bytes())

    def test_zip_inside_root_is_refused(self):
        with self.assertRaises(ValueError): PACKER.package(self.root, self.root/'out.zip')

    def test_missing_required_source_lock_is_refused(self):
        (self.root/'source/package-lock.json').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing'): self.pack()

    def test_hash_mismatch_is_refused(self):
        self.write('prototype.html', 'changed')
        with self.assertRaisesRegex(ValueError, 'hash mismatch'): self.pack()

    def test_actual_sfc_and_typescript_required(self):
        (self.root/'source/src/presentation/components/FixturePanel.vue').unlink()
        with self.assertRaisesRegex(ValueError, 'SFC'): self.pack()

    def test_symlink_is_refused(self):
        self.symlink(self.root/'link', self.base, True)
        with self.assertRaisesRegex(ValueError, 'Symlink'): self.pack()

    def test_symlinked_root_is_refused(self):
        linked = self.base/'linked'
        self.symlink(linked, self.root, True)
        with self.assertRaisesRegex(ValueError, 'Symlink'): PACKER.package(linked, self.base/'out.zip')

    def test_secret_and_font_files_are_refused(self):
        for name in ['.env', '.npmrc', 'credentials.json', 'secret.pem', 'font.woff2', 'font.ttf']:
            with self.subTest(name=name):
                self.write(name, 'unsafe')
                with self.assertRaises(ValueError): self.pack()
                (self.root/name).unlink()

    def test_case_collision_is_refused(self):
        self.write('ReadMe.md', 'collision')
        with self.assertRaisesRegex(ValueError, 'colliding'): self.pack()

    def test_vault_directories_are_refused(self):
        (self.root/'.dev-vault').mkdir()
        with self.assertRaisesRegex(ValueError, 'vault'): self.pack()

    def test_cache_and_dependency_trees_are_excluded(self):
        self.write('node_modules/big.js', 'not shipped')
        self.write('.git/config', 'not shipped')
        self.pack()
        with zipfile.ZipFile(self.base/'out.zip') as archive:
            self.assertFalse(any('node_modules' in name or '.git/' in name for name in archive.namelist()))

    def test_false_verified_status_is_refused(self):
        self.manifest['status'] = 'verified'; self.update_manifest()
        with self.assertRaisesRegex(ValueError, 'Unpassed'): self.pack()

    def test_exact_required_stack_is_checked(self):
        self.package['dependencies']['vue'] = '^3.5.43'
        self.write('source/package.json', json.dumps(self.package))
        self.write('source/package-lock.json', json.dumps({'packages': {'': {
            'dependencies': self.package['dependencies'], 'devDependencies': self.package['devDependencies']}}}))
        with self.assertRaisesRegex(ValueError, 'Exact required'): self.pack()

    def test_package_lock_drift_is_refused(self):
        self.package['dependencies']['vue'] = '3.5.42'
        self.write('source/package.json', json.dumps(self.package))
        with self.assertRaisesRegex(ValueError, 'lock mismatch'): self.pack()

    def test_feature_mode_requires_change_metadata(self):
        self.manifest['mode'] = 'improvement'; self.update_manifest()
        with self.assertRaisesRegex(ValueError, 'baseline'): self.pack()
        for name in ['changes/baseline-reference.json', 'changes/change-set.json', 'changes/regression-cases.md']:
            self.write(name, '{}')
        self.pack()

    def test_reserved_slug_is_refused(self):
        self.manifest['slug'] = 'con'; self.update_manifest()
        with self.assertRaisesRegex(ValueError, 'slug'): self.pack()

    def test_portable_paths(self):
        for name in ['../x', '/absolute', 'a//b', 'con.txt', 'x:y', 'a\\b', 'a.', 'a ']:
            with self.subTest(name=name): self.assertFalse(PACKER.portable(name))
        for name in ['source/.editorconfig', 'source/@scope/file.ts', 'docs/file name.md']:
            self.assertTrue(PACKER.portable(name))

if __name__ == '__main__':
    unittest.main()
