import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, PlanValidationError, parseDate, formatDate, addDays, daysBetween,
  dateRange, weekday, clampRange, isoWeek, normalizePlan, validatePlan,
  computePlan, computeAllocation, makeBuckets,
} from '../src/domain.mjs';

const role = (id = 'dev', fte = 1) => ({ id, name: id.toUpperCase(), fte, color: '#b5a3f4', notes: '' });
const allocation = (overrides = {}) => ({ id: 'a1', roleId: 'dev', name: 'Implementation', start: '2027-01-04', end: '2027-01-08', fte: 1, notes: '', ...overrides });
const block = (overrides = {}) => ({ id: 'b1', roleId: null, name: 'Blocked', start: '2027-01-04', end: '2027-01-08', fraction: 1, ...overrides });
const plan = (overrides = {}) => ({ id: 'plan-1', name: 'Resource plan', start: '2027-01-04', end: '2027-01-08', budgetPt: 10,
  calendar: { workdays: [1, 2, 3, 4, 5], hoursPerDay: 8, holidays: [] }, roles: [role()], allocations: [], blocks: [], notes: '', ...overrides });
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: expected ${expected}, received ${actual}`);
const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0);

test('calendar parser rejects impossible, non-padded, time-bearing and non-string dates', () => {
  for (const value of ['2027-02-29', '2028-02-30', '2026-04-31', '2026-00-01', '2026-13-01', '2026-10-00', '2026-1-01', '2026-01-01T00:00:00Z', '0000-01-01', null, 123]) {
    assert.throws(() => parseDate(value));
  }
  assert.equal(formatDate(parseDate('2028-02-29')), '2028-02-29');
  assert.equal(formatDate(parseDate('0099-01-02')), '0099-01-02');
  assert.equal(formatDate(parseDate('0001-01-01')), '0001-01-01');
});

test('date operations are inclusive and unaffected by European daylight-saving boundaries', () => {
  assert.equal(daysBetween('2026-10-23', '2026-10-30'), 7);
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.deepEqual(dateRange('2027-01-04', '2027-01-04'), ['2027-01-04']);
  assert.equal(weekday('2027-01-04'), 1);
  assert.equal(weekday('2027-01-10'), 7);
  assert.throws(() => dateRange('2027-01-08', '2027-01-04'));
  assert.throws(() => addDays('2027-01-04', 0.5));
  const result = computePlan(plan({ start: '2026-10-23', end: '2026-10-30', allocations: [allocation({ start: '2026-10-23', end: '2026-10-30' })] }));
  assert.equal(result.totals.netPt, 6);
});

test('range clipping preserves one-day intersections and reports disjoint ranges', () => {
  assert.deepEqual(clampRange('2027-01-01', '2027-01-04', '2027-01-04', '2027-01-08'), { start: '2027-01-04', end: '2027-01-04', days: 1 });
  assert.equal(clampRange('2027-01-01', '2027-01-03', '2027-01-04', '2027-01-08'), null);
  assert.throws(() => clampRange('2027-01-08', '2027-01-04', '2027-01-04', '2027-01-08'));
});

test('ISO weeks assign January dates to the correct week-numbering year', () => {
  assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, week: 53, key: '2026-W53', start: '2026-12-28', end: '2027-01-03' });
  assert.equal(isoWeek('2027-01-04').key, '2027-W01');
  assert.equal(isoWeek('2024-12-30').key, '2025-W01');
  assert.equal(isoWeek('2023-01-01').key, '2022-W52');
});

test('all supported four-digit years remain aggregatable at their date boundaries', () => {
  assert.equal(isoWeek('0001-01-01').key, '0001-W01');
  const last = isoWeek('9999-12-31');
  assert.equal(last.end, '9999-12-31');
  assert.equal(last.boundsClipped, true);
  const result = makeBuckets(plan({ start: '9999-12-30', end: '9999-12-31' }));
  assert.equal(result.length, 1);
  assert.equal(result[0].calendarDays, 2);
});

test('roles define capacity but do not create implicit full-plan effort', () => {
  const result = computePlan(plan({ roles: [role('dev', 1.5)] }));
  assert.equal(result.totals.netPt, 0);
  assert.equal(result.totals.capacityPt, 7.5);
  assert.equal(result.roles[0].scheduledDays, 0);
  assert.equal(result.allocations.length, 0);
});

test('FTE is person-day demand per working day and supports roles larger than one person', () => {
  const result = computePlan(plan({ roles: [role('dev', 3)], allocations: [allocation({ fte: 2.5 })] }));
  assert.equal(result.totals.workingDays, 5);
  assert.equal(result.totals.grossPt, 12.5);
  assert.equal(result.totals.netPt, 12.5);
  assert.equal(result.totals.capacityPt, 15);
  assert.equal(result.totals.hours, 100);
});

test('one inclusive working date is one person-day and a weekend-only allocation is zero', () => {
  const singleDay = computePlan(plan({ start: '2027-01-04', end: '2027-01-04', allocations: [allocation({ end: '2027-01-04' })] }));
  assert.equal(singleDay.totals.netPt, 1);
  const weekend = computePlan(plan({ start: '2027-01-09', end: '2027-01-10', allocations: [allocation({ start: '2027-01-09', end: '2027-01-10' })] }));
  assert.equal(weekend.totals.netPt, 0);
  assert.equal(weekend.totals.capacityPt, 0);
});

test('leap day is included when it is a configured working day', () => {
  const result = computePlan(plan({ start: '2028-02-28', end: '2028-03-01', allocations: [allocation({ start: '2028-02-28', end: '2028-03-01' })] }));
  assert.equal(result.totals.calendarDays, 3);
  assert.equal(result.totals.netPt, 3);
});

test('the workweek is configurable, including Sunday and an empty workweek', () => {
  const result = computePlan(plan({ end: '2027-01-10', calendar: { workdays: [3, 7], hoursPerDay: 8, holidays: [] }, allocations: [allocation({ end: '2027-01-10' })] }));
  assert.equal(result.totals.netPt, 2);
  assert.deepEqual(result.days.filter(day => day.working).map(day => day.date), ['2027-01-06', '2027-01-10']);
  const none = computePlan(plan({ calendar: { workdays: [] }, allocations: [allocation()] }));
  assert.equal(none.totals.netPt, 0);
  assert.ok(none.warnings.some(warning => warning.code === 'no-workdays'));
});

test('manual holidays exclude effort once even with multiple labels and overlapping blocks', () => {
  const result = computePlan(plan({ allocations: [allocation()], blocks: [block({ start: '2027-01-06', end: '2027-01-06' })],
    calendar: { workdays: [1, 2, 3, 4, 5], hoursPerDay: 8, holidays: [{ id: 'h1', date: '2027-01-06', name: 'Holiday' }, { id: 'h2', date: '2027-01-06', name: 'Closure' }, { id: 'h3', date: '2027-01-10', name: 'Sunday' }] } }));
  assert.equal(result.totals.workingDays, 4);
  assert.equal(result.totals.grossPt, 4);
  assert.equal(result.totals.blockedPt, 0);
  assert.equal(result.days[2].holiday, 'Holiday · Closure');
});

test('hours per day changes hours without changing person-days or FTE demand', () => {
  const result = computePlan(plan({ allocations: [allocation({ fte: 0.5 })], calendar: { workdays: [1, 2, 3, 4, 5], hoursPerDay: 7.5, holidays: [] } }));
  assert.equal(result.totals.netPt, 2.5);
  assert.equal(result.totals.hours, 18.75);
  assert.equal(result.allocations[0].hours, 18.75);
});

test('a complete global block subtracts effort and capacity, preserving gross demand', () => {
  const result = computePlan(plan({ allocations: [allocation()], blocks: [block()] }));
  assert.equal(result.totals.grossPt, 5);
  assert.equal(result.totals.blockedPt, 5);
  assert.equal(result.totals.netPt, 0);
  assert.equal(result.totals.capacityPt, 0);
  assert.equal(result.roles[0].scheduledDays, 5);
  assert.equal(result.roles[0].blockedDays, 5);
});

test('overlapping global and role blocks use the strongest fraction instead of adding', () => {
  const result = computePlan(plan({ allocations: [allocation({ fte: 2 })], roles: [role('dev', 2)], blocks: [
    block({ id: 'b1', fraction: 0.5 }), block({ id: 'b2', fraction: 0.4 }), block({ id: 'b3', roleId: 'dev', fraction: 0.75, start: '2027-01-05', end: '2027-01-07' }),
  ] }));
  assert.equal(result.totals.grossPt, 10);
  assert.equal(result.totals.blockedPt, 6.5);
  assert.equal(result.totals.netPt, 3.5);
  assert.equal(result.totals.capacityPt, 3.5);
  assert.equal(result.roles[0].blockedDays, 3.25);
  assert.equal(result.totals.blockedDays, 2.5);
});

test('role-specific blocking affects only the named role', () => {
  const result = computePlan(plan({ roles: [role('dev'), role('ux')], allocations: [allocation(), allocation({ id: 'a2', roleId: 'ux' })], blocks: [block({ roleId: 'ux' })] }));
  assert.equal(result.roles.find(item => item.id === 'dev').netPt, 5);
  assert.equal(result.roles.find(item => item.id === 'ux').netPt, 0);
  assert.equal(result.totals.netPt, 5);
  assert.equal(result.totals.blockedPt, 5);
});

test('overlapping allocations remain additive and surface nominal-capacity warnings', () => {
  const result = computePlan(plan({ allocations: [allocation({ fte: 0.8 }), allocation({ id: 'a2', fte: 0.6, start: '2027-01-06', end: '2027-01-07' })] }));
  close(result.totals.grossPt, 5.2);
  close(result.totals.netPt, 5.2);
  close(result.totals.overloadPt, 0.8);
  assert.equal(result.roles[0].overloadDays, 2);
  assert.equal(result.roles[0].overlapDays, 2);
  close(result.roles[0].maxFte, 1.4);
  assert.equal(result.warnings.find(item => item.code === 'role-over-capacity').days, 2);
});

test('a gap after many fractional allocations has exactly zero residual effort', () => {
  const result = computePlan(plan({ roles: [role('dev', 100)], allocations: Array.from({ length: 1000 }, (_, index) => allocation({ id: `a-${index}`, end: '2027-01-04', fte: 0.13 })) }));
  assert.equal(result.days[1].roles[0].allocationCount, 0);
  assert.equal(result.days[1].roles[0].allocationFte, 0);
  assert.equal(result.days[1].grossPt, 0);
  assert.equal(result.days[1].netPt, 0);
  close(result.totals.netPt, 130);
});

test('capacity warnings retain requested overload hidden by complete blocked time', () => {
  const result = computePlan(plan({ allocations: [allocation({ fte: 2 })], blocks: [block()] }));
  assert.equal(result.totals.overloadPt, 0);
  assert.equal(result.roles[0].overloadDays, 0);
  assert.equal(result.roles[0].requestedOverloadDays, 5);
  assert.ok(result.warnings.some(item => item.code === 'role-over-capacity'));
});

test('ranges outside the plan are clipped without mutating the stored schedule', () => {
  const input = plan({ allocations: [allocation({ start: '2026-12-01', end: '2027-02-01' }), allocation({ id: 'outside', start: '2027-02-01', end: '2027-02-10' })],
    blocks: [block({ start: '2026-01-01', end: '2027-01-05' }), block({ id: 'outside-block', start: '2028-01-01', end: '2028-01-10' })] });
  const result = computePlan(input);
  assert.equal(result.totals.grossPt, 5);
  assert.equal(result.totals.netPt, 3);
  assert.equal(result.plan.allocations[0].start, '2026-12-01');
  assert.equal(result.allocations[0].start, '2027-01-04');
  assert.equal(result.allocations[0].clipped, true);
  assert.equal(result.allocations[1].outsidePlan, true);
  assert.equal(result.allocations[1].netPt, 0);
  assert.equal(result.allocations[1].start, null);
  assert.equal(result.totals.activeAllocationCount, 1);
  assert.equal(result.totals.activeBlocks, 1);
  assert.deepEqual(new Set(result.warnings.map(item => item.code)), new Set(['allocation-clipped', 'allocation-outside-plan', 'block-clipped', 'block-outside-plan']));
});

test('single-allocation summaries can preview a proposed block without including other demand', () => {
  const input = plan({ allocations: [allocation({ fte: 5 })], blocks: [block({ fraction: 0.5, start: '2027-01-06', end: '2027-01-06' })] });
  const summary = computeAllocation(input, allocation({ id: 'proposed', fte: 0.4 }));
  assert.equal(summary.workingDays, 5);
  close(summary.grossPt, 2);
  close(summary.blockedPt, 0.2);
  close(summary.netPt, 1.8);
  assert.equal(input.allocations.length, 1);
  assert.equal(input.allocations[0].fte, 5);
});

test('budget comparison uses net effort and can represent absent or zero budgets', () => {
  const over = computePlan(plan({ budgetPt: 3, allocations: [allocation()] }));
  assert.equal(over.totals.budgetRemainingPt, -2);
  assert.equal(over.totals.budgetExceededPt, 2);
  assert.ok(over.warnings.some(item => item.code === 'budget-exceeded'));
  const noBudget = computePlan(plan({ budgetPt: null, allocations: [allocation()] }));
  assert.equal(noBudget.totals.budgetRemainingPt, null);
  assert.equal(noBudget.totals.budgetExceededPt, null);
  assert.equal(computePlan(plan({ budgetPt: 0 })).totals.budgetRemainingPt, 0);
});

test('weekly buckets are chronological, year-aware and clipped at plan boundaries', () => {
  const result = computePlan(plan({ start: '2026-12-30', end: '2027-01-05', allocations: [allocation({ start: '2026-12-30', end: '2027-01-05' })] }));
  const weeks = makeBuckets(result, 'week');
  assert.deepEqual(weeks.map(item => item.key), ['2026-W53', '2027-W01']);
  assert.equal(weeks[0].start, '2026-12-30');
  assert.equal(weeks[0].end, '2027-01-03');
  assert.equal(weeks[1].end, '2027-01-05');
  assert.deepEqual(weeks.map(item => item.netPt), [3, 2]);
});

test('day, week and month aggregates conserve full-precision plan and per-role totals', () => {
  const input = plan({ start: '2026-10-05', end: '2027-02-19', roles: [role('dev'), role('dm', 0.2)], allocations: [
    allocation({ start: '2026-10-05', end: '2027-02-19', fte: 0.13 }),
    allocation({ id: 'a2', roleId: 'dm', start: '2026-10-05', end: '2027-02-19', fte: 0.17 }),
    allocation({ id: 'a3', start: '2026-11-17', end: '2027-01-04', fte: 0.11 }),
  ], blocks: [block({ start: '2026-12-21', end: '2027-01-03' }), block({ id: 'b2', roleId: 'dev', start: '2026-11-09', end: '2026-11-19', fraction: 0.35 })] });
  const computed = computePlan(input);
  for (const mode of ['day', 'week', 'month']) {
    const buckets = makeBuckets(computed, mode);
    assert.equal(sum(buckets, 'calendarDays'), computed.totals.calendarDays);
    assert.equal(sum(buckets, 'workingDays'), computed.totals.workingDays);
    for (const field of ['grossPt', 'blockedPt', 'netPt', 'capacityPt', 'overloadPt', 'hours']) {
      close(sum(buckets, field), computed.totals[field], `${mode} ${field}`);
      for (const [index, summary] of computed.roles.entries()) close(sum(buckets.map(bucket => bucket.roles[index]), field), summary[field], `${mode} ${summary.id} ${field}`);
    }
  }
  for (const summary of computed.roles) close(sum(computed.allocations.filter(item => item.roleId === summary.id), 'netPt'), summary.netPt);
  assert.throws(() => makeBuckets(computed, 'quarter'));
});

test('the 20-week sample has UX35 + RE35 + Dev80 + DM14 =164 PT against150', () => {
  const input = plan({ start: '2026-10-05', end: '2027-02-19', budgetPt: 150, roles: [role('ux'), role('re'), role('dev'), role('dm', 0.2)],
    allocations: [
      allocation({ id: 'ux1', roleId: 'ux', start: '2026-10-05', end: '2026-11-06' }),
      allocation({ id: 'ux2', roleId: 'ux', start: '2027-02-08', end: '2027-02-19' }),
      allocation({ id: 're1', roleId: 're', start: '2026-10-05', end: '2026-11-20' }),
      allocation({ id: 'dev1', start: '2026-10-05', end: '2026-12-04' }),
      allocation({ id: 'dev2', start: '2027-01-04', end: '2027-02-19' }),
      allocation({ id: 'dm1', roleId: 'dm', start: '2026-10-05', end: '2026-11-20', fte: 0.2 }),
      allocation({ id: 'dm2', roleId: 'dm', start: '2027-01-04', end: '2027-02-19', fte: 0.2 }),
    ], blocks: [block({ start: '2026-12-21', end: '2027-01-03' })] });
  const result = computePlan(input);
  assert.equal(result.totals.workingDays, 100);
  assert.equal(result.totals.blockedDays, 10);
  assert.equal(makeBuckets(result).length, 20);
  [35, 35, 80, 14].forEach((expected, index) => close(result.roles[index].netPt, expected));
  close(result.totals.netPt, 164);
  close(result.totals.budgetExceededPt, 14);
});

test('normalization copies all mutable structures and calculations do not mutate source state', () => {
  const input = plan({ allocations: [allocation()], blocks: [block({ fraction: 0.2 })] });
  const original = JSON.stringify(input);
  const normalized = normalizePlan(input);
  normalized.roles[0].name = 'Changed';
  normalized.calendar.workdays.push(7);
  normalized.allocations[0].fte = 8;
  assert.equal(JSON.stringify(input), original);
  computePlan(input);
  assert.equal(JSON.stringify(input), original);
});

test('validation rejects dangling roles, duplicate IDs, invalid date order and unsafe colors', () => {
  for (const invalid of [
    plan({ end: '2027-01-01' }),
    plan({ roles: [role(), role()] }),
    plan({ allocations: [allocation(), allocation()] }),
    plan({ allocations: [allocation({ roleId: 'unknown' })] }),
    plan({ blocks: [block({ roleId: 'unknown' })] }),
    plan({ blocks: [block({ end: '2027-01-01' })] }),
    plan({ roles: [{ ...role(), color: 'url(javascript:alert(1))' }] }),
    plan({ id: '<script>' }),
  ]) {
    const result = validatePlan(invalid);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.equal(result.plan, null);
    assert.throws(() => normalizePlan(invalid), PlanValidationError);
  }
});

test('numeric validation rejects coercion, NaN, infinities and out-of-range FTE or fractions', () => {
  for (const value of [0, -1, 100.01, 0.001, NaN, Infinity, '0.5', null]) {
    assert.equal(validatePlan(plan({ roles: [role('dev', value)] })).valid, false);
    assert.equal(validatePlan(plan({ allocations: [allocation({ fte: value })] })).valid, false);
  }
  for (const value of [-0.01, 1.01, NaN, '1', null]) assert.equal(validatePlan(plan({ blocks: [block({ fraction: value })] })).valid, false);
  assert.equal(validatePlan(plan({ roles: [role('dev', 0.01)], allocations: [allocation({ fte: 100 })], blocks: [block({ fraction: 0 })] })).valid, true);
});

test('validation enforces bounded data sizes and accepts the exact date-range limit', () => {
  const start = '2025-01-01';
  assert.equal(validatePlan(plan({ start, end: addDays(start, LIMITS.days - 1) })).valid, true);
  assert.equal(validatePlan(plan({ start, end: addDays(start, LIMITS.days) })).valid, false);
  assert.equal(validatePlan(plan({ roles: Array.from({ length: LIMITS.roles + 1 }, (_, index) => role(`role-${index}`)) })).valid, false);
  assert.equal(validatePlan(plan({ allocations: Array.from({ length: LIMITS.allocations + 1 }, (_, index) => allocation({ id: `a-${index}` })) })).valid, false);
  assert.equal(validatePlan(plan({ blocks: Array.from({ length: LIMITS.blocks + 1 }, (_, index) => block({ id: `b-${index}` })) })).valid, false);
  assert.equal(validatePlan(plan({ calendar: { holidays: Array.from({ length: LIMITS.holidays + 1 }, (_, index) => ({ id: `h-${index}`, date: '2027-01-01', name: '' })) } })).valid, false);
});

test('optional fields receive deterministic defaults and bad workday calendars are rejected', () => {
  const input = { id: 'p', name: 'Minimal', start: '2027-01-04', end: '2027-01-08' };
  const result = normalizePlan(input);
  assert.deepEqual(result.calendar, { workdays: [1, 2, 3, 4, 5], hoursPerDay: 8, holidays: [] });
  assert.equal(result.budgetPt, null);
  assert.deepEqual(result.roles, []);
  assert.deepEqual(normalizePlan(input), normalizePlan(input));
  for (const workdays of [[0], [8], [1.5], [1, 1], ['1']]) assert.equal(validatePlan(plan({ calendar: { workdays } })).valid, false);
  assert.equal(validatePlan(plan({ roles: [{ ...role(), color: 'blue' }] })).valid, true);
});
