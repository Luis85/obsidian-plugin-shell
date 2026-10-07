// The Definition of Ready and Done reference (docs/development/DEFINITION-OF-READY-AND-DONE.md) lists every configured
// rule once, with its title from scripts/delivery and its severity from configs/delivery, so the page cannot drift.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readyRules } from '../tooling/delivery/rules-ready.mjs';
import { doneRules } from '../tooling/delivery/rules-done.mjs';

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const page = 'docs/development/DEFINITION-OF-READY-AND-DONE.md';
/** `| DOR-01 | Title | severity | …` rows of a Markdown page, by rule id. */
function ruleRows(markdown) {
  const rows = new Map();
  for (const [, id, title, severity] of markdown.matchAll(/^\| (DO[RD]-\d+) \| ([^|]+?) \| (error|warning) \|/gm)) {
    rows.set(id, [...rows.get(id) ?? [], { title, severity }]);
  }
  return rows;
}
/** Differences between the configured rules and the page's rows. */
function ruleDrift(markdown, gates) {
  const rows = ruleRows(markdown), failures = [], known = new Set();
  for (const { config, rules } of gates) for (const [id, setting] of Object.entries(config.rules)) {
    known.add(id);
    const found = rows.get(id) ?? [];
    if (found.length !== 1) { failures.push(`${id}: ${found.length} rows`); continue; }
    if (found[0].title !== rules[id]?.title) failures.push(`${id}: title "${found[0].title}" is not "${rules[id]?.title}"`);
    if (found[0].severity !== setting.severity) failures.push(`${id}: severity ${found[0].severity} is not ${setting.severity}`);
  }
  for (const id of rows.keys()) if (!known.has(id)) failures.push(`${id}: not configured`);
  return failures;
}
const gates = () => [{ config: JSON.parse(read('configs/delivery/definition-of-ready.json')), rules: readyRules },
  { config: JSON.parse(read('configs/delivery/definition-of-done.json')), rules: doneRules }];

test('every configured Definition of Ready and Done rule appears once in the reference with its title and severity', () => {
  const markdown = read(page);
  assert.deepEqual(ruleDrift(markdown, gates()), []);
  assert.match(markdown, /^> Type: reference\b/m);
  assert.equal(ruleRows(markdown).size, gates().reduce((sum, gate) => sum + Object.keys(gate.config.rules).length, 0));
});

test('negative: a missing, renamed, re-rated, duplicated or unknown rule row is reported', () => {
  const markdown = read(page);
  const drift = text => ruleDrift(text, gates()).join('\n');
  assert.match(drift(markdown.replace(/^\| DOR-04 \|.*\n/m, '')), /DOR-04: 0 rows/);
  assert.match(drift(markdown.replace('| DOR-05 | Acceptance criteria |', '| DOR-05 | Criteria |')), /DOR-05: title "Criteria"/);
  assert.match(drift(markdown.replace('| DOD-08 | Affected areas cover the diff | warning |', '| DOD-08 | Affected areas cover the diff | error |')), /DOD-08: severity error is not warning/);
  const row = /^\| DOD-01 \|.*$/m.exec(markdown)[0];
  assert.match(drift(markdown.replace(row, `${row}\n${row}`)), /DOD-01: 2 rows/);
  assert.match(drift(`${markdown}\n| DOR-99 | Invented | error | Increment | x |\n`), /DOR-99: not configured/);
});
