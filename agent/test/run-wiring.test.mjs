// Wiring test for the real "run" command. A paired computer (a saved config) talks to a local
// stub of the print-agent function. The stub answers 401 at once, as it does for a removed
// computer, so the agent must stop there. The only printer is a fake that must never be used.
// Nothing here reaches QRquick, Supabase, the internet or a printer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { saveConfig } from '../src/config.mjs';
import { main, VERSION } from '../src/cli.mjs';

const TOKEN = 'qpa_' + 'R'.repeat(43);
const SHOP = 'Wiring Test Shop';
const PRINTER = 'Front Desk';
const REVOKED = 'This computer was removed from QRquick. Pair it again to print.';
const LIMIT = { timeout: 10000 };

function parseOrText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// A local stub of the print-agent function. It records every request and answers 401.
async function startStub(t) {
  const requests = [];
  const server = createServer((req, res) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      text += chunk;
    });
    req.on('end', () => {
      requests.push({
        method: req.method,
        path: req.url,
        auth: req.headers.authorization ?? null,
        body: parseOrText(text),
      });
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'agent_unauthorized', message: REVOKED }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return { url: `http://127.0.0.1:${server.address().port}/print-agent`, requests };
}

// The only printer the run may see. It records any print, and a print here would be a bug.
function fakePrinter() {
  const prints = [];
  return {
    prints,
    platform: 'linux',
    acceptsImages: true,
    listPrinters: async () => [
      { name: PRINTER, isDefault: true, enabled: true, capabilitiesKnown: true, colour: true, duplex: true, papers: ['A4'] },
    ],
    print: async (job) => {
      prints.push(job);
      throw new Error('print must not run in this test');
    },
  };
}

test('run sends the saved token and printer list to the saved address, stops at once on 401, and prints nothing', LIMIT, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-run-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const stub = await startStub(t);
  await saveConfig(dir, {
    serverUrl: stub.url,
    token: TOKEN,
    agentId: 'agent-1',
    shopName: SHOP,
    computerName: 'TEST-PC',
    platform: 'linux',
    printer: PRINTER,
    pairedAt: new Date().toISOString(),
  });
  const printer = fakePrinter();
  const out = [];
  const fail = [];
  const code = await main(['run'], {
    dir,
    platform: 'linux',
    out: (line) => out.push(line),
    fail: (line) => fail.push(line),
    adapter: printer,
  });

  // Configuration: the shop name from the saved config is shown when the run starts.
  assert.ok(out.some((line) => line.includes(`running for ${SHOP}`)), out.join('\n'));
  // Error handling: a 401 ends the run with exit code 2 and the plain message. Nothing is thrown.
  assert.equal(code, 2, fail.join('\n'));
  assert.deepEqual(fail, []);
  assert.ok(out.includes(REVOKED), out.join('\n'));
  // API client and worker: the first call is the status report, sent to the saved address with
  // the token and the printer list from the adapter.
  assert.equal(stub.requests.length, 1, 'the worker stops on the first 401: no retry and no claim');
  const [first] = stub.requests;
  assert.equal(first.method, 'POST');
  assert.equal(first.path, '/print-agent/heartbeat');
  assert.equal(first.auth, `Bearer ${TOKEN}`);
  assert.equal(first.body.version, VERSION);
  assert.deepEqual(first.body.printers.map((p) => p.name), [PRINTER]);
  // Safety: nothing is printed, and the token is never shown.
  assert.equal(printer.prints.length, 0, 'nothing is printed');
  assert.ok(!out.join('\n').includes(TOKEN), 'the token is never printed');
});

test('run --simulated-printer is refused before the saved config is read, so nothing starts', LIMIT, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-run-refuse-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  // The config file is a folder, so reading it fails with EISDIR. A refusal that comes first never reads it.
  await mkdir(path.join(dir, 'agent.json'));
  const calls = [];
  const requests = [];
  const out = [];
  const fail = [];
  const code = await main(['run', '--simulated-printer'], {
    dir,
    platform: 'linux',
    out: (line) => out.push(line),
    fail: (line) => fail.push(line),
    adapter: {
      platform: 'linux',
      acceptsImages: true,
      listPrinters: async () => {
        calls.push('listPrinters');
        throw new Error('no printer may be read');
      },
      print: async () => {
        calls.push('print');
        throw new Error('no print may run');
      },
    },
    fetchImpl: async (url) => {
      requests.push(String(url));
      throw new Error('no request may be made');
    },
  });
  assert.equal(code, 1);
  assert.deepEqual(fail, [
    'Simulated printing is now the "simulate" command. It works offline and never contacts QRquick. Nothing was started.',
  ]);
  assert.deepEqual(out, [], 'nothing starts');
  assert.deepEqual(requests, [], 'no request is made');
  assert.deepEqual(calls, [], 'no printer is read or used');
});
