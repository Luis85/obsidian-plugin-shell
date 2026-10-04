/**
 * Generated documentation for the delivery checks, as pure text transforms: the handoff Completion record,
 * the CHANGELOG Unreleased entries, docs/README.md index rows, missing handoff sections from the template
 * and the status field. Authored text is never rewritten; the Completion record is the only replaced section.
 */
import { posix } from 'node:path';
import { categories, mergeNotes, parseChangelog, sectionBody, validateChangelog } from '../release/changelog.mjs';
import { acceptanceCriteria, affectedAreas, parseHandoff } from './handoff.mjs';
import { matchesPath } from './paths.mjs';

const cell = value => String(value).replace(/\|/g, '\\|');
const trimEnd = lines => { const copy = [...lines]; while (copy.length && !copy.at(-1).trim()) copy.pop(); return copy; };

/** Replaces the `## name` section (up to the next `#`/`##` heading) or appends it at the end. */
export function upsertSection(text, name, sectionText) {
  const model = parseHandoff(text); const lines = model.lines;
  const index = model.sections.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
  const block = sectionText.replace(/\n+$/, '').split('\n');
  if (index < 0) return [...trimEnd(lines), '', ...block, ''].join('\n');
  const start = model.sections[index].line - 1;
  const next = model.sections[index + 1]?.line - 1;
  const after = Number.isInteger(next) ? lines.slice(next) : [];
  return [...lines.slice(0, start), ...block, ...(after.length ? ['', ...after] : [''])].join('\n');
}

/** Sets one frontmatter scalar, adding the key before the closing --- when it is absent. */
export function setFrontmatterValue(text, key, value) {
  const lines = String(text).split('\n');
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (lines[0]?.trim() !== '---' || close < 0) return text;
  const at = lines.slice(1, close).findIndex(line => line.startsWith(`${key}:`));
  if (at >= 0) lines[at + 1] = `${key}: ${value}`; else lines.splice(close, 0, `${key}: ${value}`);
  return lines.join('\n');
}

/** Appends each missing `##` section of the template, in template order, before the Completion record. */
export function scaffoldSections(text, templateText, names, generated) {
  const present = new Set(parseHandoff(text).sections.map(item => item.name.toLowerCase()));
  const template = parseHandoff(templateText);
  const missing = names.filter(name => !present.has(name.toLowerCase()));
  if (!missing.length) return { text, added: [] };
  let output = text; let record = null;
  const handoff = parseHandoff(text); const recordSection = handoff.section(generated);
  if (recordSection) {
    const start = recordSection.line - 1;
    record = handoff.lines.slice(start).join('\n'); output = trimEnd(handoff.lines.slice(0, start)).join('\n') + '\n';
  }
  for (const name of missing) {
    const source = template.section(name);
    const body = source ? source.lines.map(entry => entry.text) : ['<describe this section>'];
    output = [...trimEnd(output.split('\n')), '', `## ${name}`, ...trimEnd(body), ''].join('\n');
  }
  if (record) output = [...trimEnd(output.split('\n')), '', record].join('\n');
  return { text: output, added: missing };
}

/** CHANGELOG text with the given { category, text } entries merged into ## [Unreleased]; validated after. */
export function changelogWithEntries(text, entries) {
  if (!entries.length) return text;
  const model = parseChangelog(text); const unreleased = model.sections.find(item => item.unreleased);
  if (!unreleased) throw new Error('CHANGELOG_UNRELEASED_REQUIRED: add a "## [Unreleased]" section first.');
  const notes = categories.filter(name => entries.some(entry => entry.category === name))
    .map(name => [`### ${name}`, '', ...entries.filter(entry => entry.category === name).map(entry => `- ${entry.text}`)].join('\n')).join('\n\n');
  const body = mergeNotes(sectionBody(model, unreleased), notes);
  const output = [...model.lines.slice(0, unreleased.start), model.lines[unreleased.start], '', body, '', ...model.lines.slice(unreleased.end)].join('\n');
  const check = validateChangelog(output);
  if (!check.ok) throw new Error(`CHANGELOG_INVALID: ${check.diagnostics.map(item => item.code).join(', ')}`);
  return output;
}

