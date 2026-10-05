import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { evaluateRule, missingRulePaths, readRuleClause, readRuleExpression, ruleClauses, rulePaths, ruleText } from '../../bin/domain/process-rules.ts';

const data = { change: { kind: 'fix', title: 'Fix parser', tags: ['cli', 'docs'], empty: '' }, checks: { coverage: 92, tests: 'passed', ok: true }, nothing: null };
const evaluate = condition => evaluateRule(readRuleExpression(condition, 'rule'), data);

test('every comparison operator decides true and false against process data', () => {
  for (const [condition, expected] of [
    [{ path: 'change.kind', equals: 'fix' }, true], [{ path: 'change.kind', equals: 'feature' }, false],
    [{ path: 'checks.ok', equals: true }, true], [{ path: 'checks.coverage', equals: 92 }, true],
    [{ path: 'change.kind', notEquals: 'feature' }, true], [{ path: 'change.kind', notEquals: 'fix' }, false],
    [{ path: 'change.kind', in: ['fix', 'feature'] }, true], [{ path: 'change.kind', in: ['docs'] }, false],
    [{ path: 'change.kind', notIn: ['docs'] }, true], [{ path: 'change.kind', notIn: ['fix'] }, false],
    [{ path: 'change.tags', contains: 'cli' }, true], [{ path: 'change.tags', contains: 'ui' }, false],
    [{ path: 'change.title', contains: 'pars' }, true], [{ path: 'change.title', contains: 'xyz' }, false],
    [{ path: 'checks.coverage', gt: 91 }, true], [{ path: 'checks.coverage', gt: 92 }, false],
    [{ path: 'checks.coverage', gte: 92 }, true], [{ path: 'checks.coverage', gte: 93 }, false],
    [{ path: 'checks.coverage', lt: 93 }, true], [{ path: 'checks.coverage', lt: 92 }, false],
    [{ path: 'checks.coverage', lte: 92 }, true], [{ path: 'checks.coverage', lte: 91 }, false],
    [{ path: 'change.kind', present: true }, true], [{ path: 'missing.value', present: true }, false],
    [{ path: 'nothing', present: false }, true], [{ path: 'change.kind', present: false }, false],
    [{ path: 'change.title', matches: 'Fix *' }, true], [{ path: 'change.title', matches: 'Fix' }, false],
    [{ path: 'change.title', matches: '?ix?parser' }, true], [{ path: 'change.title', matches: '*parser*' }, true],
    [{ path: 'change.title', matches: '*x*z' }, false], [{ path: 'change.title', matches: '**Fix**' }, true],
    [{ path: 'change.tags', length: true, equals: 2 }, true], [{ path: 'change.tags', length: true, gte: 3 }, false],
    [{ path: 'change.empty', length: true, gte: 1 }, false], [{ path: 'change.title', length: true, lt: 20 }, true],
  ]) assert.equal(evaluate(condition), expected, JSON.stringify(condition));
});

test('three-valued logic: missing or mistyped data is unknown, and only decided parts settle all/any/not', () => {
  for (const [condition, expected] of [
    [{ path: 'missing.value', equals: 'x' }, null], [{ path: 'nothing', notEquals: 'x' }, null],
    [{ path: 'change.kind', gt: 1 }, null], [{ path: 'checks.coverage', matches: '9*' }, null],
    [{ path: 'checks.coverage', contains: 'x' }, null], [{ path: 'change.tags', in: ['cli'] }, null],
    [{ path: 'checks.coverage', length: true, gte: 1 }, null], [{ path: 'change.title', contains: 3 }, null],
    [{ not: { path: 'missing.value', equals: 'x' } }, null], [{ not: { path: 'change.kind', equals: 'fix' } }, false],
    [{ all: [{ path: 'change.kind', equals: 'fix' }, { path: 'missing.value', equals: 1 }] }, null],
    [{ all: [{ path: 'change.kind', equals: 'docs' }, { path: 'missing.value', equals: 1 }] }, false],
    [{ all: [{ path: 'change.kind', equals: 'fix' }, { path: 'checks.ok', equals: true }] }, true],
    [{ any: [{ path: 'change.kind', equals: 'fix' }, { path: 'missing.value', equals: 1 }] }, true],
    [{ any: [{ path: 'change.kind', equals: 'docs' }, { path: 'missing.value', equals: 1 }] }, null],
    [{ any: [{ path: 'change.kind', equals: 'docs' }, { path: 'checks.ok', equals: false }] }, false],
  ]) assert.equal(evaluate(condition), expected, JSON.stringify(condition));
  const nested = readRuleExpression({ all: [{ path: 'a.b', equals: 1 }, { not: { path: 'c', present: true } }, { any: [{ path: 'a.b', gt: 0 }] }] }, 'rule');
  assert.deepEqual(rulePaths(nested), ['a.b', 'c', 'a.b']);
  assert.deepEqual(missingRulePaths(nested, { a: { b: 1 } }), ['c']);
  assert.equal(evaluateRule(readRuleExpression({ path: 'long', matches: '*a' }, 'rule'), { long: 'x'.repeat(10001) }), null, 'oversized values are never matched');
  assert.equal(evaluateRule(readRuleExpression({ path: 'emoji', matches: '?' }, 'rule'), { emoji: '\u{1F600}' }), true, 'wildcards count characters, not UTF-16 units');
});

