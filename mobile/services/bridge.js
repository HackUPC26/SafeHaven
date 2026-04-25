// SafeHaven event bridge.
//
// Per the BMAD Path-C plan, all incident events (incident_opened, tier_changed,
// gps_update, ai_label, etc.) flow into a Hypercore log running inside a Bare
// Worklet on the device. The receiver browser PWA replicates that Hypercore over
// Hyperswarm/WebRTC — there is intentionally no central WebSocket relay.
//
// connect() / send() keep the same external API the rest of the app already
// uses, but their implementations now route through the worklet instead of a
// remote WS server.

import { start as startWorklet, appendEntry, joinSwarm, getPubkey } from './worklet-rpc';

let connected = false;
let connecting = null;

export async function connect() {
  if (connected) return;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      await startWorklet();
      const pubkey = await getPubkey();
      console.log('[bridge] worklet ready, pubkey:', pubkey);
      // Join Hyperswarm so a receiver browser can replicate the Hypercore.
      // Fire-and-forget; failures are non-fatal for local logging.
      joinSwarm()
        .then((topic) => console.log('[bridge] swarm joined topic:', topic))
        .catch((err) => console.warn('[bridge] swarm join failed:', err.message));
      connected = true;
    } catch (err) {
      console.error('[bridge] connect failed:', err.message ?? err);
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export function send(event) {
  if (!connected) {
    console.warn('[bridge] send before connect, dropped:', event.event_type);
    return;
  }
  const entry = { ...event, timestamp_iso: new Date().toISOString() };
  appendEntry(entry).catch((err) =>
    console.warn('[bridge] append failed:', event.event_type, err.message ?? err)
  );
}
