// Pure helpers: no DOM and no network access, so they can be unit tested
// with Node's built-in test runner (see tests/).

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

// Money is stored and transported as integer paise (1 rupee = 100 paise).
export function formatPaise(paise) {
  if (!Number.isInteger(paise)) {
    throw new TypeError('Amount must be a whole number of paise');
  }
  return rupees.format(paise / 100);
}

const UNIT_LABELS = {
  per_side: 'per printed side',
  per_sheet: 'per sheet',
  per_copy: 'per copy',
};

export function unitLabel(pricingUnit) {
  return UNIT_LABELS[pricingUnit] ?? 'per unit';
}

const STATUS_LABELS = {
  pending: 'Waiting for the shop to approve',
  approved: 'Approved. Please pay at the counter.',
  printing: 'Printing now',
  ready: 'Ready for collection',
  completed: 'Completed',
  rejected: 'Rejected by the shop',
  cancelled: 'Cancelled',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? 'Unknown status';
}

// Escapes text before it is placed into HTML. Shop names and notes come from
// other people, so every dynamic value must pass through here.
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Upload limits. These mirror the upload-file function, which checks again from the bytes.
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';
const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const UPLOAD_EXTENSION = /\.(pdf|jpe?g|png)$/i;

// Quick check before the upload, so an obvious mistake costs no round trip.
// Returns a message for the customer, or null when the file may be sent.
export function checkUploadFile(file) {
  if (!file) return 'Choose a file first.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > UPLOAD_MAX_BYTES) return 'The file is larger than 10 MB. Try a smaller file.';
  const typeOk = UPLOAD_TYPES.includes(file.type) || (!file.type && UPLOAD_EXTENSION.test(file.name ?? ''));
  if (!typeOk) return 'Upload a PDF, JPEG or PNG file.';
  return null;
}

// Turns the chosen service, the uploaded file and the print choices into a cart item.
// `file` is what upload-file returned: { file_id, original_name, page_count }.
// Prices are deliberately absent: the server calculates every amount, and the
// page count shown here is only for the customer's screen.
export function buildItem({ serviceId, file, copies, colour, duplex }) {
  if (!serviceId) {
    throw new Error('Choose a service first.');
  }
  if (!file || !file.file_id) {
    throw new Error('Upload a file first.');
  }

  const count = Number.parseInt(copies, 10);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('Copies must be a number from 1 to 100.');
  }

  return {
    service_id: serviceId,
    file_id: file.file_id,
    file_name: file.original_name,
    page_count: file.page_count,
    copies: count,
    colour: Boolean(colour),
    duplex: Boolean(duplex),
  };
}

// The database allows one file per order item, so the page refuses the repeat early.
export function fileAlreadyInOrder(items, fileId) {
  return items.some((item) => item.file_id === fileId);
}

// Which colour modes a service can be ordered in.
export function colourAvailable(service) {
  return service.colour_price_paise !== null && service.colour_price_paise !== undefined;
}

// ---------- owner side ----------
// These checks mirror the database constraints so the owner gets a clear
// message before a request is sent. The database enforces the same rules.

export const RESERVED_SLUGS = ['admin', 'api', 'www', 'app', 'login', 'signup', 'help', 'support'];
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function validateSlug(input) {
  const slug = String(input ?? '').trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      'The web address must be 3 to 40 characters: lowercase letters, numbers and hyphens, ' +
        'and it cannot start or end with a hyphen.'
    );
  }
  if (RESERVED_SLUGS.includes(slug)) {
    throw new Error('That web address is reserved. Choose another.');
  }
  return slug;
}

const PHONE_PATTERN = /^[0-9+()\- ]{6,20}$/;

export function validateShopDetails({ name, phone, address }) {
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2 || cleanName.length > 120) {
    throw new Error('The shop name must be 2 to 120 characters.');
  }

  const cleanPhone = String(phone ?? '').trim();
  if (cleanPhone && !PHONE_PATTERN.test(cleanPhone)) {
    throw new Error('The phone number can contain digits, spaces, +, - and brackets (6 to 20 characters).');
  }

  const cleanAddress = String(address ?? '').trim();
  if (cleanAddress.length > 200) {
    throw new Error('The address must be 200 characters or fewer.');
  }

  return {
    name: cleanName,
    phone: cleanPhone || null,
    address: cleanAddress || null,
  };
}

