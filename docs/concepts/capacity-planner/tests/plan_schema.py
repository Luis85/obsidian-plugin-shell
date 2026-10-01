#!/usr/bin/env python3
"""Validate a real engine-exported plan against the checked-in JSON Schema."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from jsonschema import Draft202012Validator
import json, os

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text(encoding="utf-8")
SCHEMA=json.loads((ROOT/"plan.schema.json").read_text(encoding="utf-8"))
CHROMIUM=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium")

Draft202012Validator.check_schema(SCHEMA)
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path=CHROMIUM,args=["--no-sandbox"])
    page=browser.new_page(accept_downloads=True);page.set_content(HTML,wait_until="load")
    page.locator("#manage-btn").click()
    with page.expect_download() as exported: page.locator('[data-action="export-plan"]').click()
    document=json.loads(Path(exported.value.path()).read_text(encoding="utf-8"))
    errors=sorted(Draft202012Validator(SCHEMA).iter_errors(document),key=lambda e:list(e.path))
    assert not errors,"\n".join(f"{list(error.path)}: {error.message}" for error in errors)
    browser.close()
print("Capacity Planner whole-plan JSON Schema validation passed")
