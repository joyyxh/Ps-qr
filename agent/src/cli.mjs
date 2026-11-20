// Command-line front end for the agent. Each command returns an exit code and never
// prints the agent's token.

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createAgentApi } from './api.mjs';
import { autostartFiles } from './autostart.mjs';
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
  autostart                              Write the file that starts "run" at sign-in, with the commands to install it

Setup order: pair, printers, set-printer, doctor, test-print, run, autostart.
`;

const AGENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// True when this is the single-file build (standalone/build.mjs), which runs without a script file.
async function isStandaloneExecutable() {
  try {
    const sea = await import('node:sea');
    return sea.isSea();
  } catch {
    return false; // Node older than 20.12 has no node:sea module, so it is never the single-file build.
  }
}

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

async function pair([address, code], deps, { dir, out, platform, guided = false }) {
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
  if (!guided) out('Next: run "printers", then "set-printer <name>", then "doctor" and "test-print".');
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

// Writes the start-at-sign-in file for this platform, next to the agent, and prints how to install it.
// It only starts the agent; the agent still prints only the orders the owner has approved and marked paid.
async function autostart(_args, deps, { dir, out, platform }) {
  if (!platformName(platform)) throw new Error('Start-at-sign-in is set up for Windows and Linux only.');
  const config = await requireConfig(dir);
  // The single-file build starts itself, so the file runs the executable with "run" and no script,
  // and the files go next to the executable.
  const standalone = deps.standalone ?? (await isStandaloneExecutable());
  const agentDir = deps.agentDir ?? (standalone ? path.dirname(process.execPath) : AGENT_DIR);
  const fileDir = path.join(agentDir, 'autostart');
  const user = deps.userId ?? (process.env.USERDOMAIN && process.env.USERNAME
    ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
    : '');
  const file = autostartFiles(platform, {
    nodePath: deps.nodePath ?? process.execPath,
    scriptPath: standalone ? null : path.join(agentDir, 'bin', 'qrquick-print-agent.mjs'),
    workingDir: agentDir,
    userId: user,
    fileDir,
  });
  await mkdir(fileDir, { recursive: true });
  await writeFile(file.path, file.content, { encoding: file.encoding });
  out(`Wrote ${file.path} for ${config.shopName ?? 'this shop'}.`);
  out('');
  out('To start the agent at sign-in, run these once:');
  for (const line of file.install) out(`  ${line}`);
  out('');
  out('To stop starting it at sign-in, run:');
  for (const line of file.remove) out(`  ${line}`);
  out('');
  out('The computer must stay on and signed in for orders to print. Orders wait in the queue while it is off.');
  return 0;
}

// Thrown when the person presses Ctrl+C at a question, or the console input closes before an answer.
export class SetupCancelled extends Error {
  constructor() {
    super('Setup was cancelled.');
    this.name = 'SetupCancelled';
  }
}

// Asks one question on the console. A new interface is made for each question and closed straight after,
// so the input is released before the agent starts and Ctrl+C reaches the running agent as usual.
function askConsole(question) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    rl.on('SIGINT', () => rl.close());
    rl.on('close', () => {
      if (!answered) reject(new SetupCancelled());
    });
    rl.question(question, (answer) => {
      answered = true;
      rl.close();
      resolve(answer);
    });
  });
}

// Lists the printers, asks for the fallback printer by number, and saves it. Enter skips the choice.
async function chooseFallbackPrinter(deps, ctx, ask) {
  const { out, platform } = ctx;
  const list = await makeAdapter(deps, platform).listPrinters();
  if (list.length === 0) {
    out('No printers were found on this computer. Install the printer, then open this again.');
    return;
  }
  out('Printers on this computer:');
  list.forEach((p, i) => {
    const notes = [p.isDefault ? 'system default' : null, p.enabled ? null : 'offline or turned off'].filter(Boolean);
    out(`  ${i + 1}. ${p.name}${notes.length ? ` (${notes.join(', ')})` : ''}`);
  });
  const answer = (await ask(`Number of the printer for QRquick [1-${list.length}], or press Enter to skip: `)).trim();
  if (answer === '') return;
  const index = Number(answer);
  if (!Number.isInteger(index) || index < 1 || index > list.length) {
    out('That is not a number on the list. Skipped. Choose a printer later with "set-printer".');
    return;
  }
  await setPrinter([list[index - 1].name], deps, ctx);
}

// Started with no arguments from a console window (double-click on Windows, "Run in Terminal" on Linux).
// It pairs the computer if needed, asks for the printer, then starts printing, so nobody has to know the
// command list. The window waits for Enter before it closes, so a failure message can be read.
async function startScreen(deps, ctx) {
  const { out, fail } = ctx;
  const ask = deps.ask ?? askConsole;
  const startAgent = deps.startAgent ?? (() => run([], deps, ctx));
  out(`QRquick print agent ${VERSION}`);
  out('');
  let code = 0;
  try {
    let config = await loadConfig(ctx.dir);
    if (config?.token) {
      out(`This computer is paired with ${config.shopName}.`);
    } else {
      out('This computer is not connected to a shop yet.');
      out('Ask the shop owner for the server address and a pairing code from the QRquick owner app.');
      const address = (await ask('Server address: ')).trim();
      const pairingCode = (await ask('Pairing code: ')).trim();
      if (!address || !pairingCode) throw new Error('Both the server address and the pairing code are needed.');
      await pair([address, pairingCode], deps, { ...ctx, guided: true });
      config = await loadConfig(ctx.dir);
    }
    if (config.printer) {
      out(`Fallback printer: ${config.printer}`);
    } else {
      await chooseFallbackPrinter(deps, ctx, ask);
    }
    out('');
    code = await startAgent();
  } catch (err) {
    if (err instanceof SetupCancelled) return 130;
    fail(err instanceof Error ? err.message : String(err));
    code = 1;
  }
  try {
    await ask('\nPress Enter to close this window. ');
  } catch (err) {
    if (!(err instanceof SetupCancelled)) throw err;
  }
  return code;
}

// Terminal programs to try, in order, when a Linux desktop starts the agent without a console. Each one
// takes the command to run after its flag. The first one that starts is used.
const TERMINAL_PROGRAMS = [
  ['x-terminal-emulator', ['-e']],
  ['gnome-terminal', ['--']],
  ['konsole', ['-e']],
  ['xfce4-terminal', ['-e']],
  ['xterm', ['-e']],
];

// Starts a program without waiting for it. Resolves true only if the program started.
function startDetached(spawnImpl, file, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnImpl(file, args, { detached: true, stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

// Opens a new terminal window that runs the command. Resolves true if one of the terminal programs started.
export async function openTerminalWindow(command, spawnImpl = spawn) {
  for (const [program, flags] of TERMINAL_PROGRAMS) {
    if (await startDetached(spawnImpl, program, [...flags, ...command])) return true;
  }
  return false;
}

// Best-effort desktop notification, for a launch that has no window in which to show its message.
export async function notifyUser(text, spawnImpl = spawn) {
  await startDetached(spawnImpl, 'notify-send', ['QRquick print agent', text]);
}

// The command that starts this agent with no arguments: the executable itself, or Node with the script.
async function selfCommand() {
  if (await isStandaloneExecutable()) return [process.execPath];
  return [process.execPath, process.argv[1]];
}

const COMMANDS = { pair, printers, 'set-printer': setPrinter, doctor, 'test-print': testPrint, run, autostart };

// Entry point. deps are for tests: dir, platform, out, fail, fetchImpl, run, adapter, download, computerName,
// and for the guided start: interactive, ask (question -> answer), startAgent (-> exit code).
export async function main(argv, deps = {}) {
  const out = deps.out ?? ((line) => process.stdout.write(`${line}\n`));
  const fail = deps.fail ?? ((line) => process.stderr.write(`${line}\n`));
  const platform = deps.platform ?? process.platform;
  const dir = deps.dir ?? defaultConfigDir(platform);

  // No arguments. In a console window the guided start runs. A Linux desktop (file manager) starts the agent
  // with no console, so a terminal window is opened to run it there. Scripts and pipes get the usage text.
  if (argv.length === 0) {
    const interactive = deps.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (interactive) return startScreen(deps, { dir, out, fail, platform });
    const desktop = deps.desktopSession ?? Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
    if (platform === 'linux' && desktop) {
      const opened = await (deps.openTerminal ?? openTerminalWindow)(deps.selfCommand ?? (await selfCommand()));
      if (opened) return 0;
      const message = 'No terminal program was found. Open a terminal, go to the agent folder and run ./qrquick-print-agent';
      fail(message);
      await (deps.notify ?? notifyUser)(message);
      return 1;
    }
    out(USAGE);
    return 0;
  }
  const [command, ...args] = argv;

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
