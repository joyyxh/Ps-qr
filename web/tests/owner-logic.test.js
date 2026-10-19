import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paiseToRupeesInput,
  rupeesToPaise,
  validateService,
  validateShopDetails,
  validateSlug,
} from '../src/logic.js';

test('validateSlug accepts simple web addresses and lowercases them', () => {
  assert.equal(validateSlug('demo-xerox'), 'demo-xerox');
  assert.equal(validateSlug('  Ranchi-Print-2 '), 'ranchi-print-2');
  assert.equal(validateSlug('abc'), 'abc');
  assert.equal(validateSlug('a'.repeat(40)), 'a'.repeat(40));
});

test('validateSlug rejects bad formats and reserved words', () => {
  for (const bad of ['ab', 'a'.repeat(41), '-shop', 'shop-', 'my shop', 'my_shop', 'a..b', '']) {
    assert.throws(() => validateSlug(bad), /must be 3 to 40/, `should reject "${bad}"`);
  }
  for (const reserved of ['admin', 'api', 'support']) {
    assert.throws(() => validateSlug(reserved), /reserved/, `should reject "${reserved}"`);
  }
});

test('validateShopDetails trims values and turns blanks into null', () => {
  assert.deepEqual(validateShopDetails({ name: '  Print Hub  ', phone: ' ', address: '' }), {
    name: 'Print Hub',
    phone: null,
    address: null,
  });
  assert.deepEqual(
    validateShopDetails({ name: 'Print Hub', phone: '+91 98765-43210', address: 'Main Road' }),
    { name: 'Print Hub', phone: '+91 98765-43210', address: 'Main Road' }
  );
});

test('validateShopDetails rejects bad names, phone numbers and long addresses', () => {
  assert.throws(() => validateShopDetails({ name: 'A' }), /2 to 120/);
  assert.throws(() => validateShopDetails({ name: 'x'.repeat(121) }), /2 to 120/);
  assert.throws(() => validateShopDetails({ name: 'Print Hub', phone: '12345' }), /phone number/);
  assert.throws(() => validateShopDetails({ name: 'Print Hub', phone: '98765<script>' }), /phone number/);
  assert.throws(() => validateShopDetails({ name: 'Print Hub', address: 'x'.repeat(201) }), /200/);
});

test('rupeesToPaise converts typed rupees to whole paise without float errors', () => {
  assert.equal(rupeesToPaise(''), null);
  assert.equal(rupeesToPaise('   '), null);
  assert.equal(rupeesToPaise('0'), 0);
  assert.equal(rupeesToPaise('2'), 200);
  assert.equal(rupeesToPaise('2.5'), 250);
  assert.equal(rupeesToPaise('2.50'), 250);
  assert.equal(rupeesToPaise('0.05'), 5);
  assert.equal(rupeesToPaise('19.99'), 1999);
  assert.equal(rupeesToPaise('1000'), 100000);
});

test('rupeesToPaise rejects anything that is not a plain amount', () => {
  for (const bad of ['-1', 'abc', '1e3', '2.555', '1000.01', '10000', '2,50', '.5']) {
    assert.throws(() => rupeesToPaise(bad), Error, `should reject "${bad}"`);
  }
});

test('paiseToRupeesInput shows the amount the way an owner would type it', () => {
  assert.equal(paiseToRupeesInput(200), '2');
  assert.equal(paiseToRupeesInput(250), '2.50');
  assert.equal(paiseToRupeesInput(205), '2.05');
  assert.equal(paiseToRupeesInput(null), '');
  assert.equal(paiseToRupeesInput(undefined), '');
});

test('validateService returns whole paise and only the service fields', () => {
  const fields = validateService({
    name: '  Document printing ',
    pricingUnit: 'per_side',
    bwPrice: '2',
    colourPrice: '',
    isActive: true,
  });
  assert.deepEqual(fields, {
    name: 'Document printing',
    pricing_unit: 'per_side',
    bw_price_paise: 200,
    colour_price_paise: null,
    is_active: true,
  });
});

test('validateService accepts a colour-only service', () => {
  const fields = validateService({
    name: 'Passport photo sheet',
    pricingUnit: 'per_copy',
    bwPrice: '',
    colourPrice: '30',
    isActive: true,
  });
  assert.equal(fields.bw_price_paise, null);
  assert.equal(fields.colour_price_paise, 3000);
});

test('validateService needs a price and a known charging unit', () => {
  assert.throws(
    () => validateService({ name: 'X', pricingUnit: 'per_side', bwPrice: '', colourPrice: '' }),
    /black and white price, a colour price, or both/
  );
  assert.throws(() => validateService({ name: 'X', pricingUnit: 'per_page', bwPrice: '2' }), /charged/);
  assert.throws(() => validateService({ name: '', pricingUnit: 'per_side', bwPrice: '2' }), /1 to 80/);
  assert.throws(
    () => validateService({ name: 'X'.repeat(81), pricingUnit: 'per_side', bwPrice: '2' }),
    /1 to 80/
  );
});

test('validateService marks a service hidden only when the box is unticked', () => {
  const base = { name: 'X', pricingUnit: 'per_side', bwPrice: '2', colourPrice: '' };
  assert.equal(validateService({ ...base, isActive: false }).is_active, false);
  assert.equal(validateService({ ...base, isActive: true }).is_active, true);
});
