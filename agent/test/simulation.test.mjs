// The offline "simulate" command. Nothing here contacts a server or uses a printer: the network
// is blocked for every test, and the real printer adapter throws if it is ever called.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentApiError } from '../src/api.mjs';
import { main } from '../src/cli.mjs';
import { saveConfig } from '../src/config.mjs';
import {
  createSimulatedServer,
  readFixtureJobs,
  runSimulation,
  SIMULATION_BANNER,
} from '../src/simulation.mjs';

const PDF = Buffer.from('%PDF-1.4\n% test file\n%%EOF\n');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);
const SETTINGS = { copies: 1, colour: false, duplex: false, paper: 'A4' };
// A hung test fails after this long instead of stopping the whole run.
const LIMIT = { timeout: 10000 };
// Creating links needs extra rights on Windows, so these tests run on the other platforms only.
const LINKS = process.platform === 'win32' ? { skip: 'links need extra rights on Windows' } : {};

async function tempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-simtest-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function folderWith(t, files = {}) {
  const dir = await tempDir(t);
  for (const [name, bytes] of Object.entries(files)) await writeFile(path.join(dir, name), bytes);
  return dir;
}

function fixtureJob(overrides = {}) {
  return {
    job_id: 'sim-1',
    attempt: 1,
    state: 'queued',
    approved: true,
    paid: true,
    file: 'job.pdf',
    settings: SETTINGS,
    printer: null,
    ...overrides,
  };
}

// Any network call is recorded and fails. Restored when the test ends.
function blockNetwork(t) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    throw new Error('the network is blocked in simulation tests');
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}

// Checks the jobs, then runs the simulation over them.
async function simulateJobs(t, jobs, files = { 'job.pdf': PDF }) {
  const dir = await folderWith(t, files);
  const lines = [];
  const result = await runSimulation({
    jobs: readFixtureJobs({ jobs }, dir),
    fixtureDir: dir,
    out: (line) => lines.push(line),
  });
  return { ...result, lines };
}

// ----- checking the fixture file -----

test('a fixture with one unpaid job refuses the whole file, so nothing is simulated', LIMIT, async (t) => {
  const dir = await folderWith(t, { 'job.pdf': PDF });
  assert.throws(
    () => readFixtureJobs({ jobs: [fixtureJob(), fixtureJob({ job_id: 'sim-2', paid: false })] }, dir),
    /"sim-2" is not approved and paid/,
  );
});

test('only a literal approved and paid order can be simulated', LIMIT, async (t) => {
  const dir = await folderWith(t, { 'job.pdf': PDF });
  assert.throws(() => readFixtureJobs({ jobs: [fixtureJob({ approved: 'yes' })] }, dir), /not approved and paid/);
  assert.throws(() => readFixtureJobs({ jobs: [fixtureJob({ paid: 1 })] }, dir), /not approved and paid/);
});

test('a file outside the fixture folder is refused', LIMIT, async (t) => {
  const dir = await folderWith(t, { 'job.pdf': PDF });
  for (const bad of ['../secret.pdf', '/etc/passwd', 'sub/../../secret.pdf']) {
    assert.throws(
      () => readFixtureJobs({ jobs: [fixtureJob({ file: bad })] }, dir),
      /inside the fixture folder|outside the fixture folder/,
      `refused: ${bad}`,
    );
  }
});

test('job ids, states and attempt numbers are checked, and a repeated job id is refused', LIMIT, async (t) => {
  const dir = await folderWith(t, { 'job.pdf': PDF });
  assert.throws(() => readFixtureJobs({ jobs: [fixtureJob(), fixtureJob()] }, dir), /appears more than once/);
  assert.throws(() => readFixtureJobs({ jobs: [fixtureJob({ job_id: 'bad id!' })] }, dir), /job_id made of/);
  assert.throws(() => readFixtureJobs({ jobs: [fixtureJob({ state: 'paused' })] }, dir), /unknown state "paused"/);
  assert.throws(() => readFixtureJobs({ jobs: [fixtureJob({ attempt: 0 })] }, dir), /invalid attempt/);
});

// ----- links inside the fixture folder -----

test('a link inside the fixture folder that points outside it is refused before anything runs', { ...LIMIT, ...LINKS }, async (t) => {
  const outside = await folderWith(t, { 'secret.pdf': PDF });
  const dir = await folderWith(t, { 'job.pdf': PDF });
  await symlink(path.join(outside, 'secret.pdf'), path.join(dir, 'link.pdf'));
  assert.throws(
    () => readFixtureJobs({ jobs: [fixtureJob({ file: 'link.pdf' })] }, dir),
    /points outside the fixture folder/,
  );
});

