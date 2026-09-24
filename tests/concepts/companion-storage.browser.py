"""Real loopback-origin storage checks. These complement, not replace, adapter fixtures.
Never loads Obsidian, a personal vault or an external site. No production persistence claim.
"""
import hashlib
import json
import os
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/storage'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(HTML.read_bytes())

    def log_message(self, *_args):
        pass


def check(name, value):
    checks.append({'name': name, 'result': 'passed' if value else 'failed', 'scope': 'real Chromium Storage on loopback HTTP origin'})
    print(('PASS' if value else 'FAIL'), name, flush=True)
    assert value, name


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1280, 'height': 1000})
        context.on('request', lambda request: requests.append(request.url) if not request.url.startswith(url) else None)
        p = context.new_page()
        p.on('pageerror', lambda e: errors.append(str(e)))
        p.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        p.goto(url)
        p.locator('main [data-action="sample"]').click()
        p.locator('#sidebar [data-action="nav"][data-value="entities"]').click()
        p.locator('[data-action="er-example"]').click()
        p.evaluate('variantOpen(design().library.find(c=>c.contentSpec).id)')
        p.locator('#v-id').fill('storage-variant');p.locator('#v-name').fill('Persisted variant')
        p.locator('#modal [data-action="variant-save"]').click()
        p.evaluate('design().goal="Real-origin saved outline";designChanged()')
        p.reload()
        check('Native browser storage restores committed project data after reload', p.evaluate('!!state.project&&design().goal==="Real-origin saved outline"&&!storageWarning'))
        check('Real browser storage restores entities and grouped relationships', p.evaluate('semanticModel().entities.length===3&&semanticModel().sections.length===2&&semanticModel().relationships.length===2'))
        check('Real browser storage restores structured component variants', p.evaluate('design().library.some(c=>c.variantSpecs?.some(v=>v.id==="storage-variant"))'))
        # A second page reads and normalizes the same state. Reload the first page
        # before the deliberate conflict so both start from the accepted snapshot.
        q = context.new_page()
        q.on('pageerror', lambda e: errors.append(str(e)))
        q.goto(url)
        p.reload()
        q.evaluate('design().goal="Newer second-window edit";designChanged()')
        p.wait_for_function('() => storageWarning.includes("another window")')
        p.evaluate('design().goal="First-window unpersisted draft";save()')
        check('Real storage event stops the stale window from overwriting newer data', p.evaluate('JSON.parse(localStorage.getItem(STORAGE_KEY)).project.design.goal==="Newer second-window edit"'))
        check('Stale window retains its local session for recovery', p.evaluate('design().goal==="First-window unpersisted draft"') and p.locator('#storage-recovery').is_visible())
        q.close()
        p.reload()
        check('Reload adopts the latest retained snapshot and clears the conflict', p.evaluate('design().goal==="Newer second-window edit"&&!storageWarning'))
        p.evaluate('localStorage.setItem("unrelated-review-key","keep");state.settings.remember=false;save()')
        check('Memory-only preference removes only the concept storage key', p.evaluate('localStorage.getItem(STORAGE_KEY)===null&&localStorage.getItem("unrelated-review-key")==="keep"'))
        p.evaluate('localStorage.setItem(STORAGE_KEY,"{invalid-json")')
        p.reload()
        check('Malformed native storage is preserved rather than silently overwritten', p.evaluate('localStorage.getItem(STORAGE_KEY)==="{invalid-json"&&storageWarning.includes("preserved")'))
        check('Real-origin checks have no observed runtime errors or external requests', not errors and not requests)
        browser.close()
except Exception:
    fatal = traceback.format_exc()
    print(fatal)
finally:
    server.shutdown()
    server.server_close()
    report = {'scope': 'Real loopback HTTP origin; Chromium Storage; no file-origin or native Obsidian claim', 'html_sha256': hashlib.sha256(HTML.read_bytes()).hexdigest(), 'passed': sum(c['result'] == 'passed' for c in checks), 'failed': sum(c['result'] == 'failed' for c in checks), 'fatal': fatal, 'checks': checks, 'errors': errors, 'requests': requests}
    (OUT / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
if fatal or errors or requests or report['failed']:
    raise SystemExit(1)
