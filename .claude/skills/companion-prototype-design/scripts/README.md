# Helpers and trust boundaries

The standalone inspection/assembly helpers use Node built-ins. Integrated helpers load
the trusted shell API; building resolves Vite and stack dependencies from its lockfile.
`verify-browser.mjs` resolves installed `@playwright/test` from source/package.json. ZIP
packaging needs only Python 3. Prefer the repository's qualified runtime; helper unit
tests in this delivery were run separately, as recorded in VERIFICATION.md.

No helper implicitly installs dependencies, fetches a template, commits/pushes, runs native
Obsidian, or imports into the user's live companion. Only a separately authorized
`prototype shell --execute -- install --yes` invokes the existing exact-lock installer. `validate-project` executes the inspected
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

## Integrated compilation and save workflow

Read `../references/tooling-integration.md` for the complete lifecycle, command owners,
examples and approval boundaries. `prototype.mjs` is the preferred entrypoint (also
`npm run prototype:tools --` in the shell and its generated projects). Live discovery resolves
the actual source/compiled shell API. `shell` delegates to its parser/operations; `npm`
selects a bounded existing quality script and uses its process runner. Default behavior
is read/plan; `--execute` is explicit process authority and planned writes also need the
current `--apply` hash. Install remains explicit, never a hidden generation effect.

`build` invokes the workspace's Vite/sharedConfig/CSS scoper/qualified vendor adapter
and bundled-license plugin, emits one in-memory IIFE/CSS result, then calls the assembler.
Use an authored TypeScript entry under `harness/prototype/`. All native imports, dynamic
chunks, external assets, dependency-pin mismatches and missing real stack modules fail.
The low-level assembler above is not itself a Vue compiler; the new build adapter is the
composition of the existing compiler pipeline with that assembler. The HTML is separate
from native `dist/` and only changes after successful compilation and static checks.

The scoped mount is `#prototype-app.ps--<plugin-id>[data-plugin-ui="<plugin-id>"]`.
Read `#prototype-project-data` as inert JSON with encoding/hash/base64 bytes. Export those
original bytes, not the carrier. Set the ready marker after real Vue mount and inject only
typed deterministic browser adapters. The browser helper resolves the locked Playwright
from source/ and honors `SHELL_CHROMIUM`, without provisioning or changing versions.

`save` calls the **same** Python package scanner as ZIP (`--check`, read-only), rechecks
all byte hashes, then uses `scripts/shared/file-plan.mjs`. Preview and apply are separate;
only a new `docs/concepts/<slug>/` directory is allowed. A save is not Git commit/push,
companion import, or a claim of verification. Python discovery uses `PYTHON`/`python3`,
matching the repository's suite runner. The existing direct helpers remain supported.

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
node --test tests/helpers.test.mjs tests/validator.test.mjs tests/integration.test.mjs
python -B -m unittest discover -s tests -p 'test_*.py' -v
```

The validator tests use clearly named fake CLI fixtures to test dispatch/failure/byte
handling. They are **not** evidence that a real project is generator-compatible.
