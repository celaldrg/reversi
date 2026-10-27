import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/storage.js';

/** A Storage-like backend over a Map, like localStorage. */
function memoryBackend() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

test('values round-trip as JSON under the reversi: prefix', () => {
  const backend = memoryBackend();
  const storage = createStorage(() => backend);
  assert.equal(storage.set('settings', { mode: 'pvp', humanColor: -1 }), true);
  assert.equal(storage.set('hints', false), true);
  assert.deepEqual(storage.get('settings'), { mode: 'pvp', humanColor: -1 });
  assert.equal(storage.get('hints', true), false, 'a stored false is not replaced by the fallback');
  assert.deepEqual([...backend.items.keys()], ['reversi:settings', 'reversi:hints']);
});

test('missing or corrupt values give the fallback', () => {
  const backend = memoryBackend();
  const storage = createStorage(() => backend);
  assert.equal(storage.get('lang'), null);
  assert.equal(storage.get('lang', 'en'), 'en');
  backend.items.set('reversi:lang', '{not json');
  assert.equal(storage.get('lang', 'en'), 'en');
});

test('a failing backend never throws (private mode, full quota, blocked storage)', () => {
  const failing = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  const storage = createStorage(() => failing);
  assert.equal(storage.get('lang', 'en'), 'en');
  assert.equal(storage.set('lang', 'tr'), false);

  const blocked = createStorage(() => {
    throw new Error('access denied');
  });
  assert.equal(blocked.get('hints', true), true);
  assert.equal(blocked.set('hints', false), false);
});

test('no backend at all (as in Node) is handled', () => {
  const storage = createStorage(() => undefined);
  assert.equal(storage.get('settings', 'none'), 'none');
  assert.equal(storage.set('settings', {}), false);
});

test('the shared helper only looks up localStorage when used', async () => {
  let lookups = 0;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      lookups += 1;
      throw new Error('blocked');
    },
  });
  try {
    const { storage } = await import('../src/storage.js?lazy');
    assert.equal(lookups, 0, 'importing does not touch localStorage');
    assert.equal(storage.get('lang', 'en'), 'en');
    assert.equal(storage.set('lang', 'tr'), false);
    assert.equal(lookups, 2);
  } finally {
    delete globalThis.localStorage;
  }
});
