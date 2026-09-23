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
        with self.assertRaisesRegex(ValueError, 'Unreviewed Vue Flow vendor input'):
            self.build()

    def test_stale_generated_output_is_rejected(self):
        self.build()
        self.output.write_bytes(self.output.read_bytes() + b'\n<!-- stale fixture -->\n')
        with self.assertRaisesRegex(ValueError, 'Generated concept differs'):
            self.build(check=True)


if __name__ == '__main__':
    unittest.main()
