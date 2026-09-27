# Helpers and trust boundaries

All Node helpers use built-in modules except `verify-browser.mjs`, which resolves the
already installed `@playwright/test` from the prototype's source/package.json. ZIP
packaging needs only Python 3. Prefer the repository's qualified runtime; helper unit
tests in this delivery were run separately, as recorded in VERIFICATION.md.

No helper installs dependencies, fetches a template, commits/pushes, runs native Obsidian,
or imports into the user's live companion. `validate-project` executes the inspected
local repository's code. `verify-browser` executes the supplied browser artifact and
trusted journey test module. Point them only at trusted inputs in isolated workspaces.

```sh
# Prints static facts/hashes; no repository code execution.
node scripts/inspect-repository.mjs --repo /path/to/shell

# Real reader and real generator plan, with temporary copies and a disposable vault.
# stdout report: reader-and-plan ONLY. Never equate it with applied/generated build.
node scripts/validate-project.mjs --repo /path/to/shell --input /path/to/companion.project.json

# Assembly, not compilation. Build one IIFE and scoped CSS with the real Vue pipeline first.
node scripts/build-single-file.mjs --js compiled.js --css scoped.css --project companion.project.json --out prototype.html --title "Approved concept"
# Rebuild an existing artifact only with the explicit --replace flag.

node scripts/check-offline.mjs --html prototype.html
node scripts/verify-browser.mjs --root /path/to/concept-package

# Informational change-set; arrays reported conservatively, no merge/apply capability.
node scripts/diff-project.mjs --before baseline.json --after companion.project.json

# Run only after ZIP authorization; writes a new archive outside the source folder.
python scripts/pack-concept.py --root /path/to/concept-package --output /path/to/new.zip
```

Use `--help` for syntax. stdout redirection is a shell write: never redirect onto inputs
or existing files. Save reports only to explicitly approved new destinations. Output
parents must exist. Automatic cleanup affects only helper-created temporary workspaces.
Local path checks reduce accidental traversal/symlink mistakes, but do not promise
transactional safety against concurrent malicious filesystem mutation. Repository
plan/apply retains its own authoritative containment/ownership checks.

## Single-file build integration

Reuse/copy the shell's approved Vue/Vite transform, scoped styles and Nuxt UI runtime
patches into the independently buildable source workspace. Emit one classic browser IIFE
and one CSS file with all assets inlined; verify no additional files are needed. The
assembler takes those files plus the real companion JSON and outputs prototype.html.
It does not compile `.vue`, install Nuxt UI, prove stylesheet scoping, or invent styles.

Mount Vue on `#prototype-app`. Read `#prototype-project-data` as inert JSON with
`encoding`, `sha256`, and base64 `content`; decode original UTF-8 bytes in a browser
adapter. The separate companion.project.json is what the actual importer consumes.
Download that exact decoded data, not the carrier object. Use the adapter at bootstrap,
not from a pure domain module. Set `data-prototype-ready="true"` on `<html>` after mount.

The assembler's CSP blocks network/eval/foreign objects, but permits inline styles for
Vue's runtime style bindings. This is not a hostile-code sandbox. Offline inspection is
conservative; escaped CSS or unusual constructs may require inlining/simplification.
Do not disable CSP/checks merely to make a broken artifact appear successful.

## Browser journey module

The prototype must supply `tests/prototype.journeys.mjs` exporting an async function:

```js
export async function runJourneys({ page, expect }) {
  // These labels/actions must be bespoke to the approved prototype.
  await expect(page.getByRole('heading', { name: 'Actual page title' })).toBeVisible();
  // Execute agreed happy, negative and regression paths with real assertions here.
  return ['AC-01: actual page visible'];
}
```

This is an interface example, not a sufficient acceptance suite. Do not include it
unchanged. The helper runs journeys at 1440/390 widths in light/dark with network and
storage denied. It does not check normal/HTTP storage, companion UI import/export,
screenshots, native host behavior or full accessibility. Implement applicable additional
checks and state those gaps honestly.

## Run helper tests

```sh
node --test tests/helpers.test.mjs tests/validator.test.mjs
python -B -m unittest discover -s tests -p 'test_*.py' -v
```

The validator tests use clearly named fake CLI fixtures to test dispatch/failure/byte
handling. They are **not** evidence that a real project is generator-compatible.
