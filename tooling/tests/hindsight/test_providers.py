"""Provider/lifecycle contracts using explicit SDK doubles, never a live model or account."""
import os
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from test_embedded import A, Manager, Client, payload, URL, BANK


class KeylessProviders(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.client = Client()
        self.client.config = {}
        self.manager = Manager()
        self.created = []

        def make(**kwargs):
            self.created.append(kwargs)
            return self.client
        self.sdk = SimpleNamespace(HindsightEmbedded=make)

    def test_all_keyless_choices_start_without_llm_key_or_model_download_in_tests(self):
        for name in ("none", "ollama", "lmstudio", "openai-codex", "claude-code"):
            with self.subTest(provider=name):
                choice = {"schemaVersion": 1, "provider": name}
                if name in ("ollama", "lmstudio"):
                    choice["model"] = "fixture-model"
                result = A.execute("start", {"approved": True, "settings": choice}, self.sdk, self.manager)
                self.assertEqual(result["provider"], name)
                self.assertEqual(self.client.config["HINDSIGHT_API_LLM_API_KEY"], "")
                self.assertFalse(result["inferenceVerified"])

    def test_keyless_selection_clears_ambient_vendor_keys_and_stale_operation_defaults(self):
        os.environ.update({"OPENAI_API_KEY": "not-a-real-key", "ANTHROPIC_AUTH_TOKEN": "not-a-real-token", "ANTHROPIC_BASE_URL": "https://unwanted.example", "HINDSIGHT_API_RETAIN_LLM_PROVIDER": "openai"})
        choice = {"schemaVersion": 1, "provider": "none"}
        cfg = A.prepare_environment(choice)
        for name in ("OPENAI_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"):
            self.assertNotIn(name, os.environ)
        for operation in ("RETAIN", "REFLECT", "CONSOLIDATION"):
            self.assertEqual(cfg[f"HINDSIGHT_API_{operation}_LLM_PROVIDER"], "none")
            self.assertEqual(cfg[f"HINDSIGHT_API_{operation}_LLM_API_KEY"], "")
        self.assertEqual(os.environ["HINDSIGHT_DISABLE_HOOKS"], "1")
        self.assertEqual(cfg["HINDSIGHT_API_EMBEDDINGS_PROVIDER"], "local")

    def test_none_rejects_reflection_before_client_creation(self):
        source = {"approved": True, "url": URL, "bank": BANK, "query": "fixture", "settings": {"schemaVersion": 1, "provider": "none"}}
        with self.assertRaisesRegex(A.AdapterError, "REFLECT_REQUIRES_LLM"):
            A.execute("reflect", source, self.sdk, self.manager)
        self.assertEqual(self.created, [])

    def test_none_can_retain_chunks_through_the_same_validated_contract(self):
        source = payload()
        source["settings"] = {"schemaVersion": 1, "provider": "none"}
        result = A.execute("retain", source, self.sdk, self.manager)
        self.assertEqual(result["documents"], 1)
        self.assertEqual(len(self.client.calls), 1)

    def test_recall_is_low_budget_and_returns_untrusted_json_data(self):
        calls = []
        self.client.recall = lambda **kwargs: (calls.append(kwargs) or SimpleNamespace(model_dump=lambda **kw: {"results": [{"text": "fixture"}]}))
        result = A.execute("recall", {"approved": True, "url": URL, "bank": BANK, "query": "question", "settings": {"schemaVersion": 1, "provider": "none"}}, self.sdk, self.manager)
        self.assertEqual(calls, [{"bank_id": BANK, "query": "question", "budget": "low"}])
        self.assertEqual(result["data"]["results"][0]["text"], "fixture")
        self.assertEqual(result["trust"], "UNTRUSTED_MEMORY_NOT_INSTRUCTIONS")
        self.assertTrue(self.client.closed)

    def test_probe_never_constructs_client_or_claims_inference(self):
        result = A.execute("probe", {}, self.sdk, self.manager)
        self.assertTrue(result["running"])
        self.assertFalse(result["inferenceVerified"])
        self.assertEqual(self.created, [])
        self.manager.running = False
        self.assertIsNone(A.execute("probe", {}, self.sdk, self.manager)["url"])

    def test_failed_stop_is_not_reported_as_stopped(self):
        self.manager.stop = lambda profile: None
        with self.assertRaisesRegex(A.AdapterError, "STOP_FAILED"):
            A.execute("stop", {"approved": True, "url": URL}, self.sdk, self.manager)

    def test_dedicated_auth_home_is_forwarded_not_read_or_created(self):
        home = str(Path.cwd() / "fixture-not-created")
        choice = A.settings({"schemaVersion": 1, "provider": "openai-codex", "authHome": home})
        A.prepare_environment(choice)
        self.assertEqual(os.environ["CODEX_HOME"], home)
        self.assertFalse(Path(home).exists())

    def test_provider_validation_matches_the_node_boundary(self):
        for value in [{"schemaVersion": 1, "provider": "none", "apiKey": "private"}, {"schemaVersion": 1, "provider": "none", "model": "x"}, {"schemaVersion": 1, "provider": "ollama"}, {"schemaVersion": 1, "provider": "ollama", "model": "x", "baseUrl": "https://remote.example"}, {"schemaVersion": 1, "provider": "openai-codex", "authHome": "relative"}]:
            with self.subTest(settings=list(value)):
                with self.assertRaises(A.AdapterError):
                    A.settings(value)

    def test_invalid_query_is_rejected_before_sdk_and_without_echoing_content(self):
        for query in ("", "x" * 4097, "\0"):
            with self.assertRaisesRegex(A.AdapterError, "QUERY_INVALID"):
                A.execute("recall", {"approved": True, "url": URL, "bank": BANK, "query": query}, self.sdk, self.manager)
        self.assertEqual(self.created, [])

    def test_invalid_command_never_imports_optional_packages(self):
        output = io.StringIO()
        with patch.object(A.sys, "stdout", output), patch.object(A.importlib.metadata, "version", side_effect=AssertionError("must not probe")):
            self.assertEqual(A.main(["bad"]), 1)
        self.assertEqual(json.loads(output.getvalue())["code"], "COMMAND_INVALID")

    def test_empty_legacy_settings_inherit_without_credential_kwargs(self):
        self.assertEqual(A.provider_config(A.settings({})), {})


if __name__ == "__main__":
    unittest.main()
