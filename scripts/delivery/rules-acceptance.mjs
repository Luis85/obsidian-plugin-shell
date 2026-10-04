/**
 * Acceptance stub rules. Ready: every criterion of the Increment has its generated test stub (or already names
 * an existing test as evidence), and stubs of removed criteria are reported. Done: the stubs of the criteria in
 * scope (a change pull request: its `delivers`; otherwise all) carry no pending marker, assert something and
 * are the criterion's evidence; evidence tests carry no pending marker either.
 */
import { acceptanceCriteria } from './handoff.mjs';
import { entries } from './documents.mjs';
import { hasTestEvidence, stubPath, stubsOf, testEvidence } from './acceptance-stubs.mjs';
import { anyPullRequest, evidencePath, fail, increment, pass, skip } from './rules-common.mjs';

const noHandoff = () => skip('No handoff to check (see DOR-01).');
const settingsOf = context => context.delivery.acceptance;
const incrementId = context => context.handoff.path.split('/').at(-1).replace(/\.md$/, '');
const criteriaOf = context => acceptanceCriteria(context.handoff.model.section('Acceptance criteria')).filter(item => item.valid);
const mentions = (text, id) => new RegExp(`\\b${id}\\b`, 'u').test(text ?? '');
const generate = id => `Run \`npm run dor -- --write\` (or \`node scripts/delivery/acceptance.mjs stubs --increment ${id} --write\`)`;

function missingStubs(context) {
  const settings = settingsOf(context); const id = incrementId(context);
  const stubs = stubsOf(settings, id, context.files);
  return criteriaOf(context).flatMap(criterion => {
    const found = stubs.get(criterion.id) ?? [];
    if (found.length) return found.some(path => mentions(context.readText(path), criterion.id)) ? [] : [`${criterion.id}: ${found[0]} does not mention ${criterion.id}`];
    return hasTestEvidence(settings, criterion, context.files) ? [] : [`${criterion.id}: no stub (${stubPath(settings, id, criterion)}) and no existing test as evidence`];
  });
}

function stubProblems(context, criterion) {
  const settings = settingsOf(context);
  const pending = new RegExp(settings.pendingPattern, 'u'), assertion = new RegExp(settings.assertionPattern, 'u');
  const stubs = stubsOf(settings, incrementId(context), context.files).get(criterion.id) ?? [];
  const evidence = criterion.evidence.map(evidencePath);
  const problems = stubs.flatMap(path => {
    const text = context.readText(path) ?? '';
    return [...(pending.test(text) ? [`${criterion.id}: ${path} is still pending`] : []), ...(assertion.test(text) ? [] : [`${criterion.id}: ${path} asserts nothing`]),
      ...(evidence.includes(path) ? [] : [`${criterion.id}: ${path} is not named as its evidence`])];
  });
  for (const path of testEvidence(settings, criterion, context.files)) if (!stubs.includes(path) && pending.test(context.readText(path) ?? '')) problems.push(`${criterion.id}: evidence ${path} is still pending`);
  return problems;
}

export const acceptanceReadyRules = {
  'DOR-24': { title: 'Acceptance stubs present', appliesTo: increment, params: {},
    questions: ['Which test proves each acceptance criterion, and where will it live?'],
    run: context => {
      if (!context.handoff) return noHandoff();
      const problems = missingStubs(context);
      return problems.length ? fail(`${problems.length} acceptance criteria have no test stub.`, `${generate(incrementId(context))} to create one pending test per criterion, or name an existing test as its \`Evidence:\`.`, problems)
        : pass(`${criteriaOf(context).length} acceptance criteria have a stub or test evidence.`);
    } },
  'DOR-25': { title: 'No orphan acceptance stubs', appliesTo: increment, params: {},
    questions: ['Which stub belongs to a criterion that was removed or renumbered?'],
    run: context => {
      if (!context.handoff) return noHandoff();
      const ids = new Set(criteriaOf(context).map(item => item.id));
      const orphans = [...stubsOf(settingsOf(context), incrementId(context), context.files)].filter(([id]) => !ids.has(id)).flatMap(([id, paths]) => paths.map(path => `${path} (${id})`));
      return orphans.length ? fail(`${orphans.length} stub(s) belong to no acceptance criterion.`, 'Delete the stub or rename it to the criterion it tests (ac-<n>-…); stubs are never removed automatically.', orphans) : pass('Every stub belongs to an acceptance criterion.');
    } },
};

export const acceptanceDoneRules = {
  'DOD-18': { title: 'Acceptance stubs implemented', appliesTo: anyPullRequest, params: {},
    run: context => {
      if (!context.handoff) return skip('No handoff to check (see DOD-01).');
      const change = context.scope?.kind === 'change';
      const wanted = change ? new Set(entries(context.scope.pullRequest?.data.delivers)) : null;
      const criteria = criteriaOf(context).filter(item => !wanted || wanted.has(item.id));
      const problems = criteria.flatMap(criterion => stubProblems(context, criterion));
      return problems.length ? fail(`${problems.length} acceptance stub problem(s).`, 'Replace the pending marker with assertions that prove the criterion, and name the stub as the criterion\'s `Evidence:`.', problems)
        : pass(`${criteria.length} ${change ? 'delivered ' : ''}criteria have implemented tests.`);
    } },
};
