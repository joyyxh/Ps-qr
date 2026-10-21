import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentApiError } from '../src/api.mjs';
import { createJournal } from '../src/journal.mjs';
import { AgentRevokedError, checkSettings, choosePrinter, createWorker, normaliseSettings } from '../src/worker.mjs';

const JOB_ID = '11111111-2222-4333-8444-555555555555';
const PDF = Buffer.from('%PDF-1.4\n% test file\n%%EOF\n');
const GIF = Buffer.from('GIF89a................', 'latin1');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);
const OFFICE = {
  name: 'Office',
  isDefault: true,
  enabled: true,
  capabilitiesKnown: true,
  colour: false,
  duplex: true,
  papers: ['A4'],
};

function job(extra = {}) {
  return {
    job_id: JOB_ID,
    attempt: 1,
    settings: { copies: 2, colour: false, duplex: false, paper: 'A4' },
    printer: null,
    file_url: 'https://files.example/signed-link',
    size_bytes: PDF.length,
    file_name: 'menu.pdf',
    ...extra,
  };
}

// A fake server and printer. "events" records the order of the important steps, so
// tests can prove that "printing" is recorded before the printer receives the file.
async function harness(t, { printers = [OFFICE], acceptsImages = true, bytes = PDF, apiOverrides = {}, adapterOverrides = {}, config = {} } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-worker-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const events = [];
  const reports = [];
  const prints = [];
  const heartbeats = [];
  const api = {
    heartbeat: async (body) => {
      heartbeats.push(body);
      events.push('heartbeat');
      return { ok: true };
    },
    claim: async () => ({ job: null }),
    markPrinting: async () => {
      events.push('printing');
      return { ok: true };
    },
    finish: async (ref, result) => {
      reports.push({ ref, result });
      events.push(result.outcome);
      return { ok: true };
    },
    ...apiOverrides,
  };
  const adapter = {
    platform: 'linux',
    acceptsImages,
    listPrinters: async () => printers,
    print: async (opts) => {
      prints.push(opts);
      events.push('print');
      return { spoolerId: null };
    },
    ...adapterOverrides,
  };
  const journal = createJournal(path.join(dir, 'outbox.json'));
  const worker = createWorker({
    api,
    adapter,
    journal,
    download: async () => bytes,
    config,
    workDir: path.join(dir, 'work'),
    log: () => {},
    sleep: async () => {},
    heartbeatMs: 1e9,
  });
  return { worker, api, adapter, journal, events, reports, prints, heartbeats };
}

test('records "printing" on the server before the printer receives the file, then reports sent', async (t) => {
  const h = await harness(t);
  await h.worker.processJob(job());
  assert.deepEqual(h.events, ['printing', 'print', 'sent']);
  assert.equal(h.prints.length, 1);
  assert.equal(h.prints[0].copies, 2);
  assert.equal(h.prints[0].printer, 'Office');
  assert.equal(h.reports[0].result.outcome, 'sent');
  assert.equal(h.reports[0].ref.jobId, JOB_ID);
  assert.equal((await h.journal.read()).activeJob, null);
});

test('does not touch the printer when the server does not confirm the start', async (t) => {
  const h = await harness(t, {
    apiOverrides: {
      markPrinting: async () => {
        throw new AgentApiError(0, 'network', 'offline');
      },
    },
  });
  await h.worker.processJob(job());
  assert.deepEqual(h.events, []);
  const state = await h.journal.read();
  assert.equal(state.activeJob, null);
  assert.equal(state.pendingReports.length, 0);
});

test('a printer error is reported once as failed and never retried by the agent', async (t) => {
  const err = Object.assign(new Error('spool refused'), { code: 'spooler_error' });
  const h = await harness(t, {
    adapterOverrides: {
      print: async () => {
        h.events.push('print-attempt');
        throw err;
      },
    },
  });
  await h.worker.processJob(job());
  assert.deepEqual(h.events, ['printing', 'print-attempt', 'failed']);
  assert.equal(h.reports[0].result.errorCode, 'spooler_error');
});

