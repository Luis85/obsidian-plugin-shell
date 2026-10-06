import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validatePlan } from './test-plan.mjs';
import { object } from './evidence-adapters.mjs';

export async function acceptanceReport(root, session) {
  const baseline = validatePlan(JSON.parse(await readFile(join(root, 'docs/testing/test-plan.json'), 'utf8')));
  const crosswalk = JSON.parse(await readFile(join(root, 'docs/testing/acceptance-crosswalk.json'), 'utf8'));
  object(crosswalk, ['schemaVersion', 'baselineSchemaVersion', 'acceptance']);
  if (crosswalk.schemaVersion !== 1 || crosswalk.baselineSchemaVersion !== 1 || !Array.isArray(crosswalk.acceptance) || crosswalk.acceptance.length !== 96) throw new Error('EVIDENCE_CROSSWALK_SCHEMA');
  const seen = new Set();
  const rows = crosswalk.acceptance.map(row => {
    object(row, ['id', 'requiredModes', 'links', 'gap']);
    const original = baseline.acceptance.find(item => item.id === row.id);
    if (!original || seen.has(row.id) || !row.gap || JSON.stringify(row.requiredModes) !== JSON.stringify(original.requiredModes) || !Array.isArray(row.links)) throw new Error('EVIDENCE_CROSSWALK_MODES');
    seen.add(row.id);
    const linked = new Set();
    const links = row.links.map(link => {
      object(link, ['producer', 'file', 'name', 'mode', 'extent', 'assertions']);
      if (!['partial', 'whole'].includes(link.extent) || !row.requiredModes.includes(link.mode) || !link.assertions || !link.name || !link.file) throw new Error('EVIDENCE_CROSSWALK_LINK');
      const key = JSON.stringify([link.producer, link.file, link.name, link.mode]);
      if (linked.has(key)) throw new Error('EVIDENCE_CROSSWALK_DUPLICATE');
      linked.add(key);
      const matches = session.packets.filter(packet => packet.producer === link.producer).flatMap(packet => packet.result.cases.filter(test => test.file === link.file && test.name === link.name && test.mode === link.mode && test.status === 'passed'));
      return { ...link, observed: session.status === 'passed' && matches.length > 0 };
    });
    const wholeModes = new Set(links.filter(link => link.observed && link.extent === 'whole').map(link => link.mode));
    const missingModes = row.requiredModes.filter(mode => !wholeModes.has(mode));
    return { id: row.id, summary: original.summary, requiredModes: row.requiredModes,
      state: links.length && links.every(link => link.observed && link.extent === 'whole') && !missingModes.length ? 'verified' : links.some(link => link.observed) ? 'partial' : 'not-run',
      links, missingModes, gap: row.gap, retainedBaselineLinks: original.evidence };
  });
  return { schemaVersion: 1, status: session.status, execution: { totalRuns: session.totalRuns, passingRuns: session.packets.length, errors: session.errors },
    acceptance: rows, sourceCoverage: session.packets.filter(packet => packet.producer === 'coverage').map(packet => packet.result.coverage),
    performanceQualification: 'separate controlled-reference protocol; no inference from test pass counts',
    release: { status: 'blocked', reason: 'Legacy release guard and unexecuted normative modes remain; evidence grants no release authority.' } };
}
