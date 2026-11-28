// The TOTP setup QR code arrives as an SVG string. It is shown only as an SVG data image.
// It is never inserted as markup, and no other URL form is accepted.
export function qrImageSource(qrCode) {
  const text = String(qrCode ?? '');
  if (text.startsWith('data:image/svg+xml,')) return text;
  if (text.trimStart().startsWith('<svg')) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text.trim())}`;
  return '';
}
