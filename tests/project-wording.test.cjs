const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const context = { window: {} };
vm.runInNewContext(readFileSync(path.join(__dirname, '../project-wording.js'), 'utf8'), context);
const wording = context.window.TotoWrapProjectWording;

test('confirmed names remain compatible with backups without gender', () => {
  assert.equal(wording.singular('Luigi', [{ name: 'Luigi' }]), 'bamboccione');
  assert.equal(wording.singular(' Annika '), 'bambocciona');
  assert.equal(wording.singular('New Player'), 'player');
});

test('stored choices take precedence and survive JSON round trips and renaming', () => {
  const roster = JSON.parse(JSON.stringify([{ name: 'Luigi', gender: 'f' }]));
  assert.equal(wording.singular('luigi', roster), 'bambocciona');
  roster[0].name = 'New Name';
  assert.equal(wording.singular('New Name', roster), 'bambocciona');
  roster[0].gender = 'm';
  assert.equal(wording.singular('New Name', roster), 'bamboccione');
  assert.equal(wording.singular('Luigi', [{ name: 'Luigi', gender: '' }]), 'player');
  assert.equal(wording.singular('Luigi', [{ name: 'Luigi', gender: 'invalid' }]), 'player');
});

test('plural wording is reserved for distinct groups', () => {
  const roster = [{ name: 'New Name', gender: 'f' }];
  assert.equal(wording.forNames(['New Name', ' new name '], roster), 'bambocciona');
  assert.equal(wording.forNames(['Annika', 'Elisa']), 'bamboccioni');
  assert.equal(wording.forNames([], roster), 'players');
});
