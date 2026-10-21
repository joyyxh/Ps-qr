// Copies the web app from ../web into ./www, which Capacitor packs into the APK.
//
// Only the files the app needs are copied (no tests, no service worker, no build
// tools). The customer page address for QR codes is written into www/config.js from
// PRINTNEST_PUBLIC_URL, so the repository's config.js does not have to change.
//
//   PRINTNEST_PUBLIC_URL=https://your-printnest-site.example  node scripts/copy-web.mjs

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../../web');
const target = path.resolve(here, '../www');
const APP_FILES = ['index.html', 'styles.css', 'config.js', 'manifest.webmanifest', 'icons', 'src'];
const PUBLIC_URL_PATTERN = /^https:\/\/[a-z0-9.-]+(:\d{1,5})?(\/[A-Za-z0-9._~\/@-]*)?$/i;

const publicUrl = (process.env.PRINTNEST_PUBLIC_URL ?? '').trim();
if (publicUrl && !PUBLIC_URL_PATTERN.test(publicUrl)) {
  console.error(`PRINTNEST_PUBLIC_URL must be a plain https:// address, for example https://printnest.example/ (got "${publicUrl}").`);
  process.exit(1);
}

let config = await readFile(path.join(source, 'config.js'), 'utf8');
if (publicUrl) {
  const replaced = config.replace(/publicBaseUrl:\s*'[^']*'/, `publicBaseUrl: '${publicUrl}'`);
  const withAuth = replaced.replace(/authRedirectUrl:\s*'[^']*'/, `authRedirectUrl: '${publicUrl}'`);
  if (!/publicBaseUrl:\s*'[^']*'/.test(config) || !/authRedirectUrl:\s*'[^']*'/.test(config)) {
    console.error('config.js has no publicBaseUrl/authRedirectUrl lines to set. Check web/config.js.');
    process.exit(1);
  }
  config = withAuth;
} else {
  console.warn(
    'PRINTNEST_PUBLIC_URL is not set. QR codes made in the app would point at the app itself, ' +
      'and the app shows a warning until the address is set.'
  );
}
config = config.replace(/ownerApp:\s*(true|false)/, 'ownerApp: true');
if (!/ownerApp:\s*true/.test(config)) {
  console.error('config.js has no ownerApp flag to configure the Android owner-only bundle.');
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const name of APP_FILES) {
  await cp(path.join(source, name), path.join(target, name), { recursive: true });
}
await writeFile(path.join(target, 'config.js'), config);

console.log(`Copied ${APP_FILES.length} items from web/ into www/ ${publicUrl ? `(QR address: ${publicUrl})` : '(no QR address set)'}`);
