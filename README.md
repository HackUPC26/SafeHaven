# SafeHaven

> **One-line pitch:** SafeHaven is a covert safety app disguised as an everyday
> app that lets people in danger silently escalate from live audio to full
> evidence capture using voice, hidden gestures, and AI-assisted auto-triggering.

SafeHaven is a hackathon MVP for covert emergency assistance. The sender app is
disguised as a normal weather app, but it can silently escalate an incident
through hidden triggers, codewords, and planned AI auto-triggers. A trusted
contact opens a receiver PWA to see live context such as tier state, location,
incident timeline, and planned audio/video/AI evidence.

This README combines the current runnable prototype notes with the BMAD planning
artifacts in `_bmad-output/planning-artifacts/`.

### Link to Demo Video
[Video](https://youtube.com/shorts/DvGF6OGmoGA?is=WysinNqFKzdqSK1G)

## Problem

People in danger often cannot safely call for help.

In domestic abuse and coercive-control contexts, visible SOS behavior can
*increase* risk. Existing tools are usually either:

- **passive** — location sharing without intervention, or
- **overt** — panic/SOS interfaces that can be noticed.

The missing capability is discreet, real-time trusted-contact intervention with
evidence continuity.

## Solution

SafeHaven combines:

- Disguised sender app UI (weather skin in the MVP; podcast/notes/clock skins planned)
- Covert activation (codewords, hidden gestures, planned Back Tap / Action Button / Siri phrase)
- Three-tier escalation through codewords and optional AI auto-trigger
- Trusted-contact browser dashboard — no app install, opens from a shared link
- Tamper-evident incident log and explicit evidence export flow

**Positioning:** *When visible help is dangerous, SafeHaven brings a trusted
witness in silently.*

### PEARS Sponsor Track

SafeHaven is built on the **Pear protocol** (Hypercore + Hyperswarm + Bare
runtime) for the PEARS sponsor track. The target architecture transmits all
incident data exclusively peer-to-peer between the sender's iPhone and the
trusted contact's browser. No cloud backend stores or proxies sensitive data —
the only server is a static file host that delivers the receiver PWA bundle on
first load.

> The current hackathon demo uses WebRTC over a small WebSocket signaling
> server while the no-server browser-to-Hypercore replication path is built.
> See *Architecture Target* and *Known Prototype Limits* below.

## Target Users

- **Primary:** people at risk of intimate partner violence and coercive control.
- **Secondary:** people walking alone at night, students, travelers, elderly users.
- **Decision-maker in incident:** the trusted contact who needs immediate,
  interpretable context to decide whether to call emergency services.

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

### Sender (iPhone) experience

- App appears as a normal utility UI (weather screen).
- User triggers discreetly — codeword in the search field, or 3-second hold
  on the H/L row.
- Escalation tiers activate with minimal visible change to the disguise.
- Planned: on-device AI detects danger signals when the user cannot act.

### Receiver (Browser Dashboard) elements

The target dashboard renders, side-by-side:

- **Live video feed** with AI annotation overlays (person count, posture,
  scene context). Last frame + annotations persist with a staleness timestamp
  if the feed freezes.
- **Audio label rail** — scrolling timeline of AI audio labels, timestamped
  and colour-coded: red for IMPACT/SCREAMING, amber for SHOUTING, grey for
  SILENCE.
- **Live GPS map** — pin, address, coordinates, movement trail.
- **AI risk assessment banner** — synthesises all signals: green / amber / red
  with actionable guidance text.
- **Incident timeline** — chronological colour-coded events (tier changes, AI
  triggers, GPS updates).
- **"Call Police with Location"** — primary action button, large, red, always
  visible, pre-loaded with live GPS coordinates.
- **"Save Evidence"** — secondary button, packages session data for download.
- **Session header** — person's name, active tier badge, session duration, P2P
  connection status.

### Privacy and Evidence Model

- Append-only Hypercore log gives tamper-evident chronology.
- Default minimize-retention posture (session-first; no automatic cloud
  storage).
- Post-incident persistence is **explicit** — the trusted contact must click
  *Save Evidence* to download anything. Nothing persists on the receiver's
  device without that consent action.
- Evidence package: NDJSON timeline + media chunk references + AI label log
  with timestamps and confidence scores + GPS track + (planned) PDF report
  with key video frames.

### Onboarding and Pairing (target flow)

**Sender first-time setup:**

1. Install SafeHaven dev client.
2. Choose disguise skin, configure 3 codewords, set trusted contact.
3. App generates an incident keypair (Hypercore public key + shared encryption
   key).
4. App shows a QR code and shareable link
   (`https://dashboard.safe-haven.app/#<pubkey>:<encryptionKey>`).
   The `#fragment` is never sent to the static server.
5. User shares the link with their trusted contact via any channel.
6. Optional: configure Back Tap / Action Button as a hidden activation
   shortcut.

**Trusted contact setup:**

1. Open the shared link in any modern browser.
2. Browser downloads the static PWA bundle once.
3. Browser reads the keypair from the URL fragment (client-side only).
4. Dashboard enters standby mode — *Waiting for connection.*
5. When an incident starts, the browser auto-connects via Hyperswarm DHT and
   begins replicating.

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

### Planned Neural Engine AI Layers

1. **Auto-trigger from sound classification**
   - Escalating voices → Tier 1
   - Screaming / impact-like events → Tier 2
   - Sustained distress → Tier 3 (policy-based, with cooldown windows + manual override)
2. **Audio labelling for receiver clarity** — labels such as SHOUTING, CRYING,
   IMPACT, GLASS BREAKING, EXTENDED SILENCE.
3. **Video annotation metadata** — person count, rapid motion flags, scene
   cues; last-known annotation persists if the stream degrades.

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

> Expo Go does **not** work — `react-native-webrtc` and `react-native-bare-kit`
> need a custom dev client. The first build has to go through Xcode.

### 0. Prerequisites

System:

- macOS (for iOS builds) — Linux/Windows works for the signaling server +
  receiver browser only
- Node.js ≥ 20 and npm
- A physical iPhone (recommended for camera + mic + GPS) **or** an iOS
  simulator runtime

First-time-only macOS / Xcode setup (skip what you already have):

1. **Install Xcode** from the Mac App Store (≥ 15). Open it once so it
   finishes the post-install components dance.
2. **Install Xcode command-line tools**: `xcode-select --install`
3. **Accept the Xcode license**: `sudo xcodebuild -license accept`
4. **Install an iOS simulator runtime** (recent Xcode ships without one):
   Xcode → Settings → Platforms → click the **+** next to iOS → install
   the latest iOS runtime. *(Skip if you'll only build to a physical iPhone.)*
5. **Install CocoaPods**: `sudo gem install cocoapods`
   (or `brew install cocoapods` if you prefer Homebrew)
6. **For physical-device builds, sign in to Xcode with an Apple ID:**
   Xcode → Settings → Accounts → **+** → Apple ID. A free Apple ID is
   enough for development; no paid Developer Program needed.
7. **Trust the developer profile on the iPhone** the first time you
   install: iPhone Settings → General → VPN & Device Management → tap
   your Apple ID → Trust. Until you do, the app crashes on launch.

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

### 2. (Optional) Re-pack the Bare Worklet bundle

A prebuilt `mobile/backend/worklet.bundle.mjs` is checked in, so this step
is only needed if you change `mobile/backend/worklet.js`.

```bash
# from mobile/
npm run pack:worklet
```

### 3. First iOS build

The `mobile/ios/` Xcode project (Podfile, Info.plist with camera/mic/location
permissions, AppDelegate, etc.) **is committed**. `Pods/` and `build/` are not
— `expo run:ios` runs `pod install` for you on first invocation.

Plug in an iPhone (unlock + trust the laptop) or pick a simulator, then:

```bash
# from mobile/
npx expo run:ios --device      # physical iPhone
# or:
npx expo run:ios               # simulator
```

The first build takes 5–10 minutes (Pods download, RN compile, native
modules). When it finishes, the dev client app (named **mobile** on the
home screen — bundle ID `com.<your_name>.safehaven`) is installed.

If `pod install` fails with "no such xcode" / signing errors, point
CocoaPods at the right Xcode once and retry:
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

**If the build fails with a code-signing error**, open the workspace and
set a team:

1. `open mobile/ios/mobile.xcworkspace` (NOT `.xcodeproj`).
2. Select the **mobile** target → **Signing & Capabilities** tab.
3. Tick **Automatically manage signing** and pick your Apple ID team in
   **Team**. Xcode generates a development bundle ID for you.
4. Re-run `npx expo run:ios --device`.

You can also build entirely from Xcode: open the workspace, pick your
device in the toolbar, hit ▶. Metro still has to be running separately
(next step).

### 4. Subsequent runs (no rebuild needed)

After the first build, you only need Metro running on the laptop. The
dev client app on the phone connects to it.

```bash
# from mobile/
npx expo start --dev-client
# press 'i' to open the simulator, or just open the dev client app on the phone
```

You only need to repeat step 3 (`expo run:ios`) when:

- You change `mobile/package.json` and the new dep is a native module
  (re-runs `pod install`).
- You edit anything in `mobile/ios/` (Info.plist, entitlements, etc.).
- You re-run `npm run pack:worklet` (rebuilds the Bare bundle).
- The dev client crashes on launch with native-module errors.

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
# Easiest: scan the QR code shown on the phone (long-press "Barcelona" 2s
# → Settings → Trusted Contact Pairing). The QR encodes the full URL
# below, so the browser opens straight into the dashboard.
http://<your-ip>:8080/#<token>

# Without QR: open http://<your-ip>:8080/ and paste the token (the hex
# string shown under the QR, before the ':') into the overlay.
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
