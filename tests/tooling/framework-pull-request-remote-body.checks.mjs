import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodySize, composeRemoteBody, parseRemoteBody, remoteMarker, renderManagedBlock, requireBodyFits } from '../../bin/domain/increments/remote-body.ts';
import { blobUrl, canonicalWikilinks, remoteToWikilinks, wikilinksToRemote } from '../../bin/domain/increments/remote-links.ts';
import { samplePullRequestView } from '../support/fake-hosting-remote.mjs';

const github = { platform: 'github', web: 'https://github.com/octo/demo', ref: 'feature/hosting-set' };
const azure = { platform: 'azure-devops', web: 'https://dev.azure.com/contoso/Demo/_git/demo', ref: 'feature/hosting-set' };
const content = parsed => ({ summary: parsed.summary, scope: parsed.scope, tasks: parsed.tasks, documents: parsed.documents, notes: parsed.notes, amendments: parsed.amendments });
const expected = view => ({ summary: view.summary, scope: view.scope, tasks: view.tasks, documents: view.documents, notes: view.notes, amendments: view.amendments });
const codeOf = code => error => error.message.startsWith(`${code}:`);

test('a rendered block parses back to the same content on GitHub and Azure, in both marker styles', () => {
  const views = [samplePullRequestView(), samplePullRequestView({ tasks: [], amendments: [], documents: [], notes: '', scope: { in: [], out: [] } })];
  for (const view of views) for (const links of [github, azure]) for (const markers of ['html', 'reference']) {
    const block = renderManagedBlock(view, { links, markers });
    const parsed = parseRemoteBody(block, links);
    assert.equal(parsed.status, 'ok', `${links.platform}/${markers}: ${parsed.problem}`);
    assert.equal(parsed.id, view.id); assert.equal(parsed.increment, view.increment.id);
    assert.deepEqual(content(parsed), expected(view));
    assert.deepEqual(parsed.span, { start: 0, end: block.length }); assert.equal(parsed.unmanagedChars, 0);
    assert.ok(block.includes(remoteMarker(view.id)), 'the marker adapters search for is present');
  }
});

