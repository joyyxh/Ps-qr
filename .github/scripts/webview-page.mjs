// Reads or clicks inside the QRquick WebView through Chrome DevTools (WebView remote debugging).
//
// The debug APK is debuggable, so the app's WebView exposes a DevTools socket. adb forwards
// it to a local port (see apk-ui-check.sh). This reads the real page state, which does not
// depend on the Android accessibility tree, and clicks with real mouse input events.
//
// Usage:
//   node .github/scripts/webview-page.mjs <port> text
//   node .github/scripts/webview-page.mjs <port> click "<text fragment>"
//
// Prints one JSON object on stdout. Exits 0 when the page answered, 1 otherwise.
// Requires Node 22 (global WebSocket and fetch).

const [port, command, fragment = ''] = process.argv.slice(2);
const base = `http://127.0.0.1:${port}`;

const timer = setTimeout(() => {
  console.log(JSON.stringify({ error: 'timed out talking to the WebView' }));
  process.exit(1);
}, 25000);

function fail(message) {
  console.log(JSON.stringify({ error: message }));
  clearTimeout(timer);
  process.exit(1);
}

async function pageTarget() {
  const response = await fetch(`${base}/json`);
  const targets = await response.json();
  const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  return pages.find((t) => /localhost/.test(t.url)) || pages[0] || null;
}

function openSocket(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;
  const ready = new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('could not open the WebView socket'));
  });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      nextId += 1;
      pending.set(nextId, resolve);
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
  return { ready, send, close: () => socket.close() };
}

async function evaluate(cdp, expression) {
  const reply = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (reply.result?.exceptionDetails) {
    throw new Error(reply.result.exceptionDetails.text || 'page script failed');
  }
  return reply.result?.result?.value;
}

const READ_PAGE = `(() => {
  const tabs = document.getElementById('owner-tabbar');
  return JSON.stringify({
    url: location.href,
    title: document.title,
    text: document.body ? document.body.innerText : '',
    tabsVisible: !!tabs && !tabs.hidden && tabs.innerHTML.trim() !== ''
  });
})()`;

function clickScript(wanted) {
  return `(() => {
    const wanted = ${JSON.stringify(wanted)};
    const candidates = [...document.querySelectorAll('button, a, [role="button"], input[type="submit"]')];
    const hit = candidates.find((el) => ((el.innerText || el.value || '').trim()).includes(wanted));
    if (!hit) return null;
    hit.scrollIntoView({ block: 'center' });
    const box = hit.getBoundingClientRect();
    return JSON.stringify({
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      label: (hit.innerText || hit.value || '').trim()
    });
  })()`;
}

async function main() {
  const target = await pageTarget();
  if (!target) return fail('no WebView page is available on that port');

  const cdp = openSocket(target.webSocketDebuggerUrl);
  await cdp.ready;
  try {
    if (command === 'text') {
      const page = JSON.parse(await evaluate(cdp, READ_PAGE));
      console.log(JSON.stringify(page));
    } else if (command === 'click') {
      const found = await evaluate(cdp, clickScript(fragment));
      if (!found) {
        console.log(JSON.stringify({ clicked: null, reason: `no button or link contains "${fragment}"` }));
        cdp.close();
        clearTimeout(timer);
        process.exit(1);
      }
      const spot = JSON.parse(found);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await cdp.send('Input.dispatchMouseEvent', {
          type,
          x: spot.x,
          y: spot.y,
          button: type === 'mouseMoved' ? 'none' : 'left',
          clickCount: type === 'mouseMoved' ? 0 : 1,
        });
      }
      console.log(JSON.stringify({ clicked: spot.label, x: Math.round(spot.x), y: Math.round(spot.y) }));
    } else {
      return fail(`unknown command: ${command}`);
    }
  } finally {
    cdp.close();
  }
  clearTimeout(timer);
  process.exit(0);
}

main().catch((error) => fail(error.message));
