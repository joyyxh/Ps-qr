// Statistics for one shop, shown on its own page: #/owner/shop/<slug>/stats.
//
// Every number comes from three database functions (shop_stats_summary,
// shop_stats_daily and shop_recent_activity). Each one checks that the signed-in
// user owns the shop, then adds up the orders and payments already stored. This
// file only groups, labels and exports what the database returned.

import {
  addDays,
  bucketLabel,
  cancelReasonLabel,
  changeText,
  checkRange,
  comparisonRange,
  dailyReportCsv,
  describeActivity,
  escapeHtml,
  formatDay,
  formatPaise,
  formatShortDay,
  formatWeekday,
  groupDays,
  istToday,
  ordersCsv,
  periodLabel,
  PERIODS,
  presetRange,
  rangeLabel,
  weekStart,
} from './logic.js';

const GROUPINGS = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
];

const GROUP_HEADINGS = {
  day: 'Day',
  week: 'Week (Monday to Sunday)',
  month: 'Month',
  year: 'Year',
};

export function createStatsPages({ app, ownerApi, messageFor, now = () => new Date() }) {
  let view = null; // state of the statistics page on screen
  let loadToken = 0; // a slow response that finishes late is ignored

  function show(html) {
    app.innerHTML = html;
  }

  function on(selector, eventName, handler) {
    app.querySelector(selector)?.addEventListener(eventName, handler);
  }

  function onAll(selector, eventName, handler) {
    app.querySelectorAll(selector).forEach((el) => el.addEventListener(eventName, handler));
  }

  // Called by owner.js for #/owner/shop/<slug>/stats.
  async function open(shop) {
    const today = istToday(now());
    view = {
      shop,
      today,
      period: 'month', // the button that is selected
      rangeKind: 'month', // the period the numbers on screen were loaded for
      range: presetRange('month', today),
      custom: { from: '', to: '' },
      grouping: 'day',
      week: weekStart(today),
      data: null,
      error: '',
    };
    await load();
  }

  // Reads everything the page shows: the period, the period before it for
  // comparison, the daily rows, the chosen week and the recent activity.
  async function load() {
    const token = ++loadToken;
    view.today = istToday(now());
    const { shop, range, week } = view;
    const previousRange = comparisonRange(view.rangeKind, range.from, range.to);
    show('<section class="card"><p class="muted">Loading statistics…</p></section>');
    try {
      const [current, previous, daily, weekDays, activity] = await Promise.all([
        ownerApi.statsSummary(shop.id, range.from, range.to),
        ownerApi.statsSummary(shop.id, previousRange.from, previousRange.to),
        ownerApi.statsDaily(shop.id, range.from, range.to),
        ownerApi.statsDaily(shop.id, week, addDays(week, 6)),
        ownerApi.recentActivity(shop.id, 30),
      ]);
      if (token !== loadToken) return;
      view.data = { current, previous, previousRange, daily, weekDays, activity };
      view.error = '';
    } catch (err) {
      if (token !== loadToken) return;
      view.error = messageFor(err);
    }
    render();
  }

  function render() {
    if (!view) return;
    show(pageHtml());
    bind();
  }

  function pageHtml() {
    const { shop, data, error } = view;
    const sections = data
      ? [
          earningsCard(),
          ordersCard(),
          weekCard(),
          cancellationsCard(),
          completedCard(),
          paymentsCard(),
          servicesCard(),
          activityCard(),
          exportCard(),
        ]
      : [];
    return `
      <section class="card">
        <p class="small"><a href="#/owner/shop/${encodeURIComponent(shop.slug)}">← ${escapeHtml(shop.name)}</a></p>
        <h1>Statistics</h1>
        <p class="muted small">Based on your orders and the payments you record. Times are in India (IST).</p>
        ${periodControls()}
        <p class="error" role="alert">${escapeHtml(error)}</p>
      </section>
      ${sections.join('')}`;
  }

  function periodControls() {
    const { period, range, data, custom } = view;
    const presets = PERIODS.map(
      (name) =>
        `<button type="button" data-period="${name}" class="${name === period ? 'on' : ''}" ` +
        `aria-pressed="${name === period}">${escapeHtml(periodLabel(name))}</button>`
    ).join('');
    const customForm =
      period === 'custom'
        ? `<form id="custom-range" class="grid stats-custom">
             <label>From <input type="date" name="from" required value="${escapeHtml(custom.from)}" /></label>
             <label>To <input type="date" name="to" required value="${escapeHtml(custom.to)}" /></label>
             <button type="submit" data-label="Show these dates">Show these dates</button>
           </form>`
        : '';
    const showing = data
      ? `<p class="muted small">Showing <strong>${escapeHtml(rangeLabel(range.from, range.to))}</strong>
           · compared with ${escapeHtml(rangeLabel(data.previousRange.from, data.previousRange.to))}</p>`
      : '';
    return `<div class="segmented stats-periods">${presets}</div>
      ${customForm}
      ${showing}
      <p><button type="button" class="link" data-action="refresh-stats">Refresh</button></p>`;
  }

  // ---------- sections ----------

  function earningsCard() {
    const { current, previous, daily } = view.data;
    const net = current.earnings;
    const before = previous.earnings;
    const groups = groupDays(daily, view.grouping).filter(hasActivity);
    const rows = groups
      .map(
        (group) => `<tr>
          <td>${escapeHtml(bucketLabel(group, view.grouping))}</td>
          <td class="num">${group.earnedOrders}</td>
          <td class="num">${formatPaise(group.earnedPaise)}</td>
          <td class="num">${formatPaise(group.refundsPaise)}</td>
        </tr>`
      )
      .join('');
    const groupButtons = GROUPINGS.map(
      ([key, label]) =>
        `<button type="button" data-grouping="${key}" class="${key === view.grouping ? 'on' : ''}" ` +
        `aria-pressed="${key === view.grouping}">${escapeHtml(label)}</button>`
    ).join('');
    return `
      <section class="card">
        <h2>Earnings and revenue</h2>
        <p class="muted small">Money you recorded as received, counted on the day it was paid. Cancelled,
           rejected and refunded orders are not counted. Order value is shown separately.</p>
        <div class="stat-grid">
          ${tile('Net earnings', formatPaise(net.net_paise), changeText(net.net_paise, before.net_paise))}
          ${tile('Paid orders', String(net.net_orders), changeText(net.net_orders, before.net_orders))}
          ${tile('Received in cash', formatPaise(net.net_cash_paise))}
          ${tile('Received online', formatPaise(net.net_online_paise))}
        </div>
        <div class="segmented stats-periods">${groupButtons}</div>
        <div class="table-wrap">
          <table class="breakdown">
            <thead>
              <tr><th>${escapeHtml(GROUP_HEADINGS[view.grouping])}</th><th class="num">Paid orders</th>
                  <th class="num">Net earnings</th><th class="num">Refunds</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" class="muted">No payments recorded in this period.</td></tr>'}</tbody>
            <tfoot>
              <tr><th>Total</th><th class="num">${net.net_orders}</th>
                  <th class="num">${formatPaise(net.net_paise)}</th><th class="num">${formatPaise(current.refunds.paise)}</th></tr>
            </tfoot>
          </table>
        </div>
      </section>`;
  }

  function ordersCard() {
    const { current, previous } = view.data;
    const o = current.orders;
    const before = previous.orders;
    return `
      <section class="card">
        <h2>Order statistics</h2>
        <p class="muted small">Orders placed in this period, by their status now.</p>
        <div class="stat-grid">
          ${tile('Total orders', String(o.total), changeText(o.total, before.total))}
          ${tile('Order value (not earnings)', formatPaise(o.order_value_paise), changeText(o.order_value_paise, before.order_value_paise))}
          ${tile('Pending', String(o.pending))}
          ${tile('Approved (confirmed)', String(o.approved))}
          ${tile('Printing', String(o.printing))}
          ${tile('Ready', String(o.ready))}
          ${tile('Completed', String(o.completed))}
          ${tile('Cancelled', String(o.cancelled))}
          ${tile('Rejected', String(o.rejected))}
        </div>
      </section>`;
  }

  function weekCard() {
    const { weekDays } = view.data;
    const thisWeek = weekStart(view.today);
    const atThisWeek = view.week === thisWeek;
    const rows = weekDays
      .map(
        (day) => `<tr>
          <td>${escapeHtml(formatWeekday(day.date))} ${escapeHtml(formatShortDay(day.date))}</td>
          <td class="num">${day.orders}</td>
          <td class="num">${formatPaise(day.earned_paise)}</td>
          <td class="num">${day.stopped}</td>
        </tr>`
      )
      .join('');
    return `
      <section class="card">
        <h2>Weekly report</h2>
        <p class="muted small">${escapeHtml(rangeLabel(view.week, addDays(view.week, 6)))}</p>
        <div class="week-nav">
          <button type="button" class="link" data-week="prev">← Previous week</button>
          <button type="button" class="link" data-week="this" ${atThisWeek ? 'disabled' : ''}>This week</button>
          <button type="button" class="link" data-week="next" ${atThisWeek ? 'disabled' : ''}>Next week →</button>
        </div>
        ${weekChartSvg(weekDays)}
        <p class="legend">
          <span><span class="swatch earned"></span>Net earnings</span>
          <span><span class="swatch placed"></span>Orders placed</span>
          <span>Each set of bars is scaled to the busiest day for that measure.</span>
        </p>
        <div class="table-wrap">
          <table class="breakdown">
            <thead><tr><th>Day</th><th class="num">Orders placed</th><th class="num">Net earnings</th>
                <th class="num">Cancelled or rejected</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function cancellationsCard() {
    const { current, previous } = view.data;
    const c = current.cancellations;
    const before = previous.cancellations;
    const reasons = current.reasons
      .map(
        (row) => `<tr><td>${escapeHtml(cancelReasonLabel(row.reason))}</td><td class="num">${row.count}</td></tr>`
      )
      .join('');
    return `
      <section class="card">
        <h2>Cancellations</h2>
        <p class="muted small">Cancelled or rejected orders placed in this period. The rate is those orders
           out of all orders placed in the period.</p>
        <div class="stat-grid">
          ${tile('Cancelled', String(c.cancelled))}
          ${tile('Rejected', String(c.rejected))}
          ${tile('Cancellation rate', `${c.rate_percent}%`, `Previous period: ${before.rate_percent}%`)}
        </div>
        <h3>Reasons</h3>
        ${
          reasons
            ? `<div class="table-wrap"><table class="breakdown">
                 <thead><tr><th>Reason</th><th class="num">Orders</th></tr></thead>
                 <tbody>${reasons}</tbody>
               </table></div>`
            : '<p class="muted">No cancellations or rejections in this period.</p>'
        }
        <p class="muted small">A reason is the one the shop picks on the order. Older orders may have none.</p>
      </section>`;
  }

  function completedCard() {
    const { current, previous } = view.data;
    const c = current.completed;
    const before = previous.completed;
    return `
      <section class="card">
        <h2>Completed orders</h2>
        <p class="muted small">Orders placed in this period that are completed. Pages printed is pages
           multiplied by copies.</p>
        <div class="stat-grid">
          ${tile('Completed orders', String(c.count), changeText(c.count, before.count))}
          ${tile('Pages printed', String(c.pages))}
          ${tile('Items', String(c.items))}
          ${tile('Revenue', formatPaise(c.revenue_paise), changeText(c.revenue_paise, before.revenue_paise))}
        </div>
      </section>`;
  }

  function paymentsCard() {
    const { current } = view.data;
    const p = current.payments;
    const e = current.earnings;
    const r = current.refunds;
    return `
      <section class="card">
        <h2>Payments</h2>
        <p class="muted small">Orders placed in this period, by payment state.</p>
        <div class="stat-grid">
          ${tile('Unpaid', String(p.unpaid))}
          ${tile('Pending online', String(p.pending))}
          ${tile('Paid', String(p.paid))}
          ${tile('Refunded', String(p.refunded))}
        </div>
        <p class="muted small">Money by the day it was paid, in this period.</p>
        <div class="stat-grid">
          ${tile('Collected', formatPaise(e.collected_paise), 'Paid orders, including refunded ones')}
          ${tile('Refunds recorded', String(r.count), formatPaise(r.paise))}
          ${tile('Refund due', formatPaise(e.refund_due_paise), 'Paid, then cancelled or rejected')}
        </div>
      </section>`;
  }

  function servicesCard() {
    const rows = view.data.current.services
      .map(
        (line) => `<tr>
          <td>${escapeHtml(line.service)}</td>
          <td>${line.colour ? 'Colour' : 'B&amp;W'}</td>
          <td class="num">${line.items}</td>
          <td class="num">${line.pages}</td>
          <td class="num">${formatPaise(line.revenue_paise)}</td>
        </tr>`
      )
      .join('');
    return `
      <section class="card">
        <h2>Popular services</h2>
        <p class="muted small">Most ordered first. Cancelled and rejected orders are left out.</p>
        ${
          rows
            ? `<div class="table-wrap"><table class="breakdown">
                 <thead><tr><th>Service</th><th>Mode</th><th class="num">Items</th><th class="num">Pages</th>
                     <th class="num">Revenue</th></tr></thead>
                 <tbody>${rows}</tbody>
               </table></div>`
            : '<p class="muted">No orders for services in this period.</p>'
        }
      </section>`;
  }

  function activityCard() {
    const items = view.data.activity
      .map((event) => {
        const when = new Date(event.at).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        return `<li>
          <span class="muted small">${escapeHtml(when)}</span>
          <span><span class="mono">${escapeHtml(event.tracking_code)}</span> · ${escapeHtml(describeActivity(event))}</span>
        </li>`;
      })
      .join('');
    return `
      <section class="card">
        <h2>Recent activity</h2>
        <p class="muted small">The 30 latest changes to your orders. This list is not limited to the dates above.</p>
        ${items ? `<ol class="activity">${items}</ol>` : '<p class="muted">No activity yet.</p>'}
      </section>`;
  }

  function exportCard() {
    return `
      <section class="card">
        <h2>Export reports</h2>
        <p class="muted small">Opens in Excel or Google Sheets. Amounts are in rupees. Times are in India (IST).
           Files cover the period above.</p>
        <div class="actions">
          <button type="button" data-export="daily">Download daily report (CSV)</button>
          <button type="button" data-export="orders">Download orders placed (CSV)</button>
        </div>
      </section>`;
  }

  // ---------- actions ----------

  function bind() {
    onAll('[data-period]', 'click', (event) => choosePeriod(event.currentTarget.dataset.period));
    onAll('[data-grouping]', 'click', (event) => {
      view.grouping = event.currentTarget.dataset.grouping;
      render();
    });
    on('#custom-range', 'submit', onCustomSubmit);
    onAll('[data-week]', 'click', (event) => chooseWeek(event.currentTarget.dataset.week));
    on('[data-action="refresh-stats"]', 'click', () => load());
    onAll('[data-export]', 'click', onExport);
  }

  function choosePeriod(period) {
    view.today = istToday(now());
    if (period === 'custom') {
      view.period = 'custom';
      if (!view.custom.from) view.custom = { from: view.range.from, to: view.range.to };
      render();
      return;
    }
    view.period = period;
    view.rangeKind = period;
    view.range = presetRange(period, view.today);
    load();
  }

  function onCustomSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    view.custom = { from: String(data.get('from') ?? ''), to: String(data.get('to') ?? '') };
    const problem = checkRange(view.custom.from, view.custom.to);
    if (problem) {
      view.error = problem;
      render();
      return;
    }
    view.period = 'custom';
    view.rangeKind = 'custom';
    view.range = { from: view.custom.from, to: view.custom.to };
    load();
  }

  function chooseWeek(which) {
    view.today = istToday(now());
    const thisWeek = weekStart(view.today);
    if (which === 'prev') view.week = addDays(view.week, -7);
    if (which === 'next') view.week = addDays(view.week, 7);
    if (which === 'this') view.week = thisWeek;
    if (view.week > thisWeek) view.week = thisWeek; // no weeks after this one
    load();
  }

  async function onExport(event) {
    const button = event.currentTarget;
    const kind = button.dataset.export;
    const { shop, range, data } = view;
    const name = `printnest-${shop.slug}-${kind}-${range.from}-to-${range.to}.csv`;
    button.disabled = true;
    try {
      const text =
        kind === 'daily'
          ? dailyReportCsv(data.daily)
          : ordersCsv(
              await ownerApi.listOrdersBetween(
                shop.id,
                `${range.from}T00:00:00+05:30`,
                `${addDays(range.to, 1)}T00:00:00+05:30`
              )
            );
      downloadCsv(name, text);
    } catch (err) {
      view.error = messageFor(err);
      render();
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }

  // The byte-order mark makes Excel read the file as UTF-8, so ₹ and names show correctly.
  function downloadCsv(filename, text) {
    const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { open };
}

// ---------- small presentation helpers (no state) ----------

function hasActivity(group) {
  return group.orders > 0 || group.stopped > 0 || group.completed > 0 || group.earnedPaise > 0 || group.refundsPaise > 0;
}

function tile(label, value, note = '') {
  return `<div class="stat">
    <span class="label">${escapeHtml(label)}</span>
    <span class="value">${escapeHtml(value)}</span>
    ${note ? `<span class="delta">${escapeHtml(note)}</span>` : ''}
  </div>`;
}

// Two bars per day: net earnings and orders placed. Each measure has its own scale,
// so the bars compare days with each other, not earnings with orders.
function weekChartSvg(days) {
  const width = 360;
  const height = 220;
  const top = 12;
  const bottom = 44;
  const plot = height - top - bottom;
  const slot = (width - 16) / 7;
  const barWidth = Math.min(16, slot * 0.34);
  const topEarned = Math.max(1, ...days.map((day) => day.earned_paise));
  const topOrders = Math.max(1, ...days.map((day) => day.orders));
  const bars = days
    .map((day, index) => {
      const centre = 8 + slot * index + slot / 2;
      const earnedHeight = Math.round((day.earned_paise / topEarned) * plot);
      const placedHeight = Math.round((day.orders / topOrders) * plot);
      const title = `${formatDay(day.date)}: ${formatPaise(day.earned_paise)} earned, ${day.orders} placed`;
      return `<g>
        <title>${escapeHtml(title)}</title>
        <rect class="bar-earned" x="${(centre - barWidth - 1).toFixed(1)}" y="${top + plot - earnedHeight}"
              width="${barWidth.toFixed(1)}" height="${earnedHeight}" />
        <rect class="bar-placed" x="${(centre + 1).toFixed(1)}" y="${top + plot - placedHeight}"
              width="${barWidth.toFixed(1)}" height="${placedHeight}" />
        <text x="${centre.toFixed(1)}" y="${height - 26}" text-anchor="middle">${escapeHtml(formatWeekday(day.date))}</text>
        <text x="${centre.toFixed(1)}" y="${height - 10}" text-anchor="middle">${escapeHtml(formatShortDay(day.date))}</text>
      </g>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img"
      aria-label="Net earnings and orders placed for each day of the week">
    <line class="axis" x1="8" x2="${width - 8}" y1="${top + plot}" y2="${top + plot}" />
    ${bars}
  </svg>`;
}
