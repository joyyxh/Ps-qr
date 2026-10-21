// Command-line front end for the agent. Each command returns an exit code and never
// prints the agent's token.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAgentApi } from './api.mjs';
import { configPaths, defaultConfigDir, loadConfig, normaliseServerUrl, saveConfig } from './config.mjs';
import { createJournal } from './journal.mjs';
import { createPrinterAdapter } from './printers/index.mjs';
import { findSumatra } from './printers/windows.mjs';
import { runCommand } from './runner.mjs';
import { buildSamplePdf } from './sample-page.mjs';
import { AgentRevokedError, checkSettings, choosePrinter, createWorker, toServerPrinter } from './worker.mjs';

export const VERSION = '0.1.0';

export const USAGE = `QRquick print agent ${VERSION}

Commands:
  pair <server-address> <pairing-code>   Connect this computer to a shop (once)
  printers                               List the printers on this computer
  set-printer <printer-name>             Pick the fallback printer for this computer
  doctor                                 Check the setup and the connection to QRquick
  test-print                             Print one test page on the chosen printer (uses paper)
  run                                    Start printing approved orders (keep this running)

Setup order: pair, printers, set-printer, doctor, test-print, run.
`;

function platformName(platform) {
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return null;
}

function makeAdapter(deps, platform) {
  if (deps.adapter) return deps.adapter;
  const sumatraPath = platform === 'win32' ? findSumatra() : null;
  return createPrinterAdapter({ platform, run: deps.run ?? runCommand, sumatraPath });
}

async function requireConfig(dir) {
  const config = await loadConfig(dir);
  if (!config?.token) throw new Error('This computer is not paired yet. Run "pair" first.');
  return config;
}

async function pair([address, code], deps, { dir, out, platform }) {
  if (!address || !code) throw new Error('Usage: qrquick-print-agent pair <server-address> <pairing-code>');
  const key = platformName(platform);
  if (!key) throw new Error('This print agent runs on Windows and Linux only.');
  const serverUrl = normaliseServerUrl(address);
  const computerName = (deps.computerName ?? os.hostname()).slice(0, 60);
  const api = createAgentApi({ serverUrl, fetchImpl: deps.fetchImpl });
  const result = await api.pair({ code: code.trim(), name: computerName, platform: key, version: VERSION });
  await saveConfig(dir, {
    serverUrl,
    token: result.token,
    agentId: result.agent_id,
    shopName: result.shop_name,
    computerName,
    platform: key,
    printer: null,
    pairedAt: new Date().toISOString(),
  });
  out(`Paired with ${result.shop_name}.`);
  out('Next: run "printers", then "set-printer <name>", then "doctor" and "test-print".');
  return 0;
}

async function printers(_args, deps, { dir, out, platform }) {
  const list = await makeAdapter(deps, platform).listPrinters();
  const config = await loadConfig(dir);
  if (list.length === 0) {
    out('No printers were found on this computer. Install the printer, then run this again.');
    return 0;
  }
  for (const p of list) {
    const flags = [
      p.isDefault ? 'system default' : null,
      p.enabled ? 'ready' : 'offline or turned off',
      p.capabilitiesKnown ? (p.colour ? 'colour' : 'black and white only') : 'options not readable',
      p.duplex ? 'double-sided' : null,
      config?.printer === p.name ? 'chosen for QRquick' : null,
    ].filter(Boolean);
    out(`${p.name} (${flags.join(', ')})`);
  }
  return 0;
}

async function setPrinter([name], deps, { dir, out, platform }) {
  if (!name) throw new Error('Usage: qrquick-print-agent set-printer <printer-name>');
  const config = await requireConfig(dir);
  const list = await makeAdapter(deps, platform).listPrinters();
  if (!list.some((p) => p.name === name)) {
    throw new Error(`"${name}" is not a printer on this computer. Run "printers" to see the exact names.`);
  }
  await saveConfig(dir, { ...config, printer: name });
  out(`"${name}" is now the fallback printer for this computer. The owner app can still choose another printer per order.`);
  return 0;
}

