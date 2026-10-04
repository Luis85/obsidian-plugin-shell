/**
 * Runs one gate over an injected repository snapshot: exemptions, handoff selection, rule evaluation and
 * (for the Definition of Done) the generated documentation. Writing happens only through `io.write`.
 */
import { posix } from 'node:path';
import { categories } from '../release/changelog.mjs';
import { completionRecord, changelogWithEntries, indexWithRows, scaffoldSections, setFrontmatterValue, upsertSection } from './generate.mjs';
import { changelogEntries, docsImpact, parseFrontmatter, parseHandoff } from './handoff.mjs';
import { matchesAny, safeRelative } from './paths.mjs';
import { readyRules } from './rules-ready.mjs';
import { doneRules, missingChangelogEntries } from './rules-done.mjs';
import { refinementBrief } from './report.mjs';

/** The exemption notice for a head branch or pull-request author the config exempts, else null. */
export function exemption(delivery, { headRef = '', actor = '' }) {
  const branch = delivery.exemptions.branches.find(prefix => headRef.startsWith(prefix));
  if (branch) return `Head branch ${headRef} is exempt (${branch}*): no increment handoff is required.`;
  if (delivery.exemptions.actors.includes(actor)) return `Pull requests by ${actor} are exempt: no increment handoff is required.`;
  return null;
}

/** Increment paths named by the `increment:` field (an id, a path or a [[wikilink]]) of changed PullRequest documents. */
function referencedIncrements(delivery, snapshot, documents) {
  const paths = new Set();
  for (const path of documents) {
    const data = parseFrontmatter(String(snapshot.readText(path) ?? '').replace(/\r\n?/g, '\n').split('\n')).data;
    const raw = data.type === delivery.pullRequests.type ? data[delivery.pullRequests.incrementKey] : null;
    const value = typeof raw === 'string' ? raw.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim() : '';
    if (value) paths.add(value.includes('/') ? value.replace(/(?:\.md)?$/, '.md') : delivery.handoff.glob.replace('*', value.replace(/\.md$/, '')));
  }
  return [...paths];
}

/** Picks the Increment: --handoff, a "Handoff: path" line in the PR body, the one Increment changed in the diff, else
 * the one Increment that changed PullRequest documents (docs/pull-requests/*.md) name in their `increment:` field. */
export function selectHandoff(delivery, snapshot, explicit) {
  const settings = delivery.handoff; const create = delivery.refinement.newHandoff;
  const named = explicit ?? new RegExp(`^\\s*${settings.bodyKey}:\\s*\`?([^\\s\`]+)\`?\\s*$`, 'mu').exec(snapshot.body ?? '')?.[1];
  const source = explicit ? '--handoff' : 'pull request body';
  if (named) {
    if (!safeRelative(named) || !matchesAny([settings.glob], named)) return { problem: { message: `${named} (${source}) is not a handoff path matching ${settings.glob}.`, hint: `Name a file such as docs/increments/<slug>.md; create one with \`${create}\`.` } };
    return snapshot.files.includes(named) ? { path: named, source } : { problem: { message: `${named} (${source}) does not exist.`, hint: `Create it with \`${create}\` and commit it.` } };
  }
  const changedDocs = glob => snapshot.diff.filter(file => file.status !== 'D' && matchesAny([glob], file.path) && !settings.ignore.includes(file.path)).map(file => file.path);
  let candidates = changedDocs(settings.glob); let origin = 'diff';
  if (!candidates.length) { candidates = referencedIncrements(delivery, snapshot, changedDocs(delivery.pullRequests.glob)); origin = 'PullRequest document'; }
  if (candidates.length === 1) return snapshot.files.includes(candidates[0]) ? { path: candidates[0], source: origin }
    : { problem: { message: `${candidates[0]} (${origin}) does not exist.`, hint: `Create it with \`${create}\` and commit it.` } };
  if (!candidates.length) return { problem: { message: `No handoff matching ${settings.glob} is added or changed in this pull request.`, hint: `Create one with \`${create}\`, fill it in (or use the increment-handoff skill) and commit it with the pull request.` } };
  return { problem: { message: `${candidates.length} handoffs changed: ${candidates.join(', ')}.`, hint: `Keep one handoff per pull request, or name it with --handoff or a "${settings.bodyKey}: docs/increments/<slug>.md" line in the pull-request body.` } };
}

/** Rule results with severity applied: a failing warning rule reports "warn"; a disabled rule "disabled". */
export function evaluate(definitions, configured, context) {
  return Object.entries(definitions).map(([id, definition]) => {
    const rule = configured[id];
    const base = { id, title: definition.title, severity: rule.severity };
    if (!rule.enabled) return { ...base, status: 'disabled', message: 'Disabled in the configuration.' };
    if (!definition.appliesTo.includes(context.kind ?? 'Increment')) return { ...base, status: 'skip', message: `Does not apply to ${context.kind} documents.` };
    let outcome;
    try { outcome = definition.run(context, rule.params); } catch (error) { outcome = { status: 'fail', message: `Rule error: ${error.message}`, hint: 'Report this as a delivery-check bug.' }; }
    const status = outcome.status === 'fail' && rule.severity === 'warning' ? 'warn' : outcome.status;
    return { ...base, ...outcome, status };
  });
}
const blocking = results => results.filter(rule => rule.status === 'fail' && rule.severity === 'error');

function context(config, snapshot, selection) {
  const handoffText = selection.path ? snapshot.readText(selection.path) : null;
  return { delivery: config.delivery, files: snapshot.files, suites: snapshot.suites, scripts: snapshot.scripts, categories,
    diff: snapshot.diff, labels: snapshot.labels, readText: snapshot.readText, handoffProblem: selection.problem ?? null,
    handoff: handoffText === null ? null : { path: selection.path, source: selection.source, text: handoffText, model: parseHandoff(handoffText) } };
}

