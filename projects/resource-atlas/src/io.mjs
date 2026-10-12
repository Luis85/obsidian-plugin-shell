import { normalizePlan, computePlan, isoWeek } from './domain.mjs';

/** Native file boundaries. These functions never read or mutate browser state. */
export const NATIVE_FORMAT = 'resource-atlas';
export const WORKSPACE_FORMAT = 'resource-atlas-workspace';
export const SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 32 * 1024 * 1024;
export const MAX_WORKSPACE_PLANS = 25;

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const encoder = new TextEncoder();

function fail(message) {
  throw new Error(message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertTextSize(text) {
  if (typeof text !== 'string') fail('Die Importdatei muss Text enthalten.');
  if (encoder.encode(text).byteLength > MAX_IMPORT_BYTES) fail('Die Datei ist größer als 32 MB. Bitte einzelne Pläne exportieren.');
}

function assertSafeTree(value) {
  const stack = [{ value, depth: 0, exit: false }];
  const ancestors = new Set();
  let entries = 0;
  while (stack.length) {
    const current = stack.pop();
    if (current.exit) { ancestors.delete(current.value); continue; }
    entries += 1;
    if (entries > 1000000) fail('Die Datei enthält zu viele Datenfelder.');
    if (current.depth > 32) fail('Die Datei enthält zu tief verschachtelte Daten.');
    if (current.value === null || typeof current.value !== 'object') continue;
    if (ancestors.has(current.value)) fail('Zirkuläre Daten sind nicht erlaubt.');
    ancestors.add(current.value);
    stack.push({ value: current.value, depth: current.depth, exit: true });
    if (!Array.isArray(current.value) && Object.getPrototypeOf(current.value) !== Object.prototype && Object.getPrototypeOf(current.value) !== null) {
      fail('Die Datei enthält ein nicht unterstütztes Objekt.');
    }
    for (const key of Object.keys(current.value)) {
      if (FORBIDDEN_KEYS.has(key)) fail(`Das Datenfeld „${key}“ ist nicht erlaubt.`);
      stack.push({ value: current.value[key], depth: current.depth + 1 });
    }
  }
}

function parseJson(text) {
  assertTextSize(text);
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    fail('Die Datei enthält kein gültiges JSON.');
  }
  assertSafeTree(parsed);
  return parsed;
}

function assertKeys(value, allowed, label) {
  if (!isRecord(value)) fail(`${label} muss ein JSON-Objekt sein.`);
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) fail(`${label}: unbekannte Datenfelder (${unknown.slice(0, 4).join(', ')}).`);
}

function canonicalImportedPlan(value) {
  assertKeys(value, ['id', 'name', 'start', 'end', 'budgetPt', 'calendar', 'roles', 'allocations', 'blocks', 'notes'], 'Plan');
  if (value.calendar !== undefined) {
    assertKeys(value.calendar, ['workdays', 'hoursPerDay', 'holidays'], 'Kalender');
    if (Array.isArray(value.calendar.holidays)) for (const entry of value.calendar.holidays) assertKeys(entry, ['id', 'date', 'name'], 'Feiertag');
  }
  if (Array.isArray(value.roles)) for (const entry of value.roles) assertKeys(entry, ['id', 'name', 'fte', 'color', 'notes'], 'Rolle');
  if (Array.isArray(value.allocations)) for (const entry of value.allocations) assertKeys(entry, ['id', 'roleId', 'name', 'start', 'end', 'fte', 'notes'], 'Einsatz');
  if (Array.isArray(value.blocks)) for (const entry of value.blocks) assertKeys(entry, ['id', 'roleId', 'name', 'start', 'end', 'fraction'], 'Sperrzeit');
  return normalizePlan(value);
}

function nativeEnvelope(plan) {
  assertSafeTree(plan);
  return { format: NATIVE_FORMAT, schemaVersion: SCHEMA_VERSION, plan: normalizePlan(plan) };
}

function validateEnvelope(value) {
  if (!isRecord(value)) fail('Es wird ein Resource-Atlas-Plan oder eine Resource-Atlas-Sicherung erwartet.');
  if (value.format !== NATIVE_FORMAT && value.format !== WORKSPACE_FORMAT) {
    fail('Dieses Dateiformat wird nicht unterstützt. Bitte eine Resource-Atlas-JSON- oder Markdown-Datei wählen.');
  }
  if (value.schemaVersion !== SCHEMA_VERSION) fail('Diese Dateiversion wird nicht unterstützt. Erwartet wird Version 1.');
  if (value.format === NATIVE_FORMAT) {
    assertKeys(value, ['format', 'schemaVersion', 'plan'], 'Plandatei');
    const plan = canonicalImportedPlan(value.plan);
    return { kind: 'plan', plans: [plan], activePlanId: plan.id };
  }
  assertKeys(value, ['format', 'schemaVersion', 'activePlanId', 'plans'], 'Sicherung');
  if (!Array.isArray(value.plans) || value.plans.length < 1 || value.plans.length > MAX_WORKSPACE_PLANS) {
    fail('Eine Sicherung muss 1 bis 25 Pläne enthalten.');
  }
  const plans = value.plans.map(plan => canonicalImportedPlan(plan));
  const ids = new Set();
  for (const plan of plans) {
    if (ids.has(plan.id)) fail(`Die Plan-ID „${plan.id}“ kommt in der Sicherung mehrfach vor.`);
    ids.add(plan.id);
  }
  if (typeof value.activePlanId !== 'string' || !ids.has(value.activePlanId)) {
    fail('Der aktive Plan der Sicherung ist nicht enthalten.');
  }
  return { kind: 'workspace', plans, activePlanId: value.activePlanId };
}

