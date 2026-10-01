#!/usr/bin/env python3
"""Behavior and no-op regression journey for the self-contained Capacity Planner."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text(encoding="utf-8")
CHROMIUM=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium")

def open_dialog(page, selector, title_fragment):
    page.locator(selector).click()
    assert title_fragment.lower() in page.locator("#dialog-title").inner_text().lower()

def submit(page):
    page.locator('#dialog-form button[type="submit"]').click()

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path=CHROMIUM,args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":1440,"height":1000},accept_downloads=True)
    errors=[]
    page.on("console",lambda message: errors.append(f"console {message.type}: {message.text}") if message.type=="error" else None)
    page.on("pageerror",lambda error: errors.append(f"pageerror: {error}"))
    page.set_content(HTML,wait_until="load")

    assert page.locator(".role-row").count()==5
    assert page.locator(".check-card").count()==5
    assert page.locator("#scenario-select option").count()==1
    initial_revision=page.locator("#revision-pill").inner_text()

    # Save is never a no-op: opaque test origin cannot persist, so a backup download is expected.
    with page.expect_download() as saved:
        page.locator("#save-btn").click()
    assert saved.value.suggested_filename.endswith(".json")

    # New resource plan creates a second plan and increments revision.
    open_dialog(page,"#new-plan-btn","New resource plan")
    page.locator('input[name="name"]').fill("Constrained Plan")
    submit(page)
    assert page.locator("#scenario-select option").count()==2
    assert page.locator("#scenario-select").input_value()!= "scenario-baseline"
    assert page.locator("#revision-pill").inner_text()!=initial_revision

    # Plan settings save actually changes the active plan.
    open_dialog(page,"#plan-settings-btn","Plan settings")
    page.locator('input[name="name"]').fill("Constrained Delivery Plan")
    submit(page)
    assert page.locator("#plan-heading").inner_text()=="Constrained Delivery Plan"

    # Shared timeline/project save mutates project facts without creating scenario-owned iterations.
    open_dialog(page,"#timeline-btn","Project & shared timeline")
    page.locator('input[name="orderValue"]').fill("450000")
    submit(page)
    assert "450" in page.locator("#kpis .kpi").nth(3).inner_text()

    # Team: add role, add person, update availability and plan FTE/rate.
    open_dialog(page,"#team-btn","Team & role catalog")
    page.locator('[data-action="add-role"]').click()
    page.locator('input[name="name"]').fill("Security Engineer")
    page.locator('input[name="dayRate"]').fill("1000")
    submit(page)
    assert page.locator(".role-row").count()==6

    open_dialog(page,"#team-btn","Team & role catalog")
    page.locator('[data-action="add-person"]').click()
    page.locator('input[name="name"]').fill("Morgan")
    page.locator('select[name="roleId"]').select_option(label="Security Engineer")
    submit(page)

    open_dialog(page,"#team-btn","Team & role catalog")
    person_row=page.locator(".management-row").filter(has_text="Morgan")
    person_row.locator('[data-action="person-availability"]').click()
    page.locator('input[name="fte"]').fill("0.5")
    submit(page)

    security_row=page.locator(".role-row").filter(has_text="Security Engineer")
    security_row.locator('[data-action="plan-fte"]').click()
    page.locator('input[name="fte"]').fill("0.6")
    page.locator('input[name="rate"]').fill("1100")
    submit(page)
    assert "1.100" in page.locator(".role-row").filter(has_text="Security Engineer").inner_text()

    # Add work, allocate it, record actuals and split across cells.
    open_dialog(page,"#add-task-btn","Add task")
    page.locator('input[name="title"]').fill("Threat modelling")
    page.locator('input[name="units"]').fill("10")
    submit(page)
    task=page.locator("#backlog .task-card").filter(has_text="Threat modelling")
    assert task.count()==1
    task.locator('[data-action="allocate-task"]').click()
    page.locator('select[name="roleId"]').select_option(label="Security Engineer")
    page.locator('select[name="personId"]').select_option(label="Morgan")
    page.locator('input[name="hours"]').fill("30")
    submit(page)
    assert page.locator(".allocation-card").filter(has_text="Threat modelling").count()==1
    assert page.locator("#backlog .task-card").filter(has_text="Threat modelling").count()==1  # remaining work proves span support

    allocation=page.locator(".allocation-card").filter(has_text="Threat modelling")
    allocation.locator('[data-action="record-actual"]').click()
    page.locator('input[name="hours"]').fill("4")
    submit(page)
    assert "4" in page.locator(".allocation-card").filter(has_text="Threat modelling").inner_text()

    # Drag/drop uses the same allocation dialog and can place the remaining slice in another iteration.
    remaining=page.locator("#backlog .task-card").filter(has_text="Threat modelling")
    security_row=page.locator(".role-row").filter(has_text="Security Engineer")
    remaining.drag_to(security_row.locator(".capacity-cell").nth(1))
    assert "allocate" in page.locator("#dialog-title").inner_text().lower()
    page.locator('input[name="hours"]').fill("30")
    submit(page)
    assert page.locator("#backlog .task-card").filter(has_text="Threat modelling").count()==0
    assert page.locator(".allocation-card").filter(has_text="Threat modelling").count()==2

    # Commercial: add a non-labor cost and verify it renders.
    open_dialog(page,"#commercial-btn","Commercials")
    page.locator('[data-action="add-nonlabor"]').click()
    page.locator('input[name="name"]').fill("Pen test")
    page.locator('input[name="planned"]').fill("15000")
    submit(page)
    open_dialog(page,"#commercial-btn","Commercials")
    assert page.locator(".management-row").filter(has_text="Pen test").count()==1
    page.keyboard.press("Escape")

    # Baseline lifecycle: create, approve and show comparison strip.
    open_dialog(page,"#baselines-btn","Baselines")
    page.locator('[data-action="create-baseline"]').click()
    page.locator('input[name="name"]').fill("Steering baseline")
    submit(page)
    assert "Steering baseline" in page.locator("#baseline-strip").inner_text()
    open_dialog(page,"#baselines-btn","Baselines")
    page.locator('[data-action="approve-baseline"]').first.click()
    assert "approved" in page.locator("#dialog").inner_text().lower()
    page.keyboard.press("Escape")
    before_restore=page.locator("#scenario-select option").count()
    open_dialog(page,"#baselines-btn","Baselines")
    page.locator('[data-action="restore-baseline"]').first.click()
    assert page.locator("#scenario-select option").count()==before_restore+1
    assert "restored" in page.locator("#plan-heading").inner_text().lower()

    # Scenario manager: duplicate and archive are real mutations, not menu decoration.
    open_dialog(page,"#plans-btn","Resource plans / scenarios")
    before_plans=page.locator("#scenario-select option").count()
    page.locator('[data-action="duplicate-scenario"]').first.click()
    page.keyboard.press("Escape")
    assert page.locator("#scenario-select option").count()==before_plans+1
    open_dialog(page,"#plans-btn","Resource plans / scenarios")
    active_row=page.locator(".management-row.selected")
    active_row.locator('[data-action="archive-scenario"]').click()
    page.keyboard.press("Escape")
    assert page.locator("#scenario-select option").count()==before_plans

    # Scenario comparison is a real flow.
    open_dialog(page,"#compare-btn","Compare resource plans")
    assert page.locator(".compare-table tbody tr").count()>=3
    page.keyboard.press("Escape")

    # Audit has entries from prior mutations.
    open_dialog(page,"#audit-btn","Audit & revisions")
    assert page.locator(".audit-row").count()>=8
    page.keyboard.press("Escape")

    # Persistence settings save and Markdown export both have observable effects.
    open_dialog(page,"#persistence-btn","Obsidian persistence contract")
    page.locator('input[name="basePath"]').fill("Projects/Capacity Demo")
    submit(page)
    open_dialog(page,"#persistence-btn","Obsidian persistence contract")
    assert "Projects/Capacity Demo" in page.locator("#dialog").inner_text()
    with page.expect_download() as markdown:
        page.locator('[data-action="export-markdown"]').click()
    assert markdown.value.suggested_filename.endswith(".zip")
    page.keyboard.press("Escape")

    # Workspace export works; Import is wired to the file input (file chooser path is not a no-op).
    with page.expect_download() as exported:
        page.locator("#export-btn").click()
    assert exported.value.suggested_filename.endswith(".json")
    with page.expect_file_chooser():
        page.locator("#import-btn").click()
    assert page.locator("#workspace-import").count()==1

    # Scenario selector switches plans and retains project facts.
    page.locator("#scenario-select").select_option("scenario-baseline")
    assert page.locator("#plan-heading").inner_text()=="Baseline Delivery Plan"
    assert page.locator(".role-row").count()==6

    # Iteration authority can switch to an upstream Iteration Planner contract without scenario-owned dates.
    open_dialog(page,"#timeline-btn","Project & shared timeline")
    page.locator('select[name="timelineOwner"]').select_option("iteration-planner")
    submit(page)
    assert "Iteration Planner owned" in page.locator("#timeline-pill").inner_text()

    # Mobile rendering still exposes key actions and the scrollable timeline.
    page.set_viewport_size({"width":390,"height":844})
    assert page.locator("#save-btn").is_visible()
    assert page.locator("#new-plan-btn").is_visible()
    assert page.locator("#timeline-scroll").is_visible()
    assert page.locator(".planning-checks").is_visible()

    assert not errors,"\n".join(errors)
    browser.close()

print("Capacity Planner browser journeys and no-op button sweep passed")
