// Printing on Linux through CUPS, using the standard lpstat, lpoptions and lp commands.
// CUPS converts JPEG and PNG itself, so pictures are sent as they are.

import { runCommand } from '../runner.mjs';

const COLOUR_MODES = ['RGB', 'CMYK', 'Color', 'AdobeRGB'];
const GREY_MODES = ['Gray', 'Grey', 'Black'];

// "printer HP_LaserJet is idle.  enabled since ..."  ->  { name, enabled }
export function parsePrinterList(output) {
  const printers = [];
  for (const line of String(output).split('\n')) {
    const match = /^printer\s+(\S+)\s*(.*)$/.exec(line.trim());
    if (match) printers.push({ name: match[1], enabled: !/disabled/i.test(match[2]) });
  }
  return printers;
}

// "system default destination: HP_LaserJet"  ->  "HP_LaserJet"
export function parseDefaultPrinter(output) {
  return /system default destination:\s*(\S+)/.exec(String(output))?.[1] ?? null;
}

// lpoptions -l prints one line per option:  "ColorModel/Color Model: *Gray RGB"
// The asterisk marks the default value.
export function parseOptionList(output) {
  const options = {};
  for (const line of String(output).split('\n')) {
    const match = /^([A-Za-z0-9_-]+)\/[^:]*:\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    options[match[1]] = match[2]
      .split(/\s+/)
      .map((value) => value.replace(/^\*/, ''))
      .filter(Boolean);
  }
  return options;
}

// Only what the printer's own options say. A feature that cannot be found is treated
// as not available, so an order is never sent with an option the printer may ignore.
export function capabilitiesFromOptions(options) {
  const known = Object.keys(options).length > 0;
  const colourModes = options.ColorModel ?? options.ColourModel ?? options.ColorMode ?? [];
  // PPD printers list "Duplex" (None, DuplexNoTumble, DuplexTumble); IPP printers list "sides"
  // (one-sided, two-sided-long-edge, ...). Only the two-sided values count as duplex.
  const duplexModes = options.Duplex ?? options.sides ?? [];
  return {
    capabilitiesKnown: known,
    colour: colourModes.some((mode) => COLOUR_MODES.includes(mode)),
    duplex: duplexModes.some((mode) => /two-sided|^Duplex/i.test(mode)),
    papers: options.PageSize ?? null,
    colourModes,
    duplexModes,
  };
}

// Builds the lp arguments. The file name always comes last, after "--".
export function buildLpArgs({ printer, file, copies, colour, duplex, paper, title, capabilities }) {
  const args = ['-d', printer, '-n', String(copies), '-t', title];
  if (paper && capabilities.papers) {
    const match = capabilities.papers.find((p) => p.toLowerCase() === String(paper).toLowerCase());
    if (match) args.push('-o', `media=${match}`);
  }
  const modes = colour ? COLOUR_MODES : GREY_MODES;
  const mode = modes.find((candidate) => capabilities.colourModes.includes(candidate));
  if (mode) args.push('-o', `ColorModel=${mode}`);
  if (duplex) args.push('-o', 'sides=two-sided-long-edge');
  args.push('--', file);
  return args;
}

function engineMissing(message) {
  const err = new Error(message);
  err.code = 'print_engine_missing';
  return err;
}

export function createLinuxAdapter({ run = runCommand, cacheMs = 60000, now = () => Date.now() } = {}) {
  let cache = null;

  return {
    platform: 'linux',
    acceptsImages: true,

    async listPrinters() {
      if (cache && now() - cache.at < cacheMs) return cache.printers;
      let listed;
      let defaultName = null;
      try {
        listed = await run('lpstat', ['-p']);
        defaultName = parseDefaultPrinter((await run('lpstat', ['-d'])).stdout);
      } catch (err) {
        if (err.code === 'ENOENT') throw engineMissing('CUPS is not installed on this computer (lpstat is missing).');
        throw err;
      }
      const printers = [];
      for (const printer of parsePrinterList(listed.stdout)) {
        const options = await run('lpoptions', ['-p', printer.name, '-l']);
        printers.push({
          name: printer.name,
          enabled: printer.enabled,
          isDefault: printer.name === defaultName,
          ...capabilitiesFromOptions(parseOptionList(options.stdout)),
        });
      }
      cache = { at: now(), printers };
      return printers;
    },

    async print({ printer, file, copies, colour, duplex, paper, title, capabilities }) {
      const args = buildLpArgs({ printer, file, copies, colour, duplex, paper, title, capabilities });
      let result;
      try {
        result = await run('lp', args, { timeoutMs: 120000 });
      } catch (err) {
        if (err.code === 'ENOENT') throw engineMissing('CUPS is not installed on this computer (lp is missing).');
        throw err;
      }
      if (result.code !== 0) {
        const error = new Error(result.stderr.trim().slice(0, 200) || 'CUPS did not accept the job.');
        error.code = 'spooler_error';
        throw error;
      }
      return { spoolerId: /request id is (\S+)/.exec(result.stdout)?.[1] ?? null };
    },
  };
}