function stringify(value) {
  assertSafeTree(value);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  assertTextSize(text);
  return text;
}

/** Parse and validate the complete import before the caller changes any state. */
export function parseImport(text) {
  assertTextSize(text);
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return validateEnvelope(parseJson(trimmed));
  return parseMarkdown(trimmed);
}

export function serializePlan(plan) {
  return stringify(nativeEnvelope(plan));
}

export function serializeWorkspace(plans, activePlanId) {
  const envelope = { format: WORKSPACE_FORMAT, schemaVersion: SCHEMA_VERSION, activePlanId, plans };
  assertSafeTree(envelope);
  const validated = validateEnvelope(envelope);
  return stringify({ ...envelope, plans: validated.plans });
}

/** A vault-relative folder, never an absolute path or a path outside the vault. */
export function normalizeVaultFolder(value = 'Planung/Ressourcen') {
  if (typeof value !== 'string') fail('Der Vault-Ordner muss Text sein.');
  const original = value.trim();
  if (!original) return '';
  if (/^[\\/]/.test(original) || /^[a-z]:/i.test(original)) fail('Bitte einen relativen Ordner innerhalb des Vaults angeben.');
  const normalized = original.replace(/\\/g, '/').replace(/\/+$/, '');
  if (normalized.length > 200) fail('Der Vault-Ordner darf höchstens 200 Zeichen enthalten.');
  const segments = normalized.split('/');
  if (segments.length > 8) fail('Der Vault-Ordner darf höchstens 8 Ebenen enthalten.');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || segment.startsWith('.') || /[<>:"|?*\u0000-\u001F]/.test(segment) || /[. ]$/.test(segment) || segment.length > 80) {
      fail('Der Vault-Ordner enthält einen ungültigen Ordnernamen.');
    }
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)) fail('Der Vault-Ordner enthält einen reservierten Ordnernamen.');
  }
  return normalized;
}

export function safeFilename(value, fallback = 'ressourceneinsatzplan') {
  let name = String(value ?? '').normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 100)
    .replace(/[. ]+$/g, '');
  if (!name) name = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `plan-${name}`;
  return name;
}

function displayNumber(value) {
  if (!Number.isFinite(value)) fail('Der Export enthält einen ungültigen Rechenwert.');
  return String(Number(value.toFixed(6))).replace('.', ',');
}

