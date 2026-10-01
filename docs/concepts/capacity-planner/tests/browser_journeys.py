#!/usr/bin/env python3
"""Behavior, UI-focus and no-op regression journey for Capacity Planner."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text(encoding="utf-8")
CHROMIUM=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium")

def open_dialog(page, selector, title_fragment):
    page.locator(selector).click()
    assert title_fragment.lower() in page.locator("#dialog-title").inner_text().lower()

def open_manage(page, action, title_fragment):
    open_dialog(page,"#manage-btn","Manage Capacity Planner")
    page.locator(f'[data-action="{action}"]').click()
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

    # The current plan is the first content priority: compact header, collapsed summary, board near the top.
    assert page.locator(".appbar button").count()==4
    assert page.locator("#summary-panel").is_hidden()
    assert page.locator(".role-row").count()==5
    assert page.locator(".iter-head.time-focus").count()==1
    page.locator("#timeline-scroll").evaluate("el => el.scrollLeft = 900")
    page.locator("#focus-iteration-btn").click()
    page.wait_for_timeout(250)
    assert page.locator("#timeline-scroll").evaluate("el => el.scrollLeft") < 900
    assert page.locator("#workspace").count()==0  # workspace is a semantic class, not another wrapper ID
    assert page.locator(".workspace").bounding_box()["y"] < 135
    assert page.locator(".summary-chip").count()==3
    initial_revision=page.locator("#revision-pill").inner_text()

    # Summary is secondary and collapsible; the old dominant KPI-card grid is gone.
    page.locator("#summary-toggle").click()
    assert page.locator("#summary-panel").is_visible()
    assert page.locator(".summary-metric").count()==8
    assert page.locator(".summary-check").count()==5
    assert page.locator(".kpi").count()==0
    assert "Covered forecast" in page.locator("#kpis").inner_text()
    assert "456 h" in page.locator("#kpis").inner_text()  # allocated task work, not role capacity minus open scope
    assert "83,5%" in page.locator("#kpis").inner_text()
    page.locator("#summary-close").click()
    assert page.locator("#summary-panel").is_hidden()

    # Save is never a no-op: opaque test origin cannot persist, so a backup download is expected.
    with page.expect_download() as saved:
        page.locator("#save-btn").click()
    assert saved.value.suggested_filename.endswith(".json")

    # New plan stays primary and creates another scenario.
    open_dialog(page,"#new-plan-btn","New resource plan")
    page.locator('input[name="name"]').fill("Constrained Plan")
    submit(page)
    assert page.locator("#scenario-select option").count()==2
    assert page.locator("#revision-pill").inner_text()!=initial_revision

    # Secondary tools moved out of the header into one Manage surface.
    open_manage(page,"plan-settings","Plan settings")
    page.locator('input[name="name"]').fill("Constrained Delivery Plan")
    submit(page)
    assert page.locator("#plan-heading").inner_text()=="Constrained Delivery Plan"

    open_manage(page,"project-timeline","Project & shared timeline")
    page.locator('input[name="orderValue"]').fill("450000")
    submit(page)
    page.locator("#summary-toggle").click()
    assert "450.000" in page.locator("#kpis").inner_text()
    page.locator("#summary-close").click()

    # Team: add role, add person, update availability and plan FTE/rate.
    open_manage(page,"team","Team & role catalog")
    page.locator('[data-action="add-role"]').click()
    page.locator('input[name="name"]').fill("Security Engineer")
    page.locator('input[name="dayRate"]').fill("1000")
    submit(page)
    assert page.locator(".role-row").count()==6

    open_manage(page,"team","Team & role catalog")
    page.locator('[data-action="add-person"]').click()
    page.locator('input[name="name"]').fill("Morgan")
    page.locator('select[name="roleId"]').select_option(label="Security Engineer")
    submit(page)

    open_manage(page,"team","Team & role catalog")
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

    # Task-level ownership and many-person assignment are explicit before allocation.
    open_dialog(page,"#add-task-btn","Add task")
    page.locator('input[name="title"]').fill("Threat modelling")
    page.locator('input[name="units"]').fill("10")
    page.locator('select[name="ownerPersonId"]').select_option(label="Morgan · Security Engineer")
    page.locator('.person-choice').filter(has_text="Morgan").locator('input[name="assigneeId"]').check()
    page.locator('.person-choice').filter(has_text="Sam").locator('input[name="assigneeId"]').check()
    submit(page)
    task=page.locator("#backlog .task-card").filter(has_text="Threat modelling")
    assert "Owner Morgan" in task.inner_text()
    assert "2 people" in task.inner_text()

    # Owner/people are searchable, not only the task title.
    page.locator("#task-search").fill("Morgan")
    assert page.locator("#backlog .task-card").filter(has_text="Threat modelling").count()==1
    page.locator("#task-search").fill("")

    # Allocate to the owner, record actuals, then split remaining work to another assigned person/role.
    task.locator('[data-action="allocate-task"]').click()
    page.locator('select[name="roleId"]').select_option(label="Security Engineer")
    page.locator('select[name="personId"]').select_option(label="Morgan · owner")
    page.locator('input[name="hours"]').fill("30")
    submit(page)
    assert page.locator(".allocation-card").filter(has_text="Threat modelling").count()==1
    assert page.locator("#backlog .task-card").filter(has_text="Threat modelling").count()==1

    allocation=page.locator(".allocation-card").filter(has_text="Threat modelling")
    allocation.focus()
    page.keyboard.press("Enter")
    assert "edit" in page.locator("#dialog-title").inner_text().lower()
    page.keyboard.press("Escape")
    allocation.locator('[data-action="record-actual"]').click()
    page.locator('input[name="hours"]').fill("4")
    assert page.locator('input[name="dayRate"]').input_value()=="1100"
    submit(page)
    assert "4" in page.locator(".allocation-card").filter(has_text="Threat modelling").inner_text()

    remaining=page.locator("#backlog .task-card").filter(has_text="Threat modelling")
    ba_row=page.locator(".role-row").filter(has_text="Business Analyst")
    remaining.drag_to(ba_row.locator(".capacity-cell").nth(1))
    assert "allocate" in page.locator("#dialog-title").inner_text().lower()
    page.locator('select[name="personId"]').select_option(label="Sam · task team")
    page.locator('input[name="hours"]').fill("30")
    submit(page)
    assert page.locator("#backlog .task-card").filter(has_text="Threat modelling").count()==0
    assert page.locator(".allocation-card").filter(has_text="Threat modelling").count()==2
    assert "Morgan" in page.locator(".allocation-card").filter(has_text="Threat modelling").nth(0).inner_text()+page.locator(".allocation-card").filter(has_text="Threat modelling").nth(1).inner_text()
    assert "Sam" in page.locator(".allocation-card").filter(has_text="Threat modelling").nth(0).inner_text()+page.locator(".allocation-card").filter(has_text="Threat modelling").nth(1).inner_text()

    # Commercials, baselines, comparison, audit and persistence remain reachable through Manage.
    open_manage(page,"commercial","Commercials")
    page.locator('[data-action="add-nonlabor"]').click()
    page.locator('input[name="name"]').fill("Pen test")
    page.locator('input[name="planned"]').fill("15000")
    submit(page)

    open_manage(page,"baselines","Baselines")
    page.locator('[data-action="create-baseline"]').click()
    page.locator('input[name="name"]').fill("Steering baseline")
    submit(page)
    assert "Steering baseline" in page.locator("#baseline-strip").inner_text()
    open_manage(page,"baselines","Baselines")
    page.locator('[data-action="approve-baseline"]').first.click()
    assert "approved" in page.locator("#dialog").inner_text().lower()
    page.keyboard.press("Escape")

    open_manage(page,"compare-plans","Compare resource plans")
    assert page.locator(".compare-table tbody tr").count()>=2
    assert "Coverage" in page.locator(".compare-table thead").inner_text()
    page.keyboard.press("Escape")
    open_manage(page,"audit","Audit & revisions")
    assert page.locator(".audit-row").count()>=8
    page.keyboard.press("Escape")

    open_manage(page,"persistence","Obsidian persistence contract")
    page.locator('input[name="basePath"]').fill("Projects/Capacity Demo")
    submit(page)
    open_manage(page,"persistence","Obsidian persistence contract")
    assert "Projects/Capacity Demo" in page.locator("#dialog").inner_text()
    with page.expect_download() as markdown:
        page.locator('[data-action="export-markdown"]').click()
    assert markdown.value.suggested_filename.endswith(".zip")
    import zipfile
    with zipfile.ZipFile(markdown.value.path()) as archive:
        assert any("/Actuals/" in name for name in archive.namelist())
        actual_name=next(name for name in archive.namelist() if "/Actuals/" in name and name.endswith(".md"))
        assert "dayRate:" in archive.read(actual_name).decode("utf-8")
    page.keyboard.press("Escape")

    # JSON export/import are real Manage actions.
    open_dialog(page,"#manage-btn","Manage Capacity Planner")
    with page.expect_download() as exported:
        page.locator('[data-action="export-workspace"]').click()
    assert exported.value.suggested_filename.endswith(".json")
    import json
    exported_state=json.loads(Path(exported.value.path()).read_text(encoding="utf-8"))
    assert any(float(item.get("hours",0))==4 and float(item.get("dayRate",0))==1100 for item in exported_state["project"]["actuals"])
    page.keyboard.press("Escape")
    open_dialog(page,"#manage-btn","Manage Capacity Planner")
    with page.expect_file_chooser():
        page.locator('[data-action="import-workspace"]').click()
    assert page.locator("#workspace-import").count()==1

    # Scenario switch and upstream iteration authority remain intact.
    page.locator("#scenario-select").select_option("scenario-baseline")
    assert page.locator("#plan-heading").inner_text()=="Baseline Delivery Plan"
    open_manage(page,"project-timeline","Project & shared timeline")
    page.locator('select[name="timelineOwner"]').select_option("iteration-planner")
    submit(page)
    assert "Iteration Planner owned" in page.locator("#timeline-pill").inner_text()

    # Mobile keeps the current plan and primary controls, while Summary remains optional.
    page.set_viewport_size({"width":390,"height":844})
    assert page.locator("#save-btn").is_visible()
    assert page.locator("#new-plan-btn").is_visible()
    assert page.locator("#manage-btn").is_visible()
    assert page.locator("#summary-toggle").is_visible()
    assert page.locator("#timeline-scroll").is_visible()

    assert not errors,"\n".join(errors)
    browser.close()

print("Capacity Planner UI-focus, task-team and no-op journeys passed")
