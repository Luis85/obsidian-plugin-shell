"""Negative proofs for exact concept assembly and explicit analyzer entries."""
import contextlib
import importlib.util
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class AssemblyContract(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='companion-assembly-')
        self.root = Path(self.tmp.name)
        self.concept = self.root / 'docs/concepts/companion'
        shutil.copytree(ROOT / 'docs/concepts/companion/src', self.concept / 'src')
        shutil.copytree(ROOT / 'docs/concepts/companion/vendor', self.concept / 'vendor')
        shutil.copytree(ROOT / 'docs/concepts/companion/test-kit', self.concept / 'test-kit')
        shutil.copytree(ROOT / 'scripts/companion', self.root / 'scripts/companion')
        shutil.copy(ROOT / '.fallowrc.json', self.root / '.fallowrc.json')
        spec = importlib.util.spec_from_file_location('companion_assembly', ROOT / 'scripts/concepts/build-companion.py')
        self.builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.builder)
        self.builder.ROOT = self.concept
        self.output = self.concept / 'index.html'

    def tearDown(self):
        self.tmp.cleanup()

    def build(self, check=False):
        with contextlib.redirect_stdout(io.StringIO()):
            self.builder.build(self.output, check)

    def test_deterministic_exact_output(self):
        self.build()
        self.assertEqual(self.output.read_bytes(), (ROOT / 'docs/concepts/companion/index.html').read_bytes())
        self.build(check=True)

    def test_design_system_shared_modules_require_explicit_inventory(self):
        config = self.root / '.fallowrc.json'
        original = config.read_text()
        for name in ['design-system-roles.mjs', 'design-system-contract.mjs', 'design-system-css.mjs']:
            with self.subTest(name=name):
                value = json.loads(original)
                value['entry'].remove('scripts/companion/' + name)
                config.write_text(json.dumps(value))
                with self.assertRaisesRegex(ValueError, 'design-system module missing'):
                    self.build()
        config.write_text(original)

    def test_unassembled_source_is_not_hidden(self):
        (self.concept / 'src/unregistered.js').write_text('console.log("unused fixture");\n')
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            self.build()

    def test_missing_analyzer_entry_is_rejected(self):
        config = self.root / '.fallowrc.json'
        value = json.loads(config.read_text())
        value['entry'].remove('docs/concepts/companion/src/state-safety.js')
        config.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            self.build()

    def test_unreviewed_vendor_input_is_rejected(self):
        vendor = self.concept / 'vendor/vue-flow-core.iife.js'
        vendor.write_bytes(vendor.read_bytes() + b'\n// changed fixture\n')
        with self.assertRaisesRegex(ValueError, 'Unreviewed vendor input'):
            self.build()

    def test_missing_asset_entries_are_rejected(self):
        config = self.root / '.fallowrc.json'
        original = config.read_text()
        for entry in ['src/surface.css', 'vendor/vue-flow.css', 'vendor/vue.runtime.global.prod.js']:
            with self.subTest(entry=entry):
                edited = json.loads(original)
                edited['entry'].remove('docs/concepts/companion/' + entry)
                config.write_text(json.dumps(edited))
                with self.assertRaisesRegex(ValueError, 'inventory differs'):
                    self.build()
        config.write_text(original)

    def test_unassembled_styles_and_vendor_sources_are_not_hidden(self):
        for name in ['src/orphan.css', 'vendor/orphan.js', 'src/nested/orphan.js']:
            with self.subTest(name=name):
                target = self.concept / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('/* unassembled fixture */\n')
                with self.assertRaisesRegex(ValueError, 'inventory differs'):
                    self.build()
                target.unlink()

    def test_all_retained_vendor_bytes_are_verified(self):
        for name in ['pinia.iife.prod.js', 'vue.runtime.global.prod.js', 'vue-flow.css', 'vue-flow.scoped.css', 'THIRD_PARTY_NOTICES.txt']:
            with self.subTest(name=name):
                target = self.concept / 'vendor' / name
                original = target.read_bytes()
                target.write_bytes(original + b'\n/* changed fixture */\n')
                with self.assertRaisesRegex(ValueError, 'Unreviewed vendor input'):
                    self.build()
                target.write_bytes(original)

    def test_vendor_provenance_cannot_approve_changed_inputs(self):
        target = self.concept / 'vendor/provenance.json'
        value = json.loads(target.read_text())
        value['files'][0]['sha256'] = '0' * 64
        target.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'Unreviewed vendor provenance'):
            self.build()

    def test_duplicate_analyzer_entries_are_rejected(self):
        config = self.root / '.fallowrc.json'
        value = json.loads(config.read_text())
        value['entry'].append('docs/concepts/companion/src/state-safety.js')
        config.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            self.build()

    def test_shared_project_contract_changes_the_generated_artifact(self):
        self.build()
        before = self.output.read_bytes()
        shared = self.root / 'scripts/companion/project-contract.mjs'
        shared.write_text(shared.read_text() + '\n// exact shared contract change\n')
        self.build()
        self.assertNotEqual(before, self.output.read_bytes())
        self.assertIn(b'exact shared contract change', self.output.read_bytes())

    def test_shared_project_contract_requires_analyzer_entry(self):
        config = self.root / '.fallowrc.json'
        value = json.loads(config.read_text())
        value['entry'].remove('scripts/companion/project-contract.mjs')
        config.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'Shared project contract'):
            self.build()

    def test_stale_generated_output_is_rejected(self):
        self.build()
        self.output.write_bytes(self.output.read_bytes() + b'\n<!-- stale fixture -->\n')
        with self.assertRaisesRegex(ValueError, 'Generated concept differs'):
            self.build(check=True)


if __name__ == '__main__':
    unittest.main()
