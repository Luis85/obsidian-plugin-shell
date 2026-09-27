"""Narrow JSON adapter for the optional, pinned Python HindsightEmbedded SDK.

No imports of the SDK, daemon startup, or downloads occur merely by importing
this file. Credentials are inherited from the user's environment/profile, never
accepted through JSON, command arguments, returned JSON, or exception messages.
"""
from __future__ import annotations

import contextlib
import hashlib
import importlib
import importlib.metadata
import json
import re
import sys
from typing import Any
from urllib.parse import urlsplit

PROFILE = "obsidian-shell"
VERSION = "0.10.1"


class AdapterError(Exception):
    """An intentionally content-free, machine-readable diagnostic."""


def local_url(value: Any) -> str:
    if not isinstance(value, str):
        raise AdapterError("ENDPOINT_INVALID")
    parsed = urlsplit(value)
    if (parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1")
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ("", "/")):
        raise AdapterError("ENDPOINT_INVALID")
    return value.rstrip("/")


def validate_documents(payload: dict[str, Any]) -> list[dict[str, Any]]:
    bank, documents = payload.get("bank"), payload.get("documents")
    if not isinstance(bank, str) or not re.fullmatch(r"shell-[0-9a-f]{24}", bank):
        raise AdapterError("BANK_INVALID")
    if not isinstance(documents, list) or not 1 <= len(documents) <= 20:
        raise AdapterError("SOURCE_INVALID")
    seen: set[str] = set()
    for doc in documents:
        if not isinstance(doc, dict):
            raise AdapterError("SOURCE_INVALID")
        path, content = doc.get("path"), doc.get("content")
        if not isinstance(path, str) or not re.fullmatch(r"docs/memory/(?:[a-z0-9][a-z0-9-]*/)*[a-z0-9][a-z0-9-]*\.md", path):
            raise AdapterError("SOURCE_DENIED")
        if not isinstance(content, str) or not content.strip() or "\0" in content or len(content.encode()) > 65536:
            raise AdapterError("SOURCE_INVALID")
        if doc.get("sha256") != hashlib.sha256(content.encode()).hexdigest():
            raise AdapterError("SOURCE_CHANGED")
        if not isinstance(doc.get("commit"), str) or not re.fullmatch(r"[a-f0-9]{40,64}", doc["commit"]):
            raise AdapterError("COMMIT_INVALID")
        if doc.get("documentId") != f"curated:{bank}:{path}" or path in seen:
            raise AdapterError("SOURCE_INVALID")
        seen.add(path)
    return documents


def execute(command: str, payload: dict[str, Any], sdk: Any, manager: Any) -> dict[str, Any]:
    """Application boundary, injected SDK/manager for credential-free contract tests."""
    if command not in ("start", "stop", "retain") or payload.get("approved") is not True:
        raise AdapterError("APPROVAL_REQUIRED")
    expected = local_url(payload["url"]) if "url" in payload else None
    if command != "start" and expected is None:
        raise AdapterError("ENDPOINT_REQUIRED")
    documents = validate_documents(payload) if command == "retain" else []
    if manager.is_running(PROFILE) and expected and local_url(manager.get_url(PROFILE)) != expected:
        raise AdapterError("ENDPOINT_CONFLICT")
    if command == "stop":
        if not manager.is_running(PROFILE):
            return {"ok": True, "code": "ALREADY_STOPPED"}
        manager.stop(PROFILE)
        if manager.is_running(PROFILE):
            raise AdapterError("STOP_FAILED")
        return {"ok": True, "code": "STOPPED", "dataDeleted": False}
    # Explicit loopback UI hostname as defense in depth, even though UI is disabled.
    client = sdk.HindsightEmbedded(profile=PROFILE, ui=False, ui_hostname="127.0.0.1")
    try:
        endpoint = local_url(client.url)
        if expected and endpoint != expected:
            raise AdapterError("ENDPOINT_CONFLICT")
        if command == "start":
            return {"ok": True, "code": "STARTED", "url": endpoint, "profile": PROFILE}
        retained = 0
        for doc in documents:
            client.retain(bank_id=payload["bank"], content=doc["content"],
                          document_id=doc["documentId"],
                          metadata={"source": "reviewed-git-document", "path": doc["path"],
                                    "commit": doc["commit"], "sha256": doc["sha256"]},
                          tags=["curated", "git-document"])
            retained += 1
        return {"ok": True, "code": "RETAINED", "documents": retained,
                "next": "Verify queryability with hindsight_sync_status. Extraction is not proof of factual correctness."}
    finally:
        # The daemon is shared across opted-in checkouts; closing a client must not stop it.
        client.close()


def main(argv: list[str]) -> int:
    if len(argv) != 1 or argv[0] not in ("start", "stop", "retain"):
        print(json.dumps({"ok": False, "code": "COMMAND_INVALID"}))
        return 1
    try:
        text = sys.stdin.read(2 * 1024 * 1024 + 1)
        if len(text) > 2 * 1024 * 1024:
            raise AdapterError("PAYLOAD_TOO_LARGE")
        payload = json.loads(text)
        if not isinstance(payload, dict) or payload.get("approved") is not True:
            raise AdapterError("APPROVAL_REQUIRED")
        if importlib.metadata.version("hindsight-all") != VERSION:
            raise AdapterError("SDK_VERSION_MISMATCH")
        with contextlib.redirect_stdout(sys.stderr):
            sdk = importlib.import_module("hindsight")
            embed = importlib.import_module("hindsight_embed")
            result = execute(argv[0], payload, sdk, embed.get_embed_manager())
        print(json.dumps(result))
        return 0
    except Exception as error:  # Never serialize provider errors or source content.
        code = str(error) if isinstance(error, AdapterError) else "BACKEND_FAILED"
        print(json.dumps({"ok": False, "code": code,
                          "message": "Check the local prerequisites/profile. A retain failure may be partial; retry the same reviewed document IDs."}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
