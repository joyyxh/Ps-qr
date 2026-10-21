import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLpArgs,
  capabilitiesFromOptions,
  createLinuxAdapter,
  parseDefaultPrinter,
  parseOptionList,
  parsePrinterList,
} from '../src/printers/linux.mjs';
import {
  buildSumatraArgs,
  createWindowsAdapter,
  findSumatra,
  parseWindowsPrinters,
  parseWindowsPrintConfig,
  sumatraSettings,
} from '../src/printers/windows.mjs';

const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', timedOut: false });

// Routes a fake command by its first words. Anything not listed behaves as "not installed".
function fakeRun(table) {
  return async (file, args) => {
    const key = [file, ...args].join(' ');
    for (const [prefix, result] of Object.entries(table)) {
      if (key === prefix || key.startsWith(`${prefix} `)) {
        return typeof result === 'function' ? result(args) : result;
      }
    }
    throw Object.assign(new Error(`${file} not found`), { code: 'ENOENT' });
  };
}

// ---- Linux (CUPS) -------------------------------------------------------------

test('reads the CUPS printer list, enabled state and default', () => {
  const list = parsePrinterList('printer Office is idle.  enabled since Mon\nprinter Back disabled since Tue -\n');
  assert.deepEqual(list, [
    { name: 'Office', enabled: true },
    { name: 'Back', enabled: false },
  ]);
  assert.equal(parseDefaultPrinter('system default destination: Office\n'), 'Office');
  assert.equal(parseDefaultPrinter('no default\n'), null);
});

test('reads printer options, marking the default value with an asterisk', () => {
  const options = parseOptionList([
    'ColorModel/Color Model: *Gray RGB',
    'Duplex/Double-Sided Printing: *None DuplexNoTumble DuplexTumble',
    'PageSize/Media Size: *A4 Letter Legal',
  ].join('\n'));
  assert.deepEqual(options.ColorModel, ['Gray', 'RGB']);
  assert.deepEqual(options.Duplex, ['None', 'DuplexNoTumble', 'DuplexTumble']);
  assert.deepEqual(options.PageSize, ['A4', 'Letter', 'Legal']);
});

test('colour and double-sided come only from the printer\'s own options', () => {
  const colour = capabilitiesFromOptions({ ColorModel: ['Gray', 'RGB'], Duplex: ['None', 'DuplexNoTumble'] });
  assert.equal(colour.capabilitiesKnown, true);
  assert.equal(colour.colour, true);
  assert.equal(colour.duplex, true);

  const mono = capabilitiesFromOptions({ ColorModel: ['Gray'] });
  assert.equal(mono.colour, false);
  assert.equal(mono.duplex, false);

  assert.equal(capabilitiesFromOptions({}).capabilitiesKnown, false);
});

test('an IPP "one-sided" value is NOT read as double-sided', () => {
  assert.equal(capabilitiesFromOptions({ sides: ['one-sided'] }).duplex, false);
  assert.equal(capabilitiesFromOptions({ sides: ['one-sided', 'two-sided-long-edge'] }).duplex, true);
});

test('lp arguments: printer, copies, colour, duplex, media, then "--" before the file', () => {
  const capabilities = { papers: ['A4', 'Letter'], colourModes: ['Gray', 'RGB'] };
  const args = buildLpArgs({
    printer: 'Office', file: '/tmp/x.pdf', copies: 3, colour: true, duplex: true,
    paper: 'A4', title: 'QRquick job', capabilities,
  });
  assert.deepEqual(args, [
    '-d', 'Office', '-n', '3', '-t', 'QRquick job',
    '-o', 'media=A4',
    '-o', 'ColorModel=RGB',
    '-o', 'sides=two-sided-long-edge',
    '--', '/tmp/x.pdf',
  ]);
});

test('lp arguments leave out media the printer does not list, and pick a grey mode for black-and-white', () => {
  const args = buildLpArgs({
    printer: 'Office', file: 'f.pdf', copies: 1, colour: false, duplex: false,
    paper: 'A3', title: 't', capabilities: { papers: ['A4'], colourModes: ['Gray', 'RGB'] },
  });
  assert.ok(!args.some((a) => a.startsWith('media=')));
  assert.ok(args.includes('ColorModel=Gray'));
  assert.equal(args.at(-1), 'f.pdf');
  assert.equal(args.at(-2), '--');
});

test('Linux adapter lists printers with default and capability flags', async () => {
  const run = fakeRun({
    lpstat: (args) => (args[0] === '-p'
      ? ok('printer Office is idle.  enabled since Mon\nprinter Back disabled since Tue -\n')
      : ok('system default destination: Office\n')),
    lpoptions: (args) => (args[1] === 'Office'
      ? ok('ColorModel/Color Model: *Gray RGB\nDuplex/Double-Sided: *None DuplexNoTumble\n')
      : ok('')),
  });
  const printers = await createLinuxAdapter({ run }).listPrinters();
  assert.equal(printers[0].name, 'Office');
  assert.equal(printers[0].isDefault, true);
  assert.equal(printers[0].colour, true);
  assert.equal(printers[0].duplex, true);
  assert.equal(printers[1].enabled, false);
  assert.equal(printers[1].capabilitiesKnown, false);
});

