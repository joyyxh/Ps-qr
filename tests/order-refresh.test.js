// Automatic refresh of the owner's orders page: timing, visibility, cleanup, failures and
// the manual Refresh button. Timers and the page's visibility are simulated, so no browser is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_INTERVAL_MS,
  LIVE_MAX_BACKOFF_MS,
  PRINTER_RETRY_MS,
  createOrderRefresher,
  printerRetryDue,
} from '../src/order-refresh.js';

// A clock that runs only when the test moves it forward.
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map(); // id -> { at, fn }
  return {
    setTimeout(fn, ms) {
      const id = nextId;
      nextId += 1;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    // Runs every timer that falls due inside the window, in time order.
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [id, timer] of pending) {
          if (timer.at <= end && (!next || timer.at < next.timer.at)) next = { id, timer };
        }
        if (!next) break;
        pending.delete(next.id);
        now = next.timer.at;
        next.timer.fn();
      }
      now = end;
    },
    count: () => pending.size,
    delays: () => [...pending.values()].map((timer) => timer.at - now),
  };
}

// The page's visibility, which the test changes.
function fakeVisibility(visible = true) {
  let current = visible;
  const listeners = new Set();
  return {
    isVisible: () => current,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(value) {
      current = value;
      for (const fn of [...listeners]) fn(value);
    },
    listenerCount: () => listeners.size,
  };
}

