/**
 * Runs one gate over an injected repository snapshot: handoff selection, the document scope (kick-off, change
 * or increment pull request), rule evaluation and the generated files (sections and acceptance stubs for the
 * Definition of Ready; Completion records, changelog entries and index rows for the Definition of Done).
 * Writing happens only through `io.write` / `io.create`.
 */
import { posix } from 'node:path';
import { categories } from '../release/changelog.mjs';
import { completionRecord, changelogWithEntries, indexWithRows, pullRequestRecord, scaffoldSections, setFrontmatterValue, upsertSection } from './generate.mjs';
import { changelogEntries, docsImpact, parseHandoff } from './handoff.mjs';
import { documentState } from './documents.mjs';
import { planStubs } from './acceptance-stubs.mjs';
import { readyRules } from './rules-ready.mjs';
import { doneRules, missingChangelogEntries } from './rules-done.mjs';
import { refinementBrief } from './report.mjs';
import { selectHandoff } from './select.mjs';

export { exemption, selectHandoff } from './select.mjs';

/** Rule results with severity applied: a failing warning rule reports "warn"; a disabled rule "disabled". */
export function evaluate(definitions, configured, context) {
  const kinds = context.kinds ?? [context.kind ?? 'Increment'];
  return Object.entries(definitions).map(([id, definition]) => {
    const rule = configured[id];
    const base = { id, title: definition.title, severity: rule.severity };
    if (!rule.enabled) return { ...base, status: 'disabled', message: 'Disabled in the configuration.' };
    if (!definition.appliesTo.some(kind => kinds.includes(kind))) return { ...base, status: 'skip', message: `Applies to ${definition.appliesTo.join(' and ')} documents; this run checks ${kinds.join(', ')}.` };
    let outcome;
    try { outcome = definition.run(context, rule.params); } catch (error) { outcome = { status: 'fail', message: `Rule error: ${error.message}`, hint: 'Report this as a delivery-check bug.' }; }
    const status = outcome.status === 'fail' && rule.severity === 'warning' ? 'warn' : outcome.status;
    return { ...base, ...outcome, status };
  });
}
const blocking = results => results.filter(rule => rule.status === 'fail' && rule.severity === 'error');

function context(config, snapshot, selection) {
  const handoffText = selection.path ? snapshot.readText(selection.path) : null;
  const handoff = handoffText === null ? null : { path: selection.path, source: selection.source, text: handoffText, model: parseHandoff(handoffText) };
  return { delivery: config.delivery, files: snapshot.files, suites: snapshot.suites, scripts: snapshot.scripts, categories,
    diff: snapshot.diff, labels: snapshot.labels, readText: snapshot.readText, handoffProblem: selection.problem ?? null, handoff,
    ...documentState(config.delivery, snapshot, handoff) };
}
/** The snapshot with generated files laid over it (paths added to the file list, texts replaced). */
const overlay = (snapshot, files) => ({ ...snapshot, files: [...new Set([...snapshot.files, ...Object.keys(files)])].sort(), readText: path => files[path] ?? snapshot.readText(path) });
const scopeOf = current => ({ kind: current.scope.kind, pullRequest: current.scope.pullRequest?.path ?? null, base: current.refs.base || null, head: current.refs.head || null });

/** Missing acceptance stubs and the evidence they become, as files; null without a stub template. */
function stubFiles(config, current, io) {
  const template = io.stubTemplate?.();
  if (!current.handoff || template === undefined || template === null) return null;
  const id = current.handoff.path.split('/').at(-1).replace(/\.md$/, '');
  const plan = planStubs(config.delivery.acceptance, { incrementId: id, incrementPath: current.handoff.path, incrementText: current.handoff.text, model: current.handoff.model, files: current.files, template });
  const files = Object.fromEntries(plan.create.map(item => [item.path, item.text]));
  if (plan.incrementText !== current.handoff.text) files[current.handoff.path] = plan.incrementText;
  return { plan, files };
}

/** Definition of Ready. With --write: missing sections from `io.template()`, then acceptance stubs from `io.stubTemplate()`. */
export function runReady(config, snapshot, options, io) {
  const selection = selectHandoff(config.delivery, snapshot, options.handoff);
  let current = context(config, snapshot, selection);
  const generated = { scaffolded: [], written: [], stubs: [], orphans: [], evidence: [], files: {} };
  let rules = evaluate(readyRules, config.rules, current);
  if (current.handoff && blocking(rules).some(rule => rule.id === 'DOR-03')) {
    const scaffold = scaffoldSections(current.handoff.text, io.template(), config.delivery.handoff.sections, config.delivery.handoff.generatedSection);
    generated.scaffolded = scaffold.added; generated.handoffText = scaffold.text;
    if (scaffold.added.length) generated.files[current.handoff.path] = scaffold.text;
    if (options.write && scaffold.added.length) {
      io.write(current.handoff.path, scaffold.text); generated.written.push(current.handoff.path);
      snapshot = overlay(snapshot, { [current.handoff.path]: scaffold.text }); current = context(config, snapshot, selection);
    }
  }
  const stubs = stubFiles(config, current, io);
  if (stubs) {
    Object.assign(generated, { stubs: stubs.plan.create.map(item => item.path), orphans: stubs.plan.orphans, evidence: stubs.plan.evidence });
    Object.assign(generated.files, stubs.files);
    if (options.write && Object.keys(stubs.files).length) {
      for (const [path, text] of Object.entries(stubs.files)) { (path === current.handoff.path ? io.write : io.create ?? io.write)(path, text); generated.written.push(path); }
      snapshot = overlay(snapshot, stubs.files); current = context(config, snapshot, selection);
    }
  }
  if (generated.written.length) { rules = evaluate(readyRules, config.rules, current); generated.written = [...new Set(generated.written)]; }
  const status = blocking(rules).length ? 'not-ready' : 'ready';
  const result = { gate: 'ready', status, handoff: current.handoff?.path ?? null, base: snapshot.base, scope: scopeOf(current), rules, generated };
  if (status === 'not-ready') result.refinement = refinementBrief(result, readyRules, config.delivery);
  return result;
}

