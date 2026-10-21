import { createLinuxAdapter } from './linux.mjs';
import { createWindowsAdapter } from './windows.mjs';

// Picks the printing support for this computer. Each adapter has the same shape:
//   platform, acceptsImages, listPrinters(), print({...})
export function createPrinterAdapter({ platform = process.platform, run, sumatraPath = null } = {}) {
  if (platform === 'win32') return createWindowsAdapter({ run, sumatraPath });
  if (platform === 'linux') return createLinuxAdapter({ run });
  throw new Error('The QRquick print agent runs on Windows and Linux only.');
}
