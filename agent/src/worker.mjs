// The agent's main loop. It keeps the server informed, takes one job at a time,
// checks that the chosen printer can do what the order asks, and prints only after
// the server has recorded that printing has started.
//
// Duplicate prevention, in order:
//   1. The server hands a job to one agent at a time (a lease).
//   2. The agent asks the server to record "printing" before it sends the file.
//      If that fails, or the server says the job was taken back, nothing is printed.
//   3. The agent writes a note to disk before sending and after it is accepted, so a
//      restart knows whether a job may already have been printed. Reports that could
//      not be sent yet are kept and sent later.
//   4. The server never requeues a job that reached "printing". It asks the owner.

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentApiError, downloadFile } from './api.mjs';
import { detectFileType, MAX_FILE_BYTES } from './file-check.mjs';
import { imageToPdf } from './image-to-pdf.mjs';

export class AgentRevokedError extends Error {
  constructor() {
    super('This computer was removed from QRquick. Pair it again to print.');
    this.name = 'AgentRevokedError';
  }
}

function safeMessage(err) {
  return String(err?.message ?? 'Unknown problem').slice(0, 300);
}

// The server only accepts short lower-case codes. Anything else (for example a Node
// "ENOENT") is replaced with the fallback, so the job result is never rejected.
function codeOf(err, fallback) {
  return typeof err?.code === 'string' && /^[a-z_]{1,60}$/.test(err.code) ? err.code : fallback;
}

// Settings from the order. Anything outside the expected shape stops the job.
export function normaliseSettings(raw) {
  const settings = raw && typeof raw === 'object' ? raw : {};
  const copies = Number.isInteger(settings.copies) ? settings.copies : 1;
  if (copies < 1 || copies > 100) {
    const err = new Error('The number of copies must be between 1 and 100.');
    err.code = 'bad_settings';
    throw err;
  }
  return {
    copies,
    colour: settings.colour === true,
    duplex: settings.duplex === true,
    paper: typeof settings.paper === 'string' && settings.paper.length <= 10 ? settings.paper : 'A4',
  };
}

// The printer the server chose, else the one set on this computer, else the system default.
export function choosePrinter({ printers, wanted = null, configured = null }) {
  const name = wanted || configured || null;
  if (name) return printers.find((p) => p.name === name) ?? null;
  return printers.find((p) => p.isDefault) ?? null;
}

// Returns null when the printer can do the job, else { code, message }.
export function checkSettings(settings, printer) {
  if (!printer.enabled) {
    return { code: 'printer_offline', message: `"${printer.name}" is turned off or offline.` };
  }
  if (!printer.capabilitiesKnown && (settings.colour || settings.duplex)) {
    return {
      code: 'printer_unknown',
      message: `QRquick could not read the options of "${printer.name}". Check the printer is set up on this computer.`,
    };
  }
  if (settings.colour && !printer.colour) {
    return {
      code: 'unsupported_setting',
      message: `This order is in colour, but "${printer.name}" does not print in colour. Use a colour printer.`,
    };
  }
  if (settings.duplex && !printer.duplex) {
    return {
      code: 'unsupported_setting',
      message: `This order is double-sided, but "${printer.name}" cannot print on both sides.`,
    };
  }
  if (Array.isArray(printer.papers) && printer.papers.length > 0) {
    const supported = printer.papers.some((p) => p.toLowerCase() === settings.paper.toLowerCase());
    if (!supported) {
      return {
        code: 'unsupported_setting',
        message: `${settings.paper} paper is not supported by "${printer.name}".`,
      };
    }
  }
  return null;
}

export function toServerPrinter(p) {
  return {
    name: p.name,
    isDefault: p.isDefault === true,
    enabled: p.enabled !== false,
    capabilitiesKnown: p.capabilitiesKnown === true,
    colour: p.colour === true,
    duplex: p.duplex === true,
    papers: Array.isArray(p.papers) ? p.papers.slice(0, 20) : null,
  };
}

