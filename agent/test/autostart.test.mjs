import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { autostartFiles, systemdUnit, windowsTaskXml } from '../src/autostart.mjs';
import { saveConfig } from '../src/config.mjs';
import { main } from '../src/cli.mjs';

const NODE = '/usr/bin/node';
const SCRIPT = '/opt/qrquick/agent/bin/qrquick-print-agent.mjs';
const WORK = '/opt/qrquick/agent';

test('the Windows task starts at sign-in and restarts the agent after a failure', () => {
  const file = windowsTaskXml({ nodePath: 'C:\\Program Files\\nodejs\\node.exe', scriptPath: 'C:\\QRquick\\agent\\bin\\qrquick-print-agent.mjs', workingDir: 'C:\\QRquick\\agent' });
  const xml = file.content.replace(/^\uFEFF/, '');
  assert.equal(file.fileName, 'QRquick-print-agent.xml');
  assert.equal(file.encoding, 'utf16le');
  assert.ok(file.content.startsWith('\uFEFF'), 'Task Scheduler expects a byte-order mark');
  assert.match(xml, /encoding="UTF-16"/);
  assert.match(xml, /<LogonTrigger>/);
  assert.match(xml, /<RestartOnFailure>\s*<Interval>PT1M<\/Interval>\s*<Count>999<\/Count>/);
  assert.match(xml, /<ExecutionTimeLimit>PT0S<\/ExecutionTimeLimit>/);
  assert.match(xml, /<StartWhenAvailable>true<\/StartWhenAvailable>/);
  assert.match(xml, /<Command>C:\\Program Files\\nodejs\\node\.exe<\/Command>/);
  assert.match(xml, /<Arguments>&quot;C:\\QRquick\\agent\\bin\\qrquick-print-agent\.mjs&quot; run<\/Arguments>/);
  assert.match(xml, /<WorkingDirectory>C:\\QRquick\\agent<\/WorkingDirectory>/);
});

test('names with ampersands and angle brackets are escaped in the task XML', () => {
  const file = windowsTaskXml({ nodePath: 'C:\\A&B\\node.exe', scriptPath: 'C:\\<x>\\agent.mjs', workingDir: 'C:\\A&B' });
  assert.match(file.content, /C:\\A&amp;B\\node\.exe/);
  assert.match(file.content, /&lt;x&gt;/);
});

test('the systemd unit runs the agent with quoted paths and restarts it', () => {
  const file = systemdUnit({ nodePath: '/opt/node bin/node', scriptPath: SCRIPT, workingDir: WORK });
  assert.equal(file.fileName, 'qrquick-print-agent.service');
  assert.match(file.content, /^WorkingDirectory=\/opt\/qrquick\/agent$/m);
  assert.match(file.content, /^ExecStart="\/opt\/node bin\/node" "\/opt\/qrquick\/agent\/bin\/qrquick-print-agent\.mjs" run$/m);
  assert.match(file.content, /^Restart=always$/m);
  assert.match(file.content, /^WantedBy=default\.target$/m);
});

test('each platform gets install and removal commands that use the full path of the file', () => {
  const windows = autostartFiles('win32', { nodePath: NODE, scriptPath: SCRIPT, workingDir: WORK, fileDir: 'C:\\QRquick\\agent\\autostart', userId: '' });
  assert.ok(windows.install[0].startsWith('schtasks /Create /TN "QRquick print agent" /XML "'));
  assert.ok(windows.install[0].includes('QRquick-print-agent.xml'));
  assert.deepEqual(windows.remove, ['schtasks /Delete /TN "QRquick print agent" /F']);

  const linux = autostartFiles('linux', { nodePath: NODE, scriptPath: SCRIPT, workingDir: WORK, fileDir: '/opt/qrquick/agent/autostart' });
  assert.ok(linux.install.includes('systemctl --user enable --now qrquick-print-agent'));
  assert.ok(linux.install.some((line) => line.includes('/opt/qrquick/agent/autostart/qrquick-print-agent.service')));
  assert.deepEqual(linux.remove, ['systemctl --user disable --now qrquick-print-agent']);
});

