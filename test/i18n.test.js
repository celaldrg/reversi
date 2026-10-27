import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LANGUAGES, STRINGS, pickLanguage, translate } from '../src/i18n.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('English and Turkish define the same non-empty strings', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  const english = Object.keys(STRINGS.en).sort();
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), english);
  for (const lang of LANGUAGES) {
    for (const key of english) {
      assert.equal(typeof STRINGS[lang][key], 'string', `${lang}.${key}`);
      assert.ok(STRINGS[lang][key].trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('both languages use the same placeholders in every string', () => {
  for (const key of Object.keys(STRINGS.en)) {
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(STRINGS.en[key]), key);
  }
});

test('the language button names the language it switches to', () => {
  assert.equal(translate('en', 'langButton'), 'TR');
  assert.equal(translate('tr', 'langButton'), 'EN');
});

test('translate fills placeholders, including nested messages', () => {
  assert.equal(translate('en', 'cellEmpty', { square: 'd3' }), 'd3, empty');
  assert.equal(translate('tr', 'cellBlackLast', { square: 'h8' }), 'h8, siyah, son hamle');
  const level = { key: 'levelHard' };
  assert.equal(translate('en', 'infoComputer', { level }), 'Against the computer · Hard');
  assert.equal(translate('tr', 'infoComputer', { level }), 'Bilgisayara karşı · Zor');
  assert.equal(translate('en', 'resultYouWin', { score: 40 }), 'You win 40!');
});

test('translate falls back safely', () => {
  assert.equal(translate('de', 'undo'), 'Undo', 'unknown language → English');
  assert.equal(translate('tr', 'noSuchKey'), 'noSuchKey', 'unknown key comes back as is');
  assert.equal(translate('en', 'cellWhite'), '{square}, white', 'a missing parameter stays visible');
  assert.equal(translate('en', 'cellWhite', { square: 0 }), '0, white');
});

test('pickLanguage accepts only supported languages', () => {
  assert.equal(pickLanguage('tr'), 'tr');
  assert.equal(pickLanguage('en'), 'en');
  for (const value of [null, undefined, 'TR', 'de', 42, {}]) assert.equal(pickLanguage(value), 'en');
});

test('every key the page and the scripts use exists', () => {
  const html = read('../index.html');
  const used = new Set([...html.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)].map((match) => match[1]));
  assert.ok(used.size > 20, 'index.html has translated elements');
  for (const file of readdirSync(new URL('../src/', import.meta.url)).filter((name) => name.endsWith('.js'))) {
    const source = read(`../src/${file}`);
    for (const match of source.matchAll(/\bt\('(\w+)'/g)) used.add(match[1]);
    for (const match of source.matchAll(/\bkey: (?:[^,}]*\?\s*)?'(\w+)'(?:\s*:\s*'(\w+)')?/g)) {
      used.add(match[1]);
      if (match[2]) used.add(match[2]);
    }
    for (const match of source.matchAll(/:\s*'(level\w+|cell\w+|result\w+|toast\w+|pass\w+)'/g)) used.add(match[1]);
  }
  for (const key of used) {
    assert.ok(Object.hasOwn(STRINGS.en, key), `missing string: ${key}`);
  }
});

test('the page has no untranslated fallback text left in a different language', () => {
  const html = read('../index.html');
  for (const match of html.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)) {
    const [, key, text] = match;
    if (text.trim()) assert.equal(text.trim(), STRINGS.en[key].trim(), `index.html text for ${key}`);
  }
});
