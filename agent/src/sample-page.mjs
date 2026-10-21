// A one-page A4 text PDF for "test-print". It uses the built-in Helvetica font, so
// nothing needs to be embedded. Non-ASCII characters are replaced with "?".

function escapeText(text) {
  return String(text).replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&');
}

export function buildSamplePdf(lines) {
  const body = lines
    .map((line, i) => `/F1 ${i === 0 ? 22 : 14} Tf 1 0 0 1 72 ${760 - i * 28} Tm (${escapeText(line)}) Tj`)
    .join('\n');
  const content = `BT\n${body}\nET\n`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let text = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(text, 'latin1'));
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(text, 'latin1');
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    text += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(text, 'latin1');
}
