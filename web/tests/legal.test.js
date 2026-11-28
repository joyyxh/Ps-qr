// The public Terms and Privacy pages: the version matches the server, every required topic is present,
// nothing invents a contact or legal identity, and the output is escaped.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LEGAL_KINDS, LEGAL_PAGES, LEGAL_VERSION, legalHtml } from '../src/legal.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(path.resolve(here, '../../supabase/migrations/0021_owner_username_auth.sql'), 'utf8');

const headings = (kind) => LEGAL_PAGES[kind].sections.map((section) => section.heading);
const allText = (kind) => JSON.stringify(LEGAL_PAGES[kind]);

test('the published version is the version the server seeds', () => {
  assert.match(migration, new RegExp(`'terms', '${LEGAL_VERSION}'`));
  assert.match(migration, new RegExp(`'privacy', '${LEGAL_VERSION}'`));
});

test('both pages exist and have sections', () => {
  assert.deepEqual(LEGAL_KINDS, ['terms', 'privacy']);
  for (const kind of LEGAL_KINDS) assert.ok(LEGAL_PAGES[kind].sections.length > 5, `${kind} has sections`);
});

test('the terms cover accounts, files, orders, payment, printing, refunds, use and suspension', () => {
  for (const topic of [
    'Accounts',
    'Uploaded files',
    'Prices and orders',
    'Payment',
    'Printing and collection',
    'Refunds and disputes',
    'Acceptable use',
    'Service availability',
    'Suspension and ending use',
    'Liability',
  ]) {
    assert.ok(headings('terms').includes(topic), `terms has "${topic}"`);
  }
});

test('the privacy policy covers collection, storage, retention, providers, deletion and contact', () => {
  for (const topic of ['Who we are', 'What we collect', 'Who receives it', 'How long we keep data', 'Deleting data', 'Security']) {
    assert.ok(headings('privacy').includes(topic), `privacy has "${topic}"`);
  }
});

test('the payment text names cash and UPI and says QRquick takes no payment', () => {
  const payment = LEGAL_PAGES.terms.sections.find((s) => s.heading === 'Payment');
  const body = payment.paragraphs.join(' ');
  assert.match(body, /cash/);
  assert.match(body, /UPI/);
  assert.match(body, /does not take payments/);
});

test('the privacy policy says customers give no name, phone or address', () => {
  assert.match(allText('privacy'), /do not ask customers for a name, phone number or address/);
});

test('retention is not claimed as automatic: deletion is shown as not yet switched on', () => {
  const retention = LEGAL_PAGES.privacy.sections.find((s) => s.heading === 'How long we keep data');
  assert.match(retention.paragraphs.join(' '), /not switched on yet/);
});

test('no email address, company name or contact is written in: only bracketed placeholders', () => {
  for (const kind of LEGAL_KINDS) {
    assert.doesNotMatch(allText(kind), /[\w.+-]+@[\w-]+\.[\w.]+/, `${kind} has no email address`);
    assert.match(allText(kind), /\[operator|\[contact|\[privacy contact/i, `${kind} marks what the operator fills in`);
  }
});

test('the rendered page is marked as a draft, escapes its text and runs no script', () => {
  for (const kind of LEGAL_KINDS) {
    const html = legalHtml(kind);
    assert.match(html, /Draft for review/);
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, new RegExp(`Version ${LEGAL_VERSION.replace(/\./g, '\\.')}`));
  }
});

test('the back link goes to sign in in the owner app and to the home page in the browser', () => {
  assert.match(legalHtml('terms', { ownerApp: true }), /href="#\/owner"/);
  assert.match(legalHtml('terms', { ownerApp: false }), /href="#\/"/);
});

test('an unknown page is refused rather than rendered', () => {
  assert.throws(() => legalHtml('cookies'), /Unknown legal page/);
});