const MAX_PRICE_PAISE = 100000; // ₹1,000, the database limit for one price

export function validateCashPolicy({ timing, minimumRupees }) {
  const cleanTiming = String(timing ?? 'counter');
  if (!['counter', 'collection'].includes(cleanTiming)) {
    throw new Error('Choose whether cash is due at the counter or on collection.');
  }
  const text = String(minimumRupees ?? '').trim();
  if (text === '') return { cash_payment_timing: cleanTiming, minimum_order_paise: 0 };
  const minimum = rupeesToPaise(text);
  if (minimum === null || minimum < 0) throw new Error('Enter a valid minimum order amount.');
  return { cash_payment_timing: cleanTiming, minimum_order_paise: minimum };
}

// Turns a rupee amount typed by the owner ("2", "2.5", "12.50") into whole
// paise. Blank means "not offered" and returns null. The text is parsed as
// digits, never as a float, so no rounding error can creep in.
export function rupeesToPaise(input) {
  const text = String(input ?? '').trim();
  if (text === '') return null;

  const match = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new Error('Enter prices in rupees, for example 2 or 2.50.');
  }

  const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (paise > MAX_PRICE_PAISE) {
    throw new Error('A price can be at most ₹1,000.');
  }
  return paise;
}

// The inverse of rupeesToPaise, for filling an edit form.
export function paiseToRupeesInput(paise) {
  if (!Number.isInteger(paise)) return '';
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export const PRICING_UNITS = ['per_side', 'per_sheet', 'per_copy'];

export function validateService(form) {
  const name = String(form.name ?? '').trim();
  if (name.length < 1 || name.length > 80) {
    throw new Error('The service name must be 1 to 80 characters.');
  }

  if (!PRICING_UNITS.includes(form.pricingUnit)) {
    throw new Error('Choose how this service is charged.');
  }

  const bwPricePaise = rupeesToPaise(form.bwPrice);
  const colourPricePaise = rupeesToPaise(form.colourPrice);
  if (bwPricePaise === null && colourPricePaise === null) {
    throw new Error('Enter a black and white price, a colour price, or both.');
  }

  return {
    name,
    pricing_unit: form.pricingUnit,
    bw_price_paise: bwPricePaise,
    colour_price_paise: colourPricePaise,
    is_active: Boolean(form.isActive),
  };
}

// ---------- owner: orders ----------
// The database enforces these moves (guard_order_changes trigger in migration
// 0001). This table only decides which buttons the owner sees, so it must
// match the database.
const NEXT_ORDER_STATUSES = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['printing', 'ready', 'completed', 'cancelled'],
  printing: ['ready', 'completed'],
  ready: ['completed'],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function nextOrderStatuses(status) {
  return NEXT_ORDER_STATUSES[status] ?? [];
}

const ACTION_LABELS = {
  approved: 'Approve',
  rejected: 'Reject',
  printing: 'Start printing',
  ready: 'Mark ready',
  completed: 'Mark completed',
  cancelled: 'Cancel order',
};

export function orderActionLabel(status) {
  return ACTION_LABELS[status] ?? status;
}

// Rejecting and cancelling cannot be undone, so the owner confirms them first.
export function isIrreversibleMove(status) {
  return status === 'rejected' || status === 'cancelled';
}

const OWNER_STATUS_LABELS = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  printing: 'Printing',
  ready: 'Ready for collection',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function ownerStatusLabel(status) {
  return OWNER_STATUS_LABELS[status] ?? status;
}

// Orders that still need the shop's attention.
export function isOpenOrder(status) {
  return ['pending', 'approved', 'printing', 'ready'].includes(status);
}

// One line for the owner, for example
// "Document printing · 12 pages × 2 copies · B&W, double-sided".
export function describeOrderItem(item) {
  const mode = item.colour ? 'colour' : 'B&W';
  const sides = item.duplex ? 'double-sided' : 'single-sided';
  const pages = `${item.page_count} ${item.page_count === 1 ? 'page' : 'pages'}`;
  const copies = `${item.copies} ${item.copies === 1 ? 'copy' : 'copies'}`;
  return `${item.service_name} · ${pages} × ${copies} · ${mode}, ${sides}`;
}

// ---------- owner: automatic printing ----------
// The owner app shows what the printing computers report. The database decides every
// change (migration 0010). These helpers only choose the words and the buttons.

const JOB_STATUS_LABELS = {
  queued: 'Waiting for a printing computer',
  claimed: 'Being sent to the printer',
  printing: 'Printing',
  sent: 'Sent to the printer',
  failed: 'Not printed',
  needs_check: 'Check the printer',
};

export function printJobLabel(status) {
  return JOB_STATUS_LABELS[status] ?? status;
}

// Plain words for the reasons a job did not print. A message from the agent is more
// specific, so it is shown first when there is one.
const FAILURE_TEXT = {
  printer_offline: 'The printer is turned off or offline. Turn it on, then print again.',
  printer_not_found: 'That printer is not connected to the printing computer.',
  printer_unknown: 'The printer options could not be read on the printing computer.',
  unsupported_setting: 'This printer cannot print what the order asks for.',
  print_engine_missing: 'The printing software is not set up on the printing computer.',
  spooler_error: 'The printing computer could not send the job to the printer.',
  download_failed: 'The file could not be downloaded to the printing computer.',
  file_changed: 'The file does not match the upload. Ask the customer to upload it again.',
  file_type_unknown: 'The file is not a PDF, JPEG or PNG.',
  image_unsupported: 'This picture format cannot be printed here. Ask for a JPG or PDF.',
  too_many_claims: 'The printing computer could not finish this job after several tries.',
  bad_settings: 'The order settings could not be read.',
};

export function printFailureText(job) {
  if (!job) return '';
  if (job.status === 'needs_check') {
    return 'The printer may already have printed this. Check it before printing again.';
  }
  if (job.status !== 'failed') return '';
  return job.error_message || FAILURE_TEXT[job.error_code] || 'The order did not print.';
}

// The newest job for each order item. A retry creates a new attempt number.
export function latestJobsByItem(jobs) {
  const latest = new Map();
  for (const job of jobs ?? []) {
    const current = latest.get(job.order_item_id);
    if (!current || job.attempt > current.attempt) latest.set(job.order_item_id, job);
  }
  return latest;
}

// The file items of an order that have no print job yet.
export function itemsToSend(order, jobsByItem) {
  return (order.order_items ?? []).filter((item) => item.file_id && item.id && !jobsByItem.has(item.id));
}

// "Send to printer" shows for a paid order that is approved or already printing, when a
// file item has no job yet. Once every file is queued the button goes away.
export function canSendToPrint(order, jobsByItem) {
  if (!['approved', 'printing'].includes(order.status)) return false;
  if (order.payment_status !== 'paid') return false;
  return itemsToSend(order, jobsByItem).length > 0;
}

// Print again. A failed job is safe to retry. A job that may already have printed needs
// the owner to confirm first.
export function retryOptions(job) {
  if (!job) return null;
  if (job.status === 'failed') return { confirmMayHavePrinted: false, warning: '' };
  if (job.status === 'needs_check') {
    return {
      confirmMayHavePrinted: true,
      warning: 'The printer may already have printed this page. Only print it again if you checked the printer and nothing came out.',
    };
  }
  return null;
}

export function printAgentFunctionUrl(supabaseUrl) {
  return `${String(supabaseUrl ?? '').replace(/\/$/, '')}/functions/v1/print-agent`;
}

export function agentStatusLabel(agent) {
  return agent.online ? 'Connected' : 'Not connected right now';
}

export function printerOptionLabel(printer) {
  const notes = [];
  if (printer.isDefault) notes.push('system default');
  if (!printer.enabled) notes.push('offline');
  if (printer.capabilitiesKnown) notes.push(printer.colour ? 'colour' : 'black and white');
  if (printer.duplex) notes.push('double-sided');
  return notes.length ? `${printer.name} (${notes.join(', ')})` : printer.name;
}

// A line for the top of the orders page about the printing computers. '' when all is well.
export function printingNotice({ agents = [], jobs = [] }) {
  if (!agents.length) return 'No printing computer is set up yet, so orders will not print automatically.';
  if (agents.some((agent) => agent.online)) return '';
  const waiting = jobs.filter((job) => job.status === 'queued').length;
  if (!waiting) return 'No printing computer is connected right now.';
  return `No printing computer is connected. ${waiting} job${waiting === 1 ? ' is' : 's are'} waiting.`;
}

// ---------- owner: statistics, payments and CSV ----------
// Calendar days are "YYYY-MM-DD" strings in India time (IST). The arithmetic
// below runs on those strings in UTC, so the result does not depend on the
// time zone of the device showing the page.

const INDIA_TIME = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RANGE_DAYS = 800; // the database refuses longer periods

function utcDate(day) {
  return new Date(`${day}T00:00:00Z`);
}

// True for a real calendar day such as 2001-03-05 (not 2001-02-30).
export function isDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
  return utcDate(value).toISOString().slice(0, 10) === value;
}

