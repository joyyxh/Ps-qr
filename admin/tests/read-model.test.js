import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUDIT_ACTION_LABELS,
  KIND_LABELS,
  STATE_LABELS,
  auditRows,
  coverageLabel,
  formatIst,
  licenceFacts,
} from '../src/read-model.js';

const MIGRATION_0011 = readFileSync(new URL('../../supabase/migrations/0015_licence_foundation.sql', import.meta.url), 'utf8');
const SHOP = { shop_id: '8f14e45f-ceea-4b7a-9c1d-2a3b4c5d6e7f', slug: 'sunrise-print', name: 'Sunrise Print' };

function listFromCheck(pattern) {
  const match = MIGRATION_0011.match(pattern);
  assert.ok(match, `pattern not found in 0015: ${pattern}`);
  return match[1].split(',').map((item) => item.trim().replace(/'/g, '')).sort();
}

// ---------- labels ----------

test('the labels cover exactly the values the database allows', () => {
  assert.deepEqual(
    Object.keys(AUDIT_ACTION_LABELS).sort(),
    listFromCheck(/licence_audit_log_action check \(\s*action in \(([^)]*)\)/),
  );
  assert.deepEqual(Object.keys(KIND_LABELS).sort(), listFromCheck(/licence_coverages_kind check \(kind in \(([^)]*)\)/));
  assert.deepEqual(Object.keys(STATE_LABELS).sort(), ['ACTIVE', 'EXPIRED', 'NONE', 'REVOKED', 'SCHEDULED']);
});

// ---------- times ----------

test('times are shown in India Standard Time, not UTC', () => {
  // 2026-11-08 23:30 UTC is 9 November 05:00 in India. A UTC display would say 8 November.
  const text = formatIst('2026-11-08T23:30:00Z');
  assert.match(text, /IST$/);
  assert.match(text, /\b9\b/);
  assert.match(text, /2026/);
});

test('an empty time reads None and an unreadable time is named as such', () => {
  assert.equal(formatIst(null), 'None');
  assert.equal(formatIst(''), 'None');
  assert.equal(formatIst('not a date'), 'Time not readable');
});

// ---------- licence view ----------

test('an active licence shows its access end, with no next start', () => {
  const rows = licenceFacts({
    shop: SHOP,
    state_version: 3,
    state: { state: 'ACTIVE', basis: 'admin_grant', access_until: '2026-12-01T00:00:00+05:30', next_start: null },
    coverages: [],
    coverages_truncated: false,
  });
  const labels = rows.map(([label]) => label);
  assert.deepEqual(labels, ['Shop', 'State', 'Access ends', 'State version']);
  assert.deepEqual(rows[0], ['Shop', 'Sunrise Print (sunrise-print)']);
  assert.equal(rows[1][1], 'Active');
  assert.equal(rows[3][1], '3');
});

test('a scheduled licence shows its next start', () => {
  const rows = licenceFacts({
    shop: SHOP,
    state_version: 1,
    state: { state: 'SCHEDULED', basis: null, access_until: null, next_start: '2026-12-01T00:00:00+05:30' },
    coverages: [],
    coverages_truncated: false,
  });
  const labels = rows.map(([label]) => label);
  assert.equal(labels.includes('Next start'), true);
  assert.equal(labels.includes('Access ends'), false);
});

test('a shop with no licence shows the no-licence state and no dates', () => {
  const rows = licenceFacts({
    shop: SHOP,
    state_version: 0,
    state: { state: 'NONE', basis: null, access_until: null, next_start: null },
    coverages: [],
    coverages_truncated: false,
  });
  assert.deepEqual(rows.map(([label]) => label), ['Shop', 'State', 'State version']);
  assert.equal(rows[1][1], 'No licence');
});

test('an unexpected state is shown as Unknown rather than echoed', () => {
  const rows = licenceFacts({
    shop: SHOP,
    state_version: 2,
    state: { state: '<img src=x>', basis: null, access_until: null, next_start: null },
    coverages: [],
    coverages_truncated: false,
  });
  assert.equal(rows[1][1], 'Unknown');
});

// ---------- coverages ----------

test('a coverage label names its kind, its status and its period, and an open end reads no end', () => {
  const current = coverageLabel({
    kind: 'admin_grant', status: 'current', starts_at: '2026-11-01T00:00:00+05:30', ends_at: '2026-12-01T00:00:00+05:30',
  });
  assert.match(current, /^Admin grant, current: .* to .*IST$/);

  const lifetime = coverageLabel({
    kind: 'lifetime_grant', status: 'scheduled', starts_at: '2026-12-01T00:00:00+05:30', ends_at: null,
  });
  assert.match(lifetime, /^Lifetime grant, scheduled: /);
  assert.match(lifetime, /to no end$/);
});

// ---------- audit ----------

test('an audit entry shows its action, reason and coverage, and a missing coverage reads None', () => {
  const rows = auditRows({
    entry_id: '5e1c2d3a-0000-4000-8000-000000000001',
    created_at: '2026-11-08T10:00:00+05:30',
    action: 'revoke',
    coverage_id: null,
    reason: 'Refund agreed',
    licence_start: null,
    licence_end: null,
    actor_user_id: '11111111-2222-4333-8444-555555555555',
    before_state: {},
    after_state: {},
  });
  const byLabel = Object.fromEntries(rows);
  assert.equal(byLabel.Action, 'Revocation');
  assert.equal(byLabel.Reason, 'Refund agreed');
  assert.equal(byLabel['Coverage ID'], 'None');
  assert.equal(byLabel['Licence start'], 'None');
  // N5 (open): the recording admin's ID is not displayed. The data is kept; the view omits it.
  assert.equal('Recorded by' in byLabel, false, 'the recording admin must not be shown (N5)');
  assert.equal(JSON.stringify(rows).includes('11111111-2222-4333-8444-555555555555'), false);
});

test('an unknown audit action is shown as Unknown', () => {
  const rows = auditRows({
    entry_id: '5e1c2d3a-0000-4000-8000-000000000002',
    created_at: '2026-11-08T10:00:00+05:30',
    action: 'delete',
    coverage_id: null,
    reason: 'x',
    licence_start: null,
    licence_end: null,
    actor_user_id: '11111111-2222-4333-8444-555555555555',
  });
  assert.equal(Object.fromEntries(rows).Action, 'Unknown');
});
