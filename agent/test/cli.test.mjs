import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.mjs';
import { main, SetupCancelled } from '../src/cli.mjs';

const TOKEN = 'qpa_' + 'K'.repeat(43);
const SERVER = 'https://x.example.supabase.co/functions/v1/print-agent';

async function setup(t, extra = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const out = [];
  const fail = [];
  const deps = { dir, platform: 'linux', out: (l) => out.push(l), fail: (l) => fail.push(l), ...extra };
  return { dir, out, fail, deps };
}

const pairingFetch = (requests) => async (url, init) => {
  requests.push({ url, body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ agent_id: 'agent-1', shop_name: 'Test Print Shop', token: TOKEN }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const oneOffice = {
  platform: 'linux',
  listPrinters: async () => [{ name: 'Office', isDefault: true, enabled: true, capabilitiesKnown: true, colour: false, duplex: false, papers: null }],
  print: async () => ({ spoolerId: null }),
};

test('pair saves the token, prints no token, and sends the code to the server', async (t) => {
  const requests = [];
  const { dir, out, fail, deps } = await setup(t, { fetchImpl: pairingFetch(requests), computerName: 'SHOP-PC' });
  const code = await main(['pair', SERVER, 'ABCD-EFGH'], deps);
  assert.equal(code, 0, fail.join('\n'));
  assert.equal(requests[0].url, `${SERVER}/pair`);
  assert.deepEqual(requests[0].body, { code: 'ABCD-EFGH', name: 'SHOP-PC', platform: 'linux', version: '0.1.0' });
  assert.ok(out.some((l) => l.includes('Paired with Test Print Shop')));
  assert.ok(!out.join('\n').includes(TOKEN), 'the token is never printed');
  const saved = await loadConfig(dir);
  assert.equal(saved.token, TOKEN);
  assert.equal(saved.serverUrl, SERVER);
});

test('pair refuses an insecure server address before contacting anything', async (t) => {
  const requests = [];
  const { fail, deps } = await setup(t, { fetchImpl: pairingFetch(requests) });
  const code = await main(['pair', 'http://example.com/functions', 'ABCD-EFGH'], deps);
  assert.equal(code, 1);
  assert.equal(requests.length, 0);
  assert.match(fail[0], /must start with https/);
});

test('set-printer only accepts a printer that exists on this computer', async (t) => {
  const { dir, out, fail, deps } = await setup(t, { adapter: oneOffice, fetchImpl: pairingFetch([]) });
  await main(['pair', SERVER, 'ABCD-EFGH'], deps);
  assert.equal(await main(['set-printer', 'Nowhere'], deps), 1);
  assert.match(fail.at(-1), /is not a printer on this computer/);
  assert.equal(await main(['set-printer', 'Office'], deps), 0);
  assert.equal((await loadConfig(dir)).printer, 'Office');
  assert.ok(out.at(-1).includes('"Office" is now the fallback printer'));
});

test('run refuses to start before the computer is paired', async (t) => {
  const { fail, deps } = await setup(t, { adapter: oneOffice });
  assert.equal(await main(['run'], deps), 1);
  assert.match(fail[0], /not paired yet/);
});

test('doctor reports a failed connection and exits non-zero', async (t) => {
  const { out, deps } = await setup(t, {
    adapter: oneOffice,
    fetchImpl: pairingFetch([]),
  });
  await main(['pair', SERVER, 'ABCD-EFGH'], deps);
  const failing = { ...deps, fetchImpl: async () => { throw new TypeError('offline'); } };
  const out2 = [];
  const code = await main(['doctor'], { ...failing, out: (l) => out2.push(l) });
  assert.equal(code, 1);
  assert.ok(out2.some((l) => l.startsWith('FAIL Connected to QRquick')));
  assert.ok(out2.some((l) => l.startsWith('OK   Paired with QRquick')));
  assert.ok(out.length > 0);
});

test('doctor sends the real printer list, so the owner keeps seeing the printers', async (t) => {
  const { deps } = await setup(t, { adapter: oneOffice, fetchImpl: pairingFetch([]) });
  await main(['pair', SERVER, 'ABCD-EFGH'], deps);
  const bodies = [];
  const fetchImpl = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const code = await main(['doctor'], { ...deps, fetchImpl });
  assert.equal(code, 0);
  assert.equal(bodies[0].printers[0].name, 'Office');
});

test('unknown commands and help', async (t) => {
  const { out, fail, deps } = await setup(t);
  assert.equal(await main(['help'], deps), 0);
  assert.ok(out.join('\n').includes('Commands:'));
  assert.equal(await main(['frobnicate'], deps), 1);
  assert.match(fail[0], /Unknown command "frobnicate"/);
});

// Answers the questions in order. A question with no answer left fails the test.
function scripted(answers) {
  const asked = [];
  const ask = async (question) => {
    asked.push(question);
    if (answers.length === 0) throw new Error(`unexpected question: ${question}`);
    return answers.shift();
  };
  return { ask, asked };
}

test('no arguments outside a terminal print the usage and never prompt', async (t) => {
  const { out, deps } = await setup(t, {
    interactive: false,
    ask: async () => { throw new Error('must not prompt'); },
  });
  assert.equal(await main([], deps), 0);
  assert.ok(out.join('\n').includes('Commands:'));
});

test('no arguments in a terminal: pairs, chooses the printer, starts the agent, and waits before closing', async (t) => {
  const { dir, out, fail, deps } = await setup(t, { adapter: oneOffice, fetchImpl: pairingFetch([]), computerName: 'SHOP-PC' });
  const { ask, asked } = scripted([SERVER, 'ABCD-EFGH', '1', '']);
  let started = 0;
  const code = await main([], { ...deps, interactive: true, ask, startAgent: async () => { started += 1; return 0; } });
  assert.equal(code, 0, fail.join('\n'));
  assert.equal(started, 1);
  assert.equal(asked.length, 4);
  assert.match(asked[0], /Server address/);
  assert.match(asked[1], /Pairing code/);
  assert.match(asked[2], /Number of the printer/);
  assert.match(asked[3], /Press Enter to close/);
  const saved = await loadConfig(dir);
  assert.equal(saved.token, TOKEN);
  assert.equal(saved.printer, 'Office');
  const text = out.join('\n');
  assert.ok(!text.includes(TOKEN), 'the token is never printed');
  assert.ok(!text.includes('Next: run'), 'the guided start does not print the command list');
});

test('no arguments in a terminal: a rejected pairing code is reported, the agent does not start, and the window waits', async (t) => {
  const rejecting = async () => new Response(
    JSON.stringify({ code: 'pairing_code_invalid', message: 'That code is not valid or has expired.' }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  );
  const { fail, deps } = await setup(t, { adapter: oneOffice, fetchImpl: rejecting });
  const { ask, asked } = scripted([SERVER, 'WRONG-CODE', '']);
  let started = 0;
  const code = await main([], { ...deps, interactive: true, ask, startAgent: async () => { started += 1; return 0; } });
  assert.equal(code, 1);
  assert.equal(started, 0);
  assert.match(fail.at(-1), /not valid or has expired/);
  assert.match(asked.at(-1), /Press Enter to close/);
});

test('no arguments in a terminal on a paired computer with a printer set: starts at once', async (t) => {
  const { out, fail, deps } = await setup(t, { adapter: oneOffice, fetchImpl: pairingFetch([]) });
  await main(['pair', SERVER, 'ABCD-EFGH'], deps);
  await main(['set-printer', 'Office'], deps);
  const { ask, asked } = scripted(['']);
  let started = 0;
  const code = await main([], { ...deps, interactive: true, ask, startAgent: async () => { started += 1; return 0; } });
  assert.equal(code, 0, fail.join('\n'));
  assert.equal(started, 1);
  assert.equal(asked.length, 1, 'only the closing question is asked');
  assert.ok(out.some((l) => l.includes('paired with Test Print Shop')));
});

test('no arguments in a terminal: Ctrl+C at a question stops before anything is paired', async (t) => {
  const { dir, deps } = await setup(t, { adapter: oneOffice, fetchImpl: pairingFetch([]) });
  const ask = async () => { throw new SetupCancelled(); };
  let started = 0;
  const code = await main([], { ...deps, interactive: true, ask, startAgent: async () => { started += 1; return 0; } });
  assert.equal(code, 130);
  assert.equal(started, 0);
  assert.equal((await loadConfig(dir))?.token, undefined);
});