// Each request waits until the test answers it. The options show whether it was a manual refresh.
function requests() {
  const calls = [];
  return {
    calls,
    fetchData(options) {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      calls.push({ resolve, reject, options });
      return promise;
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const networkError = () => new TypeError('Failed to fetch');
const last = (list) => list[list.length - 1];

function build(overrides = {}) {
  const timers = fakeTimers();
  const visibility = overrides.visibility ?? fakeVisibility(true);
  const source = requests();
  const applied = [];
  const statuses = [];
  const refresher = createOrderRefresher({
    fetchData: (options) => source.fetchData(options),
    apply: (data) => applied.push(data),
    onStatus: (state, error) => statuses.push({ state, error }),
    timers,
    ...overrides,
    visibility,
  });
  return { refresher, timers, visibility, source, applied, statuses };
}

test('refreshes every 25 seconds, inside the 20 to 30 second window, and waits for each reply before scheduling the next', async () => {
  assert.ok(LIVE_INTERVAL_MS >= 20000 && LIVE_INTERVAL_MS <= 30000);
  const { refresher, timers, source } = build();

  refresher.start();
  assert.deepEqual(timers.delays(), [25000]);

  timers.advance(24999);
  assert.equal(source.calls.length, 0, 'nothing before 25 seconds');
  timers.advance(1);
  assert.equal(source.calls.length, 1);
  assert.equal(timers.count(), 0, 'no timer while a request is running');

  last(source.calls).resolve({ orders: [] });
  await flush();
  assert.deepEqual(timers.delays(), [25000], 'the next refresh is set once the reply arrives');
  refresher.stop();
});

test('starting twice keeps one timer and one visibility listener; stopping removes both', () => {
  const { refresher, timers, visibility } = build();

  refresher.start();
  refresher.start();
  assert.equal(timers.count(), 1);
  assert.equal(visibility.listenerCount(), 1);

  refresher.stop();
  refresher.start();
  assert.equal(timers.count(), 1, 'a restart does not add a second timer');

  refresher.stop();
  assert.equal(timers.count(), 0);
  assert.equal(visibility.listenerCount(), 0);
  assert.equal(refresher.isRunning(), false);
});

test('a tick while a request is still running starts no second request', async () => {
  const { refresher, timers, source } = build();
  refresher.start();

  timers.advance(25000); // one request goes out and is not answered yet
  timers.advance(120000); // four more intervals pass
  assert.equal(source.calls.length, 1, 'no overlapping request');

  last(source.calls).resolve({ orders: [] });
  await flush();
  assert.equal(timers.count(), 1);
  refresher.stop();
});

test('stop clears the timer and the listener, ignores a late reply, and sends nothing afterwards', async () => {
  const { refresher, timers, visibility, source, applied } = build();
  refresher.start();
  timers.advance(25000);

  refresher.stop();
  last(source.calls).resolve({ orders: ['late'] });
  await flush();

  assert.equal(applied.length, 0, 'a reply that arrives after stop is not drawn');
  assert.equal(timers.count(), 0);
  assert.equal(visibility.listenerCount(), 0);
  timers.advance(300000);
  assert.equal(source.calls.length, 1, 'no requests after stop');
});

test('a hidden page sends nothing; when it is visible again it refreshes at once, with one timer', async () => {
  const { refresher, timers, visibility, source } = build();
  refresher.start();

  visibility.set(false);
  assert.equal(timers.count(), 0, 'no timer while hidden');
  timers.advance(120000);
  assert.equal(source.calls.length, 0, 'no requests while hidden');

  visibility.set(true);
  assert.equal(source.calls.length, 1, 'refreshes at once when visible again');
  assert.equal(timers.count(), 0, 'no timer while that refresh is running');

  // Flicking between hidden and visible while the request runs must not add requests or timers.
  visibility.set(false);
  visibility.set(true);
  visibility.set(false);
  visibility.set(true);
  assert.equal(source.calls.length, 1);

  last(source.calls).resolve({ orders: [] });
  await flush();
  assert.equal(timers.count(), 1, 'exactly one timer after resuming');
  refresher.stop();
});

test('a page that starts hidden waits until it is visible before the first request', () => {
  const visibility = fakeVisibility(false);
  const { refresher, timers, source } = build({ visibility });

  refresher.start();
  assert.equal(timers.count(), 0);
  assert.equal(source.calls.length, 0);

  visibility.set(true);
  assert.equal(source.calls.length, 1);
  refresher.stop();
});

test('after failures the wait grows from 25 s to a 5 minute cap, and a good reply resets it', async () => {
  assert.equal(LIVE_MAX_BACKOFF_MS, 300000);
  const { refresher, timers, source, statuses, applied } = build();
  refresher.remember({ orders: [] });
  refresher.start();

  const waits = [];
  for (let i = 0; i < 6; i += 1) {
    timers.advance(timers.delays()[0]);
    last(source.calls).reject(networkError());
    await flush();
    waits.push(timers.delays()[0]);
  }
  assert.deepEqual(waits, [25000, 50000, 100000, 200000, 300000, 300000]);
  assert.equal(last(statuses).state, 'offline');
  assert.ok(last(statuses).error instanceof TypeError);
  assert.equal(applied.length, 0, 'the last list is kept, nothing is redrawn');

  timers.advance(timers.delays()[0]);
  last(source.calls).resolve({ orders: [] });
  await flush();
  assert.equal(last(statuses).state, 'live');
  assert.deepEqual(timers.delays(), [25000], 'back to the normal interval');
  refresher.stop();
});

test('unchanged data is not drawn again; changed data is drawn once', async () => {
  const { refresher, timers, source, applied } = build();
  refresher.remember({ orders: [1] });
  refresher.start();

  timers.advance(25000);
  last(source.calls).resolve({ orders: [1] });
  await flush();
  assert.equal(applied.length, 0, 'same data: nothing is drawn');

  timers.advance(25000);
  last(source.calls).resolve({ orders: [1, 2] });
  await flush();
  assert.deepEqual(applied, [{ orders: [1, 2] }]);

  timers.advance(25000);
  last(source.calls).resolve({ orders: [1, 2] });
  await flush();
  assert.equal(applied.length, 1, 'the same new data is not drawn a second time');
  refresher.stop();
});

test('changed data waits while the owner is using a list control, then is drawn', async () => {
  let editing = true;
  const { refresher, timers, source, applied } = build({ canApply: () => !editing });
  refresher.remember({ orders: [1] });
  refresher.start();

  timers.advance(25000);
  last(source.calls).resolve({ orders: [1, 2] });
  await flush();
  assert.equal(applied.length, 0, 'not drawn while a printer or reason menu is in use');

  editing = false;
  timers.advance(25000);
  last(source.calls).resolve({ orders: [1, 2] });
  await flush();
  assert.deepEqual(applied, [{ orders: [1, 2] }], 'drawn at the next refresh once the menu is closed');
  refresher.stop();
});

test('a manual Refresh during an automatic one waits for it, then sends its own request, so it never shows older data', async () => {
  const { refresher, timers, source, applied } = build();
  refresher.start();
  timers.advance(25000); // automatic request 1 goes out before the click

  const manual = refresher.refresh({ manual: true });
  assert.equal(source.calls.length, 1, 'the click waits; it does not overlap the running request');

  source.calls[0].resolve({ orders: [4] });
  await flush();
  assert.equal(source.calls.length, 2, 'then the manual request goes out');
  assert.deepEqual(source.calls[1].options, { manual: true });

  source.calls[1].resolve({ orders: [5] });
  assert.deepEqual(await manual, { orders: [5] }, 'the manual result is the newer reply, not the older one');
  assert.deepEqual(applied, [{ orders: [4] }, { orders: [5] }]);
  assert.equal(timers.count(), 1, 'the automatic rhythm continues');
  refresher.stop();
});

test('several manual clicks while a request runs share one follow-up request', async () => {
  const { refresher, timers, source } = build();
  refresher.start();
  timers.advance(25000);

  const first = refresher.refresh({ manual: true });
  const second = refresher.refresh({ manual: true });
  const third = refresher.refresh({ manual: true });
  assert.equal(first, second);
  assert.equal(second, third);
  assert.equal(source.calls.length, 1);

  source.calls[0].resolve({ orders: [1] });
  await flush();
  assert.equal(source.calls.length, 2, 'one follow-up request for all three clicks');

  source.calls[1].resolve({ orders: [2] });
  assert.deepEqual(await first, { orders: [2] });
  assert.deepEqual(await third, { orders: [2] });
  assert.equal(source.calls.length, 2, 'no further requests');
  refresher.stop();
});

test('stopping while a manual Refresh waits sends nothing afterwards', async () => {
  const { refresher, timers, source } = build();
  refresher.start();
  timers.advance(25000);
  const manual = refresher.refresh({ manual: true });

  refresher.stop();
  source.calls[0].resolve({ orders: [1] });
  assert.equal(await manual, undefined, 'the waiting refresh ends without a request');
  timers.advance(300000);
  assert.equal(source.calls.length, 1, 'no request after stop');
  assert.equal(timers.count(), 0);
});

test('fetchData is told whether the request is manual', async () => {
  const { refresher, timers, source } = build();
  refresher.start();
  timers.advance(25000);
  assert.deepEqual(source.calls[0].options, { manual: false });
  source.calls[0].resolve({ orders: [] });
  await flush();

  const manual = refresher.refresh({ manual: true });
  assert.deepEqual(source.calls[1].options, { manual: true });
  source.calls[1].resolve({ orders: [] });
  await manual;
  refresher.stop();
});

test('printer status is asked for again once the retry wait has passed', () => {
  assert.equal(PRINTER_RETRY_MS, 300000);
  assert.equal(printerRetryDue(0, 1000), true, 'no failure recorded: due');
  assert.equal(printerRetryDue(301000, 1000), false, 'still inside the wait');
  assert.equal(printerRetryDue(301000, 301000), true, 'due exactly when the wait ends');
});

test('a manual Refresh still works after failed automatic requests, and reports its own failure to the caller', async () => {
  const { refresher, timers, source, statuses } = build();
  refresher.start();
  timers.advance(25000);
  last(source.calls).reject(networkError());
  await flush();
  assert.equal(last(statuses).state, 'offline');

  // The owner presses Refresh before the scheduled retry.
  const retry = refresher.refresh({ manual: true });
  assert.equal(source.calls.length, 2);
  last(source.calls).resolve({ orders: [9] });
  assert.deepEqual(await retry, { orders: [9] });
  assert.equal(last(statuses).state, 'live');

  const failing = refresher.refresh({ manual: true });
  last(source.calls).reject(networkError());
  await assert.rejects(failing, TypeError);
  refresher.stop();
});

test('a reply from an earlier session is ignored after stop and restart; a new refresh is not blocked by it', async () => {
  const { refresher, timers, source, applied } = build();
  refresher.start();
  timers.advance(25000); // call 1 goes out
  refresher.stop();
  refresher.start();

  const fresh = refresher.refresh(); // must be a new request, not the old one
  assert.equal(source.calls.length, 2);

  source.calls[0].resolve({ orders: ['old'] });
  await flush();
  assert.equal(applied.length, 0, 'the old reply is not drawn');

  source.calls[1].resolve({ orders: ['new'] });
  await fresh;
  assert.deepEqual(applied, [{ orders: ['new'] }]);
  refresher.stop();
});
