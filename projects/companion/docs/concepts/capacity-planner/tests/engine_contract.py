#!/usr/bin/env python3
"""Direct planner-engine contract tests independent of dialog mutation code."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text(encoding="utf-8")
CHROMIUM=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium")

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path=CHROMIUM,args=["--no-sandbox"])
    page=browser.new_page(accept_downloads=True)
    page.set_content(HTML,wait_until="load")

    # Obtain the engine's current data input through its public workspace JSON output.
    page.locator("#manage-btn").click()
    with page.expect_download() as download:
        page.locator('[data-action="export-workspace"]').click()
    workspace=json.loads(Path(download.value.path()).read_text(encoding="utf-8"))
    page.keyboard.press("Escape")

    metadata=page.evaluate("() => ({name: CapacityPlannerEngine.name, version: CapacityPlannerEngine.version})")
    assert metadata=={"name":"capacity-planner","version":1}

    created=page.evaluate("""arg => CapacityPlannerEngine.createPlan(arg.workspace,arg.input)""",{
        "workspace":workspace,
        "input":{"name":"Engine Created","basis":"blank","budget":175000,"contingencyPct":7.5,"targetMarginPct":22},
    })
    assert len(created["workspace"]["scenarios"])==len(workspace["scenarios"])+1
    assert created["workspace"]["activeScenarioId"]==created["planId"]
    assert created["plan"]["name"]=="Engine Created"
    assert created["plan"]["allocations"]==[]

    updated=page.evaluate("""arg => CapacityPlannerEngine.updatePlan(arg.workspace,arg.id,arg.patch)""",{
        "workspace":created["workspace"],"id":created["planId"],
        "patch":{"name":"Engine Updated","status":"approved","budget":190000,"contingencyPct":9,"targetMarginPct":24},
    })
    assert updated["plan"]["name"]=="Engine Updated"
    assert updated["plan"]["status"]=="approved"
    assert updated["plan"]["budget"]==190000

    document=page.evaluate("""arg => CapacityPlannerEngine.exportPlanDocument(arg.workspace,arg.id)""",{
        "workspace":updated["workspace"],"id":updated["planId"],
    })
    # JSON text serialization/parsing is owned by the engine contract itself.
    serialized=page.evaluate("doc => CapacityPlannerEngine.stringifyPlanDocument(doc)",document)
    document=page.evaluate("text => CapacityPlannerEngine.parsePlanJson(text)",serialized)
    document=json.loads(json.dumps(document))
    assert document["schema"]=="capacity-planner.plan"
    assert document["version"]==1
    assert document["engine"]=={"name":"capacity-planner","version":1}
    assert document["plan"]["name"]=="Engine Updated"
    assert page.evaluate("doc => CapacityPlannerEngine.validatePlanDocument(doc)",document) is None

    # The engine consumes the exact JSON representation it produces.
    plan_json=page.evaluate("doc => CapacityPlannerEngine.stringifyPlanDocument(doc)",document)
    parsed=page.evaluate("text => CapacityPlannerEngine.parsePlanJson(text)",plan_json)
    assert parsed==document

    opened=page.evaluate("doc => CapacityPlannerEngine.workspaceFromPlanDocument(doc)",parsed)
    assert opened["project"]==document["project"]
    assert len(opened["scenarios"])==1
    assert opened["scenarios"][0]["name"]=="Engine Updated"
    assert opened["activeScenarioId"]==opened["scenarios"][0]["id"]

    # A self-produced plan can also be added back to the same project as another scenario.
    added=page.evaluate("""arg => CapacityPlannerEngine.addPlanDocument(arg.workspace,arg.document,{name:'Round-trip copy'})""",{
        "workspace":workspace,"document":document,
    })
    assert len(added["workspace"]["scenarios"])==len(workspace["scenarios"])+1
    assert added["plan"]["name"]=="Round-trip copy"
    assert added["workspace"]["activeScenarioId"]==added["planId"]

    # Corrupted documents are rejected before they can mutate state.
    corrupt=json.loads(json.dumps(document));corrupt["plan"]["allocations"].append({"id":"bad","taskId":"missing","roleId":"missing","iterationId":"missing","hours":1})
    error=page.evaluate("doc => CapacityPlannerEngine.validatePlanDocument(doc)",corrupt)
    assert isinstance(error,str) and error

    browser.close()

print("Capacity Planner engine contract and JSON round-trip passed")