test('simulate refuses a fixture whose link leaves the folder, and starts nothing', { ...LIMIT, ...LINKS }, async (t) => {
  const outside = await folderWith(t, { 'secret.pdf': PDF });
  const dir = await folderWith(t, {
    'jobs.json': JSON.stringify({ jobs: [fixtureJob({ file: 'link.pdf' })] }),
  });
  await symlink(path.join(outside, 'secret.pdf'), path.join(dir, 'link.pdf'));
  const calls = blockNetwork(t);
  const { deps, out, fail, realPrinterCalls } = cliDeps(await tempDir(t));
  assert.equal(await main(['simulate', path.join(dir, 'jobs.json')], deps), 1);
  assert.match(fail.join('\n'), /points outside the fixture folder/);
  assert.deepEqual(out, [], 'the banner is not shown, because nothing starts');
  assert.deepEqual(calls, [], 'no request is made');
  assert.equal(realPrinterCalls.length, 0, 'no printer is used');
});

test('a link that stays inside the fixture folder is still simulated', { ...LIMIT, ...LINKS }, async (t) => {
  const dir = await folderWith(t, {});
  await mkdir(path.join(dir, 'real'));
  await writeFile(path.join(dir, 'real', 'menu.pdf'), PDF);
  await symlink(path.join(dir, 'real', 'menu.pdf'), path.join(dir, 'link.pdf'));
  const jobs = readFixtureJobs({ jobs: [fixtureJob({ file: 'link.pdf' })] }, dir);
  const r = await runSimulation({ jobs, fixtureDir: dir, out: () => {} });
  assert.equal(r.records[0].state, 'sent');
  assert.equal(r.prints.length, 1);
});

test('a file replaced by a link to outside after the check is refused when it is read', { ...LIMIT, ...LINKS }, async (t) => {
  const outside = await folderWith(t, { 'secret.pdf': PDF });
  const dir = await folderWith(t, { 'job.pdf': PDF });
  const jobs = readFixtureJobs({ jobs: [fixtureJob()] }, dir);
  await rm(path.join(dir, 'job.pdf'));
  await symlink(path.join(outside, 'secret.pdf'), path.join(dir, 'job.pdf'));
  const r = await runSimulation({ jobs, fixtureDir: dir, out: () => {} });
  assert.equal(r.records[0].state, 'failed');
  assert.equal(r.records[0].errorCode, 'download_failed');
  assert.equal(r.prints.length, 0);
});

// ----- the offline run -----

test('a simulated job is never sent to QRquick: no network call is made and the job ends as simulated', LIMIT, async (t) => {
  const calls = blockNetwork(t);
  const r = await simulateJobs(t, [fixtureJob()]);
  assert.deepEqual(calls, [], 'no request leaves this computer');
  assert.equal(r.records[0].state, 'sent');
  assert.equal(r.records[0].simulated, true);
  assert.equal(r.prints.length, 1);
});

test('the steps run in order: claim, printing, then the finish, and every line says SIMULATED', LIMIT, async (t) => {
  const r = await simulateJobs(t, [fixtureJob()]);
  const steps = r.calls.filter((c) => c !== 'heartbeat');
  assert.deepEqual(steps.slice(0, 3), ['claim', 'printing', 'finish:sent']);
  assert.ok(r.lines.some((l) => l.includes('SIMULATED on')), r.lines.join('\n'));
  assert.ok(r.lines.every((l) => !l.includes(': sent to ')), 'nothing is logged as sent to a printer');
});

test('printing and needs-check jobs are never claimed or printed again', LIMIT, async (t) => {
  const r = await simulateJobs(t, [
    fixtureJob({ job_id: 'sim-1', state: 'printing' }),
    fixtureJob({ job_id: 'sim-2', state: 'needs_check' }),
    fixtureJob({ job_id: 'sim-3' }),
  ]);
  assert.deepEqual(
    r.records.map((x) => [x.jobId, x.state]),
    [
      ['sim-1', 'printing'],
      ['sim-2', 'needs_check'],
      ['sim-3', 'sent'],
    ],
  );
  assert.equal(r.prints.length, 1, 'only the queued job is printed');
  assert.equal(r.calls.filter((c) => c === 'claim').length, 2, 'one claim for the queued job, one to find nothing left');
});

test('settings the simulated printer cannot do are refused before anything is simulated', LIMIT, async (t) => {
  const r = await simulateJobs(t, [fixtureJob({ settings: { ...SETTINGS, paper: 'A3' } })]);
  assert.equal(r.records[0].state, 'failed');
  assert.equal(r.records[0].errorCode, 'unsupported_setting');
  assert.equal(r.prints.length, 0);
});

