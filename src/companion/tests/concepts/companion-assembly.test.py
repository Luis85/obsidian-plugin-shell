"""Negative proofs for exact concept assembly and explicit analyzer entries."""
import contextlib
import importlib.util
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PREFIX = 'docs/concepts/companion/'


def ignore_tests(directory, names):
    """Skip bytecode and each project's own tests folder; the assembly never reads either."""
    return [name for name in names if name == '__pycache__' or (name == 'tests' and Path(directory).name in {'tooling', 'cli', 'shared', 'companion', 'plugin', 'tui'})]


class AssemblyContract(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='companion-assembly-')
        self.root = Path(self.tmp.name)
        self.concept = self.root / 'docs/concepts/companion'
        self.app = self.root / 'src/companion/app'
        shutil.copytree(ROOT / 'src/companion/app', self.app)
        shutil.copytree(ROOT / 'docs/concepts/companion/vendor', self.concept / 'vendor')
        shutil.copytree(ROOT / 'docs/concepts/companion/test-kit', self.concept / 'test-kit')
        # The schema 6 project contract is bundled from the copied sources with the pinned local toolchain;
        # the repository layout is mirrored so the assembly finds every input where it does in the checkout.
        for folder in ['tooling', 'src/shared', 'src/cli']:
            shutil.copytree(ROOT / folder, self.root / folder, ignore=ignore_tests)
        # Vite follows project tsconfig references even when their modules are not in the bundle.
        shutil.copytree(ROOT / 'configs/types', self.root / 'configs/types')
        for config in (ROOT / 'src').glob('*/tsconfig.json'):
            target = self.root / config.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(config, target)
        (self.root / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        shutil.copy(ROOT / 'package.json', self.root / 'package.json')
        (self.root / 'configs/quality').mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / 'configs/quality/fallow.json', self.root / 'configs/quality/fallow.json')
        spec = importlib.util.spec_from_file_location('companion_assembly', ROOT / 'tooling/concepts/build-companion.py')
        self.builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.builder)
        self.builder.REPO = self.root
        self.builder.ROOT = self.concept
        self.builder.APP = self.app
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

    def test_shared_prd_limits_are_inlined_and_inventoried(self):
        self.build()
        html = self.output.read_text(encoding='utf-8')
        self.assertEqual(html.count('const PRD_LIMITS = Object.freeze('), 1)
        self.assertNotIn("import { PRD_LIMITS } from './prd-limits.mjs'", html)
        self.assertLess(html.index('const PRD_LIMITS'), html.index('const COMPANION_FORMAT = CompanionContract.COMPANION_FORMAT'))
        config = self.root / 'configs/quality/fallow.json'
        value = json.loads(config.read_text())
        value['entry'].remove('src/shared/companion/prd-limits.mjs')
        config.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'Shared PRD limits missing from inventory'):
            self.build()

    def test_bundled_project_contract_requires_explicit_inventory(self):
        config = self.root / 'configs/quality/fallow.json'
        original = config.read_text()
        for path in ['tooling/concepts/concept-contract.ts', 'tooling/concepts/contract-bundle.mjs']:
            with self.subTest(path=path):
                value = json.loads(original)
                value['entry'].remove(path)
                config.write_text(json.dumps(value))
                with self.assertRaisesRegex(ValueError, 'Bundled project contract missing from analyzer inventory: ' + path):
                    self.build()
        config.write_text(original)

    def test_design_system_shared_modules_require_explicit_inventory(self):
        config = self.root / 'configs/quality/fallow.json'
        original = config.read_text()
        for name in ['design-system-roles.mjs', 'design-system-contract.mjs', 'design-system-css.mjs']:
            with self.subTest(name=name):
                value = json.loads(original)
                value['entry'].remove('src/shared/companion/' + name)
                config.write_text(json.dumps(value))
                with self.assertRaisesRegex(ValueError, 'design-system module missing'):
                    self.build()
        config.write_text(original)

    def test_visual_contract_modules_require_explicit_inventory(self):
        config = self.root / 'configs/quality/fallow.json'
        original = config.read_text()
        for name in ['visual-ir.mjs', 'visual-validate.mjs', 'visual-session.mjs']:
            with self.subTest(name=name):
                value = json.loads(original)
                value['entry'].remove('src/shared/companion/visual/' + name)
                config.write_text(json.dumps(value))
                with self.assertRaisesRegex(ValueError, 'Visual contract missing from analyzer inventory: src/shared/companion/visual/' + name):
                    self.build()
        config.write_text(original)

    def test_visual_contract_is_inlined_and_the_schema_6_contract_is_bundled_once(self):
        self.build()
        text = self.output.read_text(encoding='utf-8')
        for name in ['function emptyVisualDesigns(', 'function visualSession(', 'const COMPANION_VERSION = CompanionContract.AUTHORING_VERSION;', '<script data-contract="CompanionContract">']:
            self.assertEqual(text.count(name), 1, name)
        self.assertLess(text.index('<script data-contract="CompanionContract">'), text.index('const COMPANION_VERSION = CompanionContract.AUTHORING_VERSION;'))
        self.assertNotIn("from './visual/", text)
        # Retired formats are refused by the bundled contract; no migration or v5 contract is assembled.
        for retired in ['function migrateDetailDesigns(', 'function migrateCompanionDocument(', 'function validateDetailDesigns(', 'const COMPANION_VERSION = 5;', 'id="companion-visual-seed"', 'id="project-starters-data"']:
            self.assertNotIn(retired, text)

    def test_visual_editor_modules_are_assembled(self):
        html = (ROOT / 'docs/concepts/companion/index.html').read_text(encoding='utf-8')
        markers = ['function veCommit(', 'function validateVisualDesigns(']
        markers += ['function veCanvasHtml(', '.ve-editor']
        markers += ['function vePagesView(', 'function vePageEditorView(', 'function veOutlineHtml(', 'function veInsertHtml(', 'function veLayoutsHtml(', 'role="tree"']
        markers += ['function vePageInspectorHtml(', 'function veInteractionForm(', 'function veFieldEdit(', 'function veReviewFindings(', 'function veHealthHtml(']
        markers += ['function veComponentEditorView(', 'function veContractHtml(', 'function veChildInspectorHtml(', 'Would create a cycle']
        markers += ['function handleVisualAction(', 'if(handleVisualAction(action,value)', 'veFieldEdit(el)||', 'pages:vePagesView', "'page-editor':vePageEditorView"]
        markers += ['function veEditorKeydown(', 'function veOutlineStep(', '...vePaletteRows(),...NAV.map(', "'ve-delete':veDeleteDialog", "'ve-reparent':veReparentDialog"]
        for marker in markers:
            self.assertIn(marker, html, marker)
        # The visual editors have no Vue Flow island: render no longer mounts or destroys the legacy detail flow.
        self.assertNotIn('dtMount();', html)
        self.assertNotIn('dtDestroy();smDestroy()', html)

    def test_unassembled_source_is_not_hidden(self):
        (self.app / 'unregistered.js').write_text('console.log("unused fixture");\n')
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            self.build()

    def test_missing_analyzer_entry_is_rejected(self):
        config = self.root / 'configs/quality/fallow.json'
        value = json.loads(config.read_text())
        value['entry'].remove('src/companion/app/state-safety.js')
        config.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            self.build()

    def test_unreviewed_vendor_input_is_rejected(self):
        vendor = self.concept / 'vendor/vue-flow-core.iife.js'
        vendor.write_bytes(vendor.read_bytes() + b'\n// changed fixture\n')
        with self.assertRaisesRegex(ValueError, 'Unreviewed vendor input'):
            self.build()

    def test_missing_asset_entries_are_rejected(self):
        config = self.root / 'configs/quality/fallow.json'
        original = config.read_text()
        for entry in ['src/companion/app/surface.css', PREFIX + 'vendor/vue-flow.css', PREFIX + 'vendor/vue.runtime.global.prod.js']:
            with self.subTest(entry=entry):
                edited = json.loads(original)
                edited['entry'].remove(entry)
                config.write_text(json.dumps(edited))
                with self.assertRaisesRegex(ValueError, 'inventory differs'):
                    self.build()
        config.write_text(original)

    def test_unassembled_styles_and_vendor_sources_are_not_hidden(self):
        for name, base in [('orphan.css', self.app), ('vendor/orphan.js', self.concept), ('nested/orphan.js', self.app)]:
            with self.subTest(name=name):
                target = base / name
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
        config = self.root / 'configs/quality/fallow.json'
        value = json.loads(config.read_text())
        value['entry'].append('src/companion/app/state-safety.js')
        config.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            self.build()

    def test_shared_project_contract_changes_the_generated_artifact(self):
        self.build()
        before = self.output.read_bytes()
        shared = self.root / 'src/shared/companion/authoring-contract.ts'
        original = shared.read_text()
        marker = 'only schema 6 is supported.'
        self.assertEqual(original.count(marker), 1)
        shared.write_text(original.replace(marker, 'only schema 6 is supported (exact shared contract change).'))
        self.build()
        self.assertNotEqual(before, self.output.read_bytes())
        self.assertIn(b'exact shared contract change', self.output.read_bytes())

    def test_unbundleable_project_contract_fails_closed(self):
        self.build()
        before = self.output.read_bytes()
        shared = self.root / 'src/shared/companion/authoring-contract.ts'
        shared.write_text(shared.read_text() + '\nexport const broken = ;\n')
        with self.assertRaisesRegex(ValueError, 'Project contract bundle failed'):
            self.build()
        self.assertEqual(before, self.output.read_bytes())

    def test_stale_generated_output_is_rejected(self):
        self.build()
        self.output.write_bytes(self.output.read_bytes() + b'\n<!-- stale fixture -->\n')
        with self.assertRaisesRegex(ValueError, 'Generated concept differs'):
            self.build(check=True)


if __name__ == '__main__':
    unittest.main()
