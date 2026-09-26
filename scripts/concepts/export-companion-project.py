"""Regenerate the companion's checked-in self-project using its actual embedded seed.

This executes trusted repository code in isolated Chromium, with an in-memory
Storage adapter and every network request refused. It never opens a user vault.
"""
import argparse
import hashlib
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUTPUT = ROOT / 'docs/concepts/companion/companion-project.json'
STORAGE = """<script>const data={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v},removeItem:k=>delete data[k]}});</script>"""
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
errors = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    page.route('**/*', lambda route: route.abort())
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: errors.append('Unexpected request: ' + request.url))
    page.set_content(STORAGE + HTML.read_text(encoding='utf8'))
    output = page.evaluate('companionJson(companionExampleProject())').rstrip() + '\n'
    browser.close()
if errors:
    raise SystemExit('\n'.join(errors))
raw = output.encode('utf8')
if args.check:
    if OUTPUT.read_bytes() != raw:
        raise SystemExit('Companion self-project differs from its embedded seed')
else:
    OUTPUT.write_bytes(raw)
print(('Verified' if args.check else 'Generated') + ' self-project: ' + str(len(raw)) + ' bytes; SHA-256 ' + hashlib.sha256(raw).hexdigest())
