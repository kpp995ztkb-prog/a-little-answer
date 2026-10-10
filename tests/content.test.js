import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answers, chooseAnswer } from '../src/answers.js';
import { normalizeNickname } from '../src/nickname.js';

test('60 distinct short answers are available', () => {
  assert.equal(answers.length, 60); assert.equal(new Set(answers).size, 60);
  assert.ok(answers.every(a => a.length <= 32 && a.split('\n').length <= 2));
});
test('selection excludes the previous answer even at random boundaries', () => {
  for (const previous of answers) for (const random of [() => 0, () => 0.999999]) {
    const selected = chooseAnswer(previous, random);
    assert.notEqual(selected, previous); assert.ok(answers.includes(selected));
  }
});
test('nickname trims whitespace and counts Unicode characters', () => {
  assert.equal(normalizeNickname('  小鹿  '), '小鹿');
  assert.equal(normalizeNickname('   '), '');
  assert.equal(Array.from(normalizeNickname('🐰'.repeat(15))).length, 12);
  assert.equal(normalizeNickname('ABCDEFGHIJKLM'), 'ABCDEFGHIJKL');
});