async function doctor(_args, deps, { dir, out, platform }) {
  let problems = 0;
  const check = (ok, label, detail = '') => {
    out(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` - ${detail}` : ''}`);
    if (!ok) problems += 1;
  };

  const config = await loadConfig(dir);
  check(Boolean(config?.token), 'Paired with QRquick', config?.shopName ? `shop: ${config.shopName}` : 'run "pair" first');

  let list = null;
  try {
    list = await makeAdapter(deps, platform).listPrinters();
    check(list.length > 0, 'Printers found on this computer', `${list.length} found`);
  } catch (err) {
    check(false, 'Printing system available', err.message);
  }

  if (platform === 'win32') {
    const sumatra = findSumatra();
    check(Boolean(sumatra), 'SumatraPDF installed', sumatra ?? 'not found, see agent/README.md');
  }

  if (config?.printer) {
    check((list ?? []).some((p) => p.name === config.printer), 'Fallback printer still exists', config.printer);
  }

  if (config?.token) {
    if (!list) {
      check(false, 'Connected to QRquick', 'skipped, because the printers could not be read');
    } else {
      try {
        const api = createAgentApi({ serverUrl: config.serverUrl, token: config.token, fetchImpl: deps.fetchImpl });
        // The real printer list is sent. An empty list would erase the printers the owner sees.
        await api.heartbeat({ version: VERSION, printers: list.map(toServerPrinter) });
        check(true, 'Connected to QRquick');
      } catch (err) {
        check(false, 'Connected to QRquick', err.message);
      }
    }
  }

  out(problems
    ? `\n${problems} check(s) need attention.`
    : '\nAll checks passed. Run "test-print" to confirm the printer works before relying on it.');
  return problems ? 1 : 0;
}

async function testPrint(_args, deps, { dir, out, platform }) {
  const config = await requireConfig(dir);
  const adapter = makeAdapter(deps, platform);
  const list = await adapter.listPrinters();
  const printer = choosePrinter({ printers: list, configured: config.printer });
  if (!printer) throw new Error('No printer is set up on this computer. Run "printers" and "set-printer".');
  const problem = checkSettings({ copies: 1, colour: false, duplex: false, paper: 'A4' }, printer);
  if (problem) throw new Error(problem.message);

  const folder = await mkdtemp(path.join(os.tmpdir(), 'qrquick-test-'));
  try {
    const file = path.join(folder, 'test-page.pdf');
    await writeFile(file, buildSamplePdf([
      'QRquick print agent',
      `Computer: ${os.hostname()}`,
      `Printer: ${printer.name}`,
      `Time: ${new Date().toISOString()}`,
    ]));
    await adapter.print({
      printer: printer.name,
      file,
      copies: 1,
      colour: false,
      duplex: false,
      paper: 'A4',
      title: 'QRquick test page',
      capabilities: printer,
    });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  out(`Test page sent to "${printer.name}". Check that a page came out. The agent cannot see the paper, so confirm it yourself.`);
  return 0;
}

async function run(_args, deps, { dir, out, platform }) {
  const config = await requireConfig(dir);
  const api = createAgentApi({ serverUrl: config.serverUrl, token: config.token, fetchImpl: deps.fetchImpl });
  const worker = createWorker({
    api,
    adapter: makeAdapter(deps, platform),
    journal: createJournal(configPaths(dir).outbox),
    download: deps.download,
    config: { printer: config.printer },
    log: (line) => out(`${new Date().toISOString()} ${line}`),
    version: VERSION,
  });
  out(`QRquick print agent ${VERSION} is running for ${config.shopName}. Keep this window open. Press Ctrl+C to stop.`);
  try {
    await worker.run();
  } catch (err) {
    if (err instanceof AgentRevokedError) {
      out(err.message);
      return 2;
    }
    throw err;
  }
  return 0;
}

const COMMANDS = { pair, printers, 'set-printer': setPrinter, doctor, 'test-print': testPrint, run };

// Entry point. deps are for tests: dir, platform, out, fail, fetchImpl, run, adapter, download, computerName.
export async function main(argv, deps = {}) {
  const out = deps.out ?? ((line) => process.stdout.write(`${line}\n`));
  const fail = deps.fail ?? ((line) => process.stderr.write(`${line}\n`));
  const platform = deps.platform ?? process.platform;
  const dir = deps.dir ?? defaultConfigDir(platform);
  const [command = 'help', ...args] = argv;

  if (command === 'help' || command === '--help' || command === '-h') {
    out(USAGE);
    return 0;
  }
  const handler = COMMANDS[command];
  if (!handler) {
    fail(`Unknown command "${command}".\n\n${USAGE}`);
    return 1;
  }
  try {
    return await handler(args, deps, { dir, out, platform });
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