test('the autostart command writes the file next to the agent and prints the install steps', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-autostart-'));
  const agentDir = await mkdtemp(path.join(os.tmpdir(), 'qrq-agent-'));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  });
  await saveConfig(dir, { serverUrl: 'https://x.example.supabase.co/functions/v1/print-agent', token: `qpa_${'K'.repeat(43)}`, shopName: 'Test Shop' });
  const out = [];
  const fail = [];
  const code = await main(['autostart'], {
    dir, platform: 'linux', agentDir, nodePath: NODE, out: (line) => out.push(line), fail: (line) => fail.push(line),
  });
  assert.equal(code, 0, fail.join('\n'));
  const written = await readFile(path.join(agentDir, 'autostart', 'qrquick-print-agent.service'), 'utf8');
  assert.match(written, /ExecStart="\/usr\/bin\/node" ".*qrquick-print-agent\.mjs" run/);
  const text = out.join('\n');
  assert.match(text, /systemctl --user enable --now qrquick-print-agent/);
  assert.match(text, /Orders wait in the queue while it is off/);
  assert.ok(!text.includes('K'.repeat(43)), 'the token is never printed');
});

test('without a script, the Windows task and the systemd unit run the executable with "run" only', () => {
  const exe = '/opt/qrquick/qrquick-print-agent';
  const unit = systemdUnit({ nodePath: exe, scriptPath: null, workingDir: '/opt/qrquick' });
  assert.match(unit.content, /^ExecStart="\/opt\/qrquick\/qrquick-print-agent" run$/m);
  assert.doesNotMatch(unit.content, /\.mjs/);
  const task = windowsTaskXml({ nodePath: 'C:\\QRquick\\qrquick-print-agent.exe', scriptPath: null, workingDir: 'C:\\QRquick' });
  assert.match(task.content, /<Command>C:\\QRquick\\qrquick-print-agent\.exe<\/Command>/);
  assert.match(task.content, /<Arguments>run<\/Arguments>/);
});

test('in the single-file build the autostart command runs the executable and writes next to it', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-autostart-exe-'));
  const agentDir = await mkdtemp(path.join(os.tmpdir(), 'qrq-exe-folder-'));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  });
  await saveConfig(dir, { serverUrl: 'https://x.example.supabase.co/functions/v1/print-agent', token: `qpa_${'K'.repeat(43)}`, shopName: 'Test Shop' });
  const out = [];
  const fail = [];
  const code = await main(['autostart'], {
    dir, platform: 'linux', agentDir, standalone: true, nodePath: '/opt/qrquick/qrquick-print-agent', out: (line) => out.push(line), fail: (line) => fail.push(line),
  });
  assert.equal(code, 0, fail.join('\n'));
  const written = await readFile(path.join(agentDir, 'autostart', 'qrquick-print-agent.service'), 'utf8');
  assert.match(written, /^ExecStart="\/opt\/qrquick\/qrquick-print-agent" run$/m);
  assert.doesNotMatch(written, /\.mjs/);
  assert.ok(!out.join('\n').includes('K'.repeat(43)), 'the token is never printed');
});

test('autostart refuses to run before the computer is paired', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-autostart-empty-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const fail = [];
  const code = await main(['autostart'], { dir, platform: 'linux', out: () => {}, fail: (line) => fail.push(line) });
  assert.equal(code, 1);
  assert.match(fail.join('\n'), /not paired yet/);
});

test('autostart says plainly when the platform is not supported', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qrq-autostart-mac-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const fail = [];
  const code = await main(['autostart'], { dir, platform: 'darwin', out: () => {}, fail: (line) => fail.push(line) });
  assert.equal(code, 1);
  assert.match(fail.join('\n'), /Windows and Linux only/);
});
