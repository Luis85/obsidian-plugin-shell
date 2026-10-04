import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readCollectionDefinition } from '../../bin/domain/collection-definition.ts';
import { collectionCreate, collectionManagedUpdate, collectionUpdate, readCollectionRecord } from '../../bin/domain/collection-record.ts';
import { collectionReferenceOk, collectionReleaseVersion, readCollectionAccepts } from '../../bin/domain/collection-reference.ts';
import { mergeCollectionBlock, mergeCollectionRegister } from '../../bin/domain/collection-register.ts';
import { candidateCreate, candidateEditable, candidateFrontmatter, candidateTransition, readCandidateInput, readCandidateRecord, readCandidateVersion } from '../../bin/domain/release-candidate.ts';
import { candidateBlockNames, candidateDocs, candidateReadmeBody } from '../../bin/domain/release-candidate-docs.ts';
import { candidateFindings } from '../../bin/domain/release-candidate-check.ts';
import { hash } from '../../bin/adapters/framework/files.ts';
const repository = resolve(import.meta.dirname, '../..');
const shipped = JSON.parse(await readFile(join(repository, 'configs/collections/increment.json'), 'utf8'));
const increments = readCollectionDefinition(structuredClone(shipped));
const edit = change => { const value = structuredClone(shipped); change(value); return value; };
const draft = (extra = {}) => ({ ...candidateCreate({ version: '1.0.0', increments: ['INC-0001'], targetDate: '2026-11-01' }, '2026-10-04'), ...extra });

test('release versions are strict x.y.z or x.y.z-rc.N without leading zeros', () => {
  for (const version of ['0.0.1', '1.0.0', '10.20.30', '1.0.0-rc.0', '1.0.0-rc.12']) assert.equal(readCandidateVersion(version), version);
  for (const version of ['1.0', '1.0.0.0', 'v1.0.0', '01.0.0', '1.00.0', '1.0.0-beta.1', '1.0.0-rc', '1.0.0-rc.01', '1.0.0 ', '../1.0.0', 1])
    assert.throws(() => readCandidateVersion(version), /CANDIDATE_VERSION|x\.y\.z/, String(version));
  assert.ok(collectionReleaseVersion.test('2.3.4-rc.5') && !collectionReleaseVersion.test('2.3.4-rc.5/x'));
});

test('status transitions are checked, freezing needs increments, and dates follow the status', () => {
  const frozen = candidateTransition(draft(), 'frozen', '2026-10-05');
  assert.deepEqual([frozen.status, frozen.frozen, frozen.updated], ['frozen', '2026-10-05', '2026-10-05']);
  assert.throws(() => candidateEditable(frozen), /1\.0\.0 is frozen; only a draft candidate changes its increments/);
  assert.equal(candidateTransition(frozen, 'draft', '2026-10-06').frozen, undefined, 'returning to draft clears the freeze date');
  const qualified = candidateTransition(frozen, 'qualified', '2026-10-07');
  assert.equal(candidateTransition(qualified, 'frozen', '2026-10-08').frozen, '2026-10-05', 're-freezing a qualified candidate keeps its freeze date');
  const released = candidateTransition(qualified, 'released', '2026-10-09');
  assert.deepEqual([released.status, released.released, released.frozen], ['released', '2026-10-09', '2026-10-05']);
  assert.throws(() => candidateTransition(released, 'draft', '2026-10-10'), /released → draft is not allowed; from released use no other status/);
  assert.throws(() => candidateTransition(draft(), 'released', '2026-10-10'), /draft → released is not allowed; from draft use frozen, abandoned/);
  assert.throws(() => candidateTransition(draft({ increments: [] }), 'frozen', '2026-10-10'), /Add at least one increment before freezing/);
  assert.throws(() => candidateTransition(draft(), 'shipped', '2026-10-10'), /--to must be one of draft, frozen, qualified, released, abandoned/);
  assert.equal(candidateTransition(draft(), 'abandoned', '2026-10-10').status, 'abandoned');
});

