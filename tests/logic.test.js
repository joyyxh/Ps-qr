import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
  buildItem,
  checkUploadFile,
  colourAvailable,
  escapeHtml,
  fileAlreadyInOrder,
  formatPaise,
  statusLabel,
  unitLabel,
} from '../src/logic.js';

test('formatPaise shows rupees with two decimals', () => {
  assert.equal(formatPaise(4800), '₹48.00');
  assert.equal(formatPaise(200), '₹2.00');
  assert.equal(formatPaise(0), '₹0.00');
});

test('formatPaise rejects fractional paise', () => {
  assert.throws(() => formatPaise(12.5), TypeError);
});

test('unitLabel and statusLabel fall back safely for unknown values', () => {
  assert.equal(unitLabel('per_sheet'), 'per sheet');
  assert.equal(unitLabel('mystery'), 'per unit');
  assert.equal(statusLabel('ready'), 'Ready for collection');
  assert.equal(statusLabel('whatever'), 'Unknown status');
});

test('escapeHtml neutralises markup in shop-provided text', () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('hi')">&`),
    '&lt;img src=x onerror=&quot;alert(&#39;hi&#39;)&quot;&gt;&amp;'
  );
  assert.equal(escapeHtml(null), '');
});

test('buildItem returns the file and the customer choices, never prices', () => {
  const item = buildItem({
    serviceId: 'svc-1',
    file: { file_id: 'file-1', original_name: 'notes.pdf', page_count: 12 },
    copies: '2',
    colour: true,
    duplex: false,
  });
  assert.deepEqual(item, {
    service_id: 'svc-1',
    file_id: 'file-1',
    file_name: 'notes.pdf',
    page_count: 12,
    copies: 2,
    colour: true,
    duplex: false,
  });
  for (const key of Object.keys(item)) {
    assert.doesNotMatch(key, /price|amount|total/i);
  }
});

test('buildItem rejects a missing service, a missing upload and bad copies', () => {
  const file = { file_id: 'file-1', original_name: 'a.pdf', page_count: 1 };
  assert.throws(() => buildItem({ serviceId: '', file, copies: 1 }), /Choose a service/);
  assert.throws(() => buildItem({ serviceId: 's', file: null, copies: 1 }), /Upload a file/);
  assert.throws(() => buildItem({ serviceId: 's', file: { original_name: 'x' }, copies: 1 }), /Upload a file/);
  assert.throws(() => buildItem({ serviceId: 's', file, copies: 0 }), /Copies/);
  assert.throws(() => buildItem({ serviceId: 's', file, copies: 101 }), /Copies/);
  assert.throws(() => buildItem({ serviceId: 's', file, copies: 'abc' }), /Copies/);
});

test('checkUploadFile accepts PDF, JPEG and PNG and explains anything else', () => {
  const make = (name, type, size = 1024) => ({ name, type, size });
  assert.equal(checkUploadFile(make('a.pdf', 'application/pdf')), null);
  assert.equal(checkUploadFile(make('a.jpg', 'image/jpeg')), null);
  assert.equal(checkUploadFile(make('a.png', 'image/png')), null);
  assert.equal(checkUploadFile(make('scan.pdf', '', 100)), null, 'no type reported: the extension decides');
  assert.match(
    checkUploadFile(make('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
    /PDF, JPEG or PNG/
  );
  assert.match(checkUploadFile(make('a.zip', '')), /PDF, JPEG or PNG/);
  assert.match(checkUploadFile(make('a.pdf', 'application/pdf', 0)), /empty/);
  assert.match(checkUploadFile(make('a.pdf', 'application/pdf', UPLOAD_MAX_BYTES + 1)), /larger than 10 MB/);
  assert.equal(checkUploadFile(make('a.pdf', 'application/pdf', UPLOAD_MAX_BYTES)), null);
  assert.match(checkUploadFile(null), /Choose a file/);
});

test('the file picker offers exactly the three accepted types', () => {
  for (const type of ['application/pdf', 'image/jpeg', 'image/png']) {
    assert.ok(UPLOAD_ACCEPT.includes(type), type);
  }
});

test('fileAlreadyInOrder spots a file that is already a cart line', () => {
  const cart = [{ file_id: 'file-1' }, { file_id: 'file-2' }];
  assert.equal(fileAlreadyInOrder(cart, 'file-1'), true);
  assert.equal(fileAlreadyInOrder(cart, 'file-3'), false);
  assert.equal(fileAlreadyInOrder([], 'file-1'), false);
});

test('colourAvailable reads the nullable colour price', () => {
  assert.equal(colourAvailable({ colour_price_paise: 1000 }), true);
  assert.equal(colourAvailable({ colour_price_paise: null }), false);
});