test('an unknown file type is refused and nothing is simulated', LIMIT, async (t) => {
  const r = await simulateJobs(t, [fixtureJob()], { 'job.pdf': Buffer.from('hello, not a document') });
  assert.equal(r.records[0].state, 'failed');
  assert.equal(r.records[0].errorCode, 'file_type_unknown');
  assert.equal(r.prints.length, 0);
});

test('a picture is wrapped in a PDF and then simulated', LIMIT, async (t) => {
  const r = await simulateJobs(t, [fixtureJob({ file: 'photo.jpg', size_bytes: JPEG.length })], { 'photo.jpg': JPEG });
  assert.equal(r.records[0].state, 'sent');
  assert.equal(r.prints.length, 1);
});

test('a file whose size does not match what was ordered is refused', LIMIT, async (t) => {
  const r = await simulateJobs(t, [fixtureJob({ size_bytes: 999 })]);
  assert.equal(r.records[0].state, 'failed');
  assert.equal(r.records[0].errorCode, 'file_changed');
  assert.equal(r.prints.length, 0);
});

test('a missing file is reported as a failed download, and nothing is simulated', LIMIT, async (t) => {
  const r = await simulateJobs(t, [fixtureJob({ file: 'missing.pdf' })], {});
  assert.equal(r.records[0].state, 'failed');
  assert.equal(r.records[0].errorCode, 'download_failed');
  assert.equal(r.prints.length, 0);
});

// ----- the in-memory server -----

test('the in-memory server refuses a result that would skip the printing step', LIMIT, async () => {
  const server = createSimulatedServer([
    { jobId: 'sim-1', attempt: 1, state: 'queued', filePath: '/fixtures/job.pdf', settings: SETTINGS, printer: null, sizeBytes: undefined },
  ]);
  const { job } = await server.api.claim();
  const ref = { jobId: job.job_id, attempt: job.attempt };
  await assert.rejects(server.api.finish(ref, { outcome: 'sent' }), (e) => e.code === 'lease_lost', 'sent before printing is refused');
  await assert.rejects(server.api.markPrinting({ jobId: 'sim-1', attempt: 2 }), (e) => e.code === 'lease_lost', 'a different attempt cannot start');
  await server.api.markPrinting(ref);
  await assert.rejects(server.api.markPrinting(ref), (e) => e.code === 'lease_lost', 'a job cannot start printing twice');
  await server.api.finish(ref, { outcome: 'sent' });
  await assert.rejects(server.api.finish(ref, { outcome: 'failed' }), (e) => e.code === 'lease_lost', 'sent can never become failed');
  assert.equal(server.records[0].state, 'sent');
  assert.equal(server.records[0].simulated, true);
});

test('the in-memory server keeps the job rules that migration 0010 states', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/0010_print_agents.sql', import.meta.url), 'utf8');
  // A partial drift check: if the server changes these rules, the simulation must change too.
  for (const rule of [
    "and j.status = 'queued'",
    "v_job.status <> 'claimed' or v_job.lease_until <= now()",
    "if p_outcome = 'sent' and v_job.status in ('printing', 'needs_check') then",
    "elsif p_outcome = 'failed' and v_job.status in ('claimed', 'printing') then",
  ]) {
    assert.ok(sql.includes(rule), `migration 0010 no longer has: ${rule}`);
  }
});

// ----- the safety limit -----

test('a server that never runs out of jobs stops at the safety limit instead of hanging', LIMIT, async (t) => {
  const dir = await folderWith(t, {});
  // If the safety limit were disabled, this stand-in still ends the run (after 1000 claims, as a
  // revoked computer), so the test fails quickly rather than running forever.
  let claims = 0;
  const neverEnds = {
    records: [],
    calls: [],
    api: {
      heartbeat: async () => ({ ok: true }),
      claim: async () => {
        claims += 1;
        if (claims > 1000) throw new AgentApiError(401, 'revoked', 'This computer was removed from QRquick.');
        return { job: null };
      },
      markPrinting: async () => ({ ok: true }),
      finish: async () => ({ ok: true }),
    },
  };
  await assert.rejects(
    runSimulation({ jobs: [], fixtureDir: dir, server: neverEnds, maxSteps: 5 }),
    (err) => err.name === 'SimulationStopped',
  );
});

// ----- the command line -----

async function pairedDir(t, serverUrl) {
  const dir = await tempDir(t);
  await saveConfig(dir, {
    serverUrl,
    token: 'qpa_' + 'K'.repeat(43),
    agentId: 'agent-1',
    shopName: 'Test Print Shop',
    computerName: 'TEST-PC',
    platform: 'linux',
    printer: null,
    pairedAt: '2026-10-28T00:00:00.000Z',
  });
  return dir;
}

