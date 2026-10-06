import assert from 'node:assert/strict';
import { handoutSections as relocated } from '../../src/cli/adapters/framework/handout-questions.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

test('relocated handout question catalog preserves compatibility identity and stable structure', () => {
  assert.equal(relocated.length, 20);
  const questions = relocated.flatMap(section => section.questions);
  assert.equal(questions.length, 69);
  assert.equal(new Set(questions.map(question => question.id)).size, questions.length);
  assert.ok(questions.every(question => question.id && question.question && question.hint));
  assert.ok(relocated.every(section => section.title && section.description && section.questions.length > 0));
});

test('relocated handout catalog retains required and optional review items', () => {
  const questions = relocated.flatMap(section => section.questions);
  assert.equal(questions.filter(question => question.required).length, 49);
  assert.equal(questions.filter(question => !question.required).length, 20);
  assert.ok(questions.every(question => typeof question.default === 'string'));
});
