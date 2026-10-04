import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { formatScalar, formatValue, lineEnding, parseFrontmatter, setFrontmatterValue, textLines } from '../../bin/domain/increments/frontmatter.ts';
import { extractWikilinks, formatWikilink, linkProblems, parseWikilink, resolveWikilink } from '../../bin/domain/increments/wikilinks.ts';
import { appendListItem, findMarkedRegion, findSection, insertSection, outline, prose, replaceMarkedRegion, words } from '../../bin/domain/increments/sections.ts';
import { acceptanceStubPath, defaultDeliverySchema, deliveryPathsDrift, deliverySchemaFrom, incrementExtensionKeys, retargetDeliveryConfig } from '../../bin/domain/increments/model.ts';
import { incrementTemplate } from '../../bin/domain/increments/increment-template.ts';
import { editIncrement, malformedCriteria, parseIncrement, readinessProblems, renderIncrement, validateIncrement } from '../../bin/domain/increments/increment-document.ts';
import { incrementLinkDrift, issueTableIds, pullRequestRow, pullRequestTableIds, setIssueTable, setPullRequestTable } from '../../bin/domain/increments/generated-lists.ts';
import { parseInputFragment } from '../../bin/domain/increments/input-fragment.ts';

const root = resolve(import.meta.dirname, '../..');
const deliveryFile = resolve(root, 'configs/delivery/delivery.json'), handoffScript = resolve(root, 'scripts/delivery/handoff.mjs');
const noDelivery = existsSync(deliveryFile) ? false : 'configs/delivery is not on this branch yet; the DoR contract is compared once it lands';
const noScripts = existsSync(handoffScript) ? false : 'scripts/delivery is not on this branch yet; the DoR parser is compared once it lands';
const path = 'docs/increments/delivery-pipeline.md';
const fresh = (extra = {}) => renderIncrement({ id: 'delivery-pipeline', title: 'Delivery pipeline', owner: 'Luis', ...extra });
const code = expected => error => { assert.equal(error.code, expected, error.message); assert.ok(error.message.startsWith(`${expected}: `)); return true; };
function apply(text, ...edits) { return edits.reduce((current, edit) => editIncrement(current, edit).text, text); }
function ready() {
  const fragment = parseInputFragment(['## Summary', '', 'Adds the increment commands to the CLI.', '## Outcome', '', 'Maintainers plan increments from the terminal.',
    '## Affected areas', '', '- `bin/domain/increments/**`: the document model', '## Test plan', '', '- Suite `maker`: proves the documents', '- E2E: no rendered UI changes',
    '## Docs impact', '', 'None — internal model only', '## Changelog', '', '- Added: Increment documents can be edited from the CLI.',
    '## Risks and rollback', '', 'Revert the commit; documents stay readable.', '## Dependencies', '', 'None — standalone', '## Open questions', '', 'None'].join('\n'), defaultDeliverySchema.handoff.sections);
  return apply(fresh(), { kind: 'fragment', fragment }, { kind: 'scope', side: 'in', text: 'Document model' }, { kind: 'scope', side: 'out', text: 'Remote sync' },
    { kind: 'ac-add', text: 'A new increment renders the handoff template.' });
}

test('the frontmatter subset reads like the Definition of Ready: quoting, lists, duplicates and unterminated strings', () => {
  const text = '\uFEFF---\r\ntype: Increment\r\ntitle: "Say \\"hi\\" \\\\ \\n"\r\nowner: \'Lu, is\'\r\nrefs: ["[[a|b]]", docs/x.md,\'c, d\', ""]\r\nspaced: [a, \'c, d\']\r\nempty:\r\n\r\nbad line\r\ntitle: again\r\nquote: "open\r\nlist: [ "x ]\r\n---\r\nbody';
  const parsed = parseFrontmatter(text);
  assert.equal(parsed.present, true); assert.equal(parsed.end, 13); assert.equal(text.slice(parsed.bodyStart), 'body');
  assert.deepEqual(parsed.data, { type: 'Increment', title: 'Say "hi" \\ \\n', owner: 'Lu, is', refs: ['[[a|b]]', 'docs/x.md', 'c, d'], empty: '' });
  assert.deepEqual(parsed.errors.map(error => [error.line, error.message]), [[6, 'spaced: unterminated quoted string'], [9, '"bad line" is not "key: value"'],
    [10, 'duplicate key title'], [11, 'quote: unterminated quoted string'], [12, 'list: unterminated quoted string']]);
  assert.deepEqual(parseFrontmatter('---\na: 1\n').errors, [{ line: 1, message: 'frontmatter has no closing ---' }]);
  assert.equal(parseFrontmatter('# no frontmatter').present, false);
  assert.deepEqual(textLines('a\rb\r\nc').map(line => line.text), ['a', 'b', 'c']);
  assert.equal(lineEnding('a\r\nb\n'), '\r\n'); assert.equal(lineEnding('plain'), '\n');
});

