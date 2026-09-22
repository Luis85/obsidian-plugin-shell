/** Strict validation of the versioned test-plan data, not execution of configurable shell commands. */
export const evidenceModes = ['node-baseline', 'http-specimen', 'browser-specimen',
  'browser-inline-diagnostic', 'unit', 'component', 'browser-integrated', 'native',
  'device', 'artifact', 'tooling-generated', 'manual', 'security', 'performance'];
const exactKeys = (object, keys) => {
  if (!object || typeof object !== 'object' || Array.isArray(object) ||
      Object.keys(object).some((key) => !keys.includes(key))) throw new Error('PLAN_UNKNOWN_FIELD');
};
export function validatePlan(plan) {
  exactKeys(plan, ['schemaVersion', 'baselineCommit', 'retries', 'repeat', 'suites', 'acceptance', 'releaseRequires']);
  if (plan.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(plan.baselineCommit ?? '') ||
      plan.retries !== 0 || !Number.isSafeInteger(plan.repeat) || plan.repeat < 2 || plan.repeat > 10)
    throw new Error('PLAN_POLICY');
  if (!Array.isArray(plan.suites) || !plan.suites.length) throw new Error('PLAN_EMPTY_SUITES');
  const suiteIds = new Set(); const testIds = new Set(); const fileSet = new Set();
  for (const suite of plan.suites) {
    exactKeys(suite, ['id', 'mode', 'state', 'file', 'testIds', 'scope']);
    if (!/^[a-z][a-z-]+$/.test(suite.id ?? '') || suiteIds.has(suite.id) ||
        !evidenceModes.includes(suite.mode) || !['executable', 'planned'].includes(suite.state) || !suite.scope)
      throw new Error('PLAN_SUITE');
    suiteIds.add(suite.id);
    if (suite.state === 'executable') {
      if (!/^tests\/[a-z0-9/_-]+\.(?:test|checks)\.mjs$/.test(suite.file ?? '') || fileSet.has(suite.file))
        throw new Error('PLAN_TEST_PATH');
      fileSet.add(suite.file);
      if (!Array.isArray(suite.testIds) || !suite.testIds.length) throw new Error('PLAN_EMPTY_TESTS');
      for (const id of suite.testIds) {
        if (!/^[A-Z]+-\d{2}$/.test(id) || testIds.has(id)) throw new Error('PLAN_TEST_ID');
        testIds.add(id);
      }
    } else if (suite.file !== null || suite.testIds?.length !== 0) throw new Error('PLAN_FAKE_IMPLEMENTATION');
  }
  if (!Array.isArray(plan.acceptance) || plan.acceptance.length !== 90) throw new Error('PLAN_ACCEPTANCE_COUNT');
  const ids = new Set();
  for (const item of plan.acceptance) {
    exactKeys(item, ['id', 'summary', 'risk', 'owner', 'requiredModes', 'evidence', 'gap']);
    if (!/^AC-(?:0[1-9]|[1-8][0-9]|90)$/.test(item.id ?? '') || ids.has(item.id) ||
        !item.summary || !['critical', 'high', 'normal'].includes(item.risk) || !item.owner || !item.gap)
      throw new Error('PLAN_ACCEPTANCE');
    ids.add(item.id);
    if (!Array.isArray(item.requiredModes) || !item.requiredModes.length ||
        item.requiredModes.some((m) => !evidenceModes.includes(m))) throw new Error('PLAN_MODES');
    if (!Array.isArray(item.evidence)) throw new Error('PLAN_EVIDENCE');
    for (const link of item.evidence) {
      exactKeys(link, ['testId', 'extent']);
      if (!testIds.has(link.testId) || !['partial', 'whole'].includes(link.extent)) throw new Error('PLAN_EVIDENCE');
    }
  }
  if (!Array.isArray(plan.releaseRequires) || !plan.releaseRequires.includes('native') ||
      !plan.releaseRequires.includes('artifact') || !plan.releaseRequires.includes('browser-integrated') ||
      plan.releaseRequires.some((m) => !evidenceModes.includes(m))) throw new Error('PLAN_RELEASE_MODES');
  return plan;
}
export function acceptanceEvidence(plan, results) {
  const passed = new Map();
  for (const result of results) if (result.status === 'passed') {
    for (const item of result.cases) {
      const id = /^\[([A-Z]+-\d+)\]/.exec(item.name)?.[1];
      if (item.status === 'passed' && id) passed.set(id, result.mode);
    }
  }
  return plan.acceptance.map((item) => {
    const observed = item.evidence.filter((link) => passed.has(link.testId));
    // Extent and mode must both match; inline diagnostics cannot establish HTTP/native results.
    const wholeModes = new Set(observed.filter((link) => link.extent === 'whole').map((link) => passed.get(link.testId)));
    const complete = item.evidence.length > 0 && item.evidence.every((link) => link.extent === 'whole' && passed.has(link.testId));
    return { id: item.id, state: complete && item.requiredModes.every((m) => wholeModes.has(m)) ? 'verified' :
      observed.length ? 'partial' : 'not-run', observedTestIds: observed.map((link) => link.testId),
      missingModes: item.requiredModes.filter((m) => !wholeModes.has(m)), gap: item.gap };
  });
}
export function releaseDecision(plan, results) {
  const modes = new Set(results.filter((r) => r.status === 'passed').map((r) => r.mode));
  const evidence = acceptanceEvidence(plan, results);
  // An intentionally conservative baseline guard, not the future release publisher.
  return { status: 'blocked', reason: 'NATIVE_CANDIDATE_RELEASE_VALIDATOR_NOT_IMPLEMENTED',
    missingModes: plan.releaseRequires.filter((m) => !modes.has(m)),
    unverifiedAcceptance: evidence.filter((row) => row.state !== 'verified').map((row) => row.id) };
}
