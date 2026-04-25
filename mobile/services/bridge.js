const RELAY_URL = 'ws://10.5.245.116:8080';

let ws;

export function connect() {
  ws = new WebSocket(RELAY_URL);
  ws.onopen = () => console.log('Bridge connected');
  ws.onerror = (e) => console.error('Bridge error', e);
}

export function send(event) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      ...event,
      timestamp_iso: new Date().toISOString(),
    }));
  }
}
