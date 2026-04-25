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

The runnable demo uses WebRTC over a small WebSocket signaling server while
the final no-server browser-to-Hypercore replication path is built. Treat
the signaling server as a hackathon spike, not the final privacy architecture.

## Current Demo Data Flow

Two parallel paths leave the phone for every incident event:

1. **Live (drives the receiver UI):** `App.js` → `services/bridge.send()` →
   `services/broadcast.js` → WebRTC over the signaling WS in `p2p-hello/` →
   `receiver/index.html`. Camera + mic open at Tier ≥ 1, tier/GPS events
   piggyback on the same WebSocket.
2. **Durable (on-device log):** `bridge.send()` also forwards the entry to a
   Bare Worklet (`mobile/backend/worklet.js`) running Corestore + Hypercore.
   The worklet announces its discovery key on Hyperswarm — that's the path
   the BMAD target plans to replicate to the browser, replacing the
   signaling server entirely.

The receiver browser today only reads path #1. The Hypercore log is built
unconditionally and survives app restarts.

## Installation

### Prerequisites

- macOS (for iOS builds) — Linux/Windows works for the signaling server +
  receiver browser only
- Node.js ≥ 20 and npm
- Xcode 15+ with the iOS 17 simulator runtime, or a physical iPhone with a
  paired Apple Developer account
- CocoaPods (`sudo gem install cocoapods` or via Homebrew)
- Expo CLI ships with the project; no global install needed

> Expo Go does **not** work — `react-native-webrtc` and `react-native-bare-kit`
> need a custom dev client. Use `npx expo run:ios` for the first build.

### 1. Clone and install JS deps

```bash
git clone <repo-url> safehaven
cd safehaven

# Mobile app
cd mobile
npm install

# Signaling server (tiny — only depends on `ws`)
cd ../p2p-hello
npm install
```

### 2. Install iOS native dependencies

CocoaPods links `react-native-webrtc`, `react-native-bare-kit`, and the
Expo modules into the Xcode project.

```bash
cd ../mobile/ios
pod install
```

### 3. (Optional) Re-pack the Bare Worklet bundle

A prebuilt `mobile/backend/worklet.bundle.mjs` is checked in, so this step
is only needed if you change `mobile/backend/worklet.js`.

```bash
cd mobile
npm run pack:worklet
```

### 4. First iOS build (Xcode)

Plug in an iPhone (recommended for camera + mic + GPS) or use the simulator.

```bash
cd mobile
npx expo run:ios --device      # physical device
# or:
npx expo run:ios               # simulator
```

The first build takes 5–10 minutes (Pods, RN, native modules). After it
finishes, the SafeHaven dev client is installed on the device.

For subsequent runs you only need Metro:

```bash
cd mobile
npx expo start --dev-client    # then press 'i' or open the dev client app
```

If you'd rather build from Xcode UI: open `mobile/ios/mobile.xcworkspace`
(NOT `.xcodeproj`), select your device, hit ▶.

### 5. Configure the signaling host (usually unneeded)

In dev, the mobile app reads Metro's bundler URL and reuses that IP with
port `8080` automatically. No `.env` is required for the standard LAN demo.

Override only when running outside Metro (release build, or signaling on a
different machine):

```bash
echo "EXPO_PUBLIC_SIGNAL_HOST=192.168.x.x:8080" > mobile/.env
```

## Running the Demo

Two terminals + a browser tab:

```bash
# Terminal 1 — signaling server + receiver static host (port 8080)
cd p2p-hello
npm run signal
# prints the LAN URL: http://<your-ip>:8080/
```

```bash
# Terminal 2 — mobile app
cd mobile
npx expo start --dev-client    # press 'i', or open the dev client on the phone
```

```text
# Browser — receiver
http://<your-ip>:8080/
# Paste the pairing token from the phone (long-press "Barcelona" → Settings;
# the token is the part before ':') or open directly with:
http://<your-ip>:8080/#<token>
```

### Triggers

- **Hold the H/L row** on the weather screen for 3 seconds → Tier 1
  (camera + mic permission prompt → live A/V on the receiver).
- **Type a codeword** into the search field: `sunny` → 1, `cloudy` → 2,
  `stormy` → 3 (defaults; configurable in Settings).

### No-iPhone smoke test

For a fully-browser path open `http://<your-ip>:8080/sender` in a second
tab, click *Start Broadcast*, and use the receiver URL it prints.

### Troubleshooting

- **`EADDRINUSE: 8080`** — another signaling process is still bound. Kill
  it with `lsof -nP -iTCP:8080 -sTCP:LISTEN -t | xargs kill -9`.
- **Phone can't reach the laptop** — same Wi-Fi required. Cellular and
  eduroam are known to fail (UDP QoS / AP isolation).
- **Receiver shows TIER 0** forever — make sure you opened the URL with a
  token in the fragment (or pasted one in the overlay), and check the
  signaling log for a `sender connected` line.
- **Worklet boot error in Metro** — usually means a stale build. Re-run
  `npm run pack:worklet`, then `npx expo run:ios` to rebuild the binary.
- **Black video / no audio on the receiver** — Safari blocks autoplay with
  audio; the receiver shows a "Tap to enable audio" overlay if so.

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

- The WebSocket signaling server is a local demo helper, not the final
  no-server design.
- The browser receiver does not yet replicate the on-device Hypercore log;
  it consumes only the live WebRTC channel.
- AI sound/video labels are documented in BMAD but not fully wired through
  the end-to-end product flow yet.
- Receiver evidence export is part of the target scope and still needs final
  implementation.
- Physical-device testing is required for location, microphone, camera, and
  iOS native trigger behavior.
- Hostile-network limitation: cellular (UDP QoS) and eduroam (AP isolation)
  break Hyperswarm and the WebRTC fallback. Demo on a normal LAN.

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
- Hypercore: the append-only log used for the on-device incident record and
  planned for end-to-end-encrypted P2P replication.
- Hyperswarm: the P2P discovery and connection layer the worklet uses today
  to announce the incident core's discovery key.
- Bare Worklet: the small Bare-runtime sandbox embedded in the iOS app via
  `react-native-bare-kit` — runs the Hypercore stack alongside React Native.
- Signaling server: the WebSocket broker in `p2p-hello/signaling.js` that
  carries WebRTC SDP/ICE plus tier/GPS event fan-out; also static-hosts the
  receiver page.
- Call assist: helping the receiver call emergency services without promising
  guaranteed dispatch.

Recommended next workflow: `bmad-dev-story`, starting with
`E1.3 - Hyperswarm announce + browser replication spike`.
