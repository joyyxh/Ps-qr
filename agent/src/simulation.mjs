// Offline simulation for testing the order-to-print steps without a printer.
//
// This module never contacts QRquick. Jobs come from a local fixture file, the "server" is an
// in-memory copy of the server's job rules, files are read from the fixture folder, and the
// printer is the simulated adapter. Nothing here can reach a database, so a simulated job can
// never be recorded as a real "sent" on any server.
//
// The in-memory server follows the same rules as migration 0010 (agent_claim_next_job,
// agent_mark_printing and agent_finish_job). A test reads the migration to check that these
// rules still match it.

import { realpathSync } from 'node:fs';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentApiError } from './api.mjs';
import { createJournal } from './journal.mjs';
import { createSimulatedAdapter } from './printers/simulated.mjs';
import { createWorker } from './worker.mjs';

export const SIMULATION_BANNER =
  'SIMULATION ONLY. Nothing is sent to QRquick or to any printer, and no paper comes out. Jobs come from a local file.';
export const SAMPLE_FILE_NAME = 'sample.pdf';

const MAX_JOBS = 50;
const JOB_STATES = ['queued', 'printing', 'needs_check'];
const DEFAULT_MAX_STEPS = 200;

// Raised when a simulation would not stop on its own. It is a safety net, not a normal result.
export class SimulationStopped extends Error {
  constructor(message) {
    super(message);
    this.name = 'SimulationStopped';
  }
}

// True when a resolved location is the folder itself or inside it.
function isInside(folder, location) {
  return location === folder || location.startsWith(folder + path.sep);
}

// The resolved location of a file, with links followed. Null when the file does not exist: that
// is reported later, when the file is read.
function realLocationSync(filePath) {
  try {
    return realpathSync(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Checks a fixture file before anything runs. One problem refuses the whole file, so a
// partly valid file is never half simulated. Only approved and paid orders are accepted,
// which mirrors the server's rule that a print job exists only for an approved, paid order.
export function readFixtureJobs(data, fixtureDir) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.jobs)) {
    throw new Error('The fixture file needs a "jobs" list.');
  }
  if (data.jobs.length < 1 || data.jobs.length > MAX_JOBS) {
    throw new Error(`The fixture file must have from 1 to ${MAX_JOBS} jobs.`);
  }
  const root = path.resolve(fixtureDir);
  // The folder's real location. A file's links are resolved and compared with it, so a link
  // cannot lead out of the folder.
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch {
    throw new Error('The fixture folder could not be checked. Nothing was simulated.');
  }
  const seen = new Set();
  return data.jobs.map((raw, index) => {
    const label = `Job ${index + 1}`;
    if (!raw || typeof raw !== 'object') throw new Error(`${label} is not an object.`);

    const jobId = raw.job_id;
    if (typeof jobId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(jobId)) {
      throw new Error(`${label} needs a job_id made of letters, digits and dashes.`);
    }
    if (seen.has(jobId)) throw new Error(`The job_id "${jobId}" appears more than once.`);
    seen.add(jobId);

    if (raw.approved !== true || raw.paid !== true) {
      throw new Error(
        `"${jobId}" is not approved and paid. Only approved, paid orders can be simulated, as on the real server. Nothing was simulated.`,
      );
    }

    const attempt = raw.attempt ?? 1;
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > 100) {
      throw new Error(`"${jobId}" has an invalid attempt number.`);
    }
    const state = raw.state ?? 'queued';
    if (!JOB_STATES.includes(state)) throw new Error(`"${jobId}" has an unknown state "${state}".`);

    if (typeof raw.file !== 'string' || raw.file === '' || path.isAbsolute(raw.file) || raw.file.includes('\0')) {
      throw new Error(`"${jobId}" needs a file name inside the fixture folder.`);
    }
    const filePath = path.resolve(root, raw.file);
    if (!filePath.startsWith(root + path.sep)) {
      throw new Error(`"${jobId}" points outside the fixture folder. Nothing was simulated.`);
    }
    let real;
    try {
      real = realLocationSync(filePath);
    } catch {
      throw new Error(`"${jobId}" could not be checked. Nothing was simulated.`);
    }
    if (real !== null && !isInside(realRoot, real)) {
      throw new Error(`"${jobId}" points outside the fixture folder. Nothing was simulated.`);
    }
    if (raw.size_bytes !== undefined && (!Number.isInteger(raw.size_bytes) || raw.size_bytes < 0)) {
      throw new Error(`"${jobId}" has an invalid size_bytes.`);
    }
    if (raw.printer !== undefined && raw.printer !== null && typeof raw.printer !== 'string') {
      throw new Error(`"${jobId}" has an invalid printer name.`);
    }

    return {
      jobId,
      attempt,
      state,
      filePath,
      settings: raw.settings && typeof raw.settings === 'object' ? raw.settings : {},
      printer: raw.printer ?? null,
      sizeBytes: raw.size_bytes,
    };
  });
}