// Any real printer call is recorded and fails, so a test shows whether one was attempted.
// Any request to a server is recorded and answered with "revoked" (401). A run that reaches
// the server therefore ends at its first request, so no test can keep retrying in the background.
function cliDeps(dir, extra = {}) {
  const out = [];
  const fail = [];
  const realPrinterCalls = [];
  const requests = [];
  const forbidden = (name) => async (...args) => {
    realPrinterCalls.push([name, ...args]);
    throw new Error(`${name} must not run in simulation`);
  };
  const deps = {
    dir,
    platform: 'linux',
    out: (line) => out.push(line),
    fail: (line) => fail.push(line),
    run: forbidden('run'),
    adapter: { listPrinters: forbidden('listPrinters'), print: forbidden('print') },
    fetchImpl: async (url) => {
      requests.push(String(url));
      return new Response('{"code":"revoked","message":"This computer was removed from QRquick."}', {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    },
    ...extra,
  };
  return { deps, out, fail, realPrinterCalls, requests };
}

test('run --simulated-printer is refused before any request, even against a localhost server', LIMIT, async (t) => {
  const dir = await pairedDir(t, 'http://127.0.0.1:8787/print-agent');
  const { deps, fail, realPrinterCalls, requests } = cliDeps(dir);
  assert.equal(await main(['run', '--simulated-printer'], deps), 1);
  assert.match(fail.join('\n'), /"simulate" command/);
  assert.equal(requests.length, 0, 'no request is made');
  assert.equal(realPrinterCalls.length, 0);
});

test('run refuses an unknown option before any request', LIMIT, async (t) => {
  const dir = await pairedDir(t, 'http://127.0.0.1:8787/print-agent');
  const { deps, fail, realPrinterCalls, requests } = cliDeps(dir);
  assert.equal(await main(['run', '--simulate'], deps), 1);
  assert.match(fail.join('\n'), /Unknown option "--simulate"/);
  assert.equal(requests.length, 0);
  assert.equal(realPrinterCalls.length, 0);
});

test('simulate with no file runs the built-in scenario offline, needs no pairing, and sends nothing', LIMIT, async (t) => {
  const dir = await tempDir(t); // no saved config at all
  const calls = blockNetwork(t);
  const { deps, out, fail, realPrinterCalls } = cliDeps(dir);
  assert.equal(await main(['simulate'], deps), 0);
  assert.equal(out[0], SIMULATION_BANNER);
  assert.ok(out.some((l) => l.includes('SIMULATED on')), out.join('\n'));
  assert.ok(
    out.some((l) => l.includes('Simulated: 1. Refused: 1. Left alone (already printing or needing a check): 2.')),
    out.join('\n'),
  );
  assert.deepEqual(fail, []);
  assert.deepEqual(calls, [], 'no request is made');
  assert.equal(realPrinterCalls.length, 0, 'no printer is used');
});

test('simulate with a fixture file runs it offline and prints a summary', LIMIT, async (t) => {
  const dir = await folderWith(t, {
    'job.pdf': PDF,
    'jobs.json': JSON.stringify({ jobs: [fixtureJob()] }),
  });
  const calls = blockNetwork(t);
  const { deps, out, realPrinterCalls } = cliDeps(await tempDir(t));
  assert.equal(await main(['simulate', path.join(dir, 'jobs.json')], deps), 0);
  assert.ok(out.some((l) => l.includes('Simulated: 1. Refused: 0.')), out.join('\n'));
  assert.deepEqual(calls, []);
  assert.equal(realPrinterCalls.length, 0);
});

test('simulate with an unpaid job in the file stops before anything starts', LIMIT, async (t) => {
  const dir = await folderWith(t, {
    'job.pdf': PDF,
    'jobs.json': JSON.stringify({ jobs: [fixtureJob({ paid: false })] }),
  });
  const calls = blockNetwork(t);
  const { deps, out, fail } = cliDeps(await tempDir(t));
  assert.equal(await main(['simulate', path.join(dir, 'jobs.json')], deps), 1);
  assert.match(fail.join('\n'), /is not approved and paid/);
  assert.deepEqual(out, [], 'the banner is not shown, because nothing starts');
  assert.deepEqual(calls, []);
});

test('simulate refuses extra arguments and a file that does not exist', LIMIT, async (t) => {
  const dir = await tempDir(t);
  const { deps, fail } = cliDeps(dir);
  assert.equal(await main(['simulate', 'a.json', 'b.json'], deps), 1);
  assert.match(fail.join('\n'), /Usage: qrquick-print-agent simulate/);
  assert.equal(await main(['simulate', path.join(dir, 'missing.json')], deps), 1);
  assert.match(fail.join('\n'), /Could not open/);
});