// Today's date in India, whatever time zone the device is set to.
export function istToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(day, count) {
  const date = utcDate(day);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

// Whole days from `from` to `to` (0 for the same day).
function dayGap(from, to) {
  return Math.round((utcDate(to) - utcDate(from)) / DAY_MS);
}

// Calendar days in a range, both ends included.
export function daysInRange(from, to) {
  return dayGap(from, to) + 1;
}

// The Monday that starts the week containing `day` (weeks start on Monday here).
export function weekStart(day) {
  const weekday = utcDate(day).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

export function monthStart(day) {
  return `${day.slice(0, 7)}-01`;
}

export function monthEnd(day) {
  const [year, month] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function yearStart(day) {
  return `${day.slice(0, 4)}-01-01`;
}

export function yearEnd(day) {
  return `${day.slice(0, 4)}-12-31`;
}

export const PERIODS = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS = { today: 'Today', week: 'This week', month: 'This month', year: 'This year', custom: 'Custom' };

export function periodLabel(period) {
  return PERIOD_LABELS[period] ?? 'Custom';
}

// The range a preset covers: from its first day up to and including today.
export function presetRange(period, today) {
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: weekStart(today), to: today };
    case 'month':
      return { from: monthStart(today), to: today };
    case 'year':
      return { from: yearStart(today), to: today };
    default:
      throw new Error('Choose today, this week, this month, this year or a custom range.');
  }
}

function earlierOf(a, b) {
  return a < b ? a : b;
}

// The range to compare with: the same length, in the same place in the calendar.
// Last week for this week (same weekdays), last month or last year for those
// presets (same days, cut short at the end of that month or year). Any other
// range is compared with the same number of days straight before it.
export function comparisonRange(period, from, to) {
  const length = daysInRange(from, to);
  if (period === 'week') {
    return { from: addDays(from, -7), to: addDays(to, -7) };
  }
  if (period === 'month' || period === 'year') {
    const start = period === 'month' ? monthStart(addDays(from, -1)) : yearStart(addDays(from, -1));
    const last = period === 'month' ? monthEnd(start) : yearEnd(start);
    return { from: start, to: earlierOf(addDays(start, length - 1), last) };
  }
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

// Returns a message for the owner, or null when the range may be used.
export function checkRange(from, to) {
  if (!isDay(from) || !isDay(to)) return 'Choose a start date and an end date.';
  if (dayGap(from, to) < 0) return 'The end date is before the start date.';
  if (dayGap(from, to) > MAX_RANGE_DAYS) return `Choose a range of ${MAX_RANGE_DAYS} days or less.`;
  return null;
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const SHORT_DAY_FORMAT = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'short' });
const MONTH_FORMAT = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'short', year: 'numeric' });