test('values are written so the subset and YAML read them back unchanged', () => {
  for (const value of ['In progress', 'docs/x.md', '2026-10-04T12:00:00Z', 'feature/a+b']) assert.equal(formatScalar(value), value);
  for (const value of ['a: b', 'x:', '[list]', '"quoted"', ' padded', 'true', 'C:\\path', 'a, b', '#tag']) {
    const line = `key: ${formatScalar(value)}`;
    assert.notEqual(formatScalar(value), value); assert.deepEqual(parseFrontmatter(`---\n${line}\n---\n`).data, { key: value }, line);
  }
  assert.equal(formatScalar('plain', true), '"plain"');
  const items = ['[[docs/prds/x|X]]', 'a, b', 'plain', 'q"uote'];
  assert.equal(formatValue(items), '["[[docs/prds/x|X]]","a, b", plain, "q\\"uote"]');
  assert.deepEqual(parseFrontmatter(`---\nrefs: ${formatValue(items)}\n---\n`).data.refs, items);
  assert.throws(() => formatValue('two\nlines'), code('INCREMENT_INPUT_INVALID'));
  assert.throws(() => formatValue(['ok', '']), code('INCREMENT_INPUT_INVALID'));
});

test('frontmatter edits replace, insert and remove one line and keep every other byte', () => {
  const text = '---\r\ntype: Increment\r\ncustom: keep me\r\nstatus: New\r\n---\r\n# T\r\n';
  const set = setFrontmatterValue(text, 'status', 'In progress');
  assert.equal(set, text.replace('status: New', 'status: In progress'));
  const inserted = setFrontmatterValue(text, 'refs', ['a'], { after: ['type'] });
  assert.equal(inserted, text.replace('type: Increment\r\n', 'type: Increment\r\nrefs: [a]\r\n'));
  assert.equal(setFrontmatterValue(text, 'tail', 'x'), text.replace('status: New\r\n', 'status: New\r\ntail: x\r\n'));
  assert.equal(setFrontmatterValue(text, 'custom', null), text.replace('custom: keep me\r\n', ''));
  assert.equal(setFrontmatterValue(text, 'absent', null), text);
  assert.throws(() => setFrontmatterValue('# none', 'a', 'b'), code('INCREMENT_DOCUMENT_INVALID'));
  assert.throws(() => setFrontmatterValue('---\na: 1\na: 2\n---\n', 'a', 'b', { code: 'PR_DOCUMENT_INVALID' }), code('PR_DOCUMENT_INVALID'));
});

test('the outline ignores headings in fences, nests ### under ## and keeps byte offsets', () => {
  const text = '---\na: b\n---\n# Title\n\n## One\n\n```md\n## not a heading\n```\n\n### Sub\n\nx\n\n~~~\n# also not\n~~~\n## Two\n';
  const doc = outline(text);
  assert.equal(doc.title.name, 'Title'); assert.deepEqual(doc.sections.map(section => section.name), ['One', 'Two']);
  assert.deepEqual(doc.sections[0].subsections.map(sub => sub.name), ['Sub']);
  assert.equal(text.slice(doc.sections[0].headingStart, doc.sections[0].bodyStart), '## One\n');
  assert.equal(text.slice(doc.sections[0].subsections[0].bodyStart, doc.sections[0].end), '\nx\n\n~~~\n# also not\n~~~\n');
  assert.equal(outline('### orphan\n## A\n').sections.length, 1);
  assert.equal(prose('a <!-- c\nd --> `x` b\n```\nhidden\n```\n'), 'a \n   b\n\n\n\n');
  assert.equal(words('Two words <!-- not these -->'), 2);
});

test('list appends follow the last item, replace template placeholders and keep CRLF', () => {
  const find = doc => findSection(doc, 'List');
  assert.equal(appendListItem('## List\n\n- a\n  more\n\n## Next\n', find, 'b'), '## List\n\n- a\n  more\n- b\n\n## Next\n');
  assert.equal(appendListItem('## List\r\n\r\n- <placeholder>\r\n\r\n## Next\r\n', find, 'b'), '## List\r\n\r\n- b\r\n\r\n## Next\r\n');
  assert.equal(appendListItem('## List\n\n<!-- guidance -->\n\n## Next\n', find, 'b'), '## List\n\n<!-- guidance -->\n\n- b\n\n## Next\n');
  assert.equal(appendListItem('## List\n- last', find, 'b'), '## List\n- last\n- b\n');
  assert.equal(appendListItem('## List', find, 'b'), '## List\n\n- b\n');
  assert.equal(insertSection('# T\n## B\n', 'A', 'body', ['B']), '# T\n## A\n\nbody\n\n## B\n');
  assert.equal(insertSection('# T\n\n\n', 'A', ''), '# T\n\n## A\n\n');
});

