"""Regenerate the companion's checked-in self-project using its actual embedded seed.

This executes trusted repository code in isolated Chromium, with an in-memory
Storage adapter and every network request refused. It never opens a user vault.
Python Playwright is used when installed; otherwise the repository's pinned Node
Playwright runs the same page evaluation (owner decision 2026-09-26).
"""
import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUTPUT = ROOT / 'docs/concepts/companion/companion-project.json'
STORAGE = """<script>const data={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v},removeItem:k=>delete data[k]}});</script>"""
EXPRESSION = 'companionJson(companionExampleProject())'
# Same isolation as the Python path: refused requests, recorded page errors and requests, fresh in-memory storage.
NODE_EXPORT = """
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const [html, storage, expression] = process.argv.slice(1), errors = [];
const executable = process.env.CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(executable ? { executablePath: executable } : {}) });
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => errors.push('Unexpected request: ' + request.url()));
  await page.setContent(storage + readFileSync(html, 'utf8'));
  const output = await page.evaluate(expression);
  process.stdout.write(JSON.stringify({ output, errors }));
} finally { await browser.close(); }
"""


def export_with_python(sync_playwright):
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.route('**/*', lambda route: route.abort())
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: errors.append('Unexpected request: ' + request.url))
        page.set_content(STORAGE + HTML.read_text(encoding='utf8'))
        output = page.evaluate(EXPRESSION)
        browser.close()
    return output, errors


def export_with_node():
    result = subprocess.run(['node', '--input-type=module', '-e', NODE_EXPORT, str(HTML), STORAGE, EXPRESSION],
                            cwd=ROOT, capture_output=True, encoding='utf8', check=False)
    if result.returncode != 0:
        raise SystemExit('Node Playwright export failed: ' + result.stderr.strip())
    value = json.loads(result.stdout)
    return value['output'], value['errors']


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    output, errors = export_with_node()
else:
    output, errors = export_with_python(sync_playwright)
if errors:
    raise SystemExit('\n'.join(errors))
raw = (output.rstrip() + '\n').encode('utf8')
if args.check:
    if OUTPUT.read_bytes() != raw:
        raise SystemExit('Companion self-project differs from its embedded seed')
else:
    OUTPUT.write_bytes(raw)
print(('Verified' if args.check else 'Generated') + ' self-project: ' + str(len(raw)) + ' bytes; SHA-256 ' + hashlib.sha256(raw).hexdigest())