export function formatDay(day) {
  return DAY_FORMAT.format(utcDate(day));
}

export function formatShortDay(day) {
  return SHORT_DAY_FORMAT.format(utcDate(day));
}

export function formatWeekday(day) {
  return WEEKDAY_FORMAT.format(utcDate(day));
}

export function rangeLabel(from, to) {
  return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
}

// Percentage change from the previous period, to one decimal place.
// Null when there is nothing to compare with.
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function changeText(current, previous) {
  const change = percentChange(current, previous);
  if (change === null) {
    return current > 0 ? 'New compared with the previous period' : 'Nothing in the previous period';
  }
  if (change === 0) return 'Same as the previous period';
  return `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)}% from the previous period`;
}

// Groups the daily rows from shop_stats_daily into days, weeks (Monday start), months or years.
export function groupDays(days, grouping) {
  const buckets = new Map();
  for (const row of days) {
    const key = bucketKey(row.date, grouping);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        first: row.date,
        last: row.date,
        orders: 0,
        completed: 0,
        stopped: 0,
        earnedOrders: 0,
        earnedPaise: 0,
        refundsPaise: 0,
        orderValuePaise: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.last = row.date;
    bucket.orders += row.orders;
    bucket.completed += row.completed;
    bucket.stopped += row.stopped;
    bucket.earnedOrders += row.earned_orders;
    bucket.earnedPaise += row.earned_paise;
    bucket.refundsPaise += row.refunds_paise;
    bucket.orderValuePaise += row.order_value_paise;
  }
  return [...buckets.values()];
}