test('an error code the server cannot accept is replaced with a safe one', async (t) => {
  const h = await harness(t, {
    adapterOverrides: {
      listPrinters: async () => {
        throw Object.assign(new Error('powershell.exe could not be started.'), { code: 'ENOENT' });
      },
    },
  });
  await h.worker.processJob(job());
  assert.deepEqual(h.events, ['failed']);
  assert.equal(h.reports[0].result.errorCode, 'print_engine_missing');
});

test('a colour order on a black-and-white printer fails before anything is sent', async (t) => {
  const h = await harness(t);
  await h.worker.processJob(job({ settings: { copies: 1, colour: true, duplex: false, paper: 'A4' } }));
  assert.deepEqual(h.events, ['failed']);
  assert.equal(h.reports[0].result.errorCode, 'unsupported_setting');
  assert.match(h.reports[0].result.errorMessage, /does not print in colour/);
});

test('an offline printer fails before anything is sent', async (t) => {
  const h = await harness(t, { printers: [{ ...OFFICE, enabled: false }] });
  await h.worker.processJob(job());
  assert.deepEqual(h.events, ['failed']);
  assert.equal(h.reports[0].result.errorCode, 'printer_offline');
});

test('no printer chosen and no default fails with printer_not_found', async (t) => {
  const h = await harness(t, { printers: [{ ...OFFICE, isDefault: false }] });
  await h.worker.processJob(job());
  assert.deepEqual(h.events, ['failed']);
  assert.equal(h.reports[0].result.errorCode, 'printer_not_found');
});

test('the printer named on the order wins over this computer\'s fallback', async (t) => {
  const front = { ...OFFICE, name: 'Front', isDefault: false };
  const h = await harness(t, { printers: [OFFICE, front], config: { printer: 'Office' } });
  await h.worker.processJob(job({ printer: 'Front' }));
  assert.equal(h.prints[0].printer, 'Front');
});

test('a file whose size differs from the upload is refused', async (t) => {
  const h = await harness(t);
  await h.worker.processJob(job({ size_bytes: 5 }));
  assert.deepEqual(h.events, ['failed']);
  assert.equal(h.reports[0].result.errorCode, 'file_changed');
});

test('an unknown file type is refused and nothing is printed', async (t) => {
  const h = await harness(t, { bytes: GIF });
  await h.worker.processJob(job({ size_bytes: GIF.length }));
  assert.deepEqual(h.events, ['failed']);
  assert.equal(h.reports[0].result.errorCode, 'file_type_unknown');
});

test('a JPEG is wrapped in a PDF for printers that only accept PDF', async (t) => {
  let seenBytes = null;
  const h = await harness(t, {
    acceptsImages: false,
    bytes: JPEG,
    adapterOverrides: {
      print: async (opts) => {
        h.events.push('print');
        seenBytes = await readFile(opts.file);
        assert.ok(opts.file.endsWith('.pdf'));
        return { spoolerId: null };
      },
    },
  });
  await h.worker.processJob(job({ size_bytes: JPEG.length }));
  assert.deepEqual(h.events, ['printing', 'print', 'sent']);
  assert.equal(seenBytes.subarray(0, 4).toString('latin1'), '%PDF');
});

test('a finish report that cannot be sent is kept and sent later, once', async (t) => {
  const sent = [];
  let online = false;
  const h = await harness(t, {
    apiOverrides: {
      finish: async (ref, result) => {
        if (!online) throw new AgentApiError(0, 'network', 'offline');
        sent.push({ ref, result });
        return { ok: true };
      },
    },
  });
  await h.worker.processJob(job());
  assert.equal((await h.journal.read()).pendingReports.length, 1);

  online = true;
  await h.worker.flushReports();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].ref.jobId, JOB_ID);
  assert.equal(sent[0].result.outcome, 'sent');
  assert.equal((await h.journal.read()).pendingReports.length, 0);

  await h.worker.flushReports();
  assert.equal(sent.length, 1);
});

test('a result the server no longer expects (409) is dropped without a retry loop', async (t) => {
  const h = await harness(t, {
    apiOverrides: {
      finish: async () => {
        throw new AgentApiError(409, 'lease_lost', 'QRquick took this job back.');
      },
    },
  });
  await h.worker.processJob(job());
  assert.equal((await h.journal.read()).pendingReports.length, 0);
});

