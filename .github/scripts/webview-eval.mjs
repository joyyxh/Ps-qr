// Diagnostic: evaluates one expression in the QRquick WebView through DevTools and prints the value as JSON.
const [port, expression] = process.argv.slice(2);
const base = `http://127.0.0.1:${port}`;
const timer = setTimeout(() => { console.log(JSON.stringify({ error: 'timeout' })); process.exit(1); }, 20000);
const targets = await (await fetch(`${base}/json`)).json();
const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.log(JSON.stringify({ error: 'no page' })); process.exit(1); }
const socket = new WebSocket(page.webSocketDebuggerUrl);
socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== 1) return;
  clearTimeout(timer);
  console.log(JSON.stringify(message.result?.result?.value ?? message.result ?? message));
  socket.close();
  process.exit(0);
};
socket.onerror = () => { console.log(JSON.stringify({ error: 'socket' })); process.exit(1); };
