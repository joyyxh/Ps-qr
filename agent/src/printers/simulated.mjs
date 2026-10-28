// A simulated printer, for testing the order-to-print steps without hardware.
//
// It never runs a program and never talks to a printer or to the printing system, so it does
// not import the command runner. It is used only by the offline "simulate" command (see
// ../simulation.mjs), which never contacts a server. Its results say "simulated" in every
// message and id, so they cannot be mistaken for paper that came out.

import { readFile } from 'node:fs/promises';

export const SIMULATED_PRINTER_NAME = 'SIMULATED printer (no paper)';
export const SIMULATED_SPOOLER_PREFIX = 'simulated-';

// Same shape as the real adapters: platform, acceptsImages, listPrinters(), print({...}).
// Each print gets the next id in sequence, so results are deterministic within one run.
export function createSimulatedAdapter({
  printerName = SIMULATED_PRINTER_NAME,
  enabled = true,
  colour = true,
  duplex = true,
  papers = ['A4'],
} = {}) {
  let sequence = 0;
  const prints = []; // one record per accepted job; tests and the simulation read it

  return {
    platform: 'simulated',
    simulated: true,
    // Pictures are turned into PDF first, as on Windows, so that path is exercised too.
    acceptsImages: false,
    prints,

    async listPrinters() {
      return [
        {
          name: printerName,
          isDefault: true,
          enabled,
          capabilitiesKnown: true,
          colour,
          duplex,
          papers: [...papers],
        },
      ];
    },

    async print({ printer, file, copies, colour: wantColour, duplex: wantDuplex, paper, title }) {
      if (printer !== printerName) {
        const err = new Error(`The simulated printer is "${printerName}", not "${printer}".`);
        err.code = 'printer_not_found';
        throw err;
      }
      // A real spooler needs a PDF. Refuse anything else the same way.
      const head = (await readFile(file)).subarray(0, 5).toString('latin1');
      if (head !== '%PDF-') {
        const err = new Error('The simulated spooler only accepts PDF files.');
        err.code = 'spooler_error';
        throw err;
      }
      sequence += 1;
      const spoolerId = `${SIMULATED_SPOOLER_PREFIX}${sequence}`;
      prints.push({ spoolerId, printer, copies, colour: wantColour, duplex: wantDuplex, paper, title });
      return { spoolerId, simulated: true };
    },
  };
}
