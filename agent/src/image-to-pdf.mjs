// Wraps a JPEG or PNG picture in a one-page A4 PDF, so the Windows path can print
// photos through SumatraPDF. Pure JavaScript, no dependencies.
//
// JPEG data is embedded unchanged (DCTDecode). PNG data is embedded as its own
// compressed stream with the PNG row filters kept (FlateDecode with Predictor 15).
// Only 8-bit greyscale and RGB pictures are accepted. Pictures with transparency or
// a palette are refused, so the agent never prints a surprising result.

import { Buffer } from 'node:buffer';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 36;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class UnsupportedImageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedImageError';
    this.code = 'image_unsupported';
  }
}

export function readJpeg(buf) {
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // end of image or start of scan: no frame found
    const length = buf.readUInt16BE(i + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (i + 10 > buf.length) break;
      const precision = buf[i + 4];
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      const components = buf[i + 9];
      if (precision !== 8 || (components !== 1 && components !== 3) || width < 1 || height < 1) {
        throw new UnsupportedImageError(
          'This JPEG colour format cannot be printed here. Save the picture again as a standard colour or grey JPG.',
        );
      }
      return { kind: 'jpeg', width, height, components, data: buf };
    }
    i += 2 + length;
  }
  throw new UnsupportedImageError('The JPEG picture could not be read.');
}

export function readPng(buf) {
  let offset = 8;
  let header = null;
  let hasTransparency = false;
  const pixels = [];
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buf.length) break;
    const chunk = buf.subarray(start, end);
    if (type === 'IHDR') {
      header = {
        width: chunk.readUInt32BE(0),
        height: chunk.readUInt32BE(4),
        bitDepth: chunk[8],
        colorType: chunk[9],
        interlace: chunk[12],
      };
    } else if (type === 'IDAT') {
      pixels.push(chunk);
    } else if (type === 'tRNS') {
      hasTransparency = true;
    } else if (type === 'IEND') {
      break;
    }
    offset = end + 4;
  }
  if (!header || pixels.length === 0) {
    throw new UnsupportedImageError('The PNG picture could not be read.');
  }
  if (header.bitDepth !== 8 || header.interlace !== 0 || (header.colorType !== 0 && header.colorType !== 2)) {
    throw new UnsupportedImageError(
      'Only 8-bit PNG pictures without transparency can be printed on this computer. Save the picture as JPG and try again.',
    );
  }
  if (hasTransparency || header.width < 1 || header.height < 1) {
    throw new UnsupportedImageError(
      'PNG pictures with transparency cannot be printed on this computer. Save the picture as JPG and try again.',
    );
  }
  return {
    kind: 'png',
    width: header.width,
    height: header.height,
    components: header.colorType === 2 ? 3 : 1,
    data: Buffer.concat(pixels),
  };
}

export function readImage(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return readJpeg(buf);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return readPng(buf);
  throw new UnsupportedImageError('The picture is not a JPEG or PNG file.');
}

function fmt(value) {
  return Number(value.toFixed(2));
}

// Returns a complete PDF file (as a Buffer) that shows the picture centred on one A4 page.
export function imageToPdf(buf) {
  const image = readImage(buf);
  const colorSpace = image.components === 1 ? '/DeviceGray' : '/DeviceRGB';
  const scale = Math.min(
    (A4_WIDTH - 2 * MARGIN) / image.width,
    (A4_HEIGHT - 2 * MARGIN) / image.height,
  );
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (A4_WIDTH - drawWidth) / 2;
  const y = (A4_HEIGHT - drawHeight) / 2;

  const content = Buffer.from(
    `q ${fmt(drawWidth)} 0 0 ${fmt(drawHeight)} ${fmt(x)} ${fmt(y)} cm /Im0 Do Q\n`,
    'latin1',
  );

  const base = `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}` +
    ` /ColorSpace ${colorSpace} /BitsPerComponent 8`;
  const imageDict = image.kind === 'jpeg'
    ? `<< ${base} /Filter /DCTDecode /Length ${image.data.length} >>`
    : `<< ${base} /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${image.components}` +
      ` /BitsPerComponent 8 /Columns ${image.width} >> /Length ${image.data.length} >>`;

  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (part) => {
    chunks.push(part);
    length += part.length;
  };
  const addObject = (number, parts) => {
    offsets[number] = length;
    push(Buffer.from(`${number} 0 obj\n`, 'latin1'));
    for (const part of parts) push(Buffer.isBuffer(part) ? part : Buffer.from(part, 'latin1'));
    push(Buffer.from('\nendobj\n', 'latin1'));
  };

  push(Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1'));
  addObject(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  addObject(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  addObject(3, [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}]` +
      ' /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
  ]);
  addObject(4, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
  addObject(5, [`${imageDict}\nstream\n`, image.data, '\nendstream']);

  const xrefOffset = length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let n = 1; n <= 5; n++) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  push(Buffer.from(
    `${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    'latin1',
  ));
  return Buffer.concat(chunks);
}