test('after a restart, a job the printer accepted is reported as sent', async (t) => {
  const h = await harness(t);
  await h.journal.setActive({ jobId: JOB_ID, attempt: 1, state: 'submitted', at: 1 });
  await h.worker.recoverAfterRestart();
  const state = await h.journal.read();
  assert.equal(state.activeJob, null);
  assert.deepEqual(state.pendingReports, [{ jobId: JOB_ID, attempt: 1, outcome: 'sent' }]);
  assert.deepEqual(h.events, []);
});

test('after a restart during sending, nothing is reported and nothing is reprinted', async (t) => {
  const h = await harness(t);
  await h.journal.setActive({ jobId: JOB_ID, attempt: 1, state: 'submitting', at: 1 });
  await h.worker.recoverAfterRestart();
  const state = await h.journal.read();
  assert.equal(state.activeJob, null);
  assert.equal(state.pendingReports.length, 0);
  assert.deepEqual(h.events, []);
});

test('a revoked agent (401) stops the loop with AgentRevokedError', async (t) => {
  const h = await harness(t, {
    apiOverrides: {
      claim: async () => {
        throw new AgentApiError(401, 'agent_unauthorized', 'Pair it again.');
      },
    },
  });
  await assert.rejects(h.worker.run(), AgentRevokedError);
});

test('run prints the one job it is given and stops when aborted', async (t) => {
  const controller = new AbortController();
  let claims = 0;
  const h = await harness(t, {
    apiOverrides: {
      claim: async () => {
        claims += 1;
        if (claims === 1) return { job: job() };
        controller.abort();
        return { job: null };
      },
    },
  });
  await h.worker.run({ signal: controller.signal });
  assert.deepEqual(h.events.filter((e) => e !== 'heartbeat'), ['printing', 'print', 'sent']);
});

test('the status report lists printers with only the fields the server stores', async (t) => {
  const h = await harness(t);
  await h.worker.sendHeartbeat();
  assert.deepEqual(h.heartbeats[0].printers[0], {
    name: 'Office',
    isDefault: true,
    enabled: true,
    capabilitiesKnown: true,
    colour: false,
    duplex: true,
    papers: ['A4'],
  });
});

test('order settings default to one black-and-white A4 copy and reject silly copy counts', () => {
  assert.deepEqual(normaliseSettings(undefined), { copies: 1, colour: false, duplex: false, paper: 'A4' });
  assert.throws(() => normaliseSettings({ copies: 0 }), /between 1 and 100/);
  assert.throws(() => normaliseSettings({ copies: 101 }), /between 1 and 100/);
});

test('checkSettings refuses what the printer cannot do, and allows what it can', () => {
  const simplex = { copies: 1, colour: false, duplex: false, paper: 'A4' };
  assert.equal(checkSettings(simplex, OFFICE), null);
  assert.equal(checkSettings({ ...simplex, duplex: true }, { ...OFFICE, duplex: false }).code, 'unsupported_setting');
  assert.equal(checkSettings({ ...simplex, paper: 'A3' }, OFFICE).code, 'unsupported_setting');
  assert.equal(
    checkSettings({ ...simplex, colour: true }, { ...OFFICE, capabilitiesKnown: false }).code,
    'printer_unknown',
  );
  // Without colour or double-sided, unknown options are not a reason to stop.
  assert.equal(checkSettings(simplex, { ...OFFICE, capabilitiesKnown: false }), null);
});

test('choosePrinter prefers the order, then this computer\'s fallback, then the system default', () => {
  const list = [OFFICE, { ...OFFICE, name: 'Front', isDefault: false }];
  assert.equal(choosePrinter({ printers: list, wanted: 'Front', configured: 'Office' }).name, 'Front');
  assert.equal(choosePrinter({ printers: list, configured: 'Front' }).name, 'Front');
  assert.equal(choosePrinter({ printers: list }).name, 'Office');
  assert.equal(choosePrinter({ printers: list, wanted: 'Missing' }), null);
});