test('marked regions are found and replaced between their marker lines only', () => {
  const text = 'a\n<!-- wb:list generated -->\nold\n<!-- /wb:list -->\nz\n';
  assert.equal(replaceMarkedRegion(text, 'list', 'new\r\nlines'), 'a\n<!-- wb:list generated -->\nnew\nlines\n<!-- /wb:list -->\nz\n');
  assert.equal(replaceMarkedRegion(text, 'list', ''), 'a\n<!-- wb:list generated -->\n<!-- /wb:list -->\nz\n');
  assert.equal(replaceMarkedRegion(text, 'other', 'x'), null);
  assert.equal(findMarkedRegion('<!-- wb:list -->\n', 'list'), null);
});

test('wikilinks resolve by path or unique basename and report missing and ambiguous targets', () => {
  const files = ['docs/prds/delivery.md', 'docs/a/Readme.md', 'docs/b/readme.md', 'docs/raw.txt', 'docs/increments/x.md'];
  assert.deepEqual(parseWikilink(' ./docs/prds/delivery#Goals|The PRD '), { target: './docs/prds/delivery#Goals|The PRD', path: 'docs/prds/delivery', heading: 'Goals', alias: 'The PRD' });
  assert.deepEqual(resolveWikilink(files, 'docs/prds/delivery'), { status: 'resolved', path: 'docs/prds/delivery.md' });
  assert.deepEqual(resolveWikilink(files, 'docs/raw.txt'), { status: 'resolved', path: 'docs/raw.txt' });
  assert.deepEqual(resolveWikilink(files, 'DELIVERY#heading|alias'), { status: 'resolved', path: 'docs/prds/delivery.md' });
  assert.deepEqual(resolveWikilink(files, 'readme.md'), { status: 'ambiguous', candidates: ['docs/a/Readme.md', 'docs/b/readme.md'] });
  for (const target of ['missing', 'docs/missing', '#only-heading', 'raw']) assert.deepEqual(resolveWikilink(files, target), { status: 'missing' });
  const text = 'See [[docs/prds/delivery|PRD]] and `[[in code]]`\n<!-- [[hidden]] -->\n[[nowhere]] [[readme]]\n```\n[[fenced]]\n```\n';
  assert.deepEqual(extractWikilinks(text).map(link => [link.path, link.line]), [['docs/prds/delivery', 1], ['nowhere', 3], ['readme', 3]]);
  assert.deepEqual(linkProblems(text, files, 10).map(problem => [problem.code, problem.line]), [['WIKILINK_UNRESOLVED', 13], ['WIKILINK_AMBIGUOUS', 13]]);
  assert.equal(formatWikilink('docs/x.md', 'docs/x'), '[[docs/x]]'); assert.equal(formatWikilink('docs/x.md', 'A [b] | c'), '[[docs/x|A  b    c]]');
});

test('a new increment renders the built-in template with the DoR substitutions and options', () => {
  const text = fresh({ refs: ['[[docs/prds/delivery]]', 'docs/tasks/T-1.md'], size: 'L', e2e: 'required' });
  const model = parseIncrement(text);
  assert.deepEqual([model.id, model.title, model.owner, model.size, model.status, model.e2e], ['delivery-pipeline', 'Delivery pipeline', 'Luis', 'L', 'New', 'required']);
  assert.deepEqual(model.refs, ['[[docs/prds/delivery]]', 'docs/tasks/T-1.md']); assert.deepEqual(model.pullRequests, []);
  assert.equal(model.heading, 'Delivery pipeline'); assert.deepEqual(model.sections.map(section => section.name), defaultDeliverySchema.handoff.sections);
  assert.match(renderIncrement({ id: 'x', title: '$& "q"' }), /^title: "\$& \\"q\\""$/m);
  assert.match(renderIncrement({ id: 'x', title: 'T' }), /^owner: "<owner>"$/m);
  assert.deepEqual(validateIncrement(text, { path }), []);
  assert.throws(() => renderIncrement({ id: 'Bad_Id', title: 'x' }), code('INCREMENT_ID_INVALID'));
  assert.throws(() => renderIncrement({ id: 'a'.repeat(65), title: 'x' }), code('INCREMENT_ID_INVALID'));
  assert.throws(() => renderIncrement({ id: 'x', title: 'two\nlines' }), code('INCREMENT_INPUT_INVALID'));
  assert.throws(() => renderIncrement({ id: 'x', title: 'x', size: 'XL' }), code('INCREMENT_INPUT_INVALID'));
  assert.throws(() => renderIncrement({ id: 'x', title: 'x', e2e: 'maybe' }), code('INCREMENT_INPUT_INVALID'));
});

