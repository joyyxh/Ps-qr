import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentApiError, createAgentApi, downloadFile } from '../src/api.mjs';
import { configPaths, loadConfig, normaliseServerUrl, saveConfig } from '../src/config.mjs';
import { createJournal } from '../src/journal.mjs';
import { buildSamplePdf } from '../src/sample-page.mjs';

async function tempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const TOKEN = 'qpa_' + 'T'.repeat(43);

test('API client: only claim-style calls carry the agent token; pairing does not', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, headers: init.headers, body: init.body });
    return new Response(JSON.stringify({ job: null }), { status: 200 });
  };
  const api = createAgentApi({ serverUrl: 'https://x.example/functions/v1/print-agent/', token: TOKEN, fetchImpl });
  await api.claim();
  await api.pair({ code: 'ABCD-EFGH', name: 'PC', platform: 'linux', version: '0.1.0' });
  assert.equal(seen[0].url, 'https://x.example/functions/v1/print-agent/claim');
  assert.equal(seen[0].headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(seen[1].url, 'https://x.example/functions/v1/print-agent/pair');
  assert.equal(seen[1].headers.Authorization, undefined);
});

test('API client turns the server\'s { code, message } into AgentApiError', async () => {
  const fetchImpl = async () => new Response(
    JSON.stringify({ code: 'pairing_code_invalid', message: 'That code is not valid or has expired.' }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  );
  const api = createAgentApi({ serverUrl: 'https://x.example/p', fetchImpl });
  await assert.rejects(
    api.pair({ code: 'ABCD-EFGH', name: 'PC', platform: 'linux', version: '0.1.0' }),
    (err) => err instanceof AgentApiError && err.status === 400 && err.code === 'pairing_code_invalid',
  );
});

test('API client reports a dropped connection as "network", without the link or token', async () => {
  const fetchImpl = async () => {
    throw new TypeError(`fetch failed for ${TOKEN}`);
  };
  const api = createAgentApi({ serverUrl: 'https://x.example/p', token: TOKEN, fetchImpl });
  await assert.rejects(api.claim(), (err) => {
    assert.equal(err.code, 'network');
    assert.ok(!err.message.includes(TOKEN));
    return true;
  });
});

test('file download refuses anything over the size limit', async () => {
  const big = new Response('x'.repeat(20), { status: 200 });
  await assert.rejects(
    downloadFile('https://files.example/a', { maxBytes: 10, fetchImpl: async () => big }),
    (err) => err.status === 413,
  );
  const declared = new Response('x', { status: 200, headers: { 'content-length': '99999' } });
  await assert.rejects(
    downloadFile('https://files.example/a', { maxBytes: 10, fetchImpl: async () => declared }),
    (err) => err.status === 413,
  );
  const fine = await downloadFile('https://files.example/a', {
    maxBytes: 10,
    fetchImpl: async () => new Response('hello', { status: 200 }),
  });
  assert.equal(fine.toString(), 'hello');
});

test('server address must be https, except a local test server', () => {
  assert.equal(
    normaliseServerUrl('https://x.supabase.co/functions/v1/print-agent/?x=1#y'),
    'https://x.supabase.co/functions/v1/print-agent',
  );
  assert.equal(normaliseServerUrl('http://localhost:54321/functions/v1/print-agent'), 'http://localhost:54321/functions/v1/print-agent');
  assert.throws(() => normaliseServerUrl('http://example.com/functions'), /must start with https/);
  assert.throws(() => normaliseServerUrl('not a web address'), /not a valid web address/);
});

test('config is saved and loaded back, and a missing file is "not paired"', async (t) => {
  const dir = await tempDir(t);
  assert.equal(await loadConfig(dir), null);
  await saveConfig(dir, { serverUrl: 'https://x.example', token: TOKEN, printer: null });
  assert.deepEqual(await loadConfig(dir), { serverUrl: 'https://x.example', token: TOKEN, printer: null });
  assert.ok(configPaths(dir).config.endsWith('agent.json'));
});

test('journal keeps an active job and pending reports across reads', async (t) => {
  const dir = await tempDir(t);
  const journal = createJournal(path.join(dir, 'outbox.json'));
  assert.deepEqual(await journal.read(), { activeJob: null, pendingReports: [] });
  await journal.setActive({ jobId: 'j', attempt: 1, state: 'submitted' });
  await journal.addReport({ jobId: 'j', attempt: 1, outcome: 'sent' });
  const state = await journal.read();
  assert.equal(state.activeJob.state, 'submitted');
  assert.equal(state.pendingReports.length, 1);
  await journal.removeReport('j', 1);
  await journal.clearActive();
  assert.deepEqual(await journal.read(), { activeJob: null, pendingReports: [] });
});

test('a damaged journal stops the agent instead of guessing', async (t) => {
  const dir = await tempDir(t);
  const file = path.join(dir, 'outbox.json');
  await writeFile(file, '{"activeJob": ');
  await assert.rejects(createJournal(file).read(), /notes file is damaged/);
});

test('the test page is a valid PDF with a correct cross-reference table', () => {
  const pdf = buildSamplePdf(['QRquick print agent', 'Printer: Office (round) \\ test', 'Line 3']);
  const text = pdf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.match(text, /\(Printer: Office \\\(round\\\) \\\\ test\) Tj/);
  const start = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)[1]);
  const lines = text.slice(start).split('\n');
  for (let n = 1; n <= 5; n++) {
    const offset = parseInt(lines[2 + n].slice(0, 10), 10);
    assert.ok(text.slice(offset).startsWith(`${n} 0 obj`), `object ${n}`);
  }
});
