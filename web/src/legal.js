// The Terms and Conditions and the Privacy Policy pages. Anyone can open them, signed in or not,
// in the browser and in the owner app. Sign-up links to them and requires the current version.
//
// This text is a DRAFT written from what the code does (see the checks in tests/legal.test.js).
// Items in [square brackets] are for the operator to complete. Nothing here names a company,
// address or contact that the code does not hold, and nothing states a legal position the operator has not confirmed.

import { escapeHtml } from './logic.js';

// Must match the version seeded in supabase/migrations/0021_owner_username_auth.sql. A test checks this.
export const LEGAL_VERSION = '2026-11-22.1';
export const LEGAL_EFFECTIVE = '22 November 2026';

const DRAFT_NOTICE =
  'Draft for review. Items in [square brackets] are not filled in yet. Do not publish these pages until the operator has completed and approved them.';

export const LEGAL_PAGES = Object.freeze({
  terms: {
    title: 'Terms and Conditions',
    sections: [
      {
        heading: 'About QRquick',
        paragraphs: [
          'QRquick links customers with a print shop. A customer uploads a file, chooses the print options, sees the price and places an order. The shop accepts the order, prints it and hands it over.',
          'Shop owners use QRquick to set their prices and services, see their orders, and, if they choose, print automatically from a computer in the shop.',
        ],
      },
      {
        heading: 'Who runs QRquick',
        paragraphs: [
          'QRquick is run by [operator legal name], [registered address]. Contact: [contact email or phone].',
        ],
      },
      {
        heading: 'Accounts',
        paragraphs: [
          'Customers do not need an account. Shop owners sign in with a username and a password. An owner picks the username and the password, and is given ten recovery codes that can reset the password once each.',
          'You are responsible for keeping your password and recovery codes private, and for what is done through your account. Tell [contact] at once if you think someone else has used your account.',
        ],
      },
      {
        heading: 'Uploaded files',
        paragraphs: [
          'You keep ownership of the files you upload. By uploading a file you confirm that you have the right to have it printed. Files are kept in a private store and are used to fill your order. How long they are kept is set out in the Privacy Policy.',
          'Do not upload anything that is unlawful, infringes someone else\'s rights, or contains malicious software.',
        ],
      },
      {
        heading: 'Prices and orders',
        paragraphs: [
          'Each shop sets its own prices and services, in Indian rupees (INR). Prices and totals are shown before you place an order.',
          'A shop may decline or cancel an order. It records the reason as one of: the customer asked for it, a file problem, the item is out of stock, the shop is closed, a payment problem, or other. [Operator: state any further rules on changing or cancelling an order.]',
        ],
      },
      {
        heading: 'Payment',
        paragraphs: [
          'QRquick does not take payments and does not hold money for shops or customers. You pay the shop directly: in cash at the counter, or by UPI to the shop\'s own payment QR code. The shop records when it has been paid. [Operator: confirm this statement.]',
          'Any question about a payment is between you and the shop.',
        ],
      },
      {
        heading: 'Printing and collection',
        paragraphs: [
          'The shop prints the order and arranges how it is handed over. The shop is responsible for the printed result and for the orders it accepts.',
          'When a print job fails, the shop can send it to print again. A shop computer that prints automatically is run by the shop.',
        ],
      },
      {
        heading: 'Refunds and disputes',
        paragraphs: [
          'Refunds are decided by the shop. When a shop refunds an order it records the refunded amount in QRquick.',
          'If something is wrong with an order, contact the shop first. If you cannot agree, contact [contact]. [Operator: add the refund and dispute process, with any time limits.]',
        ],
      },
      {
        heading: 'Taxes and bills',
        paragraphs: [
          'QRquick does not calculate or collect GST or other taxes. Each shop is responsible for its own taxes, bills and receipts. [Operator: confirm.]',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: ['You must not:'],
        items: [
          'upload unlawful, infringing or harmful files;',
          'try to see or change another shop\'s data or another person\'s account;',
          'interfere with the service, overload it or copy its data in bulk;',
          'place orders you do not intend to collect and pay for;',
          'use QRquick to harass anyone.',
        ],
      },
      {
        heading: 'Service availability',
        paragraphs: [
          'A shop can close to new orders at any time. We may change, pause or stop features. [Operator: state any notice period for planned changes and any availability commitment, or say that there is none.]',
        ],
      },
      {
        heading: 'Suspension and ending use',
        paragraphs: [
          'We may suspend an account or a shop that breaks these Terms. [Operator: describe how suspension is decided and how the account holder is told. No suspension control is built into the app yet.]',
        ],
      },
      {
        heading: 'Liability',
        paragraphs: ['[Operator: liability wording. Have it reviewed by a lawyer before publication.]'],
      },
      {
        heading: 'Changes to these Terms',
        paragraphs: [
          'We publish a new version with a new version number and date. A shop owner must accept the current version to create an account. [Operator: how existing users are told of a change.]',
        ],
      },
      {
        heading: 'Governing law',
        paragraphs: ['[Operator: governing law and the courts that apply.]'],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          'QRquick is run by [operator legal name], [registered address]. Privacy questions go to [privacy contact].',
        ],
      },
      {
        heading: 'What we collect',
        paragraphs: ['Customers:'],
        items: [
          'the files you upload, with their page count and size;',
          'the order you place: the items, the options, the price and a short note you type for the shop (up to 300 characters);',
          'a tracking code, so you can follow the order.',
          'We do not ask customers for a name, phone number or address in QRquick.',
        ],
      },
      {
        heading: 'What we collect from shop owners',
        paragraphs: ['Shop owners:'],
        items: [
          'a username. The password is kept only as a one-way hash, and so are the recovery codes;',
          'the shop details you enter: name, phone, address, whether the shop is open, and its services and prices;',
          'the payment QR image you upload, if you use one;',
          'the orders for your shop, and the payment and refund records you enter.',
        ],
      },
      {
        heading: 'Counters that stop abuse',
        paragraphs: [
          'To stop repeated misuse, we keep short-term counters. For uploads, the counter key is a one-way hash of your internet address. For sign-in and recovery, the key is a keyed hash of the username or address, so neither is stored in readable form. [Operator or engineering: state how long these counter rows are kept.]',
        ],
      },
      {
        heading: 'Your browser',
        paragraphs: [
          'Your choice of light or dark theme is stored in your browser. A shop owner\'s sign-in session is stored in the browser for that tab only, and is removed on sign-out or when the tab is closed. We do not use cookies to track you, and the app contains no analytics.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'We use this information to take orders, let the shop see and print them, sign owners in, keep accounts secure, stop abuse and fix faults.',
        ],
      },
      {
        heading: 'Who receives it',
        paragraphs: ['The shop you order from receives your order, your files, your note and the payment record. The shop\'s print computer receives the files for its orders.', 'Our service providers:'],
        items: [
          'Supabase: the database, sign-in, file storage and server functions. [Operator: confirm the hosting region.]',
          'GitHub Pages: serves the web app files.',
          'Google Fonts: the font files are loaded from Google when a page opens, which sends your internet address to Google.',
        ],
      },
      {
        heading: 'How long we keep data',
        paragraphs: [
          'Uploaded customer files are given an expiry time of one day by default. Automatic deletion of expired files is not switched on yet. [Operator: set the retention period and turn on deletion before publishing. State here how long orders and shop records are kept.]',
        ],
      },
      {
        heading: 'Deleting data',
        paragraphs: [
          'Shop owners can change shop details and prices, and can make new recovery codes. To ask for an order, a file or an account to be deleted, contact [privacy contact]. There is no self-service deletion in the app yet. [Operator: confirm the process and how long it takes.]',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Pages are served over HTTPS. Customer files are kept in a private store and read only by the server. Database rules limit each shop\'s data to its own owners. Passwords and recovery codes are stored only as one-way hashes.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: ['[Operator: state the age policy, if any.]'],
      },
      {
        heading: 'Your rights',
        paragraphs: ['[Operator: list the rights that apply to you under the law that governs this service, and how to use them.]'],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: ['We publish a new version with a new version number and date. [Operator: how users are told of a change.]'],
      },
    ],
  },
});

export const LEGAL_KINDS = Object.freeze(Object.keys(LEGAL_PAGES));

// The page content as HTML. Every value is escaped; the text above is the only source.
export function legalHtml(kind, { ownerApp = false } = {}) {
  const page = LEGAL_PAGES[kind];
  if (!page) throw new Error(`Unknown legal page: ${kind}`);
  const back = ownerApp ? '#/owner' : '#/';
  const other = kind === 'terms' ? 'privacy' : 'terms';
  const otherTitle = LEGAL_PAGES[other].title;
  const sections = page.sections
    .map(
      (section) => `
        <h2>${escapeHtml(section.heading)}</h2>
        ${section.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('')}
        ${section.items ? `<ul>${section.items.map((text) => `<li>${escapeHtml(text)}</li>`).join('')}</ul>` : ''}`
    )
    .join('');
  return `
    <section class="card legal">
      <p><a class="link" href="${back}">← Back</a></p>
      <p class="eyebrow">QRQUICK</p>
      <h1>${escapeHtml(page.title)}</h1>
      <p class="muted small">Version ${escapeHtml(LEGAL_VERSION)}. Effective ${escapeHtml(LEGAL_EFFECTIVE)}.</p>
      <p class="banner" role="note">${escapeHtml(DRAFT_NOTICE)}</p>
      ${sections}
      <p class="muted small"><a href="#/${other}">${escapeHtml(otherTitle)}</a></p>
    </section>`;
}

// Shows one of the pages in the app's content area. The owner tab bar is hidden, as on the sign-in screen.
export function renderLegalPage(app, kind, { ownerApp = false } = {}) {
  const tabbar = document.getElementById('owner-tabbar');
  if (tabbar) {
    tabbar.hidden = true;
    tabbar.innerHTML = '';
  }
  document.body.classList.remove('has-tabbar');
  app.innerHTML = legalHtml(kind, { ownerApp });
  window.scrollTo?.(0, 0);
}
