// What the agent keeps on this computer: the server address, the agent's token,
// the printer to use and the computer's name. The token is a secret. The file is
// written with owner-only permissions where the system supports them.

import { mkdir, readFile, rename, writeFile, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function defaultConfigDir(platform = process.platform, env = process.env) {
  if (env.QRQUICK_AGENT_DIR) return env.QRQUICK_AGENT_DIR;
  if (platform === 'win32') {
    const appData = env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'QRquick Print Agent');
  }
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'qrquick-print-agent');
}

export function configPaths(dir) {
  return {
    dir,
    config: path.join(dir, 'agent.json'),
    outbox: path.join(dir, 'outbox.json'),
  };
}

// The address of the print-agent function. Only https is accepted, except for a
// test server on this same computer.
export function normaliseServerUrl(input) {
  let url;
  try {
    url = new URL(String(input ?? '').trim());
  } catch {
    throw new Error('The server address is not a valid web address.');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('The server address must start with https://');
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

export async function loadConfig(dir) {
  try {
    const parsed = JSON.parse(await readFile(configPaths(dir).config, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveConfig(dir, config) {
  const { config: file } = configPaths(dir);
  await mkdir(dir, { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
  try {
    await chmod(file, 0o600);
  } catch {
    // Windows ignores POSIX modes. The folder is already private to the user.
  }
}
