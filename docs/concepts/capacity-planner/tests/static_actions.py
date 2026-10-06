#!/usr/bin/env python3
"""Fail when the prototype exposes an action/button without wiring or behavioral coverage."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
source="\n".join(path.read_text(encoding="utf-8") for path in (ROOT/"source").glob("*.ts"))
frame=(ROOT/"source"/"frame.html").read_text(encoding="utf-8")
app=(ROOT/"source"/"app.ts").read_text(encoding="utf-8")
common=(ROOT/"source"/"dialogs-common.ts").read_text(encoding="utf-8")
behavior="\n".join((ROOT/"tests"/name).read_text(encoding="utf-8") for name in ["browser_journeys.py","interaction_matrix.py"])

actions=set(re.findall(r'data-action="([a-z0-9-]+)"',source))
handlers=set(re.findall(r'action==="([a-z0-9-]+)"',app))
missing=sorted(actions-handlers)
assert not missing,f"Unwired data-action values: {missing}"
untested=sorted(action for action in actions if action not in behavior)
assert not untested,f"Delegated actions missing browser behavior coverage: {untested}"

button_ids=set(re.findall(r'<button[^>]+id="([a-z0-9-]+)"',frame))
listener_ids=set(re.findall(r'\$\("#([a-z0-9-]+)"\)\.addEventListener',app))
missing_ids=sorted(button_ids-listener_ids)
assert not missing_ids,f"Static buttons without listeners: {missing_ids}"
untested_ids=sorted(button_id for button_id in button_ids if button_id not in behavior)
assert not untested_ids,f"Static buttons missing browser behavior coverage: {untested_ids}"

for control_id in ["scenario-select","task-search"]:
    assert control_id in behavior,f"Interactive control #{control_id} is missing browser behavior coverage"
assert 'data-dialog-close' in common and 'addEventListener("click"' in common
assert 'type="submit"' in common and 'addEventListener("submit"' in common
assert 'reportValidity()' in common and 'announce(' in common
print(f"Static interaction contract passed: {len(actions)} delegated actions and {len(button_ids)} static buttons are wired and behavior-tested")
