"""Run a declared exact-artifact concept suite; fail closed on missing/stale evidence."""
import argparse
import hashlib
import importlib.metadata
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts'
SUITES = [
    ('generator-fixtures', 'generator-fixtures/checks.json'),
    ('generator-boundaries', 'generator-boundaries/checks.json'),
    ('project-starters', 'project-starters/checks.json'),
    ('design-styles', 'design-styles/checks.json'),
    ('composition', 'composition/checks.json'),
    ('storymap-polish', 'storymap-polish/checks.json'),
    ('detail-polish', 'detail-polish/checks.json'),
    ('details', 'details/checks.json'),
    ('storymaps', 'storymaps/checks.json'),
    ('project-transfer', 'project-transfer/checks.json'),
    ('product-audit', 'product-audit/checks.json'),
    ('consistency', 'consistency/checks.json'),
    ('style-guide', 'style-guide/checks.json'),
    ('test-data', 'test-data/checks.json'),
    ('editors', 'editors/checks.json'),
    ('data-sources', 'data-sources/checks.json'),
    ('single-vault', 'single-vault/checks.json'),
    ('semantic', 'semantic/checks.json'),
    ('er-polish', 'er-polish/checks.json'),
    ('containers', 'containers/checks.json'),
    ('reference', 'reference/checks.json'),
    ('reference-graph', 'reference/graph-checks.json'),
    ('reconciliation', 'reconciliation/checks.json'),
    ('unified', 'unified/checks.json'),
    ('safety', 'safety/checks.json'),
    # Node Playwright suites (owner decision 2026-09-26) share the same checks.json contract.
    ('visual-editors', 'visual-editors/checks.json', 'node'),
]
SLOW = {'composition', 'visual-editors'}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--real-storage', action='store_true', help='Also require real loopback-origin browser storage evidence.')
parser.add_argument('--only', action='append', default=[], metavar='SUITE', help='Run only the named suite (repeatable); the summary then covers just those suites.')
args = parser.parse_args()
if args.real_storage:
    SUITES.append(('storage', 'storage/checks.json'))
unknown = sorted(set(args.only) - {entry[0] for entry in SUITES})
if unknown:
    parser.error('unknown suite(s): ' + ', '.join(unknown))
if args.only:
    SUITES = [entry for entry in SUITES if entry[0] in args.only]
NODE = os.environ.get('NODE') or shutil.which('node')


def suite_command(name, runner):
    if runner == 'node':
        if not NODE:
            raise OSError('Node.js is required for the ' + name + ' suite; set NODE or put node on PATH.')
        return [NODE, f'tests/concepts/companion-{name}.browser.mjs']
    return [sys.executable, f'tests/concepts/companion-{name}.browser.py']


def python_playwright():
    try:
        return importlib.metadata.version('playwright')
    except importlib.metadata.PackageNotFoundError:
        return None
OUT.mkdir(parents=True, exist_ok=True)
identity = hashlib.sha256(HTML.read_bytes()).hexdigest()
subprocess.run([sys.executable, 'scripts/concepts/build-companion.py', '--check'], cwd=ROOT, check=True)
results = []
for name, relative_report, *kind in SUITES:
    runner = kind[0] if kind else 'python'
    report_path = OUT / relative_report
    report_path.unlink(missing_ok=True)
    try:
        run = subprocess.run(suite_command(name, runner), cwd=ROOT, text=True, capture_output=True, timeout=300 if name in SLOW else 150)
        (OUT / f'{name}.log').write_text(run.stdout + run.stderr)
        evidence = json.loads(report_path.read_text()) if report_path.exists() else {}
        # Older individual scripts intentionally report different summary shapes;
        # named assertions are their shared contract, never trust just exit code.
        checks = evidence.get('checks', [])
        passed = sum(c.get('result') == 'passed' for c in checks)
        failed = sum(c.get('result') != 'passed' for c in checks)
        expected_hash = evidence.get('html_sha256', evidence.get('sha256'))
        ok = run.returncode == 0 and bool(checks) and not failed and not evidence.get('fatal') and not evidence.get('errors') and not evidence.get('requests')
        ok = ok and expected_hash == identity and hashlib.sha256(HTML.read_bytes()).hexdigest() == identity
        results.append({'suite': name, 'runner': runner, 'status': 'passed' if ok else 'failed', 'passed': passed, 'failed': failed, 'exit': run.returncode, 'evidence': str(report_path.relative_to(ROOT)), 'html_sha256': expected_hash})
    except (subprocess.TimeoutExpired, OSError, ValueError) as error:
        results.append({'suite': name, 'runner': runner, 'status': 'failed', 'error': str(error)})
    print(json.dumps(results[-1]), flush=True)
    if results[-1]['status'] != 'passed':
        break
report = {
    'schema': 'companion-concept-browser/v1',
    'status': 'passed' if len(results) == len(SUITES) and all(r['status'] == 'passed' for r in results) else 'failed',
    'html_sha256': identity, 'html_bytes': HTML.stat().st_size,
    'python': sys.version, 'playwright': python_playwright(),
    'node': subprocess.run([NODE, '--version'], text=True, capture_output=True).stdout.strip() if NODE else None,
    'only': args.only,
    'chromium_executable': os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
    'real_storage_requested': args.real_storage,
    'passed': sum(r.get('passed', 0) for r in results), 'suites': results,
    'scope': 'Companion UI, full-project read-only CLI, reviewed project generation and the exported test-data CLI in isolated temporary directories. Assertion totals include model, geometry and controlled-state fixtures; not native host, generated-project dependency/build qualification or release qualification.',
}
# A partial (--only) run never replaces the full-suite summary.
(OUT / ('browser-summary-only.json' if args.only else 'browser-summary.json')).write_text(json.dumps(report, indent=2) + '\n')
raise SystemExit(0 if report['status'] == 'passed' else 1)
