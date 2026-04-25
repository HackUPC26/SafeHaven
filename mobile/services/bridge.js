const RELAY_URL = 'ws://10.5.245.116:8080';

let ws;
let retryTimer;

export function connect() {
  clearTimeout(retryTimer);
  ws = new WebSocket(RELAY_URL);
  ws.onopen = () => console.log('Bridge connected');
  ws.onerror = (e) => console.error('Bridge error', e);
  ws.onclose = () => {
    retryTimer = setTimeout(connect, 3000);
  };
}

export function send(event) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      ...event,
      timestamp_iso: new Date().toISOString(),
    }));
  }
}
