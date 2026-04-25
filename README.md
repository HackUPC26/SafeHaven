# SafeHaven

SafeHaven is a hackathon MVP for covert emergency assistance. The sender app is
disguised as a normal weather app, but it can silently escalate an incident
through hidden triggers, codewords, and planned AI auto-triggers. A trusted
contact opens a receiver PWA to see live context such as tier state, location,
incident timeline, and planned audio/video/AI evidence.

This README combines the current runnable prototype notes with the BMAD planning
artifacts in `_bmad-output/planning-artifacts/`.

## Quick Version

SafeHaven is a safety demo with two sides:

- The sender side is a mobile app that looks like a normal weather app.
- The receiver side is a browser dashboard for a trusted contact.
- The current prototype sends status and location events through a local bridge.
- The target BMAD architecture replaces the bridge with encrypted P2P incident
  replication.

For a hackathon demo, the easiest path is to run the bridge, start the mobile
app, open the receiver PWA, then trigger an incident from the disguised weather
screen.

## Product Scope

The MVP flow from the BMAD docs:

1. The sender opens an iPhone app that looks like a weather utility.
2. The sender escalates through three monotonic tiers.
3. The trusted contact receives incident context in a browser dashboard.
4. At Tier 3, the receiver sees a prominent call-assist action with the latest
   known location.
5. The receiver can explicitly save evidence from the browser session.

| Tier | Meaning | MVP behavior |
| --- | --- | --- |
| 0 | Idle | Normal disguise UI only |
| 1 | Monitor | Start audio context and live GPS |
| 2 | Escalated | Add live video |
| 3 | Emergency | High-priority alert and call-assist UX |

## Components

| Component | Directory | Description |
| --- | --- | --- |
| Mobile App | `mobile/` | Expo React Native sender app with weather disguise, settings, QR setup, tier state, and location/status events |
| Receiver PWA | `receiver/` | Static PWA that displays incoming incident context |
| P2P Socket Server | `p2p-hello/` | Node.js WebSocket + Autopass bridge for the current prototype |
| iOS Project | `ios/` | Generated iOS native project for the Expo app |
| BMAD Docs | `_bmad-output/` | Product, architecture, market, and story artifacts |
| BMAD Config | `_bmad/` | BMAD method config, agents, workflows, and manifests |

## Architecture Target

The BMAD architecture targets a serverless Pear-protocol design:

- Sender: React Native / Expo iPhone app with a Bare Worklet P2P runtime.
- Incident log: Hypercore append-only event/media log managed by Corestore.
- Transport: Hyperswarm DHT with Noise-encrypted peer connections.
- Receiver: static browser PWA that reads a pairing URL fragment and replicates
  the incident Hypercore.
- Evidence: client-side IndexedDB session buffer plus explicit Save Evidence
  export.
- Backend: none for incident data. A static host only serves the receiver bundle.

Planned incident entry types include `incident_start`, `tier_change`, `gps`,
`audio_chunk`, `video_chunk`, `ai_label`, `ai_video_annotation`, and
`incident_end`.

Current implementation caveat:

The repo's runnable prototype uses WebSocket and Autopass bridge pieces while
the final no-server browser replication path is validated. Treat bridge
endpoints as hackathon spikes, not the final privacy architecture.

## Running The Prototype

### Demo Checklist

Use this checklist when preparing a quick demo:

- Start the P2P socket server first.
- Copy the invite key printed by the sender process.
- Start the P2P receiver with that invite key.
- Serve the receiver PWA in a browser tab.
- Start the mobile app with Expo.
- Confirm the phone can reach the bridge IP and port.
- Trigger Tier 1 from the disguised weather screen.
- Confirm the receiver shows the new tier and location events.

Prerequisites:

- Node.js and npm
- Expo Go, an iOS/Android simulator, or a physical device
- Xcode for local iOS builds

Install dependencies:

```bash
cd mobile
npm install

cd ../p2p-hello
npm install
```

### Mobile App

Expo React Native app that runs on iOS or Android and sends location/status
events to the P2P socket server.

```bash
cd mobile
npm start
npm run android
npm run ios
```

Before testing on a physical device, update `mobile/services/bridge.js` if
needed so `RELAY_URL` points at your development machine:

```js
const RELAY_URL = 'ws://<your-local-ip>:8080';
```

Prototype controls:

- Hold the weather `H/L` row for 3 seconds to trigger Tier 1.
- Use configured codewords/settings flows in the sender app for tier setup.
- When Tier 1+ is active, the app requests foreground location permission and
  sends GPS updates through the bridge.

### Receiver PWA

Static HTML PWA with no build step.

```bash
cd receiver
python3 -m http.server 3000
# or
npx http-server -p 3000
```

Open `http://localhost:3000` in a browser. The service worker enables offline
capability.

### P2P Socket Server

Node.js server that bridges the mobile app's WebSocket events into an Autopass
Hypercore-based P2P stream. Run sender and receiver in separate terminals.

```bash
cd p2p-hello
npm install

# Terminal 1: start the sender
npm run sender
# Output: Invite: <KEY>

# Terminal 2: start the receiver with the invite key
npm run receiver <KEY>
```

The mobile app connects to the WebSocket on port `8080`. The receiver PWA reads
data streamed by the receiver process.

### Running Everything Together

```bash
# 1. Install dependencies
cd mobile && npm install && cd ../p2p-hello && npm install

# 2. Start P2P sender
cd p2p-hello && npm run sender

# 3. Start P2P receiver with the invite key
cd p2p-hello && npm run receiver <KEY>

# 4. Serve the Receiver PWA
cd receiver && python3 -m http.server 3000

# 5. Start the mobile app
cd mobile && npm start
```

## BMAD Build Backlog

The BMAD stories prioritize the riskiest implementation path first:

1. Validate browser-to-Bare/Hypercore replication before building more UX.
2. Implement the Bare Worklet incident log and typed entries.
3. Build the weather disguise and monotonic tier state machine.
4. Add GPS, audio chunks, then video chunks.
5. Add receiver map, timeline, audio labels, and risk banner.
6. Add AI sound classification and auto-trigger policy.
7. Add Save Evidence export from browser IndexedDB.

Key story file: `_bmad-output/planning-artifacts/SafeHaven-Epics-and-Stories.md`.

## Safety And Privacy Notes

- This is a prototype, not a production emergency service.
- Do not claim guaranteed police dispatch.
- Emergency actions are call-assist flows unless a verified emergency-service
  integration exists.
- Get explicit permission for microphone, camera, location, and evidence export.
- Keep incident data local or encrypted P2P; avoid cloud storage for sensitive
  content.
- Mark any mocked emergency behavior as demo-only.

## BMAD Sources

- `_bmad-output/planning-artifacts/SafeHaven-MVP-PRD.md`
- `_bmad-output/planning-artifacts/SafeHaven-Architecture.md`
- `_bmad-output/planning-artifacts/SafeHaven-Epics-and-Stories.md`
- `_bmad-output/planning-artifacts/SafeHaven-Product-Brief-v2.md`

Recommended next workflow: `bmad-dev-story`, starting with
`E1.3 - Hyperswarm announce + browser replication spike`.
