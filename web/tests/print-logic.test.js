import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agentStatusLabel,
  canSendToPrint,
  itemsToSend,
  latestJobsByItem,
  printAgentFunctionUrl,
  printerOptionLabel,
  printFailureText,
  printingNotice,
  printJobLabel,
  retryOptions,
} from '../src/logic.js';
import { createOwnerApi } from '../src/owner-api.js';

const config = { supabaseUrl: 'https://example-project.supabase.co/', publishableKey: 'sb_publishable_TEST' };
const signedIn = {
  getSession: async () => ({ access_token: 'owner-token', expires_at: 9e9, user: { id: 'owner-1' } }),
};

function fakeFetch(responseBody = null, status = 200) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    return new Response(responseBody === null ? null : JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

// An order with one file item and one item without a file (from before uploads).
function order(overrides = {}) {
  return {
    id: 'order-1',
    status: 'approved',
    payment_status: 'paid',
    order_items: [
      { id: 'item-1', file_id: 'file-1', file_name: 'menu.pdf' },
      { id: 'item-2', file_id: null, file_name: null },
    ],
    ...overrides,
  };
}

test('job labels are plain words, and unknown statuses are shown as they are', () => {
  assert.equal(printJobLabel('queued'), 'Waiting for a printing computer');
  assert.equal(printJobLabel('needs_check'), 'Check the printer');
  assert.equal(printJobLabel('weird'), 'weird');
});

test('the failure text prefers the agent\'s own message and never claims a page printed', () => {
  assert.equal(printFailureText({ status: 'sent' }), '');
  assert.equal(printFailureText(null), '');
  assert.equal(
    printFailureText({ status: 'failed', error_code: 'unsupported_setting', error_message: 'Office does not print in colour.' }),
    'Office does not print in colour.'
  );
  assert.equal(
    printFailureText({ status: 'failed', error_code: 'printer_offline', error_message: null }),
    'The printer is turned off or offline. Turn it on, then print again.'
  );
  assert.match(printFailureText({ status: 'needs_check' }), /may already have printed/);
});

test('the newest attempt is kept for each order item', () => {
  const latest = latestJobsByItem([
    { id: 'a', order_item_id: 'item-1', attempt: 1, status: 'failed' },
    { id: 'b', order_item_id: 'item-1', attempt: 2, status: 'queued' },
    { id: 'c', order_item_id: 'item-2', attempt: 1, status: 'sent' },
  ]);
  assert.equal(latest.get('item-1').id, 'b');
  assert.equal(latest.get('item-2').status, 'sent');
  assert.equal(latestJobsByItem(undefined).size, 0);
});

test('only file items without a job are sent, and only for a paid approved or printing order', () => {
  const none = new Map();
  assert.deepEqual(itemsToSend(order(), none).map((i) => i.id), ['item-1']);
  assert.equal(canSendToPrint(order(), none), true);
  assert.equal(canSendToPrint(order({ status: 'printing' }), none), true);

  // Once the file has a job, the button goes away.
  assert.equal(canSendToPrint(order(), new Map([['item-1', { id: 'j' }]])), false);
  // Unpaid, pending or stopped orders cannot be sent.
  assert.equal(canSendToPrint(order({ payment_status: 'unpaid' }), none), false);
  assert.equal(canSendToPrint(order({ payment_status: 'pending' }), none), false);
  assert.equal(canSendToPrint(order({ status: 'cancelled' }), none), false);
  assert.equal(canSendToPrint(order({ status: 'pending' }), none), false);
  // Items from before uploads have no file, so there is nothing to send.
  assert.equal(canSendToPrint(order({ order_items: [{ id: 'x', file_id: null }] }), none), false);
});

test('a failed job can be printed again freely; a job that may have printed needs confirmation', () => {
  assert.deepEqual(retryOptions({ status: 'failed' }), { confirmMayHavePrinted: false, warning: '' });
  const check = retryOptions({ status: 'needs_check' });
  assert.equal(check.confirmMayHavePrinted, true);
  assert.match(check.warning, /already have printed/);
  for (const status of ['queued', 'claimed', 'printing', 'sent']) {
    assert.equal(retryOptions({ status }), null, status);
  }
  assert.equal(retryOptions(null), null);
});

test('the pairing command uses the print-agent function address without a trailing slash', () => {
  assert.equal(
    printAgentFunctionUrl('https://example-project.supabase.co/'),
    'https://example-project.supabase.co/functions/v1/print-agent'
  );
  assert.equal(printAgentFunctionUrl(undefined), '/functions/v1/print-agent');
});

test('printer names come with the facts the owner needs to choose', () => {
  assert.equal(
    printerOptionLabel({ name: 'Office', isDefault: true, enabled: true, capabilitiesKnown: true, colour: false, duplex: true }),
    'Office (system default, black and white, double-sided)'
  );
  assert.equal(printerOptionLabel({ name: 'Plain', enabled: true, capabilitiesKnown: false }), 'Plain');
  assert.equal(agentStatusLabel({ online: true }), 'Connected');
  assert.equal(agentStatusLabel({ online: false }), 'Not connected right now');
});

test('the printing notice warns when nothing can print, and stays quiet when a computer is connected', () => {
  assert.match(printingNotice({ agents: [] }), /will not print automatically/);
  assert.equal(
    printingNotice({ agents: [{ online: false }], jobs: [{ status: 'queued' }, { status: 'queued' }] }),
    'No printing computer is connected. 2 jobs are waiting.'
  );
  assert.equal(printingNotice({ agents: [{ online: false }], jobs: [] }), 'No printing computer is connected right now.');
  assert.equal(printingNotice({ agents: [{ online: true }], jobs: [] }), '');
});

test('owner print calls send the right database function and arguments', async () => {
  const { calls, fetchImpl } = fakeFetch({});
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });

  await api.printStatus('shop-1');
  await api.createPrintPairing('shop-1');
  await api.revokePrintAgent('agent-1');
  await api.setAgentPrinter('agent-1', null);
  await api.approveForPrint('order-1');
  await api.retryPrintJob('job-1');
  await api.retryPrintJob('job-2', true);

  assert.equal(calls[0].url, 'https://example-project.supabase.co/rest/v1/rpc/owner_print_status');
  assert.deepEqual(calls[0].body, { p_shop_id: 'shop-1' });
  assert.equal(calls[1].url, 'https://example-project.supabase.co/rest/v1/rpc/create_print_agent_pairing');
  assert.deepEqual(calls[2].body, { p_agent_id: 'agent-1' });
  assert.equal(calls[3].url, 'https://example-project.supabase.co/rest/v1/rpc/set_print_agent_printer');
  assert.deepEqual(calls[3].body, { p_agent_id: 'agent-1', p_printer: null });
  assert.equal(calls[4].url, 'https://example-project.supabase.co/rest/v1/rpc/approve_order_for_print');
  assert.deepEqual(calls[4].body, { p_order_id: 'order-1' });
  assert.equal(calls[5].url, 'https://example-project.supabase.co/rest/v1/rpc/retry_print_job');
  assert.deepEqual(calls[5].body, { p_job_id: 'job-1', p_confirm_may_have_printed: false });
  assert.deepEqual(calls[6].body, { p_job_id: 'job-2', p_confirm_may_have_printed: true });
  for (const call of calls) {
    assert.equal(call.init.headers.Authorization, 'Bearer owner-token');
  }
});

test('the order list asks for the order item id, which the print lines need', async () => {
  const { calls, fetchImpl } = fakeFetch([]);
  const api = createOwnerApi({ config, auth: signedIn, fetchImpl });
  await api.listOrders('shop-1');
  assert.match(calls[0].url, /order_items\(id,service_name/);
});