test('increment edits add scope, criteria, evidence and refs with stable ids and exact Markdown', () => {
  let text = apply(fresh(), { kind: 'scope', side: 'in', text: 'Planner' }, { kind: 'scope', side: 'out', text: 'Remote sync' },
    { kind: 'ac-add', text: 'Renders the template' }, { kind: 'ac-add', text: 'Refuses a bad id', evidence: [] });
  assert.match(text, /### In scope\n\n- Planner\n\n### Out of scope\n\n- Remote sync\n\n## Acceptance/);
  assert.match(text, /\n- \[ \] AC-1: Renders the template\n {2}Evidence: `tests\/acceptance\/delivery-pipeline\/ac-1\.checks\.mjs`\n- \[ \] AC-2: Refuses a bad id\n\n## Affected/);
  const set = editIncrement(text, { kind: 'ac-set', id: 'AC-1', checked: true, evidence: ['tests/a.checks.mjs', 'docs/b.md'] });
  assert.deepEqual(set.edits, [{ section: 'Acceptance criteria', action: 'set', itemId: 'AC-1' }]);
  assert.match(set.text, /\n- \[x\] AC-1: Renders the template\n {2}Evidence: `tests\/a.checks.mjs`, `docs\/b.md`\n- \[ \] AC-2/);
  text = editIncrement(set.text, { kind: 'ac-set', id: 'AC-1', text: 'Renders it' }).text;
  assert.deepEqual(parseIncrement(text).acceptance.map(item => [item.id, item.checked, item.text, item.evidence]),
    [['AC-1', true, 'Renders it', ['tests/a.checks.mjs', 'docs/b.md']], ['AC-2', false, 'Refuses a bad id', []]]);
  const third = editIncrement(text, { kind: 'ac-add', text: 'Third' });
  assert.deepEqual([third.edits[0].itemId, third.created], ['AC-3', { id: 'AC-3', stub: 'tests/acceptance/delivery-pipeline/ac-3.checks.mjs' }]);
  assert.deepEqual(parseIncrement(third.text).acceptance.at(-1).evidence, ['tests/acceptance/delivery-pipeline/ac-3.checks.mjs']);
  const custom = editIncrement(text, { kind: 'ac-add', text: 'Own', evidence: ['docs/proof.md'] }, { schema: { ...defaultDeliverySchema, acceptance: { pattern: 'spec/{increment}-{ac}.md' } } });
  assert.deepEqual([custom.created.stub, parseIncrement(custom.text).acceptance.at(-1).evidence], ['spec/delivery-pipeline-ac-3.md', ['docs/proof.md']]);
  assert.equal(acceptanceStubPath(undefined, 'x', 'AC-12'), 'tests/acceptance/x/ac-12.checks.mjs');
  assert.throws(() => acceptanceStubPath(undefined, 'x', 'T-1'), code('INCREMENT_INPUT_INVALID'));
  assert.throws(() => editIncrement(text, { kind: 'ac-set', id: 'AC-9', checked: true }), code('INCREMENT_AC_NOT_FOUND'));
  assert.throws(() => editIncrement(text, { kind: 'ac-set', id: 'AC-1', evidence: ['a`b'] }), code('INCREMENT_INPUT_INVALID'));
  const files = ['docs/prds/delivery.md'];
  const ref = editIncrement(text, { kind: 'ref-add', ref: '[[docs/prds/delivery]]' }, { files });
  assert.match(ref.text, /^e2e: optional\nrefs: \["\[\[docs\/prds\/delivery\]\]"\]$/m);
  assert.deepEqual(editIncrement(ref.text, { kind: 'ref-add', ref: '[[docs/prds/delivery]]' }).edits, []);
  assert.throws(() => editIncrement(text, { kind: 'ref-add', ref: '[[docs/prds/missing]]' }, { files }), code('WIKILINK_UNRESOLVED'));
  assert.equal(parseIncrement(editIncrement(text, { kind: 'ref-add', ref: '#12' }).text).refs.at(-1), '#12');
});

test('fields, sections and fragments edit only their own bytes, keeping CRLF and custom keys', () => {
  const original = fresh().replace('pullRequests: []\n', 'pullRequests: []\nreviewer: "Ana"\n').replace(/\n/g, '\r\n');
  let text = editIncrement(original, { kind: 'field', key: 'title', value: 'Renamed: pipeline' }).text;
  assert.match(text, /^title: "Renamed: pipeline"\r$/m); assert.match(text, /^# Renamed: pipeline\r$/m); assert.match(text, /^reviewer: "Ana"\r$/m);
  assert.ok(!/[^\r]\n/.test(text));
  text = apply(text, { kind: 'field', key: 'owner', value: 'Ana' }, { kind: 'field', key: 'size', value: 'S' }, { kind: 'field', key: 'e2e', value: 'none' });
  assert.deepEqual(['owner', 'size', 'e2e'].map(key => parseFrontmatter(text).data[key]), ['Ana', 'S', 'none']);
  const section = editIncrement(text, { kind: 'section', name: 'open QUESTIONS', body: 'None\n' });
  assert.deepEqual(section.edits, [{ section: 'Open questions', action: 'replace' }]);
  assert.match(section.text, /## Open questions\r\n\r\n<!-- "None" when ready\. Each open question blocks the Definition of Ready\. -->\r\n\r\nNone\r\n$/);
  assert.equal(section.text.slice(0, section.text.indexOf('## Open questions')), text.slice(0, text.indexOf('## Open questions')));
  const scoped = editIncrement(text, { kind: 'section', name: 'Out of scope', body: '- Nothing else' }).text;
  assert.match(scoped, /### Out of scope\r\n\r\n- Nothing else\r\n\r\n## Acceptance/);
  assert.throws(() => editIncrement(text, { kind: 'section', name: 'Completion record', body: 'x' }), code('INCREMENT_SECTION_UNKNOWN'));
  const bare = '---\ntype: Increment\nstatus: New\n---\n# T\n\n## Summary\n\nOld.\n';
  assert.equal(editIncrement(bare, { kind: 'section', name: 'Dependencies', body: 'None' }).text, `${bare}\n## Dependencies\n\nNone\n`);
  assert.match(editIncrement(bare, { kind: 'scope', side: 'out', text: 'x' }).text, /## Scope\n\n### Out of scope\n\n- x\n$/);
  const fragment = parseInputFragment('# Better title\n\n## summary\n\nNew summary.\n\n## Scope\n\n### In scope\n\n- one\n\n### Out of scope\n\n- two\n', defaultDeliverySchema.handoff.sections);
  const result = editIncrement(bare, { kind: 'fragment', fragment });
  assert.deepEqual(result.edits.map(edit => edit.section), ['frontmatter', 'Summary', 'In scope', 'Out of scope']);
  assert.equal(result.text, '---\ntype: Increment\nstatus: New\ntitle: "Better title"\n---\n# T\n\n## Summary\n\nNew summary.\n\n## Scope\n\n### In scope\n\n- one\n\n### Out of scope\n\n- two\n');
  assert.throws(() => editIncrement(bare, { kind: 'fragment', fragment: parseInputFragment('loose text', ['Summary']) }), code('INCREMENT_INPUT_INVALID'));
  assert.throws(() => editIncrement(bare, { kind: 'fragment', fragment: parseInputFragment('## Summary\n### In scope\n- x', ['Summary']) }), code('INCREMENT_SECTION_UNKNOWN'));
});

test('Done and Cancelled increments refuse every content edit', () => {
  for (const status of ['Done', 'Cancelled']) {
    const locked = fresh().replace('status: New', `status: ${status}`);
    for (const edit of [{ kind: 'scope', side: 'in', text: 'x' }, { kind: 'field', key: 'owner', value: 'x' }, { kind: 'pull-requests', ids: [], rows: [] }])
      assert.throws(() => editIncrement(locked, edit), code('INCREMENT_LOCKED'));
  }
});

test('the generated pull-request list stays in step with the pullRequests key and reports drift', () => {
  const rows = [{ id: 'delivery-pipeline-1', title: 'Hosting set', status: 'Draft', path: 'docs/pull-requests/delivery-pipeline-1.md', number: 74, url: 'https://github.com/o/r/pull/74' },
    { id: 'delivery-pipeline-2', title: 'Second', status: 'New', path: 'docs/pull-requests/delivery-pipeline-2.md' }];
  assert.equal(pullRequestRow(rows[0]), '- [[docs/pull-requests/delivery-pipeline-1|Hosting set]] · Draft · [#74](https://github.com/o/r/pull/74)');
  const text = editIncrement(fresh(), { kind: 'pull-requests', ids: rows.map(row => row.id), rows }).text;
  assert.match(text, /^pullRequests: \[delivery-pipeline-1, delivery-pipeline-2\]$/m);
  assert.match(text, /## Open questions\n[\s\S]*\n\n## Pull requests\n\n<!-- wb:pull-requests generated by node bin\/app; edits here are replaced -->\n- \[\[docs[^\n]*\n- \[\[docs[^\n]*\n<!-- \/wb:pull-requests -->\n$/);
  assert.deepEqual(pullRequestTableIds(text), rows.map(row => row.id));
  assert.deepEqual(validateIncrement(text, { path }), []);
  const refreshed = setPullRequestTable(text, [rows[1]]);
  assert.equal(refreshed.split('<!-- wb:pull-requests')[0], text.split('<!-- wb:pull-requests')[0]);
  assert.deepEqual(validateIncrement(refreshed, { path }).map(problem => problem.code), ['INCREMENT_LINK_DRIFT']);
  const withCompletion = setPullRequestTable(`${fresh()}\n## Completion record\n\nDone.\n`, []);
  assert.match(withCompletion, /## Pull requests\n\n<!-- wb:pull-requests[^\n]*\n<!-- \/wb:pull-requests -->\n\n## Completion record/);
  assert.match(setPullRequestTable(`${fresh()}\n## Pull requests\n\nhand-written\n`, [rows[1]]), /## Pull requests\n\n<!-- wb:pull-requests[^\n]*\n- \[\[docs\/pull-requests\/delivery-pipeline-2\|Second\]\] · New\n<!-- \/wb:pull-requests -->\n$/);
  assert.deepEqual(incrementLinkDrift({ id: 'a', pullRequests: ['a-1', 'a-3'] }, [{ id: 'a-1', increment: 'a' }, { id: 'a-2', increment: 'a' }, { id: 'a-3', increment: 'b' }]).map(problem => problem.message),
    ['Pull request a-2 names a but is not in its pullRequests list.', 'a lists a-3, which has no document or names another increment.']);
});

test('increments record their branch, base and generated issue list next to the pull requests', () => {
  const text = fresh({ branch: 'increment/delivery-pipeline', base: 'main' });
  assert.match(text, /^pullRequests: \[\]\nbranch: "increment\/delivery-pipeline"\nbase: main\n---$/m);
  const model = parseIncrement(text);
  assert.deepEqual([model.branch, model.base, model.issues], ['increment/delivery-pipeline', 'main', []]);
  assert.throws(() => fresh({ branch: 'bad branch' }), code('BRANCH_NAME_INVALID'));
  const rows = [{ id: 'delivery-pipeline', title: 'First issue', status: 'New', path: 'docs/issues/delivery-pipeline.md' }];
  const linked = editIncrement(editIncrement(text, { kind: 'issues', ids: ['delivery-pipeline'], rows }).text, { kind: 'pull-requests', ids: [], rows: [] }).text;
  assert.match(linked, /^pullRequests: \[\]\nissues: \[delivery-pipeline\]\nbranch:/m);
  assert.match(linked, /## Open questions\n[\s\S]*\n## Issues\n\n<!-- wb:issues generated by node bin\/app; edits here are replaced -->\n- \[\[docs\/issues\/delivery-pipeline\|First issue\]\] · New\n<!-- \/wb:issues -->\n\n## Pull requests\n/);
  assert.deepEqual(issueTableIds(linked), ['delivery-pipeline']); assert.deepEqual(validateIncrement(linked, { path }), []);
  assert.deepEqual(validateIncrement(setIssueTable(linked, []), { path }).map(problem => problem.message), ['The issues key and the generated list differ for delivery-pipeline.']);
  assert.deepEqual(incrementLinkDrift({ id: 'a', pullRequests: [], issues: ['a'] }, [{ id: 'a-2', increment: 'a' }], 'issues').map(problem => problem.message),
    ['Issue a-2 names a but is not in its issues list.', 'a lists a, which has no document or names another increment.']);
  assert.deepEqual(incrementLinkDrift({ id: 'a', pullRequests: [] }, [], 'issues'), []);
  assert.ok(validateIncrement(text.replace('base: main', 'base: "a..b"').replace('pullRequests: []', 'pullRequests: []\nissues: x'))
    .some(problem => problem.message === 'base "a..b" is not a branch name.'));
  assert.ok(validateIncrement(text.replace('pullRequests: []', 'pullRequests: []\nissues: x')).some(problem => problem.message === 'issues must be a [list].'));
});

test('validation reports DOR-02 frontmatter problems, missing sections, malformed criteria and links', () => {
  const broken = fresh().replace('type: Increment', 'type: Task').replace('size: M', 'size: XL').replace('pullRequests: []', 'pullRequests: x\nextra: 1')
    .replace('## Outcome', '## Outcomes').replace('- [ ] AC-2:', '- [ ] AC-1:').replace('- [ ] AC-1: <observable', '- AC-x <observable');
  const messages = validateIncrement(broken, { path: 'docs/increments/other.md' }).map(problem => problem.message);
  for (const expected of ['Unknown key extra; the Definition of Ready refuses it.', 'type must be Increment.', 'id "delivery-pipeline" differs from the file name "other".',
    'size must be one of S, M, L.', 'pullRequests must be a [list].', '## Outcome is missing.', '"AC-x <observable behavior that can be tested independently>" is not "[ ] AC-n: text".'])
    assert.ok(messages.includes(expected), expected);
  assert.deepEqual(malformedCriteria(broken).map(item => item.line), [42]);
  assert.ok(validateIncrement(fresh().replace('- [ ] AC-2:', '- [ ] AC-1:')).some(problem => problem.message === 'AC-1 appears more than once.'));
  assert.deepEqual(validateIncrement('no frontmatter')[0], { code: 'INCREMENT_DOCUMENT_INVALID', message: 'The file does not start with a --- frontmatter block.', line: 1 });
  assert.ok(validateIncrement(fresh().replace('id: delivery-pipeline', 'id: Bad Id\nid: x')).some(problem => problem.line === 4 && problem.message === 'duplicate key id'));
  const linked = editIncrement(fresh(), { kind: 'ref-add', ref: '[[docs/prds/gone]]' }).text.replace('<the observable result', '[[readme]] <the observable result');
  assert.deepEqual(validateIncrement(linked, { path, files: ['a/readme.md', 'b/readme.md'] }).map(problem => [problem.code, problem.line]), [['WIKILINK_AMBIGUOUS', 24], ['WIKILINK_UNRESOLVED', 9]]);
});

test('the structural Ready gate lists placeholders, thin sections, scope and open questions until they are resolved', () => {
  const blocked = readinessProblems(fresh(), { path });
  assert.ok(blocked.every(problem => problem.code === 'INCREMENT_NOT_READY'));
  assert.ok(blocked.some(problem => problem.message === 'Placeholder <the observable result for a user or maintainer once this is merged> is left.' && problem.line === 24));
  assert.ok(blocked.some(problem => problem.message === 'Resolve the open questions and write "None".'));
  assert.ok(readinessProblems(renderIncrement({ id: 'x', title: 'TODO later', owner: 'o' })).some(problem => problem.message === 'Placeholder TODO is left.'));
  assert.deepEqual(readinessProblems(ready(), { path }), []);
  const thin = ready().replace('Maintainers plan increments from the terminal.', 'Short.').replace('- Remote sync\n', '');
  assert.deepEqual(readinessProblems(thin, { path }).map(problem => problem.message), ['## Outcome needs at least three words or "None".', 'State both ### In scope and ### Out of scope.']);
  assert.deepEqual(readinessProblems(ready().replace(/\n- \[ \] AC-1:[^\n]*/, ''), { path }).map(problem => problem.message), ['## Acceptance criteria needs at least three words or "None".', 'Add at least one acceptance criterion.']);
});

test('built-in delivery defaults accept a matching configuration, report drift and retarget moved folders', () => {
  const config = { schemaVersion: 1, handoff: { ...defaultDeliverySchema.handoff, glob: 'notes/increments/*.md' }, pullRequests: defaultDeliverySchema.pullRequests, sizes: defaultDeliverySchema.sizes };
  const schema = deliverySchemaFrom(structuredClone(config));
  assert.equal(schema.handoff.glob, 'notes/increments/*.md'); assert.deepEqual(schema.branches, defaultDeliverySchema.branches);
  assert.deepEqual(deliverySchemaFrom({ ...config, handoff: { ...config.handoff, optionalKeys: ['refs', 'pullRequests'] }, branches: { increment: 'inc/{id}', pullRequest: 'inc/{increment}/{pr}', base: 'trunk' } }).branches,
    { increment: 'inc/{id}', pullRequest: 'inc/{increment}/{pr}', base: 'trunk' });
  assert.deepEqual([deliverySchemaFrom({ ...config, acceptance: 'a/{increment}/{ac}.md' }).acceptance, deliverySchemaFrom({ ...config, acceptance: { pattern: 'b/{increment}/{ac}.md' } }).acceptance],
    [{ pattern: 'a/{increment}/{ac}.md' }, { pattern: 'b/{increment}/{ac}.md' }]);
  assert.deepEqual(deliveryPathsDrift(schema, { increments: 'notes/increments', pullRequests: 'docs/pull-requests' }), []);
  assert.deepEqual(deliveryPathsDrift(schema, { increments: 'docs/increments', pullRequests: 'docs/pr' }).map(problem => problem.code), ['DELIVERY_PATHS_DRIFT', 'DELIVERY_PATHS_DRIFT']);
  for (const change of [{ handoff: { ...config.handoff, statuses: ['New'] } }, { handoff: { ...config.handoff, type: 'Story' } }, { sizes: {} }, { sizes: { S: { maxAcceptanceCriteria: 0, maxAffectedAreas: 1 } } },
    { handoff: { ...config.handoff, maxSlugLength: 0 } }, { handoff: { ...config.handoff, optionalKeys: ['refs', 'pullRequests', 'tags'] } }, { branches: { increment: '', pullRequest: 'x', base: 'main' } }, { acceptance: 'tests/{ac}.mjs' }, { handoff: { ...config.handoff, ignore: 'x' } }, { handoff: { ...config.handoff, glob: '' } }, { pullRequests: { ...config.pullRequests, incrementKey: 'inc' } }, { handoff: null }])
    assert.throws(() => deliverySchemaFrom({ ...config, ...change }), code('DELIVERY_SCHEMA_UNSUPPORTED'));
  const text = `${JSON.stringify({ handoff: { glob: 'docs/increments/*.md', ignore: ['docs/increments/README.md', 'other/x.md'] }, pullRequests: { glob: 'docs/pull-requests/*.md' } }, null, 2)}\n`;
  const moved = retargetDeliveryConfig(text, { increments: { from: 'docs/increments', to: 'plan/increments' }, pullRequests: { from: 'docs/pull-requests', to: 'plan/prs' } });
  assert.equal(moved, text.replace('"docs/increments/*.md"', '"plan/increments/*.md"').replace('"docs/increments/README.md"', '"plan/increments/README.md"').replace('"docs/pull-requests/*.md"', '"plan/prs/*.md"'));
  assert.equal(retargetDeliveryConfig(text, {}), text);
  assert.throws(() => retargetDeliveryConfig(text, { increments: { from: 'elsewhere', to: 'x' } }), code('DELIVERY_PATHS_DRIFT'));
  assert.throws(() => retargetDeliveryConfig('{', {}), code('DELIVERY_SCHEMA_UNSUPPORTED'));
});

test('the built-in schema and template equal configs/delivery, except the extension keys it does not list yet', { skip: noDelivery }, () => {
  const raw = JSON.parse(readFileSync(deliveryFile, 'utf8')), schema = deliverySchemaFrom(raw);
  assert.equal(readFileSync(resolve(root, raw.handoff.template), 'utf8'), incrementTemplate);
  assert.deepEqual(schema, { ...defaultDeliverySchema, handoff: { ...defaultDeliverySchema.handoff, optionalKeys: raw.handoff.optionalKeys } });
  const missing = incrementExtensionKeys.filter(key => !raw.handoff.optionalKeys.includes(key));
  // Until delivery.json lists branch, base and issues, the CLI refuses to write them instead of producing a DOR-02 failure.
  for (const key of missing) assert.throws(() => editIncrement(fresh(), key === 'issues' ? { kind: 'issues', ids: [], rows: [] } : { kind: 'field', key, value: 'main' }, { schema }), code('DELIVERY_SCHEMA_UNSUPPORTED'), key);
  if (!missing.length) assert.deepEqual(schema, defaultDeliverySchema);
});

test('CLI-written increments parse through the DoR parser and pass DOR-02', { skip: noScripts }, async () => {
  const handoff = await import(pathToFileURL(handoffScript).href), { renderHandoff } = await import(pathToFileURL(resolve(root, 'scripts/delivery/increment.mjs')).href);
  const { readyRules, resolveWikilink: dorResolve } = await import(pathToFileURL(resolve(root, 'scripts/delivery/rules-ready.mjs')).href);
  assert.equal(fresh(), renderHandoff(incrementTemplate, { slug: 'delivery-pipeline', title: 'Delivery pipeline', owner: 'Luis' }));
  const text = apply(ready(), { kind: 'field', key: 'title', value: 'Quote "and" \\ colon: [x]' }, { kind: 'ref-add', ref: '[[docs/prds/a, b]]' },
    { kind: 'ac-set', id: 'AC-1', checked: true, evidence: ['tests/x.checks.mjs'] }, { kind: 'pull-requests', ids: ['delivery-pipeline-1'], rows: [{ id: 'delivery-pipeline-1', title: 'One', status: 'New', path: 'docs/pull-requests/delivery-pipeline-1.md' }] });
  const model = handoff.parseHandoff(text);
  assert.deepEqual(model.frontmatter.errors, []); assert.deepEqual(model.frontmatter.data, parseFrontmatter(text).data);
  assert.deepEqual(handoff.acceptanceCriteria(model.section('Acceptance criteria')).map(({ id, checked, text: body, evidence }) => ({ id, checked, text: body, evidence })),
    parseIncrement(text).acceptance.map(({ id, checked, text: body, evidence }) => ({ id, checked, text: body, evidence })));
  const delivery = JSON.parse(readFileSync(deliveryFile, 'utf8'));
  assert.equal(readyRules['DOR-02'].run({ handoff: { model, path }, delivery }, { allowUnknownKeys: false }).status, 'pass');
  const body = text.slice(parseFrontmatter(text).bodyStart);
  assert.deepEqual(handoff.wikilinks(body), extractWikilinks(body).map(link => link.target));
  for (const target of ['docs/prds/delivery', 'delivery', 'missing', 'readme']) assert.equal(dorResolve(['docs/prds/delivery.md', 'a/readme.md'], target), resolveWikilink(['docs/prds/delivery.md', 'a/readme.md'], target).status === 'resolved');
});
