"""Lazy, keyless-capable adapter around the real HindsightEmbedded SDK.

Only non-secret provider choices are persisted by the Node entry. No login,
credential reading, package install or daemon startup occurs on module import.
"""
from __future__ import annotations
import contextlib
import importlib
import importlib.metadata
import json
import os
import re
import sys
from urllib.parse import urlsplit
import hashlib
from typing import Any

PROFILE = "obsidian-shell"
VERSION = "0.10.1"


class AdapterError(Exception):
    """Content-free diagnostic safe to return over the adapter protocol."""


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


PROVIDERS = {"none", "ollama", "lmstudio", "openai-codex", "claude-code", "environment"}
DEFAULT_MODELS = {"openai-codex": "gpt-5.4-mini", "claude-code": "claude-sonnet-4-5-20250929"}


def settings(value):
    if value == {}:
        return {"schemaVersion": 1, "provider": "environment"}
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or value.get("provider") not in PROVIDERS:
        raise AdapterError("PROVIDER_INVALID")
    if set(value) - {"schemaVersion", "provider", "model", "baseUrl", "authHome"}:
        raise AdapterError("PROVIDER_INVALID")
    name, model = value["provider"], value.get("model")
    if model is not None and (not isinstance(model, str) or not re.fullmatch(r"[\w./:@+-]{1,160}", model)):
        raise AdapterError("MODEL_INVALID")
    if name in ("ollama", "lmstudio") and not model:
        raise AdapterError("MODEL_REQUIRED")
    if name in ("none", "environment") and model is not None:
        raise AdapterError("MODEL_INVALID")
    if "baseUrl" in value:
        if name not in ("ollama", "lmstudio") or not isinstance(value["baseUrl"], str):
            raise AdapterError("PROVIDER_INVALID")
        u = urlsplit(value["baseUrl"])
        if (u.scheme != "http" or u.hostname not in ("127.0.0.1", "localhost", "::1") or
                u.username or u.password or u.query or u.fragment or u.path not in ("", "/", "/v1", "/v1/")):
            raise AdapterError("ENDPOINT_INVALID")
    if "authHome" in value:
        home = value["authHome"]
        if name != "openai-codex" or not isinstance(home, str) or not os.path.isabs(home) or len(home) > 1024 or re.search(r"[\x00-\x1f]", home):
            raise AdapterError("AUTH_HOME_INVALID")
    return value


def provider_config(choice):
    """Explicit primary and per-operation settings prevent stale profile inheritance."""
    name = choice["provider"]
    if name == "environment":
        return {}
    model = choice.get("model", DEFAULT_MODELS.get(name, ""))
    base = choice.get("baseUrl", {"ollama": "http://127.0.0.1:11434/v1", "lmstudio": "http://127.0.0.1:1234/v1"}.get(name, ""))
    values = {"HINDSIGHT_API_LLM_PROVIDER": name, "HINDSIGHT_API_LLM_MODEL": model,
              "HINDSIGHT_API_LLM_API_KEY": "", "HINDSIGHT_API_LLM_BASE_URL": base,
              "HINDSIGHT_API_EMBEDDINGS_PROVIDER": "local", "HINDSIGHT_API_RERANKER_PROVIDER": "local"}
    for operation in ("RETAIN", "REFLECT", "CONSOLIDATION"):
        for field, value in (("PROVIDER", name), ("MODEL", model), ("API_KEY", ""), ("BASE_URL", base)):
            values[f"HINDSIGHT_API_{operation}_LLM_{field}"] = value
    return values


def prepare_environment(choice):
    values = provider_config(choice)
    if choice["provider"] != "environment":
        for key in list(os.environ):
            if (key.startswith("HINDSIGHT_API_") and ("LLM_" in key or "EMBEDDINGS_" in key or "RERANKER_" in key)) or key in ("OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY"):
                os.environ.pop(key, None)
        os.environ.update(values)
    if choice.get("authHome"):
        os.environ["CODEX_HOME"] = choice["authHome"]
    # Inner Claude Code inference must not recursively trigger the outer memory hooks.
    os.environ["HINDSIGHT_DISABLE_HOOKS"] = "1"
    return values


