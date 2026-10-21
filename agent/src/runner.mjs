// Runs a program with a list of arguments. No shell is involved, so a printer name
// or a file path can never be read as a command.

import { execFile } from 'node:child_process';

export function runCommand(file, args, { timeoutMs = 60000, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, ...env },
      },
      (error, stdout, stderr) => {
        if (error && typeof error.code === 'string') {
          // ENOENT and similar: the program could not be started at all.
          const missing = new Error(`${file} could not be started.`);
          missing.code = error.code;
          reject(missing);
          return;
        }
        resolve({
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          stdout: String(stdout),
          stderr: String(stderr),
          timedOut: Boolean(error?.killed),
        });
      },
    );
  });
}
