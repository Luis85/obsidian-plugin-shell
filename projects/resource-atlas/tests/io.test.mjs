import test from 'node:test';
import assert from 'node:assert/strict';
import { computePlan, normalizePlan } from '../src/domain.mjs';
import { createDemoPlan } from '../src/demo.mjs';
import {
  parseImport, parseMarkdown, serializePlan, serializeWorkspace, serializeMarkdown,
  createMarkdownExport, serializeRoleCsv, serializeDailyCsv, serializePeriodCsv,
  safeFilename, normalizeVaultFolder, MAX_IMPORT_BYTES
} from '../src/io.mjs';

const envelope = plan => JSON.stringify({ format: 'resource-atlas', schemaVersion: 1, plan });
const clone = value => JSON.parse(JSON.stringify(value));
const number = value => Number(value.replace(',', '.'));

function csvRows(text) {
  const rows = [], row = [];
  let value = '', quoted = false;
  for (let index = text.charCodeAt(0) === 0xFEFF ? 1 : 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ';') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push([...row]); row.length = 0; value = ''; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

test('the illustrative plan has 164 PT and no role-capacity overload', () => {
  const result = computePlan(createDemoPlan());
  assert.ok(Math.abs(result.totals.netPt - 164) < 1e-9);
  assert.deepEqual(result.roles.map(role => Math.round(role.netPt * 100) / 100), [35, 35, 80, 14]);
  assert.equal(result.totals.overloadPt, 0);
  assert.ok(Math.abs(result.totals.budgetRemainingPt + 14) < 1e-9);
});

test('every new demo is an independent copy', () => {
  const first = createDemoPlan(), second = createDemoPlan();
  first.roles[0].name = 'Changed';
  first.calendar.workdays.pop();
  assert.equal(second.roles[0].name, 'UX / UI Design');
  assert.deepEqual(second.calendar.workdays, [1, 2, 3, 4, 5]);
});

test('native JSON round trip preserves plan IDs, dates, FTE and notes', () => {
  const plan = createDemoPlan();
  plan.notes = 'Prüfung von Umlauten, Zeilen\nund „Anführungszeichen“.\n```json\n{"x":1}\n```';
  const parsed = parseImport(serializePlan(plan));
  assert.equal(parsed.kind, 'plan');
  assert.equal(parsed.activePlanId, plan.id);
  assert.deepEqual(parsed.plans, [plan]);
});

test('workspace round trip preserves every plan and the active selection', () => {
  const first = createDemoPlan(), second = createDemoPlan();
  second.id = 'plan-two';
  second.name = 'Neues Vorhaben';
  const parsed = parseImport(serializeWorkspace([first, second], second.id));
  assert.equal(parsed.kind, 'workspace');
  assert.equal(parsed.activePlanId, second.id);
  assert.deepEqual(parsed.plans, [first, second]);
});

test('workspace serialization supports shared input subobjects without treating them as a cycle', () => {
  const first = createDemoPlan(), second = { ...first, id: 'plan-two' };
  assert.equal(parseImport(serializeWorkspace([first, second], first.id)).plans.length, 2);
});

test('invalid imports fail before mutating a supplied plan', () => {
  const plan = createDemoPlan(), before = clone(plan);
  const bad = clone(plan);
  bad.allocations[0].roleId = 'missing-role';
  assert.throws(() => parseImport(envelope(bad)), /Zugehörige Rolle fehlt/);
  assert.deepEqual(plan, before);
});

test('the native wrapper and exact schema version are required', () => {
  assert.throws(() => parseImport(JSON.stringify(createDemoPlan())), /Dateiformat/);
  assert.throws(() => parseImport(JSON.stringify({ format: 'resource-atlas', schemaVersion: 2, plan: createDemoPlan() })), /Dateiversion/);
  assert.throws(() => parseImport(JSON.stringify({ format: 'resource-atlas', schemaVersion: '1', plan: createDemoPlan() })), /Dateiversion/);
  assert.throws(() => parseImport('[]'), /erwartet/);
});

test('unknown root and nested fields fail instead of silently discarding data', () => {
  const data = { format: 'resource-atlas', schemaVersion: 1, plan: createDemoPlan(), future: 'feature' };
  assert.throws(() => parseImport(JSON.stringify(data)), /unbekannte Datenfelder/);
  delete data.future;
  data.plan.roles[0].employeeId = 'private-person';
  assert.throws(() => parseImport(JSON.stringify(data)), /unbekannte Datenfelder/);
});

test('duplicate plan IDs, missing active plan and oversized plan counts are rejected', () => {
  const plan = createDemoPlan();
  assert.throws(() => serializeWorkspace([plan, plan], plan.id), /mehrfach/);
  assert.throws(() => serializeWorkspace([plan], 'missing'), /aktive Plan/);
  assert.throws(() => serializeWorkspace([], ''), /1 bis 25/);
  const plans = Array.from({ length: 26 }, (_, index) => ({ ...plan, id: `plan-${index}` }));
  assert.throws(() => serializeWorkspace(plans, plans[0].id), /1 bis 25/);
});

test('calendar errors, dangling roles, duplicate IDs and non-finite numbers are rejected', () => {
  const plan = createDemoPlan();
  plan.start = '2026-02-30';
  assert.throws(() => parseImport(envelope(plan)), /gültiges Datum/);
  const invalidRoles = createDemoPlan();
  invalidRoles.roles[1].id = invalidRoles.roles[0].id;
  assert.throws(() => parseImport(envelope(invalidRoles)), /doppelt/);
  const source = serializePlan(createDemoPlan()).replace('"fte": 1', '"fte": 1e999');
  assert.throws(() => parseImport(source), /FTE/);
});

test('malformed and prototype-related JSON is rejected', () => {
  assert.throws(() => parseImport('{oops'), /gültiges JSON/);
  assert.throws(() => parseImport('{"format":"resource-atlas","schemaVersion":1,"__proto__":{"x":1}}'), /nicht erlaubt/);
  assert.throws(() => parseImport('{"format":"resource-atlas","schemaVersion":1,"plan":{"constructor":{"prototype":{}}}}'), /nicht erlaubt/);
  assert.equal({}.x, undefined);
});

test('overly nested, oversized and circular inputs have controlled errors', () => {
  assert.throws(() => parseImport(`{"x":${'['.repeat(34)}0${']'.repeat(34)}}`), /verschachtelte/);
  assert.throws(() => parseImport(' '.repeat(MAX_IMPORT_BYTES + 1)), /32 MB/);
  const circular = createDemoPlan();
  circular.notes = circular;
  assert.throws(() => serializePlan(circular), /Zirkuläre/);
});

test('native JSON accepts a UTF-8 BOM and surrounding whitespace', () => {
  const plan = createDemoPlan();
  assert.deepEqual(parseImport(`\uFEFF  \n${serializePlan(plan)}\n`).plans[0], plan);
});

test('Markdown exports readable frontmatter and losslessly round trips the complete plan', () => {
  const plan = createDemoPlan();
  plan.notes = 'Details <script>alert(1)</script>\n```json\n{}\n```\n<!-- resource-atlas-data:start -->';
  plan.roles[0].name = 'UX | UI';
  const markdown = serializeMarkdown(plan, { folder: 'Produkt/Ressourcen' });
  assert.match(markdown, /^---\ntype: resource-plan/);
  assert.match(markdown, /resource_folder: "Produkt\/Ressourcen"/);
  assert.match(markdown, /planned_person_days: 164/);
  assert.match(markdown, /UX \\\| UI/);
  assert.ok(!markdown.includes('<script>'));
  assert.equal(parseImport(markdown).kind, 'markdown');
  assert.deepEqual(parseMarkdown(markdown).plans[0], plan);
});

test('Markdown uses ISO weekday mapping including a Sunday working day', () => {
  const plan = createDemoPlan();
  plan.calendar.workdays = [7];
  assert.match(serializeMarkdown(plan), /\*\*Arbeitskalender:\*\* So/);
});

test('Markdown tolerates CRLF and does not treat human-summary edits as plan data', () => {
  const plan = createDemoPlan();
  const markdown = serializeMarkdown(plan).replace('title: "ERP-Projekt · Beispiel"', 'title: "Geänderte Zusammenfassung"').replace(/\n/g, '\r\n');
  assert.deepEqual(parseImport(markdown).plans[0], plan);
});

test('Markdown rejects truncated or ambiguous data blocks', () => {
  const markdown = serializeMarkdown(createDemoPlan());
  assert.throws(() => parseMarkdown(markdown.replace('<!-- resource-atlas-data:end -->', '')), /unvollständig/);
  assert.throws(() => parseMarkdown(`${markdown}\n${markdown}`), /genau einen/);
  assert.throws(() => parseMarkdown('# Some other document\n\n```json\n{}\n```'), /Datenblock/);
});

test('Markdown rejects a workspace inside its single-plan data block', () => {
  const plan = createDemoPlan();
  const markdown = `<!-- resource-atlas-data:start -->\n\`\`\`json\n${serializeWorkspace([plan], plan.id).trim()}\n\`\`\`\n<!-- resource-atlas-data:end -->`;
  assert.throws(() => parseMarkdown(markdown), /genau einen Plan/);
});

test('Markdown export path is stable and vault-relative', () => {
  const plan = createDemoPlan();
  const exported = createMarkdownExport(plan, { folder: 'Produkt\\Ressourcen' });
  assert.equal(exported.path, 'Produkt/Ressourcen/ERP-Projekt · Beispiel--resource-plan-erp-demo.md');
  assert.ok(exported.content.startsWith('---\n'));
  assert.equal(createMarkdownExport(plan, { folder: '' }).path, exported.filename);
});

test('vault folders reject traversal, absolute locations, reserved names and invalid characters', () => {
  assert.equal(normalizeVaultFolder('Planung/Ressourcen/'), 'Planung/Ressourcen');
  for (const value of ['../outside', '/etc', 'C:\\private', '\\\\host\\share', '.obsidian', 'Planung//Ressourcen', 'Planung/..', 'Planung/CON', 'Planung/a?b', 'Planung/test.']) {
    assert.throws(() => normalizeVaultFolder(value), undefined, value);
  }
});

test('download filenames are safe on common desktop platforms and keep Unicode names', () => {
  assert.equal(safeFilename('Ressourcen – Büro'), 'Ressourcen – Büro');
  assert.equal(safeFilename('../outside\\plan?.md'), '--outside-plan-.md');
  assert.equal(safeFilename('CON'), 'plan-CON');
  assert.equal(safeFilename('   '), 'ressourceneinsatzplan');
  assert.equal(safeFilename('x'.repeat(200)).length, 100);
});

test('role CSV preserves German names, decimal effort and the 164 PT sum', () => {
  const plan = createDemoPlan();
  const csv = serializeRoleCsv(plan);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const rows = csvRows(csv);
  assert.equal(rows.length, 5);
  assert.equal(rows[0][9], 'Geplante PT');
  assert.equal(rows[4][6], '0,2');
  assert.ok(Math.abs(rows.slice(1).reduce((sum, row) => sum + number(row[9]), 0) - 164) < 1e-9);
  assert.equal(rows[3][5], 'Entwicklung');
});

test('role CSV treats imported formula-like names as text and correctly escapes quotes and delimiters', () => {
  const plan = createDemoPlan();
  plan.name = '=HYPERLINK("https://example.com")';
  plan.roles[0].name = '+SUM(1;2)\n"Text"';
  const rows = csvRows(serializeRoleCsv(plan));
  assert.equal(rows[1][0], '\'=HYPERLINK("https://example.com")');
  assert.equal(rows[1][5], '\'+SUM(1;2)\n"Text"');
  assert.equal(rows[1].length, rows[0].length);
});

test('daily CSV includes weekends at zero effort and reconciles to role totals', () => {
  const plan = createDemoPlan(), calculated = computePlan(plan);
  const rows = csvRows(serializeDailyCsv(plan, calculated));
  assert.equal(rows.length, calculated.days.length * plan.roles.length + 1);
  const weekend = rows.find(row => row[1] === '2026-10-17' && row[5] === 'role-ux');
  assert.equal(weekend[3], 'Nein');
  assert.equal(weekend[11], '0');
  const total = rows.slice(1).reduce((sum, row) => sum + number(row[11]), 0);
  assert.ok(Math.abs(total - 164) < 1e-9);
});

test('weekly and monthly CSV aggregate daily effort without adding full partial periods', () => {
  const plan = createDemoPlan(), calculated = computePlan(plan);
  for (const granularity of ['week', 'month']) {
    const rows = csvRows(serializePeriodCsv(plan, calculated, granularity));
    assert.equal(rows[1][2], plan.start);
    assert.equal(rows.at(-1)[3], plan.end);
    assert.ok(Math.abs(rows.slice(1).reduce((sum, row) => sum + number(row[8]), 0) - 164) < 1e-9);
  }
  assert.throws(() => serializePeriodCsv(plan, calculated, 'year'), /Woche oder Monat/);
});

test('CSV and Markdown cannot reuse a result from another plan', () => {
  const plan = createDemoPlan(), another = { ...plan, id: 'other-plan' }, result = computePlan(another);
  assert.throws(() => serializeRoleCsv(plan, result), /gehört nicht/);
  assert.throws(() => serializeMarkdown(plan, { calculation: result }), /gehört nicht/);
});

test('exports reject stale calculations after a plan edit with the same identity', () => {
  const plan = createDemoPlan(), calculated = computePlan(plan);
  plan.allocations[0].fte = 0.5;
  assert.throws(() => serializeRoleCsv(plan, calculated), /nicht mehr aktuell/);
  assert.throws(() => serializeMarkdown(plan, { calculation: calculated }), /nicht mehr aktuell/);
  const fresh = computePlan(plan);
  assert.match(serializeMarkdown(plan, { calculation: fresh }), /planned_person_days: 151.5/);
});

test('serialization does not mutate its input plan or derived calculation', () => {
  const plan = createDemoPlan(), result = computePlan(plan);
  const beforePlan = clone(plan), beforeResult = clone(result);
  serializePlan(plan); serializeWorkspace([plan], plan.id); serializeMarkdown(plan, { calculation: result });
  serializeRoleCsv(plan, result); serializeDailyCsv(plan, result); serializePeriodCsv(plan, result);
  assert.deepEqual(plan, beforePlan);
  assert.deepEqual(result, beforeResult);
});

test('omitted optional fields round trip to the domain canonical defaults', () => {
  const plan = { id: 'empty-plan', name: 'Leerer Plan', start: '2026-10-12', end: '2026-10-16' };
  const parsed = parseImport(envelope(plan)).plans[0];
  assert.deepEqual(parsed, normalizePlan(plan));
  assert.equal(computePlan(parsed).totals.netPt, 0);
});
