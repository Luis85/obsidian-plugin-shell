// Increment: [[docs/increments/generated-inventory-headroom]]
// AC-2: Generated projects omit the planner prototypes, the companion concept's dated records, implementation handoff and opt-in browser verification, keep the concept's design and how-to documents and test kit, and still pass their own suite manifest check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectModel } from '../../../src/cli/compiler/emitters/model.ts';
import { projectFiles } from '../../../src/cli/tests/support/project-render.mjs';
import { checkSuites } from '../../../src/cli/tooling/testing/suite-manifest.mjs';
import { starterDocument } from '../../../src/shared/testing/starter-documents.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const omitted = ['docs/concepts/capacity-planner/', 'docs/concepts/iteration-planner/', 'docs/concepts/companion/handoff/', 'src/companion/tests/concepts/',
  'docs/concepts/companion/PRODUCT-REVIEW.md', 'docs/concepts/companion/PROTOTYPES-VERIFICATION.md', 'docs/concepts/companion/DETAIL-EDITORS-RESEARCH.md',
  'docs/concepts/companion/PRODUCT-AUDIT.md', 'docs/concepts/companion/UNIFIED-COMMIT.md', 'docs/concepts/companion/verification-unified.json',
  'docs/framework/development/MAIN-RECONCILIATION.md', 'tooling/concepts/run-browser-checks.py', 'tooling/tests/concept-metrics.checks.mjs',
  'docs/framework/workflows/companion-concept-verification.yml'];
const kept = ['docs/concepts/companion/README.md', 'docs/concepts/companion/VERIFICATION.md', 'docs/concepts/companion/VISUAL-EDITORS.md',
  'docs/concepts/companion/browser-checks.json', 'docs/concepts/companion/test-kit/engine.mjs', 'docs/concepts/companion/index.html', 'tooling/concepts/build-companion.py'];

test('[AC-2] a generated project omits the maintainer-only concept content, keeps its guides and passes its suite manifest check', async () => {
  const output = await projectFiles(root, projectModel(structuredClone(starterDocument('quick-capture'))));
  const paths = output.map(entry => entry.path);
  for (const path of omitted) assert.deepEqual(paths.filter(item => item === path || (path.endsWith('/') && item.startsWith(path))), [], path);
  for (const path of kept) assert.ok(paths.includes(path), path);
  const scratch = await mkdtemp(join(tmpdir(), 'inventory-headroom-suites-'));
  try {
    for (const entry of output) {
      await mkdir(dirname(join(scratch, entry.path)), { recursive: true });
      await writeFile(join(scratch, entry.path), entry.content, entry.encoding === 'base64' ? 'base64' : 'utf8');
    }
    assert.deepEqual((await checkSuites(scratch)).failures, []);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
