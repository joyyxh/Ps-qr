// The code screen remembers the address of a registration that is waiting for its code,
// across a reload. The password is never part of what is stored. Storage can be blocked,
// throw, or hold damaged data, and none of that may break the screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPendingSignupStore, PENDING_SIGNUP_KEY } from '../src/pending-signup.js';

const NOW = 1_000_000_000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('the address and the last send time survive a reload, and the password is never stored', () => {
  const storage = memoryStorage();
  createPendingSignupStore(storage).save('owner@example.com', NOW);
  // A new store on the same storage, as after a page reload.
  const restored = createPendingSignupStore(storage).load(NOW + 5_000);
  assert.deepEqual(restored, { email: 'owner@example.com', sentAtMs: NOW });
  assert.equal(storage.getItem(PENDING_SIGNUP_KEY).includes('password'), false);
});

test('with nothing saved, load returns null', () => {
  assert.equal(createPendingSignupStore(memoryStorage()).load(NOW), null);
});

test('clear removes the record, so nothing is restored after a finished or abandoned registration', () => {
  const storage = memoryStorage();
  const store = createPendingSignupStore(storage);
  store.save('owner@example.com', NOW);
  store.clear();
  assert.equal(store.load(NOW), null);
  assert.equal(storage.getItem(PENDING_SIGNUP_KEY), null);
});

test('a record older than two hours is dropped, because its code has lapsed', () => {
  const storage = memoryStorage();
  const store = createPendingSignupStore(storage);
  store.save('owner@example.com', NOW);
  assert.deepEqual(store.load(NOW + TWO_HOURS_MS), { email: 'owner@example.com', sentAtMs: NOW });
  assert.equal(store.load(NOW + TWO_HOURS_MS + 1), null);
  assert.equal(storage.getItem(PENDING_SIGNUP_KEY), null);
});

test('damaged or incomplete records are ignored and removed', () => {
  for (const bad of ['not json', 'null', '[]', '{"email":"","sentAtMs":1}', '{"email":"a@b.co"}', '{"email":5,"sentAtMs":1}']) {
    const storage = memoryStorage();
    storage.setItem(PENDING_SIGNUP_KEY, bad);
    assert.equal(createPendingSignupStore(storage).load(NOW), null, `record ${bad}`);
    assert.equal(storage.getItem(PENDING_SIGNUP_KEY), null, `record ${bad} is removed`);
  }
});

test('blocked or throwing storage never breaks the code screen', () => {
  const broken = {
    getItem() {
      throw new Error('storage blocked');
    },
    setItem() {
      throw new Error('storage blocked');
    },
    removeItem() {
      throw new Error('storage blocked');
    },
  };
  const store = createPendingSignupStore(broken);
  assert.doesNotThrow(() => store.save('owner@example.com', NOW));
  assert.equal(store.load(NOW), null);
  assert.doesNotThrow(() => store.clear());
  assert.equal(createPendingSignupStore(undefined).load(NOW), null);
});