test('rule expressions fail closed on unknown keys, mixed operators, unsafe paths, bad operands and size limits', () => {
  const deep = depth => depth ? { not: deep(depth - 1) } : { path: 'a', present: true };
  for (const [condition, pattern] of [
    [{ path: 'a', equals: 1, notEquals: 2 }, /exactly one/], [{ path: 'a' }, /exactly one/], [{ path: 'a', run: 'x', equals: 1 }, /Unknown fields: run/],
    [{ path: '__proto__.polluted', equals: 1 }, /dotted path/], [{ path: 'constructor', present: true }, /dotted path/], [{ path: 'a..b', equals: 1 }, /dotted path/],
    [{ path: 'a', gt: '3' }, /needs a number/], [{ path: 'a', gte: Number.NaN }, /finite number/], [{ path: 'a', equals: { nested: 1 } }, /string, finite number or boolean/],
    [{ path: 'a', equals: 'bell\u0007' }, /string, finite number or boolean/], [{ path: 'a', in: [] }, /at least one value/], [{ path: 'a', in: 'x' }, /array/],
    [{ path: 'a', in: [{}] }, /string, finite number or boolean/], [{ path: 'a', present: 'yes' }, /present must be boolean/],
    [{ path: 'a', matches: '' }, /wildcard pattern/], [{ path: 'a', matches: 'x'.repeat(101) }, /wildcard pattern/], [{ path: 'a', matches: 'a\nb' }, /wildcard pattern/],
    [{ path: 'a', length: true, matches: 'x' }, /compares a count/], [{ path: 'a', length: true, in: [1] }, /compares a count/],
    [{ path: 'a', length: false, equals: 1 }, /must be true/], [{ path: 'a', length: true, equals: 'x' }, /needs a number/],
    [{ all: [] }, /at least one condition/], [{ any: [{ path: 'a', present: true }], all: [] }, /Unknown fields/], [{ not: [] }, /JSON object/],
    [deep(7), /nest at most/], [{ any: Array.from({ length: 21 }, () => ({ path: 'a', present: true })) }, /at most 20/],
    [{ all: Array.from({ length: 20 }, () => ({ all: [{ path: 'a', present: true }, { path: 'b', present: true }] })) }, /60 nodes/],
  ]) assert.throws(() => readRuleExpression(condition, 'rule'), pattern, JSON.stringify(condition).slice(0, 120));
});

test('authored clause lines parse to comparisons, render back as text and flatten only one combinator level', () => {
  assert.deepEqual(readRuleClause('review.decision equals "approve"'), { path: 'review.decision', equals: 'approve' });
  assert.deepEqual(readRuleClause('review.decision equals approve'), { path: 'review.decision', equals: 'approve' });
  assert.deepEqual(readRuleClause('checks.coverage gte 90'), { path: 'checks.coverage', gte: 90 });
  assert.deepEqual(readRuleClause('change.kind in feature, fix'), { path: 'change.kind', in: ['feature', 'fix'] });
  assert.deepEqual(readRuleClause('change.kind notIn ["docs"]'), { path: 'change.kind', notIn: ['docs'] });
  assert.deepEqual(readRuleClause('notes missing'), { path: 'notes', present: false });
  assert.deepEqual(readRuleClause('  notes present '), { path: 'notes', present: true });
  assert.deepEqual(readRuleClause('checks.failed length lte 0'), { path: 'checks.failed', length: true, lte: 0 });
  for (const [line, pattern] of [['', /path operator value/], ['notes present now', /take no value/], ['notes length present', /take no value/],
    ['a resembles 1', /use one of/], ['a equals', /use one of/], ['__proto__ equals 1', /dotted path/], ['a gt "x"', /needs a number/]])
    assert.throws(() => readRuleClause(line), pattern, line);
  const expression = readRuleExpression({ all: [{ path: 'a', equals: 'x' }, { not: { path: 'b', in: [1, 2] } }, { any: [{ path: 'c', present: false }, { path: 'd', length: true, gt: 1 }] }] }, 'rule');
  assert.equal(ruleText(expression), 'all(a equals "x", not(b in [1,2]), any(c missing, d length gt 1))');
  assert.deepEqual(ruleClauses(undefined), { combine: 'all', lines: [] });
  assert.deepEqual(ruleClauses({ path: 'a', equals: 1 }), { combine: 'all', lines: ['a equals 1'] });
  assert.deepEqual(ruleClauses({ any: [{ path: 'a', equals: 1 }, { path: 'b', present: true }] }), { combine: 'any', lines: ['a equals 1', 'b present'] });
  assert.equal(ruleClauses(expression), undefined);
  assert.equal(ruleClauses({ not: { path: 'a', present: true } }), undefined);
  for (const line of ['a equals "x"', 'd length gt 1', 'c missing', 'b in [1,2]']) assert.equal(ruleText(readRuleClause(line)), line);
});