export function createWorker({
  api,
  adapter,
  journal,
  download = (url, options) => downloadFile(url, options),
  config = {},
  workDir = path.join(os.tmpdir(), 'qrquick-agent'),
  log = () => {},
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  pollMs = 5000,
  heartbeatMs = 30000,
  version = '0.1.0',
}) {
  let lastHeartbeat = 0;
  let failures = 0;

  async function sendHeartbeat() {
    let printers = [];
    try {
      printers = (await adapter.listPrinters()).map(toServerPrinter);
    } catch (err) {
      log(`Could not read the printers: ${safeMessage(err)}`);
    }
    try {
      await api.heartbeat({ version, printers });
      lastHeartbeat = now();
    } catch (err) {
      if (err instanceof AgentApiError && err.status === 401) throw new AgentRevokedError();
      log(`Could not send status: ${safeMessage(err)}`);
    }
  }

  // Sends results that could not be sent earlier. Ones the server no longer expects are dropped.
  async function flushReports() {
    const state = await journal.read();
    for (const report of state.pendingReports) {
      try {
        await api.finish(report, {
          outcome: report.outcome,
          errorCode: report.errorCode ?? null,
          errorMessage: report.errorMessage ?? null,
        });
        await journal.removeReport(report.jobId, report.attempt);
      } catch (err) {
        if (err instanceof AgentApiError && err.status === 401) throw new AgentRevokedError();
        if (err instanceof AgentApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
          log(`A job result was not needed any more and was dropped (${err.code}).`);
          await journal.removeReport(report.jobId, report.attempt);
          continue;
        }
        log('A job result is waiting to be sent. It will be retried.');
        return;
      }
    }
  }

  async function report(jobRef, outcome, errorCode = null, errorMessage = null) {
    try {
      await api.finish(jobRef, { outcome, errorCode, errorMessage });
    } catch (err) {
      if (err instanceof AgentApiError && err.status === 401) throw new AgentRevokedError();
      if (err instanceof AgentApiError && err.status === 409) return; // the server already moved on
      if (err instanceof AgentApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        log(`The server did not accept a job result (${err.code}).`);
        return;
      }
      await journal.addReport({ ...jobRef, outcome, errorCode, errorMessage });
    }
  }

  async function processJob(job) {
    const jobRef = { jobId: job.job_id, attempt: job.attempt };
    const label = `Job ${String(job.job_id).slice(0, 8)} (attempt ${job.attempt})`;

    let settings;
    try {
      settings = normaliseSettings(job.settings);
    } catch (err) {
      log(`${label}: the order settings are not valid.`);
      await report(jobRef, 'failed', err.code ?? 'bad_settings', safeMessage(err));
      return;
    }

    let printers;
    try {
      printers = await adapter.listPrinters();
    } catch (err) {
      log(`${label}: ${safeMessage(err)}`);
      await report(jobRef, 'failed', codeOf(err, 'print_engine_missing'), safeMessage(err));
      return;
    }
    const printer = choosePrinter({ printers, wanted: job.printer, configured: config.printer });
    if (!printer) {
      const name = job.printer || config.printer;
      const message = name
        ? `The printer "${name}" is not connected to this computer.`
        : 'No printer is set up on this computer.';
      log(`${label}: ${message}`);
      await report(jobRef, 'failed', 'printer_not_found', message);
      return;
    }
    const problem = checkSettings(settings, printer);
    if (problem) {
      log(`${label}: ${problem.message}`);
      await report(jobRef, 'failed', problem.code, problem.message);
      return;
    }

    let bytes;
    try {
      bytes = await download(job.file_url, { maxBytes: MAX_FILE_BYTES });
    } catch (err) {
      log(`${label}: the file could not be downloaded.`);
      await report(jobRef, 'failed', codeOf(err, 'download_failed'), safeMessage(err));
      return;
    }
    if (Number.isInteger(job.size_bytes) && bytes.length !== job.size_bytes) {
      await report(jobRef, 'failed', 'file_changed', 'The file does not match what the customer uploaded.');
      return;
    }

    const type = detectFileType(bytes);
    if (!type) {
      await report(jobRef, 'failed', 'file_type_unknown', 'The file is not a PDF, JPEG or PNG.');
      return;
    }

    let toPrint = bytes;
    let extension = type === 'jpeg' ? 'jpg' : type;
    if (type !== 'pdf' && !adapter.acceptsImages) {
      try {
        toPrint = imageToPdf(bytes);
        extension = 'pdf';
      } catch (err) {
        await report(jobRef, 'failed', codeOf(err, 'image_unsupported'), safeMessage(err));
        return;
      }
    }

    await mkdir(workDir, { recursive: true });
    const dir = await mkdtemp(path.join(workDir, 'job-'));
    try {
      const filePath = path.join(dir, `job.${extension}`);
      await writeFile(filePath, toPrint, { mode: 0o600 });

      // Note first, so a crash between here and the printer is seen on restart.
      await journal.setActive({ ...jobRef, state: 'starting', at: now() });
      try {
        await api.markPrinting(jobRef);
      } catch (err) {
        // The printer has not been given the file. Do not report a failure: if the server did record
        // "printing", a failure report would invite a reprint. The agent cannot always tell which of
        // these happened, so it leaves the job to the server:
        //   - The "printing" request never reached the server, or the server refused it (for example
        //     lease_lost) and recorded nothing. The job stays "claimed". Once the claim lease ends, the
        //     server requeues it the next time any computer in this shop sends a heartbeat or asks for
        //     work (or fails it after repeated claims).
        //   - The server recorded "printing", but its reply was lost. If no "sent" or "failed" report
        //     arrives before the printing lease ends, the server moves the job to "needs_check" for the
        //     owner to decide. It is never requeued automatically.
        await journal.clearActive();
        log(`${label}: not printed. The server did not confirm the start (${err.code ?? 'error'}).`);
        return;
      }

      await journal.setActive({ ...jobRef, state: 'submitting', at: now() });
      let result;
      try {
        result = await adapter.print({
          printer: printer.name,
          file: filePath,
          copies: settings.copies,
          colour: settings.colour,
          duplex: settings.duplex,
          paper: settings.paper,
          title: `QRquick ${String(job.job_id).slice(0, 8)}`,
          capabilities: printer,
        });
      } catch (err) {
        await journal.clearActive();
        log(`${label}: the printer did not accept the job (${err.code ?? 'error'}).`);
        await report(jobRef, 'failed', codeOf(err, 'spooler_error'), safeMessage(err));
        return;
      }

      await journal.setActive({ ...jobRef, state: 'submitted', at: now(), spoolerId: result?.spoolerId ?? null });
      await report(jobRef, 'sent');
      await journal.clearActive();
      log(
        adapter.simulated
          ? `${label}: SIMULATED on "${printer.name}". No printer was used and no paper came out.`
          : `${label}: sent to ${printer.name}.`,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  // A restart after a crash. A job that was accepted by the printer system is reported as sent.
  // A job that was only being prepared is cleared, because nothing was sent. A job whose state
  // is unknown is left to the server, which asks the owner to check the printer.
  async function recoverAfterRestart() {
    const state = await journal.read();
    const active = state.activeJob;
    if (active) {
      if (active.state === 'submitted') {
        await journal.addReport({ jobId: active.jobId, attempt: active.attempt, outcome: 'sent' });
      }
      await journal.clearActive();
    }
  }

  async function run({ signal } = {}) {
    await recoverAfterRestart();
    while (!signal?.aborted) {
      try {
        if (now() - lastHeartbeat >= heartbeatMs) await sendHeartbeat();
        await flushReports();
        const response = await api.claim();
        failures = 0;
        if (!response || !response.job) {
          await sleep(pollMs);
          continue;
        }
        await processJob(response.job);
      } catch (err) {
        if (err instanceof AgentRevokedError) throw err;
        if (err instanceof AgentApiError && err.status === 401) throw new AgentRevokedError();
        failures += 1;
        log(`Problem talking to QRquick: ${safeMessage(err)} Trying again.`);
        await sleep(Math.min(60000, 5000 * failures));
      }
    }
  }

  return { run, processJob, sendHeartbeat, flushReports, recoverAfterRestart };
}
