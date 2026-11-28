// Turns a checked read response into label and value pairs for display. Pure functions, no DOM. The DOM code
// writes every value with textContent. Times are shown in India Standard Time (Asia/Kolkata), the zone the
// licence rules use.

export const STATE_LABELS = Object.freeze({
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled (not yet started)',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
  NONE: 'No licence',
});

export const KIND_LABELS = Object.freeze({
  admin_grant: 'Admin grant',
  lifetime_grant: 'Lifetime grant',
});

export const AUDIT_ACTION_LABELS = Object.freeze({
  grant: 'Grant',
  extend: 'Extension',
  revoke: 'Revocation',
  replace: 'Replacement',
  enforcement_change: 'Enforcement change',
});

const IST_FORMAT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatIst(iso) {
  if (!iso) return 'None';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time not readable';
  return `${IST_FORMAT.format(date)} IST`;
}

export function licenceFacts(view) {
  const { shop, state, state_version: version } = view;
  const rows = [
    ['Shop', `${shop.name} (${shop.slug})`],
    ['State', STATE_LABELS[state.state] ?? 'Unknown'],
  ];
  if (state.state === 'ACTIVE') {
    rows.push(['Access ends', state.access_until ? formatIst(state.access_until) : 'No expiry']);
  }
  if (state.state === 'SCHEDULED') {
    rows.push(['Next start', formatIst(state.next_start)]);
  }
  rows.push(['State version', String(version)]);
  return rows;
}

export function coverageLabel(coverage) {
  const status = coverage.status === 'current' ? 'current' : 'scheduled';
  const end = coverage.ends_at ? formatIst(coverage.ends_at) : 'no end';
  return `${KIND_LABELS[coverage.kind] ?? 'Coverage'}, ${status}: ${formatIst(coverage.starts_at)} to ${end}`;
}

// The recording admin's user ID (entry.actor_user_id) is deliberately not shown. Whether admins may see
// who recorded each entry is open (OWNER_DECISION_SHEET.md, Part 1N, N5). The field stays in the data and
// in the API response; only the display omits it.
export function auditRows(entry) {
  return [
    ['When', formatIst(entry.created_at)],
    ['Action', AUDIT_ACTION_LABELS[entry.action] ?? 'Unknown'],
    ['Reason', entry.reason],
    ['Coverage ID', entry.coverage_id ?? 'None'],
    ['Licence start', entry.licence_start ? formatIst(entry.licence_start) : 'None'],
    ['Licence end', entry.licence_end ? formatIst(entry.licence_end) : 'None'],
  ];
}