/** docs/README.md with one `| [Title](link) | note |` row per page, at the end of the first table under its heading. */
export function indexWithRows(indexText, rows, headings, indexPath = 'docs/README.md') {
  const lines = String(indexText).split('\n'); const skipped = [];
  for (const row of rows) {
    const heading = lines.findIndex(line => line.trim() === `## ${headings[row.type]}`);
    let table = heading < 0 ? -1 : lines.findIndex((line, index) => index > heading && line.startsWith('|'));
    const nextHeading = lines.findIndex((line, index) => index > heading && /^## /.test(line));
    if (heading < 0 || table < 0 || (nextHeading >= 0 && table > nextHeading)) { skipped.push(row.target); continue; }
    while (lines[table + 1]?.startsWith('|')) table++;
    const link = posix.relative(posix.dirname(indexPath), row.target);
    lines.splice(table + 1, 0, `| [${cell(row.title)}](${link}) | ${cell(row.note || row.title)} |`);
  }
  return { text: lines.join('\n'), skipped };
}

function areaTable(model, diff, handoffPath, covered) {
  const areas = affectedAreas(model.section('Affected areas')).map(area => area.pattern).filter(Boolean);
  const files = diff.filter(file => file.status !== 'D').map(file => file.path);
  const rows = areas.map(area => [area, files.filter(path => matchesPath(area, path)).length]);
  const outside = files.filter(path => path !== handoffPath && !covered.includes(path) && !areas.some(area => matchesPath(area, path))).length;
  return ['| Area | Changed files |', '| --- | ---: |', ...rows.map(([area, count]) => `| \`${cell(area)}\` | ${count} |`), `| Outside the affected areas | ${outside} |`];
}
function gateLines(gates) {
  if (!gates) return ['`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.'];
  if (!gates.length) return ['`node bin/app check --plan` selected no gate for this diff.'];
  return ['From `node bin/app check --plan`:', '', '| Gate | Command | Required |', '| --- | --- | --- |', ...gates.map(gate => `| ${cell(gate.id)} | \`${cell(gate.command)}\` | ${gate.required ? 'yes' : 'no'} |`)];
}

/** The `## Completion record` section text for the current diff. */
export function completionRecord({ model, path, diff, base, labels, gates, label = 'e2e', heading = 'Completion record', covered = [] }) {
  const counts = { A: 0, M: 0, D: 0, R: 0 };
  for (const file of diff) counts[file.status] = (counts[file.status] ?? 0) + 1;
  const e2e = model.frontmatter.data.e2e ?? 'unset';
  const labelState = labels === null ? 'not verifiable locally' : labels.includes(label) ? 'present' : 'absent';
  const criteria = acceptanceCriteria(model.section('Acceptance criteria')).filter(item => item.valid);
  return [`## ${heading}`, '',
    `<!-- Generated by \`npm run dod -- --write\`; regenerate it instead of editing. -->`, '',
    `- Base: \`${base.ref}\` (merge base \`${base.sha.slice(0, 12)}\`)`,
    `- Changed files: ${diff.length} (${counts.A} added, ${counts.M} modified, ${counts.R} renamed, ${counts.D} deleted)`,
    `- E2E decision: ${e2e}; \`${label}\` label ${labelState}`, '',
    '### Changed files by area', '', ...areaTable(model, diff, path, covered), '',
    '### Acceptance criteria evidence', '', '| Criterion | Done | Evidence |', '| --- | --- | --- |',
    ...criteria.map(item => `| ${item.id} | ${item.checked ? 'yes' : 'no'} | ${item.evidence.map(value => `\`${cell(value)}\``).join(', ') || 'none'} |`), '',
    '### Gates', '', ...gateLines(gates), ''].join('\n');
}