function csvCell(value) {
  if (typeof value === 'number') return displayNumber(value);
  let text = String(value ?? '');
  // Keep user-entered names and notes as text when opened in a spreadsheet.
  if (/^[\s\u0000-\u001F]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(rows) {
  return `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

function calculationFor(plan, calculation) {
  const canonical = normalizePlan(plan);
  if (!calculation) return { plan: canonical, calculation: computePlan(canonical) };
  if (calculation.plan?.id !== canonical.id || !Array.isArray(calculation.roles) || !Array.isArray(calculation.days)) {
    fail('Die Auswertung gehört nicht zum gewählten Plan.');
  }
  if (JSON.stringify(calculation.plan) !== JSON.stringify(canonical)) {
    fail('Die Auswertung ist nicht mehr aktuell. Bitte den Plan erneut berechnen.');
  }
  return { plan: canonical, calculation };
}

export function serializeRoleCsv(inputPlan, inputCalculation) {
  const { plan, calculation } = calculationFor(inputPlan, inputCalculation);
  const rows = [[
    'Plan', 'Plan-ID', 'Von', 'Bis', 'Rollen-ID', 'Rolle', 'Standard-FTE',
    'Brutto-PT', 'Gesperrte PT', 'Geplante PT', 'Geplante Stunden', 'Kapazität PT', 'Überlast PT'
  ]];
  for (const role of calculation.roles) {
    rows.push([plan.name, plan.id, plan.start, plan.end, role.roleId ?? role.id, role.name, role.fte,
      role.grossPt, role.blockedPt, role.netPt, role.netPt * plan.calendar.hoursPerDay, role.capacityPt, role.overloadPt]);
  }
  return csv(rows);
}

/** One row per role and calendar day, including non-working days with zero PT. */
export function serializeDailyCsv(inputPlan, inputCalculation) {
  const { plan, calculation } = calculationFor(inputPlan, inputCalculation);
  const names = new Map(plan.roles.map(role => [role.id, role.name]));
  const rows = [[
    'Plan', 'Datum', 'ISO-Woche', 'Arbeitstag', 'Feiertag', 'Rollen-ID', 'Rolle',
    'Geplante FTE', 'Gesperrter Anteil', 'Brutto-PT', 'Gesperrte PT', 'Geplante PT', 'Geplante Stunden', 'Kapazität PT', 'Überlast PT'
  ]];
  for (const day of calculation.days) {
    for (const role of day.roles) {
      const holidayName = typeof day.holiday === 'string' ? day.holiday : day.holiday?.name ?? (day.holiday ? 'Ja' : '');
      rows.push([plan.name, day.date, isoWeek(day.date).key, day.working ? 'Ja' : 'Nein', holidayName,
        role.roleId, names.get(role.roleId) ?? '', role.allocationFte, role.blockedFraction, role.grossPt, role.blockedPt,
        role.netPt, role.netPt * plan.calendar.hoursPerDay, role.capacityPt, role.overloadPt]);
    }
  }
  return csv(rows);
}

/** Period boundaries are clipped to the plan; effort is summed from daily values. */
export function serializePeriodCsv(inputPlan, inputCalculation, granularity = 'week') {
  if (!['week', 'month'].includes(granularity)) fail('Der Zeitraum muss Woche oder Monat sein.');
  const { plan, calculation } = calculationFor(inputPlan, inputCalculation);
  const names = new Map(plan.roles.map(role => [role.id, role.name]));
  const periods = new Map();
  for (const day of calculation.days) {
    const key = granularity === 'week' ? isoWeek(day.date).key : day.date.slice(0, 7);
    if (!periods.has(key)) periods.set(key, { key, start: day.date, end: day.date, roles: new Map() });
    const period = periods.get(key);
    period.end = day.date;
    for (const role of day.roles) {
      if (!period.roles.has(role.roleId)) period.roles.set(role.roleId, { grossPt: 0, blockedPt: 0, netPt: 0, capacityPt: 0, overloadPt: 0 });
      const values = period.roles.get(role.roleId);
      for (const field of ['grossPt', 'blockedPt', 'netPt', 'capacityPt', 'overloadPt']) values[field] += role[field];
    }
  }
  const rows = [['Plan', 'Zeitraum', 'Von', 'Bis', 'Rollen-ID', 'Rolle', 'Brutto-PT', 'Gesperrte PT', 'Geplante PT', 'Geplante Stunden', 'Kapazität PT', 'Überlast PT']];
  for (const period of periods.values()) {
    for (const [roleId, values] of period.roles) {
      rows.push([plan.name, period.key, period.start, period.end, roleId, names.get(roleId) ?? '',
        values.grossPt, values.blockedPt, values.netPt, values.netPt * plan.calendar.hoursPerDay, values.capacityPt, values.overloadPt]);
    }
  }
  return csv(rows);
}

function markdownText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|~-])/g, '\\$1');
}

function tableText(value) {
  return markdownText(value).replace(/\r?\n/g, ' / ');
}

function yamlText(value) {
  return JSON.stringify(value).replace(/\u0085/g, '\\u0085').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Frontmatter is a readable summary. The marked JSON block preserves the plan losslessly. */
export function serializeMarkdown(inputPlan, options = {}) {
  const { plan, calculation } = calculationFor(inputPlan, options.calculation);
  const folder = normalizeVaultFolder(options.folder);
  const roleNames = new Map(plan.roles.map(role => [role.id, role.name]));
  const workdayNames = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const nativeJson = JSON.stringify(nativeEnvelope(plan), null, 2)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/`/g, '\\u0060');
  const lines = [
    '---',
    'type: resource-plan',
    'resource_atlas_schema: 1',
    `resource_plan_id: ${yamlText(plan.id)}`,
    `title: ${yamlText(plan.name)}`,
    `start: ${plan.start}`,
    `end: ${plan.end}`,
    `hours_per_day: ${plan.calendar.hoursPerDay}`,
    `planned_person_days: ${Number(calculation.totals.netPt.toFixed(6))}`,
    `budget_person_days: ${plan.budgetPt === null ? 'null' : plan.budgetPt}`,
    `resource_folder: ${yamlText(folder)}`,
    'tags:',
    '  - resource-atlas',
    '  - ressourceneinsatzplan',
    '---',
    '',
    `# ${markdownText(plan.name)}`,
    '',
    `**Planzeitraum:** ${plan.start} bis ${plan.end} (beide Tage eingeschlossen).`,
    '',
    `**Geplanter Aufwand:** ${displayNumber(calculation.totals.netPt)} Personentage · ${displayNumber(calculation.totals.netPt * plan.calendar.hoursPerDay)} Stunden.`,
    '',
    `**Arbeitskalender:** ${plan.calendar.workdays.map(day => workdayNames[day]).join(', ')} · ${displayNumber(plan.calendar.hoursPerDay)} Stunden pro Personentag.`,
    '',
    '## Rollen und Aufwand',
    '',
    '| Rolle | Standard-FTE | Brutto-PT | Gesperrte PT | Geplante PT | Kapazität PT | Überlast PT |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];
  for (const role of calculation.roles) lines.push(`| ${tableText(role.name)} | ${displayNumber(role.fte)} | ${displayNumber(role.grossPt)} | ${displayNumber(role.blockedPt)} | ${displayNumber(role.netPt)} | ${displayNumber(role.capacityPt)} | ${displayNumber(role.overloadPt)} |`);
  lines.push('', '## Einsätze', '', '| Rolle | Einsatz | Von | Bis | FTE |', '| --- | --- | --- | --- | ---: |');
  for (const allocation of plan.allocations) lines.push(`| ${tableText(roleNames.get(allocation.roleId))} | ${tableText(allocation.name)} | ${allocation.start} | ${allocation.end} | ${displayNumber(allocation.fte)} |`);
  if (!plan.allocations.length) lines.push('| — | Keine Einsätze geplant | — | — | — |');
  lines.push('', '## Sperrzeiten', '', '| Geltungsbereich | Grund | Von | Bis | Gesperrter Anteil |', '| --- | --- | --- | --- | ---: |');
  for (const block of plan.blocks) lines.push(`| ${tableText(block.roleId === null ? 'Alle Rollen' : roleNames.get(block.roleId))} | ${tableText(block.name)} | ${block.start} | ${block.end} | ${displayNumber(block.fraction * 100)} % |`);
  if (!plan.blocks.length) lines.push('| Alle Rollen | Keine Sperrzeiten | — | — | — |');
  if (plan.calendar.holidays.length) {
    lines.push('', '## Feiertage', '', '| Datum | Bezeichnung |', '| --- | --- |');
    for (const holiday of plan.calendar.holidays) lines.push(`| ${holiday.date} | ${tableText(holiday.name)} |`);
  }
  if (plan.notes) lines.push('', '## Notizen', '', markdownText(plan.notes));
  lines.push('', '## Rechenregeln', '',
    'Nur angelegte Einsätze erzeugen Aufwand. Standard-FTE definieren die verfügbare Rollen-Kapazität und den Vorschlag für neue Einsätze.',
    '',
    'Pro Arbeitstag gilt: Geplante PT = Summe der Einsatz-FTE × (1 − wirksamer Sperranteil). Bei überlappenden Sperrzeiten gilt der größte Sperranteil. Wochenenden gemäß Kalender und eingetragene Feiertage ergeben 0 PT.',
    '',
    '## Vollständige Plandaten', '',
    'Dieser markierte Datenblock ist die vollständige Importquelle. Die Zusammenfassung und die Eigenschaften darüber sind ein lesbarer Exportstand. Importieren verändert den Plan erst nach einer ausdrücklichen Bestätigung.',
    '',
    '<!-- resource-atlas-data:start -->',
    '```json',
    nativeJson,
    '```',
    '<!-- resource-atlas-data:end -->',
    ''
  );
  const text = lines.join('\n');
  assertTextSize(text);
  return text;
}

export function createMarkdownExport(plan, options = {}) {
  const canonical = normalizePlan(plan);
  const folder = normalizeVaultFolder(options.folder);
  const filename = `${safeFilename(canonical.name)}--${safeFilename(canonical.id)}.md`;
  return { filename, path: folder ? `${folder}/${filename}` : filename, content: serializeMarkdown(canonical, { ...options, folder }) };
}

export function parseMarkdown(text) {
  assertTextSize(text);
  const marker = /^<!-- resource-atlas-data:start -->\r?$/gm;
  if ([...text.matchAll(marker)].length !== 1) fail('Die Markdown-Datei muss genau einen vollständigen Resource-Atlas-Datenblock enthalten.');
  const match = text.match(/^<!-- resource-atlas-data:start -->\r?\n```json\r?\n([\s\S]*?)\r?\n```\r?\n<!-- resource-atlas-data:end -->\r?$/m);
  if (!match) fail('Der Resource-Atlas-Datenblock in der Markdown-Datei ist unvollständig.');
  const parsed = validateEnvelope(parseJson(match[1]));
  if (parsed.kind !== 'plan') fail('Eine Markdown-Datei darf genau einen Plan enthalten.');
  return { ...parsed, kind: 'markdown' };
}
