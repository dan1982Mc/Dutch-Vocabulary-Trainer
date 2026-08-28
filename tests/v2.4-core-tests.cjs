#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const files = [
  'js/exercises/index.js',
  'js/mastery.js',
  'js/practice.js'
];

const context = vm.createContext({
  console,
  Date,
  Math,
  JSON,
  Set,
  Map,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Promise,
  Intl,
  window: {}
});
context.window.window = context.window;
context.window.DutchTrainer = {};

for (const file of files) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const DutchTrainer = context.window.DutchTrainer;
const word = {
  id: 'test-word',
  dutch: 'omringen',
  english: 'to surround; encircle',
  level: 'B2',
  forms: { past: 'omringde', participle: 'omringd' },
  examples: ['De mensen omringen het huis.']
};
const second = {
  id: 'second-word',
  dutch: 'verwaand',
  english: 'conceited; arrogant; self-important',
  level: 'B2',
  examples: ['Hij is erg verwaand.']
};

assert.deepEqual(DutchTrainer.exercises.list().sort(), ['choose', 'fill', 'meaning', 'production', 'recall']);

const meaning = DutchTrainer.exercises.create(second, 'meaning', [word, second, { id: '3', dutch: 'wederzijds', english: 'mutual' }, { id: '4', dutch: 'afkeer', english: 'aversion' }]);
assert.equal(meaning.context, second.english);
assert.equal(meaning.options.length, 4);
assert.equal(DutchTrainer.exercises.get('meaning').check(meaning, second.dutch).correct, true);

const recall = DutchTrainer.exercises.create(second, 'recall');
assert.equal(DutchTrainer.exercises.get('recall').check({ ...recall, correctAnswer: 'to surround; encircle' }, 'to surround').correct, true);

const fill = DutchTrainer.exercises.create(word, 'fill');
assert.match(fill.context, /_____/);
assert.equal(DutchTrainer.exercises.get('fill').check(fill, 'omringen').correct, true);
assert.equal(DutchTrainer.exercises.get('fill').check(fill, 'omringd').correct, true);

const choose = DutchTrainer.exercises.create(word, 'choose', [word, second, { id: '3', dutch: 'wederzijds' }, { id: '4', dutch: 'afkeer' }]);
assert.match(choose.context, /_____/);
assert.equal(choose.options.length, 4);

const production = DutchTrainer.exercises.create(second, 'production');
assert.equal(production.context, second.dutch);

let savedWord;
const db = {
  async saveWord(value) { savedWord = JSON.parse(JSON.stringify(value)); },
  async getWords() { return []; }
};
DutchTrainer.db = db;

(async () => {
  const first = await DutchTrainer.mastery.recordAnswer({ id: 'mastery-word', dutch: 'test', english: 'test', mastery: 50 }, { correct: false, almost: false, userAnswer: 'wrong', expectedAnswer: 'test', exerciseType: 'recall' }, { type: 'recall', correctAnswer: 'test' });
  assert.equal(first.masteryAfter, 50);
  assert.equal(first.outcome, 'incorrect');

  const almost = await DutchTrainer.mastery.recordAnswer({ id: 'mastery-word-2', dutch: 'surround', english: 'to surround' }, { correct: false, almost: true, userAnswer: 'suround', expectedAnswer: 'to surround', exerciseType: 'recall' }, { type: 'recall', correctAnswer: 'to surround' });
  assert.equal(almost.outcome, 'almost');
  assert.equal(almost.masteryAfter, 4);

  const practice = await DutchTrainer.practice.start({ vocabulary: [word], exerciseType: 'fill', questionCount: 1 });
  assert.equal(practice.success, true);
  assert.equal(practice.question.type, 'fill');
  const answer = await DutchTrainer.practice.answer('omringen');
  assert.equal(answer.correct, true);
  const finished = await DutchTrainer.practice.next();
  assert.equal(finished.completed, true);

  console.log('V2.4 core tests: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