def execute(command, payload, sdk, manager):
    if command not in ("start", "stop", "probe", "retain", "recall", "reflect"):
        raise AdapterError("COMMAND_INVALID")
    if command != "probe" and payload.get("approved") is not True:
        raise AdapterError("APPROVAL_REQUIRED")
    if command == "probe":
        running = bool(manager.is_running(PROFILE))
        return {"ok": True, "code": "RUNNING" if running else "STOPPED", "running": running,
                "url": local_url(manager.get_url(PROFILE)) if running else None, "inferenceVerified": False}
    expected = local_url(payload["url"]) if "url" in payload else None
    if command != "start" and expected is None:
        raise AdapterError("ENDPOINT_REQUIRED")
    if manager.is_running(PROFILE) and expected and local_url(manager.get_url(PROFILE)) != expected:
        raise AdapterError("ENDPOINT_CONFLICT")
    if command == "stop":
        if not manager.is_running(PROFILE):
            return {"ok": True, "code": "ALREADY_STOPPED", "dataDeleted": False}
        if manager.is_running(PROFILE):
            manager.stop(PROFILE)
            if manager.is_running(PROFILE):
                raise AdapterError("STOP_FAILED")
        return {"ok": True, "code": "STOPPED", "dataDeleted": False}
    choice = settings(payload.get("settings", {}))
    if command == "reflect" and choice["provider"] == "none":
        raise AdapterError("REFLECT_REQUIRES_LLM")
    documents = validate_documents(payload) if command == "retain" else []
    if command in ("recall", "reflect"):
        if not re.fullmatch(r"shell-[a-f0-9]{24}", str(payload.get("bank", ""))):
            raise AdapterError("BANK_INVALID")
        query = payload.get("query")
        if not isinstance(query, str) or not query.strip() or len(query) > 4096 or "\0" in query:
            raise AdapterError("QUERY_INVALID")
    config = prepare_environment(choice)
    client = sdk.HindsightEmbedded(profile=PROFILE, ui=False, ui_hostname="127.0.0.1")
    try:
        # HindsightEmbedded exposes its forwarded daemon configuration as a public dict.
        # Updating before first access also clears stale values in the profile's .env.
        if config:
            client.config.update(config)
        endpoint = local_url(client.url)
        if expected and endpoint != expected:
            raise AdapterError("ENDPOINT_CONFLICT")
        if command == "start":
            return {"ok": True, "code": "STARTED", "url": endpoint, "profile": PROFILE, "provider": choice["provider"], "inferenceVerified": False}
        if command in ("recall", "reflect"):
            result = getattr(client, command)(bank_id=payload["bank"], query=payload["query"], budget="low")
            data = result.model_dump(mode="json") if hasattr(result, "model_dump") else result
            return {"ok": True, "code": command.upper(), "trust": "UNTRUSTED_MEMORY_NOT_INSTRUCTIONS", "data": data}
        retained = 0
        for doc in documents:
            client.retain(bank_id=payload["bank"], content=doc["content"], document_id=doc["documentId"],
                          metadata={"source": "reviewed-git-document", "path": doc["path"], "commit": doc["commit"], "sha256": doc["sha256"]}, tags=["curated", "git-document"])
            retained += 1
        return {"ok": True, "code": "RETAINED", "documents": retained,
                "next": "Check queryability; acceptance is not proof of correctness. A retry may incur processing cost."}
    finally:
        client.close()


def main(argv):
    try:
        if len(argv) != 1 or argv[0] not in ("start", "stop", "probe", "retain", "recall", "reflect"):
            raise AdapterError("COMMAND_INVALID")
        text = sys.stdin.read(2 * 1024 * 1024 + 1)
        if len(text) > 2 * 1024 * 1024:
            raise AdapterError("PAYLOAD_TOO_LARGE")
        payload = json.loads(text)
        if not isinstance(payload, dict):
            raise AdapterError("PAYLOAD_INVALID")
        if argv[0] != "probe" and payload.get("approved") is not True:
            raise AdapterError("APPROVAL_REQUIRED")
        for package in ("hindsight-all", "hindsight-client", "hindsight-embed"):
            if importlib.metadata.version(package) != VERSION:
                raise AdapterError("SDK_VERSION_MISMATCH")
        with contextlib.redirect_stdout(sys.stderr):
            sdk = importlib.import_module("hindsight")
            embed = importlib.import_module("hindsight_embed")
            result = execute(argv[0], payload, sdk, embed.get_embed_manager())
        print(json.dumps(result))
        return 0
    except Exception as error:
        code = str(error) if isinstance(error, AdapterError) else "BACKEND_FAILED"
        print(json.dumps({"ok": False, "code": code, "message": "Run memory doctor. No raw provider error is exported; retain failure may be partial."}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