test('candidate frontmatter round-trips and stored problems are issues, never exceptions', () => {
  const record = draft({ owner: 'Alex' }), front = candidateFrontmatter(record);
  assert.deepEqual(Object.keys(front), ['type', 'version', 'status', 'created', 'updated', 'target-date', 'owner', 'increments', 'schema_version']);
  assert.deepEqual(readCandidateRecord(front, 'INC-'), { kind: 'candidate', record, issues: [] });
  assert.deepEqual(readCandidateRecord({ type: 'Increment' }, 'INC-'), { kind: 'ignored' });
  assert.equal(readCandidateRecord({ ...front, schema_version: 2 }, 'INC-').kind, 'future');
  const bad = readCandidateRecord({ ...front, version: '1.0', status: 'shipping', increments: ['INC-1', 'INC-0001'], 'target-date': 'soon', owner: 'A\u0007' }, 'INC-');
  assert.equal(bad.record, undefined);
  assert.deepEqual(bad.issues.map(item => item.message), ['A candidate version is x.y.z or x.y.z-rc.N, such as 1.0.0 or 1.0.0-rc.1, without leading zeros.',
    'status must be one of draft, frozen, qualified, released, abandoned.', 'target-date must be a date written as YYYY-MM-DD.', 'owner needs single-line text of 1–120 characters.',
    'increments must name ids like INC-0001.']);
  assert.match(readCandidateRecord({ ...front, increments: ['INC-0001', 'INC-0001'] }, 'INC-').issues[0].message, /must not repeat/);
  assert.deepEqual(readCandidateInput({ version: '1.2.0-rc.1', increments: ['INC-0002'], owner: ' Sam ', targetDate: '', goal: 'Faster.' }, 'INC-'),
    { version: '1.2.0-rc.1', owner: 'Sam', increments: ['INC-0002'], goal: 'Faster.' });
  assert.throws(() => readCandidateInput({ version: '1.0.0', status: 'released' }, 'INC-'), /Unknown input status/);
});

test('the increment collection uses the generic accepts option, a managed candidate field and managed statuses', () => {
  assert.deepEqual([increments.type, increments.pathKey, increments.idPrefix, increments.initialStatus], ['Increment', 'increments', 'INC-', 'proposed']);
  assert.deepEqual(increments.statuses.filter(item => item.managed).map(item => item.id), ['included', 'shipped']);
  assert.deepEqual(increments.fields.find(item => item.key === 'sources').accepts, ['path', 'RISK-', 'LRN-', 'INC-']);
  assert.deepEqual(increments.fields.find(item => item.key === 'candidate').source, 'managed');
  const accepts = ['path', 'RISK-', 'LRN-'];
  for (const value of ['prototypes/checkout', 'docs/design/checkout', 'brainstorms/search/feature.definition.json', 'docs/prds/payments.md', 'RISK-0001', 'LRN-000123'])
    assert.ok(collectionReferenceOk(accepts, value), value);
  for (const value of ['../secrets', '/etc/passwd', '.git/config', 'node_modules/x', 'C:/x', 'RSK-0001', 'RISK-1', 'docs\\x', 'docs//x'])
    assert.ok(!collectionReferenceOk(accepts, value), value);
  assert.ok(collectionReferenceOk(['release-version'], '1.0.0') && !collectionReferenceOk(['release-version'], 'docs/x'));
  for (const [change, pattern] of [
    [value => { value.fields[4].accepts = ['url']; }, /entries are path, release-version or id prefixes/],
    [value => { value.fields[4].accepts = []; }, /needs 1–12 reference kinds/],
    [value => { value.fields[4].accepts = ['path', 'path']; }, /must be unique/],
    [value => { value.fields[2].accepts = ['path']; }, /accepts applies to frontmatter text and list fields/],
    [value => { value.fields[6].accepts = ['path']; }, /without a vocabulary or idPrefix/],
    [value => { value.fields[10].required = true; }, /a managed value is optional frontmatter/],
    [value => { value.statuses[0].transitions.push('included'); }, /transitions must name other statuses that are not managed/],
    [value => { value.initialStatus = 'included'; }, /initialStatus must name a status that is not managed/],
    [value => { value.statuses[1].managed = 'yes'; }, /managed must be true or false/],
  ]) assert.throws(() => readCollectionDefinition(edit(change)), pattern);
});

