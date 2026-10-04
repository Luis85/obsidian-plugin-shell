#!/usr/bin/env python3
"""Exercise delegated interactions not covered by the primary product journey."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text(encoding="utf-8")
CHROMIUM=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium")

def submit(page): page.locator('#dialog-form button[type="submit"]').click()
def manage(page,action,title):
    page.locator('#manage-btn').click();page.locator(f'[data-action="{action}"]').click();assert title.lower() in page.locator('#dialog-title').inner_text().lower()

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path=CHROMIUM,args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":1440,"height":950})
    errors=[]
    page.on("console",lambda message: errors.append(f"console {message.type}: {message.text}") if message.type=="error" else None)
    page.on("pageerror",lambda error: errors.append(f"pageerror: {error}"))
    page.set_content(HTML,wait_until="load")

    # Edit role.
    manage(page,"team","Team & role catalog")
    role_row=page.locator('.management-row').filter(has_text="Delivery Manager").first
    role_row.locator('[data-action="edit-role"]').click()
    page.locator('input[name="dayRate"]').fill("975")
    submit(page)
    assert "975" in page.locator('.role-row').filter(has_text="Delivery Manager").inner_text()

    # Edit person.
    manage(page,"team","Team & role catalog")
    person_row=page.locator('.management-row').filter(has_text="Alex").first
    person_row.locator('[data-action="edit-person"]').click()
    page.locator('input[name="baseFte"]').fill("0.6")
    submit(page)
    manage(page,"team","Team & role catalog")
    assert "0,6 base FTE" in page.locator('.management-row').filter(has_text="Alex").first.inner_text()
    page.keyboard.press("Escape")

    # Edit task estimate.
    task=page.locator('#backlog .task-card').filter(has_text="Release hardening")
    task.locator('[data-action="edit-task"]').click()
    page.locator('input[name="units"]').fill("11")
    submit(page)
    assert "66 h" in page.locator('#backlog .task-card').filter(has_text="Release hardening").inner_text()

    # Edit an existing allocation, then remove it and verify work returns to scope.
    allocation=page.locator('.allocation-card').filter(has_text="Kick-off and delivery setup")
    allocation.locator('[data-action="edit-allocation"]').click()
    page.locator('input[name="hours"]').fill("25")
    submit(page)
    allocation=page.locator('.allocation-card').filter(has_text="Kick-off and delivery setup")
    assert "25 h planned" in allocation.inner_text()
    allocation.locator('[data-action="remove-allocation"]').click()
    assert page.locator('.allocation-card').filter(has_text="Kick-off and delivery setup").count()==0
    assert page.locator('#backlog .task-card').filter(has_text="Kick-off and delivery setup").count()==1

    # Edit and remove non-labor costs. Removal refreshes the still-open dialog.
    manage(page,"commercial","Commercials")
    cloud=page.locator('.management-row').filter(has_text="Cloud environments")
    cloud.locator('[data-action="edit-nonlabor"]').click()
    page.locator('input[name="actual"]').fill("5000")
    submit(page)
    manage(page,"commercial","Commercials")
    assert "5.000" in page.locator('.management-row').filter(has_text="Cloud environments").inner_text()
    security=page.locator('.management-row').filter(has_text="External security review")
    security.locator('[data-action="remove-nonlabor"]').click()
    assert "commercials" in page.locator('#dialog-title').inner_text().lower()
    assert page.locator('.management-row').filter(has_text="External security review").count()==0
    page.keyboard.press("Escape")

    # Baseline strip opens baseline management; restore creates and opens a new plan.
    page.locator('#baseline-strip [data-action="open-baselines"]').click()
    assert "baselines" in page.locator('#dialog-title').inner_text().lower()
    page.locator('[data-action="create-baseline"]').click()
    page.locator('input[name="name"]').fill("Interaction baseline")
    submit(page)
    before_restore=page.locator('#scenario-select option').count()
    page.locator('#baseline-strip [data-action="open-baselines"]').click()
    row=page.locator('.baseline-row').filter(has_text="Interaction baseline")
    row.locator('[data-action="restore-baseline"]').click()
    assert page.locator('#scenario-select option').count()==before_restore+1
    assert "Interaction baseline restored" in page.locator('#plan-heading').inner_text()

    # Duplicate closes the stale Plans dialog and opens the copy.
    before_duplicate=page.locator('#scenario-select option').count()
    manage(page,"plans","Resource plans")
    page.locator('.management-row.selected [data-action="duplicate-scenario"]').click()
    assert page.locator('#dialog').get_attribute('open') is None
    assert page.locator('#scenario-select option').count()==before_duplicate+1
    assert "copy" in page.locator('#plan-heading').inner_text().lower()

    # Archive closes the dialog and moves the active plan to another live scenario.
    before_archive=page.locator('#scenario-select option').count()
    manage(page,"plans","Resource plans")
    page.locator('.management-row.selected [data-action="archive-scenario"]').click()
    assert page.locator('#dialog').get_attribute('open') is None
    assert page.locator('#scenario-select option').count()==before_archive-1

    # Activate another scenario from Plans and close the manager.
    manage(page,"plans","Resource plans")
    open_button=page.locator('[data-action="activate-scenario"]').first
    target_name=open_button.locator('xpath=ancestor::div[contains(@class,"management-row")]//strong').inner_text()
    open_button.click()
    assert page.locator('#dialog').get_attribute('open') is None
    assert page.locator('#plan-heading').inner_text()==target_name

    assert not errors,"\n".join(errors)
    browser.close()

print("Capacity Planner delegated interaction matrix passed")
