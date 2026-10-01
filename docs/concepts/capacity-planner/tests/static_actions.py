#!/usr/bin/env python3
"""Fail when the prototype exposes an action/button without a wired handler."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
source="\n".join(path.read_text(encoding="utf-8") for path in (ROOT/"source").glob("*.ts"))
frame=(ROOT/"source"/"frame.html").read_text(encoding="utf-8")
app=(ROOT/"source"/"app.ts").read_text(encoding="utf-8")
common=(ROOT/"source"/"dialogs-common.ts").read_text(encoding="utf-8")

actions=set(re.findall(r'data-action="([a-z0-9-]+)"',source))
handlers=set(re.findall(r'action==="([a-z0-9-]+)"',app))
missing=sorted(actions-handlers)
assert not missing,f"Unwired data-action values: {missing}"

button_ids=set(re.findall(r'<button[^>]+id="([a-z0-9-]+)"',frame))
listener_ids=set(re.findall(r'\$\("#([a-z0-9-]+)"\)\.addEventListener',app))
missing_ids=sorted(button_ids-listener_ids)
assert not missing_ids,f"Static buttons without listeners: {missing_ids}"

assert 'data-dialog-close' in common and 'addEventListener("click"' in common
assert 'type="submit"' in common and 'addEventListener("submit"' in common
print(f"Static action wiring passed: {len(actions)} delegated actions, {len(button_ids)} static buttons")
