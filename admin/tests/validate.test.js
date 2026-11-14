import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REASON_MAX_CHARS,
  isUuid,
  normaliseInstant,
  normaliseReason,
  parseStateVersion,
} from '../src/validate.js';

test('isUuid accepts the canonical form only', () => {
  assert.equal(isUuid('8f14e45f-ceea-4b7a-9c1d-2a3b4c5d6e7f'), true);
  assert.equal(isUuid('8F14E45F-CEEA-4B7A-9C1D-2A3B4C5D6E7F'), true);
  assert.equal(isUuid('8f14e45fceea4b7a9c1d2a3b4c5d6e7f'), false);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid(null), false);
  assert.equal(isUuid(42), false);
});

test('parseStateVersion accepts whole numbers from 0 and rejects anything else', () => {
  assert.deepEqual(parseStateVersion('0'), { ok: true, value: 0 });
  assert.deepEqual(parseStateVersion(' 17 '), { ok: true, value: 17 });
  assert.equal(parseStateVersion('-1').ok, false);
  assert.equal(parseStateVersion('1.5').ok, false);
  assert.equal(parseStateVersion('01').ok, false);
  assert.equal(parseStateVersion('').ok, false);
  assert.equal(parseStateVersion('1234567890123456789').ok, false);
});

test('normaliseReason trims, requires one character and caps the length in characters', () => {
  assert.deepEqual(normaliseReason('  paid by cheque  '), { ok: true, value: 'paid by cheque' });
  assert.equal(normaliseReason('   ').ok, false);
  assert.equal(normaliseReason('').ok, false);
  assert.equal(normaliseReason('a'.repeat(REASON_MAX_CHARS)).ok, true);
  assert.equal(normaliseReason('a'.repeat(REASON_MAX_CHARS + 1)).ok, false);
  // Multi-byte characters count once each.
  assert.equal(normaliseReason('ष'.repeat(REASON_MAX_CHARS)).ok, true);
});

test('normaliseInstant treats empty as null and accepts dates or zoned timestamps only', () => {
  assert.deepEqual(normaliseInstant(''), { ok: true, value: null });
  assert.deepEqual(normaliseInstant('  '), { ok: true, value: null });
  assert.deepEqual(normaliseInstant('2026-11-08'), { ok: true, value: '2026-11-08' });
  assert.deepEqual(normaliseInstant('2026-11-08T10:00:00+05:30'), { ok: true, value: '2026-11-08T10:00:00+05:30' });
  assert.deepEqual(normaliseInstant('2026-11-08T04:30:00Z'), { ok: true, value: '2026-11-08T04:30:00Z' });
  assert.equal(normaliseInstant('8 Nov 2026').ok, false);
  assert.equal(normaliseInstant('2026-11-08T10:00:00').ok, false); // no zone
});
