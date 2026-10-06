import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// The documented starter counts and the concept catalog table are derived from configs/starters, never maintained by hand.
const root = fileURLToPath(new URL('../../', import.meta.url));
const definitions = await Promise.all((await readdir(join(root, 'configs/starters'))).filter(name => name.endsWith('.json')).sort()
  .map(async name => JSON.parse(await readFile(join(root, 'configs/starters', name), 'utf8'))));
const companion = definitions.filter(definition => definition.generator?.kind === 'companion');
const focused = companion.filter(definition => !['companion-plugin', 'feature-showcase'].includes(definition.id));
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const word = count => { assert.ok(count < words.length, 'extend the number words'); return words[count]; };
const text = async path => (await readFile(join(root, path), 'utf8')).replace(/\s+/g, ' ');

test('the concept starter catalog table lists exactly the focused Companion starters with their names', async () => {
  const page = await readFile(join(root, 'docs/concepts/companion/PROJECT-STARTERS.md'), 'utf8');
  const catalog = page.slice(page.indexOf('## Catalog'), page.indexOf('\n## ', page.indexOf('## Catalog') + 1));
  const rows = [...catalog.matchAll(/^\| `([a-z0-9-]+)` \| ([^|]+) \|/gm)].map(([, id, name]) => [id, name.trim()]);
  assert.deepEqual(new Map(rows), new Map(focused.map(definition => [definition.id, definition.name])));
  assert.equal(rows.length, focused.length, 'no duplicate rows');
});

test('starter documentation states the focused and total Companion starter counts of the catalog', async () => {
  const few = word(focused.length), all = word(companion.length), capitalized = few[0].toUpperCase() + few.slice(1);
  assert.ok((await text('docs/development/COMPANION-STARTERS.md')).includes(`the ${few} focused examples, the golden Companion and the visual-feature showcase: ${all} definitions`));
  assert.ok((await text('docs/development/COMPANION-PROJECT-SCHEMA.md')).includes(`the ${few} focused examples: ${all} definitions`));
  assert.ok((await text('docs/development/JSON-STARTERS.md')).includes(`${capitalized} definitions carry the focused Companion examples`));
  for (const path of ['docs/development/COMPANION-STARTERS.md', 'docs/development/COMPANION-PROJECT-SCHEMA.md'])
    assert.doesNotMatch(await text(path), new RegExp(`\\b(?!${few}\\b)[a-z]+ focused examples`), path + ' names another focused-example count');
});
