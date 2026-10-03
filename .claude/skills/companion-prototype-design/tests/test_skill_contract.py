"""Static packaging/behavior-contract checks; not a live agent evaluation."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).parents[1]

class SkillContractTests(unittest.TestCase):
    def test_frontmatter_and_compact_instruction_file(self):
        text = (ROOT/'SKILL.md').read_text(encoding='utf-8')
        self.assertTrue(text.startswith('---\nname: companion-prototype-design\n'))
        self.assertIn('\ndescription:', text)
        self.assertLess(len(text.splitlines()), 500)
        self.assertRegex(ROOT.name, r'^[a-z0-9-]+$')

    def test_all_explicit_skill_references_exist(self):
        text = (ROOT/'SKILL.md').read_text(encoding='utf-8')
        references = re.findall(r'`((?:references|assets/templates)/[^`]+)`', text)
        self.assertGreaterEqual(len(references), 7)
        for file in references:
            with self.subTest(file=file): self.assertTrue((ROOT/file).is_file())

    def test_interview_agreement_and_authority_gates_are_present(self):
        text = (ROOT/'SKILL.md').read_text(encoding='utf-8')
        for phrase in ['new-plugin', 'new-feature', 'improvement', 'explicitly agrees',
                       'no blocking gaps', 'Do not ask again', 'does not approve',
                       'not approval to commit or push', 'inline']:
            with self.subTest(phrase=phrase): self.assertIn(phrase, text)

    def test_fresh_session_prompt_carries_all_required_delivery_types(self):
        text = (ROOT/'assets/templates/execution-prompt.md').read_text(encoding='utf-8')
        for phrase in ['prototype.html', 'companion.project.json', 'source/', 'package',
                       'lockfile', 'Vue 3', 'Pinia', 'Nuxt UI', 'subagents',
                       'file://', 'baseline', 'No access', 'TODO', 'docs/concepts/']:
            with self.subTest(phrase=phrase): self.assertIn(phrase, text)

    def test_references_distinguish_data_source_and_execution(self):
        text = (ROOT/'references/repository-contract.md').read_text(encoding='utf-8')
        for phrase in ['schemaVersion: 6', 'Data-compatible', 'Generator-compatible',
                       'Experience-compatible', 'not a generator', 'does not append/merge',
                       'framework-free', 'Preflight']:
            with self.subTest(phrase=phrase): self.assertIn(phrase, text)

    def test_no_unshipped_runtime_imports_in_node_helpers(self):
        for file in (ROOT/'scripts').rglob('*.mjs'):
            text = file.read_text(encoding='utf-8')
            for relative in re.findall(r"from ['\"](\.[^'\"]+)['\"]", text):
                with self.subTest(file=file.name, relative=relative):
                    self.assertTrue((file.parent/relative).is_file())

    def test_named_live_agent_evaluation_cases_are_not_claimed_as_execution(self):
        text = (ROOT/'examples/conversation-contracts.md').read_text(encoding='utf-8')
        self.assertIn('not claims of automated live-agent evaluation', text)
        self.assertEqual(len(re.findall(r'^\d+\.', text, re.M)), 15)

class ConceptBoardContractTests(unittest.TestCase):
    """Static workflow regressions; live image generation is not executed here."""

    def read(self, name):
        return (ROOT / name).read_text(encoding='utf-8')

    def test_offer_precedes_agreement_and_prompt(self):
        text = self.read('SKILL.md')
        stages = ['## 2. Conduct', '## 3. Offer concept boards',
                  '## 4. Obtain design agreement', '## 5. Produce the fresh-session prompt']
        positions = [text.index(stage) for stage in stages]
        self.assertEqual(positions, sorted(positions))
        self.assertIn('Shall I generate a few concept boards', text)
        self.assertIn('or proceed directly to the prototype prompt?', text)

    def test_explicit_skip_and_existing_choices_are_respected(self):
        text = self.read('references/concept-boards.md')
        for phrase in ['already chose a route', 'explicit skip', 'not a missing',
                       'already approved execution prompt', 'do not ask for the same approval twice']:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_images_use_actual_tools_and_honest_failure_states(self):
        text = self.read('references/concept-boards.md')
        for phrase in ['actually available', 'present its image outputs', 'unavailable',
                       'failed', 'No tool attempt/result', 'host ends the response',
                       'Do not invent a shell-cli', 'actually available in the']:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_boards_explore_interactions_not_just_colors(self):
        text = self.read('references/concept-boards.md')
        for phrase in ['2–3', 'only color variations', 'interaction sequence',
                       'synthetic data', 'Nuxt UI', 'editor-only', 'keyboard/focus']:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_iteration_combination_and_stale_prompt_rules(self):
        text = self.read('references/concept-boards.md')
        for phrase in ['keep / change / reject', 'no fixed', 'CB-01-r01',
                       'reconcile conflicting', 'Rejected and superseded',
                       'invalidates an older final prompt', 'reopens the affected']:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_board_selection_does_not_authorize_execution_or_save(self):
        text = self.read('references/concept-boards.md')
        for phrase in ['not full-brief agreement', 'implementation execution',
                       'repository', 'commit/push', 'live companion import',
                       'separate authority', 'private data']:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_brief_records_review_without_extending_import_schema(self):
        text = self.read('assets/templates/design-brief.md')
        for phrase in ['Concept-board exploration', 'skipped', 'selected', 'unavailable',
                       'keep/change/reject', 'hashes only for available bytes',
                       'closed JSON envelope']:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_prompt_carries_accepted_decisions_and_real_image_access(self):
        text = self.read('assets/templates/execution-prompt.md')
        for phrase in ['Accepted visual direction', 'exact IDs/revisions',
                       'complete chosen design', 'another conversation',
                       'not source components', 'Do not require a concept-boards folder',
                       'existing package/save helpers', 'supersede image artifacts']:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_canonical_reference_and_template_are_connected(self):
        text = self.read('SKILL.md')
        for name in ['references/concept-boards.md', 'assets/templates/concept-board.md']:
            with self.subTest(name=name):
                self.assertIn(f'`{name}`', text)
                self.assertTrue((ROOT/name).is_file())
        template = self.read('assets/templates/concept-board.md')
        for phrase in ['Image-generation prompt', 'Iteration record', 'Accepted handoff',
                       'not invented acceptance', 'actually available image reference']:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, template)
        self.assertIn('single source of truth', text)
        self.assertIn('.agents/skills/companion-prototype-design/SKILL.md', text)

    def test_new_conversation_scenarios_are_explicitly_not_live_evidence(self):
        text = self.read('examples/concept-board-conversations.md')
        self.assertIn('not claims of automated live-agent evaluation', text)
        self.assertEqual(len(re.findall(r'^\d+\.', text, re.M)), 8)

class PortableTestNamingTests(unittest.TestCase):
    def test_portable_node_tests_use_tooling_names_not_finite_baseline_names(self):
        tests = list((ROOT/'tests').glob('*.mjs'))
        self.assertTrue(tests)
        for path in tests:
            with self.subTest(path=path.name):
                self.assertTrue(path.name.endswith('.checks.mjs'))
        self.assertTrue((ROOT/'tests/worker-output.checks.mjs').is_file())

if __name__ == '__main__':
    unittest.main()