// The in-memory stand-in for the server. It has no network code. It is the only "server"
// a simulation has, and it follows the same rules as migration 0010:
//   - a job is claimed only from 'queued' (so 'printing' and 'needs_check' are never printed again);
//   - 'printing' is recorded only for a claimed job with the same attempt;
//   - 'sent' is accepted only from 'printing' or 'needs_check';
//   - 'failed' is accepted only from 'claimed' or 'printing'.
export function createSimulatedServer(jobs, { abort = () => {} } = {}) {
  const records = jobs.map((job) => ({
    jobId: job.jobId,
    attempt: job.attempt,
    state: job.state,
    filePath: job.filePath,
    settings: job.settings,
    printer: job.printer,
    sizeBytes: job.sizeBytes,
    simulated: false,
    errorCode: null,
  }));
  const calls = [];
  let claims = 0;

  function find(jobRef) {
    return records.find((r) => r.jobId === jobRef.jobId && r.attempt === jobRef.attempt) ?? null;
  }
  const lost = () => new AgentApiError(409, 'lease_lost', 'The job was taken back.');

  const api = {
    async heartbeat() {
      calls.push('heartbeat');
      return { ok: true };
    },

    async claim() {
      calls.push('claim');
      claims += 1;
      // Each job can be claimed once. Anything beyond that is a bug, so the simulation ends.
      if (claims > jobs.length + 1) {
        abort();
        return { job: null };
      }
      const next = records.find((r) => r.state === 'queued');
      if (!next) {
        abort();
        return { job: null };
      }
      next.state = 'claimed';
      return {
        job: {
          job_id: next.jobId,
          attempt: next.attempt,
          settings: next.settings,
          printer: next.printer,
          file_url: next.filePath,
          size_bytes: next.sizeBytes,
        },
      };
    },

    async markPrinting(jobRef) {
      calls.push('printing');
      const r = find(jobRef);
      if (!r || r.state !== 'claimed') throw lost();
      r.state = 'printing';
      return { ok: true };
    },

    async finish(jobRef, { outcome, errorCode = null }) {
      calls.push(`finish:${outcome}`);
      const r = find(jobRef);
      if (!r) throw lost();
      if (r.state === outcome) return { ok: true, already_recorded: true };
      if (outcome === 'sent' && (r.state === 'printing' || r.state === 'needs_check')) {
        r.state = 'sent';
        r.simulated = true;
        return { ok: true };
      }
      if (outcome === 'failed' && (r.state === 'claimed' || r.state === 'printing')) {
        r.state = 'failed';
        r.errorCode = errorCode;
        return { ok: true };
      }
      throw lost();
    },
  };

  return { api, records, calls };
}

// Reads a file from the fixture folder only. Nothing is downloaded from anywhere.
async function readFixtureFile(filePath, { root, maxBytes }) {
  if (!filePath.startsWith(root + path.sep)) {
    const err = new Error('The file is outside the fixture folder.');
    err.code = 'download_failed';
    throw err;
  }
  // Checked again at read time, so a link put in place after the start is still refused.
  const realRoot = await realpath(root).catch(() => null);
  const real = await realpath(filePath).catch(() => null);
  if (realRoot === null || real === null) {
    const err = new Error('The file could not be read from the fixture folder.');
    err.code = 'download_failed';
    throw err;
  }
  if (!isInside(realRoot, real)) {
    const err = new Error('The file is outside the fixture folder.');
    err.code = 'download_failed';
    throw err;
  }
  const bytes = await readFile(real);
  if (bytes.length > maxBytes) {
    const err = new Error('The file is larger than the 10 MB limit.');
    err.code = 'file_too_large';
    throw err;
  }
  return bytes;
}

// Runs the real worker over the jobs, with the simulated server and the simulated printer.
// Returns the final state of each job. A loop that would never end stops with SimulationStopped.
export async function runSimulation({
  jobs,
  fixtureDir,
  out = () => {},
  version = '0.1.0',
  maxSteps = DEFAULT_MAX_STEPS,
  server,
}) {
  const work = await mkdtemp(path.join(os.tmpdir(), 'qrquick-simulation-'));
  try {
    const controller = new AbortController();
    const fake = server ?? createSimulatedServer(jobs, { abort: () => controller.abort() });
    const adapter = createSimulatedAdapter();
    const root = path.resolve(fixtureDir);
    let steps = 0;
    const worker = createWorker({
      api: fake.api,
      adapter,
      journal: createJournal(path.join(work, 'outbox.json')),
      download: (filePath, { maxBytes }) => readFixtureFile(filePath, { root, maxBytes }),
      config: {},
      workDir: path.join(work, 'job-files'),
      log: (line) => out(line),
      // Every pause counts as a step. A loop that never ends hits the limit and stops.
      sleep: async () => {
        steps += 1;
        if (steps > maxSteps) {
          throw new SimulationStopped('The simulation stopped at its safety limit. Nothing more was simulated.');
        }
        await new Promise((resolve) => setImmediate(resolve));
      },
      pollMs: 0,
      version,
    });
    await worker.run({ signal: controller.signal });
    return { records: fake.records, prints: adapter.prints, calls: fake.calls ?? [] };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// The scenario used when "simulate" is run with no file. The caller writes SAMPLE_FILE_NAME
// into the fixture folder first. It covers a normal job, a job the printer cannot do, a job
// already printing, and a job that needs a check.
export function builtInFixture() {
  const settings = { copies: 1, colour: false, duplex: false, paper: 'A4' };
  const base = { approved: true, paid: true, file: SAMPLE_FILE_NAME, printer: null };
  return {
    jobs: [
      { ...base, job_id: 'sim-0001', attempt: 1, state: 'queued', settings },
      { ...base, job_id: 'sim-0002', attempt: 1, state: 'queued', settings: { ...settings, paper: 'A3' } },
      { ...base, job_id: 'sim-0003', attempt: 1, state: 'printing', settings },
      { ...base, job_id: 'sim-0004', attempt: 1, state: 'needs_check', settings },
    ],
  };
}
