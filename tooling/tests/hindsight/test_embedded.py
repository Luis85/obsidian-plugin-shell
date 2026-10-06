"""Offline adapter contracts; these tests do not install or run the real Hindsight SDK."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("adapter", Path(__file__).resolve().parents[2] / "scripts/hindsight/embedded.py")
A = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(A)
URL = "http://127.0.0.1:9876"
BANK = "shell-" + "a" * 24


class Manager:
    def __init__(self):
        self.running = True
        self.stopped = False

    def is_running(self, profile):
        assert profile == A.PROFILE
        return self.running

    def get_url(self, profile):
        return URL

    def stop(self, profile):
        self.running = False
        self.stopped = True


class Client:
    url = URL

    def __init__(self):
        self.calls = []
        self.closed = False

    def retain(self, **kwargs):
        self.calls.append(kwargs)

    def close(self):
        self.closed = True


def payload():
    path, text = "docs/memory/example.md", "A reviewed decision.\n"
    return {"approved": True, "url": URL, "bank": BANK, "documents": [
        {"path": path, "content": text, "sha256": hashlib.sha256(text.encode()).hexdigest(),
         "documentId": f"curated:{BANK}:{path}", "commit": "b" * 40}]}


class AdapterContracts(unittest.TestCase):
    def setUp(self):
        self.manager = Manager()
        self.client = Client()
        self.created = []

        def factory(**kwargs):
            self.created.append(kwargs)
            return self.client
        self.sdk = SimpleNamespace(HindsightEmbedded=factory)

    def test_import_does_not_require_sdk(self):
        self.assertEqual(A.PROFILE, "obsidian-shell")

    def test_start_uses_public_embedded_api_without_credential_kwargs(self):
        result = A.execute("start", {"approved": True}, self.sdk, self.manager)
        self.assertEqual(result["url"], URL)
        self.assertEqual(self.created, [{"profile": "obsidian-shell", "ui": False, "ui_hostname": "127.0.0.1"}])
        self.assertTrue(self.client.closed)
        self.assertFalse(self.manager.stopped)

    def test_retain_passes_stable_ids_and_source_provenance(self):
        source = payload()
        result = A.execute("retain", source, self.sdk, self.manager)
        self.assertEqual(result["documents"], 1)
        call = self.client.calls[0]
        self.assertEqual(call["document_id"], source["documents"][0]["documentId"])
        self.assertEqual(call["metadata"]["commit"], "b" * 40)
        self.assertEqual(call["tags"], ["curated", "git-document"])
        self.assertTrue(self.client.closed)

    def test_validation_checks_entire_batch_before_first_retain(self):
        source = payload()
        source["documents"].append({"path": ".env"})
        with self.assertRaises(A.AdapterError):
            A.execute("retain", source, self.sdk, self.manager)
        self.assertEqual(self.client.calls, [])
        self.assertEqual(self.created, [])

    def test_source_hash_mismatch_and_duplicates_are_rejected(self):
        source = payload()
        source["documents"][0]["sha256"] = "changed"
        with self.assertRaisesRegex(A.AdapterError, "SOURCE_CHANGED"):
            A.validate_documents(source)
        source = payload()
        source["documents"] *= 2
        with self.assertRaisesRegex(A.AdapterError, "SOURCE_INVALID"):
            A.validate_documents(source)

    def test_stop_never_constructs_client_or_starts_daemon(self):
        self.assertEqual(A.execute("stop", {"approved": True, "url": URL}, self.sdk, self.manager)["code"], "STOPPED")
        self.assertEqual(self.created, [])
        self.assertEqual(A.execute("stop", {"approved": True, "url": URL}, self.sdk, self.manager)["code"], "ALREADY_STOPPED")

    def test_approval_is_required(self):
        with self.assertRaisesRegex(A.AdapterError, "APPROVAL_REQUIRED"):
            A.execute("start", {}, self.sdk, self.manager)
        self.assertEqual(self.created, [])

    def test_endpoint_conflict_does_not_stop_foreign_server(self):
        with self.assertRaisesRegex(A.AdapterError, "ENDPOINT_CONFLICT"):
            A.execute("stop", {"approved": True, "url": "http://localhost:9999"}, self.sdk, self.manager)
        self.assertFalse(self.manager.stopped)

    def test_retain_failure_closes_client_without_stopping_profile(self):
        def fail(**kwargs):
            raise RuntimeError("SECRET provider body")
        self.client.retain = fail
        with self.assertRaises(RuntimeError):
            A.execute("retain", payload(), self.sdk, self.manager)
        self.assertTrue(self.client.closed)
        self.assertFalse(self.manager.stopped)

    def test_protocol_redacts_third_party_errors(self):
        output = io.StringIO()
        with patch.object(A.sys, "stdin", io.StringIO('{"approved":true}')), patch.object(A.sys, "stdout", output), \
                patch.object(A.importlib.metadata, "version", side_effect=RuntimeError("SECRET")):
            self.assertEqual(A.main(["start"]), 1)
        self.assertNotIn("SECRET", output.getvalue())
        self.assertEqual(json.loads(output.getvalue())["code"], "BACKEND_FAILED")

    def test_wrong_version_never_imports_sdk(self):
        output = io.StringIO()
        with patch.object(A.sys, "stdin", io.StringIO('{"approved":true}')), patch.object(A.sys, "stdout", output), \
                patch.object(A.importlib.metadata, "version", return_value="wrong"):
            self.assertEqual(A.main(["start"]), 1)
        self.assertEqual(json.loads(output.getvalue())["code"], "SDK_VERSION_MISMATCH")

    def test_endpoint_validation(self):
        for url in ["https://cloud.invalid", "http://user:secret@localhost", "http://localhost/path"]:
            with self.assertRaises(A.AdapterError):
                A.local_url(url)


if __name__ == "__main__":
    unittest.main()
