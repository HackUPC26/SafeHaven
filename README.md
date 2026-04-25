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
- Live audio, video, location, and tier state stream from sender to receiver
  over WebRTC; a thin Node signaling server brokers the connection.
- A Bare Worklet inside the iOS app keeps a durable on-device incident log in
  Hypercore (the planned end-to-end-encrypted P2P replication target).

For a hackathon demo, the easiest path is to run the signaling server, start
the mobile app, open the receiver in a browser, then trigger an incident from
the disguised weather screen.

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

## Short Demo Script

Use this script for a 2 minute walkthrough:

1. Show that the sender app opens as a normal weather screen.
2. Trigger Tier 1 and explain that the trusted contact receives location and
   incident status.
3. Escalate to Tier 2 and explain the planned video evidence path.
4. Escalate to Tier 3 and show the call-assist receiver state.
5. Point out that the long-term goal is encrypted P2P delivery, not cloud
   storage of sensitive incident data.

## Components

| Component | Directory | Description |
| --- | --- | --- |
| Mobile App | `mobile/` | Expo React Native sender app with weather disguise, settings, QR setup, tier state machine, GPS, WebRTC broadcast, and a Bare Worklet that runs the Hypercore log on-device |
| Receiver PWA | `receiver/` | React-based browser PWA — receives the WebRTC stream and renders tier banner, video, audio levels, GPS map, and the incident timeline |
| Signaling Server | `p2p-hello/` | Tiny Node WebSocket server (`signaling.js`) that brokers WebRTC SDP/ICE between sender and receivers, and static-hosts `receiver/` at `/` |
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

## Current Demo Data Flow

The current prototype is useful for showing the product loop before the final
Bare Worklet path is complete:

1. The mobile app creates an incident or tier/location update.
2. `mobile/services/bridge.js` sends the event to the local WebSocket bridge.
3. `p2p-hello/` receives the event and writes it into the P2P demo path.
4. The receiver side watches the stream and shows the latest incident context.
5. The BMAD target replaces the local bridge with encrypted Hypercore
   replication between sender and receiver.

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

The mobile app auto-detects the laptop's LAN IP from Metro's bundler URL, so
no `.env` changes are needed for the standard LAN demo. Override only when
running outside Metro (release build, signaling on another machine):

```bash
echo "EXPO_PUBLIC_SIGNAL_HOST=192.168.x.x:8080" > mobile/.env
```

Prototype controls:

- Hold the weather `H/L` row for 3 seconds to trigger Tier 1.
- Use configured codewords/settings flows in the sender app for tier setup.
- When Tier 1+ is active, the app requests foreground location permission and
  sends GPS updates over WebRTC.

### Receiver PWA

React-based PWA in `receiver/`. The signaling server in `p2p-hello/` serves
it at `/`, so the same origin handles both the page and the WebRTC signaling
WebSocket — no separate static host needed.

```bash
cd p2p-hello
npm install
npm run signal     # serves receiver UI + /ws on port 8080
```

Then open `http://<host>:8080/#<token>` in a browser. If you omit the token
the page prompts for it. The token is the part before `:` in the pairingId
shown on the phone (long-press "Barcelona" → Settings).

### Running Everything Together

```bash
# 1. Install dependencies
cd mobile && npm install && cd ../p2p-hello && npm install

# 2. Start the signaling server (Terminal 1)
#    Also serves the receiver PWA at http://<host>:8080/
cd p2p-hello && npm run signal

# 3. Open the receiver in a browser
#    http://<host>:8080/   — paste the invite token from the mobile app

# 4. Start the mobile app (Terminal 2)
cd mobile && npm start
```

### Troubleshooting

If the demo does not connect, check these first:

- Make sure the phone and laptop are on the same network.
- Replace `<your-local-ip>` with the laptop IP address, not `localhost`, when
  testing on a physical phone.
- Confirm the bridge process is running before opening the mobile app.
- Allow location permission in the mobile app when Tier 1 starts.
- Restart the P2P sender and receiver if the invite key has already been used.
- Delete local P2P storage folders only when you want to reset the pairing demo.

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

### Immediate Next Tasks

For the next coding session, a practical order is:

1. Confirm the current mobile-to-bridge event path still works.
2. Connect the receiver PWA to the same live event stream used by the demo.
3. Add one deterministic sample event for each tier so the dashboard can be
   tested without a phone.
4. Keep the WebSocket bridge clearly marked as a prototype-only path.
5. Start replacing bridge behavior with the BMAD Hypercore replication story.

## Known Prototype Limits

These are expected gaps in the current hackathon code:

- The WebSocket bridge is a local demo helper, not the final no-server design.
- Audio, video, and AI labels are documented in BMAD but not fully wired through
  the end-to-end product flow yet.
- Receiver evidence export is part of the target scope and still needs final
  implementation.
- Physical-device testing is required for location, microphone, camera, and iOS
  native trigger behavior.

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

## Glossary

- BMAD: the planning workflow used in this repo.
- Sender: the person using the disguised mobile app.
- Receiver: the trusted contact viewing the browser dashboard.
- Tier: the current incident severity level from 0 to 3.
- Hypercore: the append-only log planned for incident data.
- Hyperswarm: the P2P discovery and connection layer in the target design.
- Autopass: the current demo P2P building block used in `p2p-hello/`.
- Call assist: helping the receiver call emergency services without promising
  guaranteed dispatch.

Recommended next workflow: `bmad-dev-story`, starting with
`E1.3 - Hyperswarm announce + browser replication spike`.
