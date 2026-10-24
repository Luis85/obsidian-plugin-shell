// Increment: [[docs/increments/obsidian-workflows-adoption]]
// AC-5: `docs/development/WORKFLOWS.md`, `docs/development/HOSTING-PLATFORMS.md` and `docs/development/COMPANION-GENERATOR.md` describe the validation step as advisory, the release workflow's tag-and-dispatch steps, the `release` environment prerequisite and that the result is a draft release the author publishes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const text = path => readFile(resolve(root, path), 'utf8');
const section = (markdown, heading) => {
  const start = markdown.indexOf(heading); assert.ok(start >= 0, heading);
  const end = markdown.indexOf('\n## ', start + heading.length);
  return markdown.slice(start, end < 0 ? undefined : end);
};

test('[AC-5] the workflows reference documents both generated workflows and the widened release allowlist', async () => {
  const workflows = await text('docs/development/WORKFLOWS.md');
  const generated = section(workflows, "## Generated projects' workflows");
  assert.match(generated, /\*\*advisory\*\*/); assert.match(generated, /obsidianmd\/obsidian-workflows/);
  assert.match(generated, /push the tag `X\.Y\.Z`/); assert.match(generated, /"Use workflow from" set to that tag/);
  assert.match(generated, /`release` environment/); assert.match(generated, /\*\*draft\*\* GitHub release/); assert.match(generated, /publish it yourself/);
  const policy = section(workflows, '## Repository policy');
  assert.match(policy, /`release-cut\.yml`, `publish\.yml` and the generated projects' `obsidian-release\.yml`/);
  assert.match(policy, /Those three files: `workflow_dispatch` is the only trigger/);
});

test('[AC-5] the hosting and generator guides list the release workflow and how to cut a draft release', async () => {
  const hosting = await text('docs/development/HOSTING-PLATFORMS.md');
  assert.match(hosting.split('\n').find(line => line.startsWith('| `github` (default)')) ?? '', /obsidian-release\.yml/);
  const generator = section(await text('docs/development/COMPANION-GENERATOR.md'), '### Release a generated plugin');
  for (const step of [/Create a `release` environment with required reviewers/, /Push the tag `X\.Y\.Z`/, /run "Obsidian release"/, /Review the draft release .* and publish it/])
    assert.match(generator, step);
  assert.match(generator, /as warnings/);
});
