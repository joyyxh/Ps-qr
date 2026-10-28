// The simulated printer and the worker steps it drives. The server is a fake at the worker's
// edge. No real printer, program or server is used by these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentApiError } from '../src/api.mjs';
import { createJournal } from '../src/journal.mjs';
import { createSimulatedAdapter, SIMULATED_PRINTER_NAME } from '../src/printers/simulated.mjs';
import { createWorker } from '../src/worker.mjs';

const JOB_ID = '11111111-2222-4333-8444-555555555555';
const PDF = Buffer.from('%PDF-1.4\n% test file\n%%EOF\n');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);

async function tempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-sim-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function job(bytes = PDF, extra = {}) {
  return {
    job_id: JOB_ID,
    attempt: 1,
    settings: { copies: 1, colour: false, duplex: false, paper: 'A4' },
    printer: null,
    file_url: 'https://files.example/signed-link',
    size_bytes: bytes.length,
    file_name: 'menu.pdf',
    ...extra,
  };
}

// A worker with the real simulated adapter. "events" records the server calls and the
// simulated prints in order, so tests can check that "printing" comes before the print.
async function harness(t, { adapterOptions = {}, bytes = PDF, download, api: apiOverrides = {}, config = {} } = {}) {
  const dir = await tempDir(t);
  const adapter = createSimulatedAdapter(adapterOptions);
  const events = [];
  const reports = [];
  const logs = [];
  const realPrint = adapter.print;
  adapter.print = async (opts) => {
    events.push('print');
    return realPrint(opts);
  };
  const api = {
    heartbeat: async () => ({ ok: true }),
    claim: async () => ({ job: null }),
    markPrinting: async () => {
      events.push('printing');
      return { ok: true };
    },
    finish: async (ref, result) => {
      events.push(result.outcome);
      reports.push({ ref, ...result });
      return { ok: true };
    },
    ...apiOverrides,
  };
  const worker = createWorker({
    api,
    adapter,
    journal: createJournal(path.join(dir, 'outbox.json')),
    download: download ?? (async () => bytes),
    config,
    workDir: path.join(dir, 'work'),
    log: (line) => logs.push(line),
    sleep: async () => {},
    heartbeatMs: 1e9,
  });
  return { worker, adapter, events, reports, logs, dir };
}

test('the simulated printer is clearly named, marked simulated, and is the default', async () => {
  const adapter = createSimulatedAdapter();
  const [printer] = await adapter.listPrinters();
  assert.equal(printer.name, SIMULATED_PRINTER_NAME);
  assert.match(printer.name, /SIMULATED/);
  assert.equal(printer.isDefault, true);
  assert.equal(printer.enabled, true);
  assert.equal(adapter.simulated, true);
});

test('simulated results are deterministic: each accepted job gets the next simulated id', async (t) => {
  const dir = await tempDir(t);
  const file = path.join(dir, 'job.pdf');
  await writeFile(file, PDF);
  const adapter = createSimulatedAdapter();
  const options = { printer: SIMULATED_PRINTER_NAME, file, copies: 1, colour: false, duplex: false, paper: 'A4', title: 'QRquick' };
  const first = await adapter.print(options);
  const second = await adapter.print(options);
  assert.equal(first.spoolerId, 'simulated-1');
  assert.equal(second.spoolerId, 'simulated-2');
  assert.equal(adapter.prints.length, 2);
});

test('the simulated spooler refuses a non-PDF file or a printer it does not have', async (t) => {
  const dir = await tempDir(t);
  const file = path.join(dir, 'job.gif');
  await writeFile(file, Buffer.from('GIF89a................', 'latin1'));
  const adapter = createSimulatedAdapter();
  await assert.rejects(
    adapter.print({ printer: SIMULATED_PRINTER_NAME, file, copies: 1, colour: false, duplex: false, paper: 'A4', title: 'x' }),
    (err) => err.code === 'spooler_error',
  );
  await assert.rejects(
    adapter.print({ printer: 'Office', file, copies: 1, colour: false, duplex: false, paper: 'A4', title: 'x' }),
    (err) => err.code === 'printer_not_found',
  );
  assert.equal(adapter.prints.length, 0, 'nothing is recorded as printed');
});

test('a simulated run records "printing" before the print, then reports sent and says SIMULATED', async (t) => {
  const h = await harness(t);
  await h.worker.processJob(job());
  assert.deepEqual(h.events, ['printing', 'print', 'sent']);
  assert.equal(h.reports[0].outcome, 'sent');
  assert.equal(h.adapter.prints[0].spoolerId, 'simulated-1');
  assert.ok(h.logs.some((l) => l.includes('SIMULATED on')), h.logs.join('\n'));
  assert.ok(h.logs.every((l) => !l.includes(': sent to ')), 'a simulated job is never logged as sent to a printer');
});