function bucketKey(day, grouping) {
  if (grouping === 'week') return weekStart(day);
  if (grouping === 'month') return day.slice(0, 7);
  if (grouping === 'year') return day.slice(0, 4);
  return day;
}

export function bucketLabel(bucket, grouping) {
  if (grouping === 'day') return formatDay(bucket.first);
  if (grouping === 'week') return rangeLabel(bucket.first, bucket.last);
  if (grouping === 'month') return MONTH_FORMAT.format(utcDate(bucket.first));
  return bucket.first.slice(0, 4);
}

const REASON_LABELS = {
  customer_asked: 'Customer asked to cancel',
  file_problem: 'Problem with the file',
  out_of_stock: 'Out of stock',
  shop_closed: 'Shop was closed',
  payment_problem: 'Payment problem',
  other: 'Other',
  not_given: 'Reason not recorded',
};

export const CANCEL_REASONS = ['customer_asked', 'file_problem', 'out_of_stock', 'shop_closed', 'payment_problem', 'other'];

export function cancelReasonLabel(reason) {
  return REASON_LABELS[reason] ?? 'Other';
}

// What the payment line says for one order.
export function paymentLabel(order) {
  if (order.payment_status === 'paid') {
    return order.payment_channel === 'cash' ? 'Paid in cash' : 'Paid online';
  }
  if (order.payment_status === 'pending') return 'Online payment pending';
  if (order.payment_status === 'refunded') return `Refunded ${formatPaise(order.refund_paise ?? 0)}`;
  return 'Not paid yet';
}

// The payment buttons the owner may use on an order. Mirrors set_order_payment in
// the database. A cancelled or rejected order cannot take a new payment, but a
// payment already taken can still be refunded.
export function nextPaymentActions(order) {
  const stopped = order.status === 'cancelled' || order.status === 'rejected';
  switch (order.payment_status) {
    case 'unpaid':
      if (stopped) return [];
      return [
        { action: 'set_paid', channel: 'cash', label: 'Mark paid in cash' },
        { action: 'set_paid', channel: 'online', label: 'Mark paid online' },
        { action: 'set_pending', channel: 'online', label: 'Online payment pending' },
      ];
    case 'pending': {
      const confirm = stopped
        ? []
        : [
            { action: 'set_paid', channel: 'online', label: 'Confirm online payment' },
            { action: 'set_paid', channel: 'cash', label: 'Mark paid in cash' },
          ];
      return [...confirm, { action: 'set_unpaid', channel: null, label: 'Clear pending payment' }];
    }
    case 'paid':
      return [{ action: 'refund', channel: null, label: 'Record refund', danger: true }];
    default:
      return [];
  }
}

// One line for the recent activity list.
export function describeActivity(event) {
  if (event.kind === 'created') {
    return event.amount_paise == null ? 'Order placed' : `Order placed (${formatPaise(event.amount_paise)})`;
  }
  if (event.kind === 'status') {
    return `Status: ${ownerStatusLabel(event.from)} → ${ownerStatusLabel(event.to)}`;
  }
  if (event.kind === 'payment') {
    const how = event.detail === 'cash' ? ' in cash' : event.detail === 'online' ? ' online' : '';
    if (event.to === 'paid') return `Marked paid${how}`;
    if (event.to === 'pending') return 'Online payment pending';
    return 'Payment cleared';
  }
  if (event.kind === 'refund') {
    return `Refund recorded: ${formatPaise(event.amount_paise ?? 0)}`;
  }
  return 'Change recorded';
}