test('people never enter managed statuses or values; collectionManagedUpdate does, with stamps and completeness', () => {
  const input = { title: 'Checkout', summary: 'Two steps.', kind: 'feature', status: 'ready', acceptance: ['Pays in two steps'], sources: ['prototypes/checkout'] };
  const created = collectionCreate(increments, undefined, input, 'INC-0001', '2026-10-04').frontmatter;
  assert.throws(() => collectionCreate(increments, undefined, { ...input, status: 'included' }, 'INC-0002', '2026-10-04'), /included is set by another tool's reviewed plan/);
  assert.throws(() => collectionCreate(increments, undefined, { ...input, candidate: '1.0.0' }, 'INC-0002', '2026-10-04'), /Unknown input candidate/);
  assert.throws(() => collectionCreate(increments, undefined, { ...input, sources: ['../outside'] }, 'INC-0002', '2026-10-04'), /sources must name a project-relative path or ids like RISK-0001, LRN-0001, INC-0001/);
  assert.throws(() => collectionCreate(increments, undefined, { ...input, acceptance: [] }, 'INC-0002', '2026-10-04'), /Missing acceptance \(required while ready\)/);
  const record = readCollectionRecord(increments, undefined, created).record;
  const included = collectionManagedUpdate(increments, undefined, record, { status: 'included', set: { candidate: '1.0.0' } }, '2026-10-05');
  assert.deepEqual([included.status, included.values.candidate, included.values.updated, included.removed], ['included', '1.0.0', '2026-10-05', []]);
  const stored = readCollectionRecord(increments, undefined, { ...created, ...included.values }).record;
  assert.throws(() => collectionUpdate(increments, undefined, stored, { status: 'ready' }, '2026-10-06'), /included → ready is not allowed; from included use no other status/);
  assert.equal(collectionUpdate(increments, undefined, stored, { owner: 'Alex' }, '2026-10-06').values.candidate, '1.0.0', 'people edits keep the managed value');
  const shipped = collectionManagedUpdate(increments, undefined, stored, { status: 'shipped' }, '2026-10-07');
  assert.deepEqual([shipped.values.shipped, shipped.values.candidate], ['2026-10-07', '1.0.0']);
  const back = collectionManagedUpdate(increments, undefined, stored, { status: 'ready', set: { candidate: null } }, '2026-10-07');
  assert.deepEqual([back.status, back.removed], ['ready', ['candidate']]);
  assert.throws(() => collectionManagedUpdate(increments, undefined, stored, { set: { owner: 'x' } }, '2026-10-07'), /owner is not a managed field of increment/);
  assert.throws(() => collectionManagedUpdate(increments, undefined, stored, { set: { candidate: '1.0' } }, '2026-10-07'), /candidate must name a version like 1\.2\.3 or 1\.2\.3-rc\.1/);
  assert.throws(() => readCollectionAccepts('path', 'x'), /needs 1–12 reference kinds/);
});

test('generated blocks: registers and candidate documents share one marker merge that refuses hand edits', () => {
  const body = candidateReadmeBody('1.0.0', 'Faster checkout.', Object.fromEntries(candidateBlockNames.map(name => [name, `${name} v1\n`])), hash);
  assert.ok(body.startsWith('# Release candidate 1.0.0\n\n## Goal\n\nFaster checkout.\n\n## Increments\n\n<!-- candidate-increments:start sha256='));
  const authored = body.replace('## Notes\n', '## Notes\n\nKeep this.\n');
  const merged = mergeCollectionBlock('candidate-risks', authored, 'risks v2\n', hash);
  assert.ok(merged.includes('risks v2\n<!-- candidate-risks:end -->') && merged.includes('\nKeep this.\n') && merged.includes('candidate-increments v1'));
  assert.throws(() => mergeCollectionBlock('candidate-risks', merged.replace('risks v2', 'risks v2 (edited)'), 'x\n', hash), /The generated candidate-risks block was edited by hand/);
  assert.throws(() => mergeCollectionBlock('candidate-risks', merged + merged, 'x\n', hash), /Expected exactly one/);
  assert.equal(mergeCollectionBlock('candidate-risks', 'Text\n', 'x\n', hash).startsWith('Text\n\n<!-- candidate-risks:start'), true);
  const definition = readCollectionDefinition(structuredClone(shipped));
  assert.match(mergeCollectionRegister(definition, null, 'rows\n', hash), /^# Increments\n\n<!-- increment-register:start sha256=[0-9a-f]{64} -->\nrows\n<!-- increment-register:end -->\n$/);
});

test('candidate documents: increment table, risk summary, computed checklist and a changelog draft grouped by kind', () => {
  const view = (id, kind, kindLabel, extra = {}) => ({ id, title: `Title ${id}`, status: 'Included', kind, kindLabel, summary: `Summary | ${id}`, sources: ['prototypes/x'], acceptance: ['Works'], risks: [], href: `../../increments/${id}.md`, ...extra });
  const docs = candidateDocs({ record: draft({ increments: ['INC-0001', 'INC-0002', 'INC-0003', 'INC-0009'] }), asOf: '2026-10-04', riskFolder: 'docs/risks', errors: 1, missing: ['INC-0009'],
    increments: [view('INC-0001', 'feature', 'Feature'), view('INC-0002', 'fix', 'Fix', { acceptance: [] }), view('INC-0003', 'docs', 'Documentation')],
    risks: [{ id: 'RISK-0001', found: true, title: 'Outage', status: 'Assessed', level: 'high', levelLabel: 'High', open: true, href: '../../../risks/RISK-0001.md', from: ['INC-0001'] },
      { id: 'RISK-0002', found: false, title: '', status: '', level: '', levelLabel: '', open: false, href: '', from: ['INC-0003'] }] });
  assert.deepEqual(Object.keys(docs), candidateBlockNames);
  assert.match(docs['candidate-increments'], /\| \[INC-0001\]\(<\.\.\/\.\.\/increments\/INC-0001\.md>\) \| Title INC-0001 \| Feature \| Included \| Summary \\\| INC-0001 \| prototypes\/x \| Works \|/);
  assert.match(docs['candidate-increments'], /### Not found\n\n- INC-0009/);
  assert.match(docs['candidate-risks'], /\| \[RISK-0001\]\(<\.\.\/\.\.\/\.\.\/risks\/RISK-0001\.md>\) \| Outage \| Assessed \| High \| INC-0001 \|/);
  assert.match(docs['candidate-risks'], /\| RISK-0002 \| _not found in docs\/risks_ \|/);
  assert.match(docs['candidate-risks'], /\*\*Open high or critical risks:\*\* RISK-0001/);
  const checklist = docs['candidate-checklist'];
  assert.ok(checklist.includes('- [x] At least one increment is included') && checklist.includes('- [ ] Every included increment note exists and is valid'));
  assert.ok(checklist.includes('- [ ] Every increment has acceptance criteria') && checklist.includes('- [ ] No linked risk is missing') && checklist.includes('- [ ] `node bin/app candidate check --json` reports no errors'));
  assert.ok(checklist.includes('release-approval') && checklist.includes('npm run release:cut'));
  assert.match(docs['candidate-changelog'], /````markdown\n## \[1\.0\.0\] - 2026-11-01\n\n### Added\n\n- Title INC-0001: Summary \| INC-0001 \(INC-0001, Feature\)\n\n### Changed\n\n- Title INC-0003: .*\(INC-0003, Documentation\)\n\n### Fixed\n\n- Title INC-0002/);
  assert.match(candidateDocs({ record: draft({ increments: [] }), asOf: '2026-10-04', riskFolder: 'docs/risks', errors: 0, missing: [], increments: [], risks: [] })['candidate-changelog'], /_No increments yet\._/);
});

test('candidate findings: missing and unlinked increments, orphans, shared increments, folders, edited blocks and readiness warnings', () => {
  const ok = Object.fromEntries(candidateBlockNames.map(name => [name, 'ok']));
  const entry = (record, extra = {}) => ({ path: `docs/releases/candidates/${record.version}/README.md`, folder: record.version, record, issues: [], blocks: ok, ...extra });
  const increment = (id, extra = {}) => ({ id, path: `docs/releases/increments/${id}.md`, valid: true, status: 'included', candidate: '1.0.0', acceptance: 1, sources: 1, updated: '2026-10-04', risks: [], ...extra });
  const findings = candidateFindings({ asOf: '2026-12-01', riskFolder: 'docs/risks', risks: new Map([['RISK-0001', { id: 'RISK-0001', found: true, open: true, level: 'critical' }]]),
    candidates: [
      entry(draft({ status: 'frozen', frozen: '2026-10-04', increments: ['INC-0001', 'INC-0002', 'INC-0003', 'INC-0004'] }), { blocks: { ...ok, 'candidate-risks': 'edited', 'candidate-changelog': 'missing' } }),
      entry(draft({ version: '1.1.0', increments: ['INC-0004'] }), { folder: '1.1' }),
      entry(draft({ version: '0.9.0', status: 'abandoned', increments: ['INC-0001'] })),
    ],
    increments: [increment('INC-0001', { acceptance: 0, sources: 0, updated: '2026-10-09', risks: ['RISK-0001', 'RISK-0404'] }), increment('INC-0002', { status: 'ready' }),
      increment('INC-0004', { candidate: undefined, status: 'included' }), increment('INC-0005', { candidate: '2.0.0', status: 'included' })] });
  const summary = findings.map(item => `${item.severity}:${item.code}:${item.id}`);
  assert.deepEqual(summary.sort(), [
    'error:CANDIDATE_DOCS_EDITED:1.0.0', 'error:CANDIDATE_FOLDER:1.1.0', 'error:CANDIDATE_INCREMENT_MISSING:1.0.0', 'error:CANDIDATE_INCREMENT_ORPHAN:INC-0004', 'error:CANDIDATE_INCREMENT_ORPHAN:INC-0005',
    'error:CANDIDATE_INCREMENT_SHARED:INC-0004', 'error:CANDIDATE_INCREMENT_UNLINKED:1.0.0', 'error:CANDIDATE_INCREMENT_UNLINKED:1.0.0', 'error:CANDIDATE_INCREMENT_UNLINKED:1.1.0',
    'warning:CANDIDATE_CHANGED_AFTER_FREEZE:1.0.0', 'warning:CANDIDATE_DOCS_MISSING:1.0.0', 'warning:CANDIDATE_NO_ACCEPTANCE:1.0.0', 'warning:CANDIDATE_NO_SOURCES:1.0.0',
    'warning:CANDIDATE_OVERDUE:1.0.0', 'warning:CANDIDATE_OVERDUE:1.1.0', 'warning:CANDIDATE_RISK_MISSING:1.0.0', 'warning:CANDIDATE_RISK_OPEN:1.0.0']);
  assert.ok(findings.some(item => item.message === 'INC-0002 is ready in 1.0.0; frozen candidate 1.0.0 expects included in 1.0.0.'));
  assert.ok(findings.some(item => item.message === 'INC-0001 links RISK-0001, which is open at critical level.'));
});
