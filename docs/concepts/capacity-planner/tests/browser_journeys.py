#!/usr/bin/env python3
"""Optional browser journey for the self-contained Capacity Planner concept."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CHROMIUM = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=CHROMIUM, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors: list[str] = []
    page.on("console", lambda message: errors.append(f"console {message.type}: {message.text}") if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
    page.set_content(HTML, wait_until="load")

    assert page.locator(".role-row").count() == 5
    assert page.locator(".check-card").count() == 4
    assert page.locator(".iteration-summary-row").count() == 1

    page.locator('[data-action="allocate-role"]').first.click()
    page.locator('select[name="through"]').select_option(index=1)
    page.locator('input[name="fte"]').fill("0.8")
    page.locator('#dialog-form button[type="submit"]').click()
    assert "breach" in page.locator(".check-card").nth(1).inner_text().lower()

    task = page.locator("#backlog .task-card").first
    task.locator('[data-action="edit-task"]').click()
    page.locator('input[name="units"]').fill("40")
    page.locator('#dialog-form button[type="submit"]').click()
    page.locator("#backlog .task-card").first.locator('[data-action="assign-task"]').click()
    page.locator('select[name="roleId"]').select_option("role-ba")
    page.locator('select[name="iterationId"]').select_option(index=0)
    assert "exceeds planned capacity" in page.locator("#assignment-preview").inner_text()
    page.locator('#dialog-form button[type="submit"]').click()
    assert "overloaded" in page.locator(".check-card").nth(2).inner_text().lower()

    assigned = page.locator(".capacity-cell .task-card").filter(has_text="Release hardening")
    assigned.focus()
    page.keyboard.press("Enter")
    assert page.locator("#dialog").get_attribute("open") is not None
    page.keyboard.press("Escape")

    page.locator("#task-search").fill("operational")
    assert page.locator("#backlog .task-card").count() == 1
    page.locator("#task-search").fill("")

    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".planning-checks").is_visible()
    assert page.locator("#timeline-scroll").is_visible()

    assert not errors, "\n".join(errors)
    browser.close()

print("Capacity Planner browser journeys passed")