test('Linux adapter reports a missing CUPS as print_engine_missing', async () => {
  const adapter = createLinuxAdapter({ run: fakeRun({}) });
  await assert.rejects(adapter.listPrinters(), (err) => err.code === 'print_engine_missing');
});

test('Linux adapter submits with lp and returns the request id', async () => {
  const run = fakeRun({ lp: () => ok('request id is Office-42 (1 file(s))\n') });
  const result = await createLinuxAdapter({ run }).print({
    printer: 'Office', file: '/tmp/a.pdf', copies: 1, colour: false, duplex: false,
    paper: 'A4', title: 't', capabilities: { papers: null, colourModes: [] },
  });
  assert.equal(result.spoolerId, 'Office-42');
});

test('Linux adapter turns an lp refusal into spooler_error', async () => {
  const run = fakeRun({ lp: () => ({ code: 1, stdout: '', stderr: 'lp: Printer is not accepting jobs', timedOut: false }) });
  await assert.rejects(
    createLinuxAdapter({ run }).print({
      printer: 'Office', file: '/tmp/a.pdf', copies: 1, colour: false, duplex: false,
      paper: 'A4', title: 't', capabilities: { papers: null, colourModes: [] },
    }),
    (err) => err.code === 'spooler_error',
  );
});

// ---- Windows (PowerShell + SumatraPDF) ---------------------------------------

test('reads Windows printer lists whether PowerShell returns one object or many', () => {
  assert.deepEqual(parseWindowsPrinters(''), []);
  assert.deepEqual(parseWindowsPrinters('{"Name":"Office","Default":true,"WorkOffline":false}'), [
    { name: 'Office', isDefault: true, enabled: true },
  ]);
  assert.equal(parseWindowsPrinters('[{"Name":"A","Default":false,"WorkOffline":true}]')[0].enabled, false);
});

test('reads colour and duplex from the print configuration, and says "unknown" when absent', () => {
  assert.deepEqual(parseWindowsPrintConfig('{"Color":true,"DuplexingMode":"TwoSidedLongEdge"}'), {
    colour: true,
    duplex: true,
  });
  assert.deepEqual(parseWindowsPrintConfig('{"Color":false,"DuplexingMode":"OneSided"}'), {
    colour: false,
    duplex: false,
  });
  assert.deepEqual(parseWindowsPrintConfig('{"DuplexingMode":"Unknown"}'), { colour: null, duplex: null });
  assert.equal(parseWindowsPrintConfig(''), null);
});

test('SumatraPDF settings: copies, colour mode and duplex', () => {
  assert.equal(sumatraSettings({ copies: 3, colour: false, duplex: true }), '3x,monochrome,duplexlong');
  assert.equal(sumatraSettings({ copies: 1, colour: true, duplex: false }), '1x,color');
});

test('SumatraPDF arguments keep the printer name as one argument (no shell parsing)', () => {
  const args = buildSumatraArgs({
    printer: 'HP Office & Co "2nd"', file: 'C:\\temp\\job.pdf', copies: 1, colour: false, duplex: false,
  });
  assert.equal(args[0], '-print-to');
  assert.equal(args[1], 'HP Office & Co "2nd"');
  assert.ok(args.includes('-exit-on-print'));
  assert.equal(args.at(-1), 'C:\\temp\\job.pdf');
});

test('finds SumatraPDF in the usual install folders only', () => {
  assert.ok(findSumatra({ ProgramFiles: 'C:\\PF' }, (p) => p.startsWith('C:\\PF')).endsWith('SumatraPDF.exe'));
  assert.equal(findSumatra({}, () => false), null);
});

test('Windows adapter prints with SumatraPDF and reports a missing install clearly', async () => {
  const missing = createWindowsAdapter({ run: fakeRun({}), sumatraPath: null });
  await assert.rejects(
    missing.print({ printer: 'Office', file: 'x.pdf', copies: 1, colour: false, duplex: false }),
    (err) => err.code === 'print_engine_missing' && /SumatraPDF is not set up/.test(err.message),
  );

  const calls = [];
  const run = async (file, args) => {
    calls.push([file, args]);
    return ok();
  };
  await createWindowsAdapter({ run, sumatraPath: 'C:\\SumatraPDF.exe' }).print({
    printer: 'Office', file: 'x.pdf', copies: 2, colour: false, duplex: true,
  });
  assert.equal(calls[0][0], 'C:\\SumatraPDF.exe');
  assert.ok(calls[0][1].includes('2x,monochrome,duplexlong'));
});

test('Windows adapter reads printers through PowerShell and passes the name as an environment value', async () => {
  const seenEnv = [];
  const run = async (file, args, options = {}) => {
    if (args.at(-1).includes('Win32_Printer')) {
      return ok('{"Name":"Office","Default":true,"WorkOffline":false}');
    }
    seenEnv.push(options.env?.QRQUICK_PRINTER);
    return ok('{"Color":false,"DuplexingMode":"TwoSidedLongEdge"}');
  };
  const printers = await createWindowsAdapter({ run }).listPrinters();
  assert.equal(printers[0].name, 'Office');
  assert.equal(printers[0].capabilitiesKnown, true);
  assert.equal(printers[0].colour, false);
  assert.equal(printers[0].duplex, true);
  assert.deepEqual(seenEnv, ['Office']);
});
