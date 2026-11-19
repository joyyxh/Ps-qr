// Builds one self-contained executable of the print agent with Node's single executable applications.
// The executable carries its own Node runtime, so the shop computer does not need Node.js installed.
//
// Usage, from the agent folder, with Node 22 or later and the build tools installed in dist/work
// (see .github/workflows/desktop-agent.yml for the exact commands):
//   node standalone/build.mjs [outDir]
// Writes outDir/qrquick-print-agent (or qrquick-print-agent.exe on Windows). outDir defaults to dist.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) throw new Error(`Build with Node 22 or later. This is ${process.version}.`);

const here = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.resolve(here, '..');
const outDir = path.resolve(process.argv[2] ?? path.join(agentDir, 'dist'));
const work = path.join(outDir, 'work');
const isWindows = process.platform === 'win32';
const exePath = path.join(outDir, isWindows ? 'qrquick-print-agent.exe' : 'qrquick-print-agent');
const bundlePath = path.join(work, 'agent.cjs');
const configPath = path.join(work, 'sea-config.json');
const blobPath = path.join(work, 'sea-prep.blob');

// The build tools are installed in work/ by the workflow, so the agent's own folder gets no dependencies.
const requireTools = createRequire(path.join(work, 'package.json'));
const esbuild = requireTools('esbuild');
const postjectCli = path.join(work, 'node_modules', 'postject', 'dist', 'cli.js');

mkdirSync(work, { recursive: true });
rmSync(exePath, { force: true });

// 1. Bundle the agent into one CommonJS file. A bundled file has no URL of its own, so import.meta.url
//    is replaced with the address of the executable. src/cli.mjs uses it only to find the agent folder,
//    and the single-file build never runs a script from that folder.
await esbuild.build({
  entryPoints: [path.join(here, 'entry.mjs')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: bundlePath,
  define: { 'import.meta.url': '__agentMetaUrl' },
  banner: { js: 'var __agentMetaUrl = require("node:url").pathToFileURL(process.execPath).href;' },
  logLevel: 'warning',
});

// 2. Ask this Node to write the blob that the executable runs.
writeFileSync(configPath, JSON.stringify({ main: bundlePath, output: blobPath, disableExperimentalSEAWarning: true }));
execFileSync(process.execPath, ['--experimental-sea-config', configPath], { stdio: 'inherit' });

// 3. Copy this Node executable and inject the blob into the copy.
copyFileSync(process.execPath, exePath);
if (!isWindows) chmodSync(exePath, 0o755);
execFileSync(
  process.execPath,
  [postjectCli, exePath, 'NODE_SEA_BLOB', blobPath, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'],
  { stdio: 'inherit' },
);

console.log(`Built ${exePath}`);