function docsIndexRows(config, current, snapshot, files, out) {
  const { index, headings } = config.rules['DOD-06'].params;
  const indexText = snapshot.readText(index) ?? '';
  const added = new Set(snapshot.diff.filter(file => file.status === 'A').map(file => file.path));
  const rows = docsImpact(current.handoff.model.section('Docs impact')).items
    .filter(item => added.has(item.target) && item.target.startsWith('docs/') && item.target !== index && !indexText.includes(`](${posix.relative(posix.dirname(index), item.target)})`))
    .map(item => ({ ...item, title: /^# (.+)$/m.exec(snapshot.readText(item.target) ?? '')?.[1] ?? item.target }));
  if (rows.length) { const updated = indexWithRows(indexText, rows, headings, index); files[index] = updated.text; out.docsIndex = rows.map(row => row.target).filter(target => !updated.skipped.includes(target)); }
}

function generatedDocs(config, current, snapshot, gates) {
  const done = config.rules; const files = {}; const out = { changelog: [], docsIndex: [] };
  docsIndexRows(config, current, snapshot, files, out);
  const common = { diff: snapshot.diff, base: snapshot.base, labels: snapshot.labels, gates, label: done['DOD-10'].params.label, covered: done['DOD-08'].params.alwaysCovered };
  if (current.scope.kind === 'change') {
    const document = current.scope.pullRequest;
    if (!document) return { files, out };
    out.completionRecord = pullRequestRecord({ ...common, document, model: current.handoff.model, head: current.refs.head, heading: config.delivery.pullRequests.generatedSection });
    files[document.path] = upsertSection(document.text, config.delivery.pullRequests.generatedSection, out.completionRecord);
    return { files, out };
  }
  const changelog = done['DOD-04'].params.file;
  const entries = changelogEntries(current.handoff.model.section('Changelog'), categories);
  const missing = entries.none ? [] : missingChangelogEntries(snapshot.readText(changelog), entries.entries);
  if (missing.length) { files[changelog] = changelogWithEntries(snapshot.readText(changelog) ?? '', missing); out.changelog = missing; }
  out.completionRecord = completionRecord({ ...common, model: current.handoff.model, path: current.handoff.path, heading: config.delivery.handoff.generatedSection });
  files[current.handoff.path] = upsertSection(current.handoff.text, config.delivery.handoff.generatedSection, out.completionRecord);
  return { files, out };
}

/** Sets the Increment status once every other error rule passes; never on a change pull request. */
function completeStatus(config, current, rules, io, generated) {
  const statusRule = config.rules['DOD-09'];
  if (current.scope.kind === 'change' || !statusRule.enabled || !blocking(rules).every(rule => rule.id === 'DOD-09')) return false;
  if (current.handoff.model.frontmatter.data.status === statusRule.params.status) return false;
  io.write(current.handoff.path, setFrontmatterValue(current.handoff.text, 'status', statusRule.params.status)); generated.written.push(current.handoff.path); generated.status = statusRule.params.status;
  return true;
}

/** Definition of Done. `io.refresh()` re-reads the snapshot after a write; `io.gates()` gives check --plan gates or null. */
export function runDone(config, snapshot, options, io) {
  const selection = selectHandoff(config.delivery, snapshot, options.handoff);
  const evaluateAll = (current) => {
    const readyFailures = blocking(evaluate(readyRules, config.ready, current)).map(rule => rule.id);
    return evaluate(doneRules, config.rules, { ...current, kinds: current.scope.kind === 'change' ? ['PullRequest'] : ['Increment'], readyFailures });
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
        for (const [path, text] of Object.entries(fresh.files)) if (text !== snapshot.readText(path)) { io.write(path, text); generated.written.push(path); }
        snapshot = io.refresh(); current = context(config, snapshot, selection);
      }
      rules = evaluateAll(current);
      if (completeStatus(config, current, rules, io, generated)) { snapshot = io.refresh(); current = context(config, snapshot, selection); rules = evaluateAll(current); }
      generated.written = [...new Set(generated.written)];
    }
  }
  return { gate: 'done', status: blocking(rules).length ? 'not-done' : 'done', handoff: current.handoff?.path ?? null, base: snapshot.base, scope: scopeOf(current), rules, generated };
}
