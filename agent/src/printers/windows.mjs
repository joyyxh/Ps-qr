// Printing on Windows through SumatraPDF, a free PDF viewer that can print silently
// from the command line. The agent does not install it; the README explains how.
// Printer discovery and colour/duplex detection use standard PowerShell cmdlets.
//
// Not yet tested on a real Windows computer. The SumatraPDF setting words are the
// ones its documentation lists; check them on the installed version before relying on them.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { runCommand } from '../runner.mjs';

const LIST_SCRIPT =
  'Get-CimInstance -ClassName Win32_Printer | Select-Object Name, Default, WorkOffline | ConvertTo-Json -Compress';
// The printer name comes from the environment, never from the script text.
const CONFIG_SCRIPT =
  'Get-PrintConfiguration -PrinterName $env:QRQUICK_PRINTER | Select-Object Color, DuplexingMode | ConvertTo-Json -Compress';

export function parseWindowsPrinters(json) {
  if (!json || !json.trim()) return [];
  const data = JSON.parse(json);
  const list = Array.isArray(data) ? data : [data];
  return list
    .filter((p) => p && typeof p.Name === 'string')
    .map((p) => ({ name: p.Name, isDefault: p.Default === true, enabled: p.WorkOffline !== true }));
}

export function parseWindowsPrintConfig(json) {
  if (!json || !json.trim()) return null;
  const data = JSON.parse(json);
  const colour = typeof data.Color === 'boolean' ? data.Color : null;
  const mode = String(data.DuplexingMode ?? '');
  let duplex = null;
  if (/TwoSided/i.test(mode)) duplex = true;
  else if (/OneSided/i.test(mode)) duplex = false;
  return { colour, duplex };
}

// The -print-settings value SumatraPDF reads, for example "2x,color,duplexlong".
export function sumatraSettings({ copies, colour, duplex, duplexShort = false }) {
  const parts = [`${copies}x`, colour ? 'color' : 'monochrome'];
  if (duplex) parts.push(duplexShort ? 'duplexshort' : 'duplexlong');
  return parts.join(',');
}

export function buildSumatraArgs({ printer, file, copies, colour, duplex }) {
  return [
    '-print-to', printer,
    '-print-settings', sumatraSettings({ copies, colour, duplex }),
    '-silent',
    '-exit-on-print',
    file,
  ];
}

// The usual install places for SumatraPDF.
export function findSumatra(env = process.env, exists = existsSync) {
  const candidates = [
    path.join(env.ProgramFiles || 'C:\\Program Files', 'SumatraPDF', 'SumatraPDF.exe'),
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'SumatraPDF', 'SumatraPDF.exe'),
    path.join(env.LOCALAPPDATA || '', 'SumatraPDF', 'SumatraPDF.exe'),
  ];
  return candidates.find((candidate) => candidate && exists(candidate)) ?? null;
}

export function createWindowsAdapter({ run = runCommand, sumatraPath = null, cacheMs = 60000, now = () => Date.now() } = {}) {
  let cache = null;
  const powershell = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];

  return {
    platform: 'windows',
    // SumatraPDF prints PDF only, so pictures are wrapped in a PDF first.
    acceptsImages: false,

    async listPrinters() {
      if (cache && now() - cache.at < cacheMs) return cache.printers;
      const listed = await run('powershell.exe', [...powershell, LIST_SCRIPT]);
      if (listed.code !== 0) {
        const err = new Error('Windows did not list the printers.');
        err.code = 'print_engine_missing';
        throw err;
      }
      const printers = [];
      for (const printer of parseWindowsPrinters(listed.stdout)) {
        // Unknown options count as "no", so colour or double-sided orders are not sent blindly.
        const config = await run('powershell.exe', [...powershell, CONFIG_SCRIPT], {
          env: { QRQUICK_PRINTER: printer.name },
        });
        const parsed = config.code === 0 ? parseWindowsPrintConfig(config.stdout) : null;
        printers.push({
          ...printer,
          capabilitiesKnown: Boolean(parsed && parsed.colour !== null),
          colour: parsed?.colour === true,
          duplex: parsed?.duplex === true,
          papers: null,
          colourModes: [],
          duplexModes: [],
        });
      }
      cache = { at: now(), printers };
      return printers;
    },

    async print({ printer, file, copies, colour, duplex }) {
      if (!sumatraPath) {
        const err = new Error('SumatraPDF is not set up on this computer. See the agent README.');
        err.code = 'print_engine_missing';
        throw err;
      }
      const result = await run(sumatraPath, buildSumatraArgs({ printer, file, copies, colour, duplex }), {
        timeoutMs: 180000,
      });
      if (result.code !== 0) {
        const err = new Error(`SumatraPDF stopped with code ${result.code}.`);
        err.code = 'spooler_error';
        throw err;
      }
      // Windows accepted the job. Whether paper came out is not reported back.
      return { spoolerId: null };
    },
  };
}
