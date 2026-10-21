// Makes QR codes for a shop's web address. Error correction level M, with the
// four-module quiet zone the QR standard asks for around the code.
import { QRCode, QRErrorCorrectLevel } from './vendor/qrcode/qrcode.js';

const QUIET_ZONE = 4;

// The code as rows of booleans (true = dark module).
export function qrMatrix(text) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(String(text));
  qr.make();
  const size = qr.getModuleCount();
  const rows = [];
  for (let row = 0; row < size; row += 1) {
    const line = [];
    for (let col = 0; col < size; col += 1) line.push(qr.isDark(row, col));
    rows.push(line);
  }
  return rows;
}

// An SVG image that scales cleanly, for the page and for printing.
export function qrSvg(text) {
  const matrix = qrMatrix(text);
  const size = matrix.length + QUIET_ZONE * 2;
  let path = '';
  matrix.forEach((line, row) =>
    line.forEach((dark, col) => {
      if (dark) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    })
  );
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code for the shop page">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
  );
}

// A canvas with the code drawn at `scale` pixels per module, for a PNG download.
export function qrCanvas(text, scale = 12) {
  const matrix = qrMatrix(text);
  const modules = matrix.length + QUIET_ZONE * 2;
  const canvas = document.createElement('canvas');
  canvas.width = modules * scale;
  canvas.height = modules * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  matrix.forEach((line, row) =>
    line.forEach((dark, col) => {
      if (dark) ctx.fillRect((col + QUIET_ZONE) * scale, (row + QUIET_ZONE) * scale, scale, scale);
    })
  );
  return canvas;
}