/** Definition of Ready. `io.write(path, text)` is called only with --write; `io.template()` reads the template. */
export function runReady(config, snapshot, options, io) {
  const selection = selectHandoff(config.delivery, snapshot, options.handoff);
  let current = context(config, snapshot, selection);
  const generated = { scaffolded: [], written: [] };
  let rules = evaluate(readyRules, config.rules, current);
  if (current.handoff && blocking(rules).some(rule => rule.id === 'DOR-03')) {
    const scaffold = scaffoldSections(current.handoff.text, io.template(), config.delivery.handoff.sections, config.delivery.handoff.generatedSection);
    generated.scaffolded = scaffold.added; generated.handoffText = scaffold.text;
    if (options.write && scaffold.added.length) {
      io.write(current.handoff.path, scaffold.text); generated.written.push(current.handoff.path);
      current = context(config, { ...snapshot, readText: path => path === current.handoff.path ? scaffold.text : snapshot.readText(path) }, selection);
      rules = evaluate(readyRules, config.rules, current);
    }
  }
  const status = blocking(rules).length ? 'not-ready' : 'ready';
  const result = { gate: 'ready', status, handoff: current.handoff?.path ?? null, base: snapshot.base, rules, generated };
  if (status === 'not-ready') result.refinement = refinementBrief(result, readyRules, config.delivery);
  return result;
}

function generatedDocs(config, current, snapshot, gates) {
  const done = config.rules; const files = {}; const out = { changelog: [], docsIndex: [] };
  const changelog = done['DOD-04'].params.file;
  const entries = changelogEntries(current.handoff.model.section('Changelog'), categories);
  const missing = entries.none ? [] : missingChangelogEntries(snapshot.readText(changelog), entries.entries);
  if (missing.length) { files[changelog] = changelogWithEntries(snapshot.readText(changelog) ?? '', missing); out.changelog = missing; }
  const { index, headings } = done['DOD-06'].params;
  const indexText = snapshot.readText(index) ?? '';
  const added = new Set(snapshot.diff.filter(file => file.status === 'A').map(file => file.path));
  const rows = docsImpact(current.handoff.model.section('Docs impact')).items
    .filter(item => added.has(item.target) && item.target.startsWith('docs/') && item.target !== index && !indexText.includes(`](${posix.relative(posix.dirname(index), item.target)})`))
    .map(item => ({ ...item, title: /^# (.+)$/m.exec(snapshot.readText(item.target) ?? '')?.[1] ?? item.target }));
  if (rows.length) { const updated = indexWithRows(indexText, rows, headings, index); files[index] = updated.text; out.docsIndex = rows.map(row => row.target).filter(target => !updated.skipped.includes(target)); }
  out.completionRecord = completionRecord({ model: current.handoff.model, path: current.handoff.path, diff: snapshot.diff, base: snapshot.base,
    labels: snapshot.labels, gates, label: done['DOD-10'].params.label, heading: config.delivery.handoff.generatedSection, covered: done['DOD-08'].params.alwaysCovered });
  files[current.handoff.path] = upsertSection(current.handoff.text, config.delivery.handoff.generatedSection, out.completionRecord);
  return { files, out };
}

/** Definition of Done. `io.refresh()` re-reads the snapshot after a write; `io.gates()` gives check --plan gates or null. */
export function runDone(config, snapshot, options, io) {
  const selection = selectHandoff(config.delivery, snapshot, options.handoff);
  const evaluateAll = (current) => {
    const readyFailures = blocking(evaluate(readyRules, config.ready, current)).map(rule => rule.id);
    return evaluate(doneRules, config.rules, { ...current, readyFailures });
  };
  let current = context(config, snapshot, selection);
  let rules = evaluateAll(current);
  const generated = { changelog: [], docsIndex: [], written: [], files: {} };
  if (current.handoff) {
    const gates = io.gates();
    const docs = generatedDocs(config, current, snapshot, gates);
    Object.assign(generated, docs.out, { files: Object.fromEntries(Object.entries(docs.files).filter(([path, text]) => text !== snapshot.readText(path))) });
    if (options.write) {
      // Twice: the second pass counts the files the first one changed in the Completion record.
      for (let pass = 0; pass < 2; pass++) {
        const fresh = pass ? generatedDocs(config, current, snapshot, gates) : docs;
        generated.completionRecord = fresh.out.completionRecord;
        const files = fresh.files;
        for (const [path, text] of Object.entries(files)) if (text !== snapshot.readText(path)) { io.write(path, text); generated.written.push(path); }
        snapshot = io.refresh(); current = context(config, snapshot, selection);
      }
      rules = evaluateAll(current);
      const statusRule = config.rules['DOD-09'];
      if (statusRule.enabled && blocking(rules).every(rule => rule.id === 'DOD-09') && current.handoff.model.frontmatter.data.status !== statusRule.params.status) {
        io.write(current.handoff.path, setFrontmatterValue(current.handoff.text, 'status', statusRule.params.status)); generated.written.push(current.handoff.path); generated.status = statusRule.params.status;
        snapshot = io.refresh(); current = context(config, snapshot, selection); rules = evaluateAll(current);
      }
      generated.written = [...new Set(generated.written)];
    }
  }
  return { gate: 'done', status: blocking(rules).length ? 'not-done' : 'done', handoff: current.handoff?.path ?? null, base: snapshot.base, rules, generated };
}
