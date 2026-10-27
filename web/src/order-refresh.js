// Keeps the owner's orders and printer status current while the Orders page is open.
//
// The owner page supplies the load (the shop-scoped reads it already makes), the re-render
// and the visibility signal. This module owns only the timing: one request at a time, a
// single timer, a pause while the page is hidden, and a slower retry after failures.
// It has no DOM access, so it can be tested with fake timers.

export const LIVE_INTERVAL_MS = 25000; // inside the 20 to 30 second window
export const LIVE_MAX_BACKOFF_MS = 300000; // after repeated failures, try at most every 5 minutes
export const PRINTER_RETRY_MS = 300000; // after a failed printer-status read, automatic refresh waits this long

const sameData = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// True when an automatic refresh may ask for printer status again. retryAt is 0 when the last read worked.
export function printerRetryDue(retryAt, nowMs) {
  return nowMs >= retryAt;
}

// Reports whether the page is visible, and calls back when that changes.
export function browserVisibility(doc = globalThis.document) {
  return {
    isVisible: () => doc.visibilityState !== 'hidden',
    onChange(callback) {
      const handler = () => callback(doc.visibilityState !== 'hidden');
      doc.addEventListener('visibilitychange', handler);
      return () => doc.removeEventListener('visibilitychange', handler);
    },
  };
}

export function createOrderRefresher({
  fetchData, // async () => data. Rejects when the request fails.
  apply, // (data) => void. Re-renders the list. Called only when the data changed.
  same = sameData, // (a, b) => boolean
  canApply = () => true, // false while the owner is using a control in the list
  onStatus = () => {}, // ('live') or ('offline', error)
  intervalMs = LIVE_INTERVAL_MS,
  maxBackoffMs = LIVE_MAX_BACKOFF_MS,
  timers = globalThis, // { setTimeout, clearTimeout }
  visibility = browserVisibility(),
}) {
  let running = false;
  let generation = 0; // changes on start and stop, so late replies from an earlier session are ignored
  let timer = null;
  let failures = 0; // failed requests in a row
  let lastData = undefined;
  let hasData = false;
  let pending = false; // changed data that could not be drawn yet (canApply was false)
  let inFlight = null;
  let inFlightGeneration = -1;
  let followUp = null; // { generation, promise }: a manual refresh waiting for the request in progress
  let unsubscribe = null;

  function clearTimer() {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
  }

  // The wait before the next automatic refresh. After failures it grows: 25 s, 50 s, 100 s, ... up to the cap.
  function nextDelay() {
    if (failures === 0) return intervalMs;
    return Math.min(maxBackoffMs, intervalMs * 2 ** (failures - 1));
  }

  // Sets the next automatic refresh. It replaces any timer already set, so timers never stack up.
  function scheduleNext(ms = nextDelay()) {
    clearTimer();
    if (!running || !visibility.isVisible()) return;
    timer = timers.setTimeout(tick, ms);
  }

  // Sends one request and handles its reply. Only one request runs at a time (see refresh).
  function startRequest(manual) {
    const gen = generation;
    inFlightGeneration = gen;
    inFlight = (async () => {
      try {
        const data = await fetchData({ manual });
        if (gen !== generation) return data; // stopped while loading: nothing is drawn
        failures = 0;
        onStatus('live');
        if (!hasData || !same(lastData, data)) {
          lastData = data;
          hasData = true;
          pending = true;
        }
        if (pending && canApply()) {
          pending = false;
          apply(data);
        }
        return data;
      } catch (error) {
        if (gen === generation) {
          failures += 1;
          onStatus('offline', error);
        }
        throw error;
      }
    })().finally(() => {
      if (inFlightGeneration === gen) inFlight = null;
    });
    return inFlight;
  }

  // One request at a time. An automatic refresh asked for while a request runs shares that request.
  // A manual refresh does not: a request that started before the click may hold older data, so the
  // manual one waits for it to finish and then sends its own. Several manual clicks while waiting
  // share that one follow-up. The guarantee of one request at a time holds in every case.
  function refresh({ manual = false } = {}) {
    if (followUp && followUp.generation === generation) return followUp.promise;
    if (!inFlight || inFlightGeneration !== generation) return startRequest(manual);
    if (!manual) return inFlight;
    const gen = generation;
    const entry = { generation: gen, promise: null };
    entry.promise = inFlight
      .then(
        () => undefined,
        () => undefined
      )
      .then(() => {
        if (followUp === entry) followUp = null;
        return gen === generation ? startRequest(true) : undefined;
      });
    followUp = entry;
    return entry.promise;
  }

  function tick() {
    timer = null;
    if (!running || !visibility.isVisible()) return;
    refresh().then(
      () => scheduleNext(),
      () => scheduleNext()
    );
  }

  function onVisibility(visible) {
    if (!running) return;
    clearTimer();
    if (!visible) return; // hidden: no requests until the page is seen again
    // The page is back in view, so the data may be old. Load now, then keep the normal rhythm.
    refresh().then(
      () => scheduleNext(),
      () => scheduleNext()
    );
  }

  // Starts automatic refresh. Calling it again while running does nothing.
  function start() {
    if (running) return;
    running = true;
    generation += 1;
    failures = 0;
    unsubscribe = visibility.onChange(onVisibility);
    scheduleNext();
  }

  // Stops everything: the timer, the visibility listener, and any reply still on its way.
  function stop() {
    running = false;
    generation += 1;
    clearTimer();
    pending = false;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  // Records data that the screen has just drawn (for example after an action), so the next
  // automatic refresh does not draw the same data again.
  function remember(data) {
    lastData = data;
    hasData = true;
    pending = false;
  }

  return {
    start,
    stop,
    refresh,
    remember,
    isRunning: () => running,
  };
}