// Times in India for the exports, as "2001-03-05 01:30".
const INDIA_STAMP = new Intl.DateTimeFormat('en-GB', {
  timeZone: INDIA_TIME,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function istStamp(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(INDIA_STAMP.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

// Money in rupees with two decimals, for spreadsheets (not for the screen).
export function rupeesCsv(paise) {
  return ((paise ?? 0) / 100).toFixed(2);
}

// One CSV cell. Quotes and commas are escaped, and a leading = + - @ or tab is
// neutralised so a spreadsheet cannot run a formula from a customer's text.
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function dailyReportCsv(days) {
  const header = [
    'Date (IST)',
    'Orders placed',
    'Order value (INR)',
    'Completed',
    'Net earnings (INR)',
    'Net orders',
    'Refunds (INR)',
    'Cancelled or rejected',
  ];
  const rows = days.map((day) => [
    day.date,
    day.orders,
    rupeesCsv(day.order_value_paise),
    day.completed,
    rupeesCsv(day.earned_paise),
    day.earned_orders,
    rupeesCsv(day.refunds_paise),
    day.stopped,
  ]);
  return toCsv([header, ...rows]);
}

export function ordersCsv(orders) {
  const header = [
    'Tracking code',
    'Placed (IST)',
    'Status',
    'Order total (INR)',
    'Payment',
    'Payment channel',
    'Paid at (IST)',
    'Refunded at (IST)',
    'Refund (INR)',
    'Cancel reason',
    'Items',
  ];
  const rows = orders.map((order) => [
    order.tracking_code,
    istStamp(order.created_at),
    order.status,
    rupeesCsv(order.total_paise),
    order.payment_status,
    order.payment_channel ?? '',
    istStamp(order.paid_at),
    istStamp(order.refunded_at),
    order.refund_paise == null ? '' : rupeesCsv(order.refund_paise),
    order.cancel_reason ?? '',
    (order.order_items ?? []).map(describeOrderItem).join('; '),
  ]);
  return toCsv([header, ...rows]);
}

// ---------- owner: QR code, shop features and payment QR ----------

// The web address a QR code points to. The customer page is one page with the shop
// in the hash, so the address is the page address plus #/s/<slug>.
// config.publicBaseUrl wins when it is set. Otherwise the address of the page
// itself is used, which is wrong inside the Android app (its address is local).
export function publicBaseAddress(config, location) {
  const configured = String(config?.publicBaseUrl ?? '').trim();
  const base = configured || `${location.origin}${location.pathname}`;
  return { base, problem: addressProblem(base) };
}

// Returns a message for the owner when customers could not open a QR code built from this address.
export function addressProblem(base) {
  let url;
  try {
    url = new URL(base);
  } catch {
    return 'The customer page address is not a valid web address. Check publicBaseUrl in config.js.';
  }
  // The local check comes first: a local address is the bigger problem, and it is usually http too.
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    return 'This is a local address, so customers cannot open the QR code. Set publicBaseUrl in config.js to the published web address.';
  }
  if (url.protocol !== 'https:') {
    return 'The customer page address must start with https:// or the QR code will not open for customers.';
  }
  return null;
}

export function shopAddress(base, slug) {
  const trimmed = String(base).replace(/#.*$/, '');
  const root = /\.html?$/.test(trimmed) || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  return `${root}#/s/${encodeURIComponent(slug)}`;
}

// Colour is offered unless the owner has switched it off (features default to on).
export function shopOffersColour(shop) {
  return shop?.features?.colour_printing !== false;
}

export function shopOffersDoubleSided(shop) {
  return shop?.features?.double_sided !== false;
}

export const PAYMENT_QR_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg' };
export const PAYMENT_QR_MAX_BYTES = 2 * 1024 * 1024;

// The owner's payment QR image: PNG or JPEG, up to 2 MB. Returns a message, or null.
export function checkPaymentQrFile(file) {
  if (!file) return 'Choose an image first.';
  if (!PAYMENT_QR_TYPES[file.type]) return 'Upload a PNG or JPEG image.';
  if (file.size === 0) return 'The image is empty.';
  if (file.size > PAYMENT_QR_MAX_BYTES) return 'The image is larger than 2 MB. Save it at a smaller size.';
  return null;
}

// The public address of a file in the shop-assets bucket.
export function publicAssetUrl(supabaseUrl, path) {
  const encoded = String(path).split('/').map(encodeURIComponent).join('/');
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/shop-assets/${encoded}`;
}