test('a picture is wrapped in a PDF first, so the simulated spooler receives a PDF', async (t) => {
  const h = await harness(t, { bytes: JPEG });
  await h.worker.processJob(job(JPEG));
  assert.deepEqual(h.events, ['printing', 'print', 'sent']);
  assert.equal(h.adapter.prints.length, 1);
});

test('an unknown file type is refused and nothing is simulated', async (t) => {
  const bytes = Buffer.from('hello, this is not a document');
  const h = await harness(t, { bytes });
  await h.worker.processJob(job(bytes));
  assert.equal(h.reports[0].outcome, 'failed');
  assert.equal(h.reports[0].errorCode, 'file_type_unknown');
  assert.deepEqual(h.events, ['failed']);
  assert.equal(h.adapter.prints.length, 0);
});

test('a file the server cannot give us is reported once as failed and nothing is simulated', async (t) => {
  const h = await harness(t, {
    download: async () => {
      throw new AgentApiError(404, 'download_failed', 'The file could not be downloaded.');
    },
  });
  await h.worker.processJob(job());
  assert.equal(h.reports.length, 1);
  assert.equal(h.reports[0].errorCode, 'download_failed');
  assert.equal(h.adapter.prints.length, 0);
});

test('a job the server has already moved on from is not simulated again', async (t) => {
  let markCalls = 0;
  const h = await harness(t, {
    api: {
      markPrinting: async () => {
        markCalls += 1;
        if (markCalls > 1) throw new AgentApiError(409, 'lease_lost', 'The job was taken back.');
        return { ok: true };
      },
    },
  });
  await h.worker.processJob(job());
  await h.worker.processJob(job());
  assert.equal(h.adapter.prints.length, 1, 'one simulated print for one job');
  assert.equal(markCalls, 2);
  assert.ok(h.logs.some((l) => l.includes('not printed')));
});

test('no answer to "printing" means nothing is simulated and nothing is reported as failed', async (t) => {
  const h = await harness(t, {
    api: {
      markPrinting: async () => {
        throw new AgentApiError(0, 'network', 'Could not reach QRquick.');
      },
    },
  });
  await h.worker.processJob(job());
  assert.equal(h.adapter.prints.length, 0);
  assert.deepEqual(h.reports, [], 'no failure is reported, so nobody is invited to print again');
});

test('a result that could not be sent is kept and sent later, without a second simulated print', async (t) => {
  const finishCalls = [];
  const h = await harness(t, {
    api: {
      finish: async (ref, result) => {
        finishCalls.push(result.outcome);
        if (finishCalls.length === 1) throw new AgentApiError(0, 'network', 'Could not reach QRquick.');
        return { ok: true };
      },
    },
  });
  await h.worker.processJob(job());
  assert.equal(h.adapter.prints.length, 1);
  await h.worker.flushReports();
  await h.worker.flushReports();
  assert.deepEqual(finishCalls, ['sent', 'sent'], 'the result is sent once after the first failure, then nothing more');
  assert.equal(h.adapter.prints.length, 1, 'still one simulated print');
});

test('a simulated printer that is turned off fails the job before anything is simulated', async (t) => {
  const h = await harness(t, { adapterOptions: { enabled: false } });
  await h.worker.processJob(job());
  assert.equal(h.reports[0].outcome, 'failed');
  assert.equal(h.reports[0].errorCode, 'printer_offline');
  assert.deepEqual(h.events, ['failed']);
});

test('a black-and-white simulated printer refuses a colour order before anything is simulated', async (t) => {
  const h = await harness(t, { adapterOptions: { colour: false } });
  await h.worker.processJob(job(PDF, { settings: { copies: 1, colour: true, duplex: false, paper: 'A4' } }));
  assert.equal(h.reports[0].errorCode, 'unsupported_setting');
  assert.equal(h.adapter.prints.length, 0);
});

test('an order for a printer this computer does not have fails as printer_not_found', async (t) => {
  const h = await harness(t);
  await h.worker.processJob(job(PDF, { printer: 'Office Laser' }));
  assert.equal(h.reports[0].errorCode, 'printer_not_found');
  assert.equal(h.adapter.prints.length, 0);
});

test('the simulated module never imports the command runner or a real printer adapter', () => {
  const source = readFileSync(new URL('../src/printers/simulated.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /child_process|runner\.mjs|printers\/linux|printers\/windows|powershell|sumatra|execFile|https?:|fetch\(/i);
});
