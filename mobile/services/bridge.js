import { SIGNAL_WS } from './config'

let ws;

export function connect() {
  ws = new WebSocket(SIGNAL_WS);
  ws.onopen = () => console.log('Bridge connected');
  ws.onerror = (e) => console.error('Bridge error', e.message ?? e);
}

export function send(event) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      ...event,
      timestamp_iso: new Date().toISOString(),
    }));
  }
}
