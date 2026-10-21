// The agent's own notes on disk. It records the job it is about to send to the
// printer, and reports the server has not yet received. The note is written before
// a file goes to the printer, so a crash or power cut cannot make the agent forget a
// job that may have been printed.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createJournal(file) {
  async function read() {
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return { activeJob: null, pendingReports: [] };
      throw err;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Guessing could mean printing again, so stop and ask instead.
      throw new Error(`The agent's notes file is damaged (${file}). Keep it, then ask for help before printing again.`);
    }
    return {
      activeJob: data.activeJob ?? null,
      pendingReports: Array.isArray(data.pendingReports) ? data.pendingReports : [],
    };
  }

  async function write(data) {
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`);
    await rename(temp, file);
  }

  return {
    read,
    async setActive(job) {
      const data = await read();
      data.activeJob = job;
      await write(data);
    },
    async clearActive() {
      const data = await read();
      data.activeJob = null;
      await write(data);
    },
    async addReport(report) {
      const data = await read();
      data.pendingReports.push(report);
      await write(data);
    },
    async removeReport(jobId, attempt) {
      const data = await read();
      data.pendingReports = data.pendingReports.filter((r) => !(r.jobId === jobId && r.attempt === attempt));
      await write(data);
    },
  };
}