test('the published block carries the DoR handoff line, visible task ids and blob links instead of wikilinks', () => {
  const block = renderManagedBlock(samplePullRequestView(), { links: github });
  assert.match(block, /^<!-- wb:pr v1 id=delivery-1 increment=delivery kind=change -->\nHandoff: docs\/increments\/delivery\.md\n> Increment: \[Delivery pipeline\]\(https:\/\/github\.com\/octo\/demo\/blob\/feature\/hosting-set\/docs\/increments\/delivery\.md\) · Stacks on `increment\/delivery` · Plan: /);
  const kickoff = renderManagedBlock(samplePullRequestView({ id: 'delivery-kickoff', kind: 'kickoff', head: 'increment/delivery', base: 'main' }), { links: github });
  assert.match(kickoff, /^<!-- wb:pr v1 id=delivery-kickoff increment=delivery kind=kickoff -->\nHandoff: docs\/increments\/delivery\.md\n> Kick-off of increment \[Delivery pipeline\]\(/);
  assert.deepEqual([parseRemoteBody(kickoff, github).kind, parseRemoteBody(block, github).kind], ['kickoff', 'change']);
  assert.equal(parseRemoteBody(block.replace(' kind=change', ''), github).status, 'ok', 'a header without kind (v1 before kinds) still parses');
  assert.ok(block.includes('- [ ] T-1: Add the hosting set planner'));
  assert.ok(block.includes('- [x] T-2: Document [Hosting platforms](https://github.com/octo/demo/blob/feature/hosting-set/docs/development/HOSTING-PLATFORMS.md)'));
  assert.ok(block.includes('- AC-1: hosting set previews (done)\n- AC-2: apply writes the plan'));
  assert.ok(block.includes('```\n[[not-a-link]]\n```'), 'code is never rewritten');
  assert.ok(!/\[\[docs\//.test(block), 'no wikilink outside code remains');
  assert.ok(block.includes('### A-1 · 2026-10-05\n\nSplit the docs task.'));
  assert.ok(block.endsWith('<!-- /wb:pr -->'));
  const azureBlock = renderManagedBlock(samplePullRequestView(), { links: azure, markers: 'reference' });
  assert.ok(azureBlock.includes('[Hosting platforms](https://dev.azure.com/contoso/Demo/_git/demo?path=/docs/development/HOSTING-PLATFORMS.md&version=GBfeature%2Fhosting-set)'));
  assert.ok(azureBlock.startsWith('[//]: # (wb:pr v1 id=delivery-1 increment=delivery kind=change)\n'));
  assert.ok(!azureBlock.includes('<!--'), 'the reference style needs no HTML comments');
});

test('wikilinks round-trip exactly, including headings, aliases and unresolved targets; foreign links stay Markdown', () => {
  const resolve = target => ({ 'HOSTING-PLATFORMS': 'docs/development/HOSTING-PLATFORMS.md', 'docs/README': 'docs/README.md' })[target.replace(/\.md$/, '')] ?? null;
  const text = 'See [[HOSTING-PLATFORMS#Azure DevOps setup|Azure]], [[docs/README]], [[missing]] and [x](https://example.com/a(b)).';
  for (const links of [github, azure]) {
    const remote = wikilinksToRemote(text, links, resolve);
    assert.ok(remote.includes('[[missing]]'), 'an unresolved link stays literal');
    assert.ok(remote.includes('[README]('), 'the default label is the basename');
    assert.equal(remoteToWikilinks(remote, links), 'See [[docs/development/HOSTING-PLATFORMS#Azure DevOps setup|Azure]], [[docs/README]], [[missing]] and [x](https://example.com/a(b)).');
  }
  assert.equal(blobUrl(github, 'docs/a b.md', 'Some (heading)'), 'https://github.com/octo/demo/blob/feature/hosting-set/docs/a%20b.md#Some%20%28heading%29');
  const otherRef = '[a](https://github.com/octo/demo/blob/main/docs/a.md) [b](https://github.com/other/repo/blob/feature/hosting-set/docs/b.md)';
  assert.equal(remoteToWikilinks(otherRef, github), otherRef, 'links to another ref or repository are not converted');
  assert.equal(remoteToWikilinks('[x](https://github.com/octo/demo/blob/feature/hosting-set/docs/%2E%2E/x.md)', github),
    '[x](https://github.com/octo/demo/blob/feature/hosting-set/docs/%2E%2E/x.md)', 'traversal segments are never turned into wikilinks');
  assert.equal(canonicalWikilinks('[[HOSTING-PLATFORMS|HOSTING-PLATFORMS]] and [[docs/README.md]]', resolve), '[[docs/development/HOSTING-PLATFORMS]] and [[docs/README]]');
});

test('edits made on the platform are parsed tolerantly: CRLF, ticked boxes, id-less tasks and amendments, summary edits', () => {
  const view = samplePullRequestView();
  const block = renderManagedBlock(view, { links: github });
  const edited = block
    .replace('- [ ] T-1: Add the hosting set planner', '* [X] T-1: Add the hosting set planner\n- [ ] Write the migration note\n- [ ]   \n- [ ] T-9: Typed id from the web')
    .replace('Adds `hosting set`;', 'Adds the `hosting set` command;')
    .replace('Split the docs task.', 'Split the docs task in two.')
    .replace('Smaller diff.', 'Smaller diff.\n\n### 2026-10-07\n\nReviewer asked for a follow-up.\n\n### Follow-up\n\nNo date here.')
    .replace(/\n/g, '\r\n');
  const parsed = parseRemoteBody(`Reviewer intro\r\n\r\n${edited}\r\n\r\n<!-- reviewer footer -->`, github);
  assert.equal(parsed.status, 'ok');
  assert.deepEqual(parsed.tasks, [{ id: 'T-1', text: 'Add the hosting set planner', done: true }, { id: null, text: 'Write the migration note', done: false },
    { id: 'T-9', text: 'Typed id from the web', done: false }, view.tasks[1]]);
  assert.equal(parsed.summary, view.summary.replace('Adds `hosting set`;', 'Adds the `hosting set` command;'));
  assert.deepEqual(parsed.amendments.map(entry => [entry.id, entry.date, entry.markdown.split('\n')[0]]),
    [['A-1', '2026-10-05', 'Split the docs task in two.'], [null, '2026-10-07', 'Reviewer asked for a follow-up.'], [null, '', 'Follow-up']]);
  assert.equal(parsed.unmanagedChars, 'Reviewer intro\r\n\r\n'.length + '\r\n\r\n<!-- reviewer footer -->'.length);
});

test('the block replaces only its own span, so reviewer text and platform templates survive byte-for-byte', () => {
  const view = samplePullRequestView();
  const before = 'Template header\r\n\r\n', after = '\r\n\r\n- [ ] reviewer checklist outside the block\r\n';
  const original = before + renderManagedBlock(view, { links: github }) + after;
  const changed = renderManagedBlock({ ...view, tasks: [...view.tasks, { id: 'T-3', text: 'New', done: false }] }, { links: github });
  const composed = composeRemoteBody(original, parseRemoteBody(original, github), changed);
  assert.equal(composed, before + changed + after);
  assert.deepEqual(parseRemoteBody(composed, github).tasks.map(task => task.id), ['T-1', 'T-2', 'T-3'], 'checkboxes outside the block are never imported');
  assert.equal(composeRemoteBody('Only reviewer text', parseRemoteBody('Only reviewer text', github), changed), `${changed}\n\nOnly reviewer text`);
  assert.equal(composeRemoteBody(null, null, changed), changed);
});

test('missing, malformed and foreign blocks are reported instead of guessed; HTML-escaped comments are still recognised', () => {
  const block = renderManagedBlock(samplePullRequestView(), { links: github });
  const missing = parseRemoteBody('Just a description', github);
  assert.deepEqual([missing.status, missing.span, missing.unmanagedChars], ['missing', null, 18]);
  const noClose = parseRemoteBody(block.replace('<!-- /wb:pr -->', ''), github);
  assert.equal(noClose.status, 'malformed'); assert.equal(noClose.span.start, 0);
  assert.equal(parseRemoteBody(block.replace('<!-- /wb:tasks -->', ''), github).status, 'malformed');
  assert.equal(parseRemoteBody(block.replace('<!-- wb:notes -->', '<!-- wb:tasks -->'), github).status, 'malformed');
  assert.equal(parseRemoteBody(block.replace('v1 id=delivery-1', 'v2 id=delivery-1'), github).problem, 'unsupported wb:pr header');
  assert.equal(parseRemoteBody(`${block}\n${block}`, github).status, 'malformed', 'two blocks are ambiguous');
  const escaped = block.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;');
  assert.equal(parseRemoteBody(escaped, github).status, 'ok');
  assert.throws(() => parseRemoteBody('x'.repeat(262_145), github), codeOf('PR_REMOTE_RESPONSE_INVALID'));
});

test('content that would not survive a round trip, or exceeds the limits, is refused before anything is published', () => {
  const render = overrides => () => renderManagedBlock(samplePullRequestView(overrides), { links: github });
  assert.throws(render({ amendments: [{ id: 'A-1', date: '2026-10-05', markdown: '### Inner heading' }] }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.doesNotThrow(render({ amendments: [{ id: 'A-1', date: '2026-10-05', markdown: '```\n### fenced is fine\n```' }] }));
  assert.throws(render({ summary: 'Text\n<!-- /wb:summary -->\nmore' }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ notes: '[//]: # (wb:notes)' }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ title: 'Two\nlines' }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ title: 'x'.repeat(121) }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ tasks: [{ id: 'T-1', text: 'a', done: false }, { id: 'T-1', text: 'b', done: false }] }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ tasks: [{ id: 'X-1', text: 'a', done: false }] }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ id: 'bad id' }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ kind: 'feature' }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ base: 'increment/`x`' }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ amendments: [{ id: 'A-1', date: '5 Oct', markdown: 'x' }] }), codeOf('PR_REMOTE_CONTENT_INVALID'));
  assert.throws(render({ tasks: Array.from({ length: 201 }, (_, index) => ({ id: `T-${index + 1}`, text: 'x', done: false })) }), codeOf('PR_LIMIT'));
  assert.throws(render({ notes: 'n'.repeat(20_001) }), codeOf('PR_LIMIT'));
  const many = '- [ ] task\n'.repeat(201);
  const block = renderManagedBlock(samplePullRequestView(), { links: github }).replace('- [ ] T-1: Add the hosting set planner', many);
  assert.throws(() => parseRemoteBody(block, github), codeOf('PR_LIMIT'));
});

test('bodies are measured against the platform limit and never truncated', () => {
  const block = renderManagedBlock(samplePullRequestView(), { links: azure });
  assert.deepEqual(bodySize(block, 'azure-devops'), { limit: 4000, size: block.length, fits: block.length <= 4000 });
  assert.ok(block.length < 4000, `the sample fits Azure's description limit (${block.length})`);
  assert.deepEqual(bodySize('x'.repeat(65_536), 'github'), { limit: 65_536, size: 65_536, fits: true });
  assert.throws(() => requireBodyFits('x'.repeat(4001), 'azure-devops'), error => /^PR_BODY_TOO_LARGE: .*4001 characters.*at most 4000/.test(error.message));
  assert.throws(() => requireBodyFits('x'.repeat(65_537), 'github'), codeOf('PR_BODY_TOO_LARGE'));
  const notes = 'n'.repeat(3_500);
  assert.throws(() => requireBodyFits(renderManagedBlock(samplePullRequestView({ notes }), { links: azure }), 'azure-devops'), codeOf('PR_BODY_TOO_LARGE'));
});
