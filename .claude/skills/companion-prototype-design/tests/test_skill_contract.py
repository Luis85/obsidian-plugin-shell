"""Static packaging/behavior-contract checks; not a live agent evaluation."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).parents[1]

class SkillContractTests(unittest.TestCase):
    def test_frontmatter_and_compact_instruction_file(self):
        text = (ROOT/'SKILL.md').read_text()
        self.assertTrue(text.startswith('---\nname: companion-prototype-design\n'))
        self.assertIn('\ndescription:', text)
        self.assertLess(len(text.splitlines()), 500)
        self.assertRegex(ROOT.name, r'^[a-z0-9-]+$')

    def test_all_explicit_skill_references_exist(self):
        text = (ROOT/'SKILL.md').read_text()
        references = re.findall(r'`((?:references|assets/templates)/[^`]+)`', text)
        self.assertGreaterEqual(len(references), 7)
        for file in references:
            with self.subTest(file=file): self.assertTrue((ROOT/file).is_file())

    def test_interview_agreement_and_authority_gates_are_present(self):
        text = (ROOT/'SKILL.md').read_text()
        for phrase in ['new-plugin', 'new-feature', 'improvement', 'explicitly agrees',
                       'no blocking gaps', 'Do not ask again', 'does not approve',
                       'not approval to commit or push', 'inline']:
            with self.subTest(phrase=phrase): self.assertIn(phrase, text)

    def test_fresh_session_prompt_carries_all_required_delivery_types(self):
        text = (ROOT/'assets/templates/execution-prompt.md').read_text()
        for phrase in ['prototype.html', 'companion.project.json', 'source/', 'package',
                       'lockfile', 'Vue 3', 'Pinia', 'Nuxt UI', 'subagents',
                       'file://', 'baseline', 'No access', 'TODO', 'docs/concepts/']:
            with self.subTest(phrase=phrase): self.assertIn(phrase, text)

    def test_references_distinguish_data_source_and_execution(self):
        text = (ROOT/'references/repository-contract.md').read_text()
        for phrase in ['schemaVersion: 5', 'Data-compatible', 'Generator-compatible',
                       'Experience-compatible', 'not a generator', 'does not append/merge',
                       'framework-free', 'Preflight']:
            with self.subTest(phrase=phrase): self.assertIn(phrase, text)

    def test_no_unshipped_runtime_imports_in_node_helpers(self):
        for file in (ROOT/'scripts').rglob('*.mjs'):
            text = file.read_text()
            for relative in re.findall(r"from ['\"](\.[^'\"]+)['\"]", text):
                with self.subTest(file=file.name, relative=relative):
                    self.assertTrue((file.parent/relative).is_file())

    def test_named_live_agent_evaluation_cases_are_not_claimed_as_execution(self):
        text = (ROOT/'examples/conversation-contracts.md').read_text()
        self.assertIn('not claims of automated live-agent evaluation', text)
        self.assertEqual(len(re.findall(r'^\d+\.', text, re.M)), 15)

if __name__ == '__main__':
    unittest.main()
