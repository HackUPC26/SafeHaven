# SafeHaven — Epics and Stories
Date: 2026-04-25

---

## E1 — Foundation: Bare Worklet + P2P Core
> Spike E1.3 first (hours 0–2). If browser↔Bare replication doesn't work, the whole architecture needs a fallback plan.

---

### E1.1 — bare-expo bootstrap + Bare Worklet smoke test

Set up the project and confirm the Bare runtime works on a physical device before writing any app logic.

**Done when:**
- `npm run ios` runs on a physical iPhone without crashing
- A Bare Worklet starts via `react-native-bare-kit` and a bare-rpc ping/pong round-trip succeeds
- Bare log output visible via `log stream --predicate "subsystem == 'bare'"`

**Tasks:**
- [ ] Clone `bare-expo` template, rename project to SafeHaven
- [ ] Install `react-native-bare-kit`, `bare-rpc`, `corestore`, `hypercore`, `hyperswarm`
- [ ] Create `backend/worklet.mjs` with a ping/pong RPC handler using `BareKit.IPC`
- [ ] Wire `app/index.tsx` to start the Worklet and send a ping on mount; assert reply received

---

### E1.2 — Hypercore incident log + typed entry append

The Bare Worklet owns the incident log. All data written during an incident goes through here.

**Done when:**
- Corestore + Hypercore created in Bare Worklet; keypair is stable across app restarts
- `entry-writer.mjs` can append all entry types (`incident_start`, `tier_change`, `gps`, `ai_label`, `audio_chunk`, `video_chunk`, `incident_end`) and read them back by seq with correct schema
- Entries are encrypted at rest with `encKey`

**Tasks:**
- [ ] Implement `incident-core.mjs`: Corestore init, Hypercore create/open, expose `append()` and `get(seq)`
- [ ] Implement `entry-writer.mjs`: wraps entry in `{ seq, ts, type, payload }` envelope, calls `core.append()`
- [ ] Define entry type constants and payload schemas (ref Architecture §4)
- [ ] Write a local sanity test: append one of each type, read back, log to Bare console

---

### E1.3 — Hyperswarm announce + browser replication spike ⚠️ Do this first

Validate the critical P2P path end-to-end before building anything on top of it.

**Done when:**
- Bare Worklet calls `swarm.join(topic)` and announces to the DHT
- A browser tab running `hyperdht` browser.js + `hypercore` browser bundle connects and replicates entries
- Entries appended on the iPhone appear in the browser console within 3 seconds
- Works on the hackathon demo WiFi

**Tasks:**
- [ ] Implement `swarm-manager.mjs`: `join(topic)`, `leave()`, wire replication stream to Hypercore
- [ ] Implement `rpc-bridge.mjs`: handle `START_INCIDENT` / `STOP_INCIDENT` / `APPEND_ENTRY` commands from RN
- [ ] Build browser spike page with Vite: read `#pubkey:encKey` from URL fragment, init `hyperdht`, open read-only Hypercore replica, log entries
- [ ] Test: append entries from device → confirm in browser console → pin the npm package versions that work

---

### E1.4 — Media chunker

Turns continuous audio/video buffers from native into discrete Hypercore entries.

**Done when:**
- Audio buffers → `audio_chunk` entries flushed every ≤2 seconds
- Video buffers → `video_chunk` entries flushed every ≤2 seconds, keyframe-aligned
- Memory stays stable under 5 minutes of continuous recording

**Tasks:**
- [ ] Implement `media-chunker.mjs`: separate ring buffers for audio and video, time-based flush (2s interval)
- [ ] Wire audio intake and video intake from `rpc-bridge.mjs`
- [ ] Verify reassembly: extract chunks from Hypercore, concatenate, confirm playable file

---

## E2 — React Native UI

---

### E2.1 — Weather disguise skin

The app must look completely unremarkable at a glance.

**Done when:**
- App launches directly to weather UI — no SafeHaven name, no SOS elements visible
- Weather shows city, temperature, conditions icon, 5-day forecast (static mock data is fine)
- App display name and icon are neutral (e.g. "Weather")
- Tier indicator: invisible at IDLE; small coloured corner dot (green/amber/red) at T1/T2/T3

**Tasks:**
- [ ] Create `WeatherSkin` RN component with static mock weather data
- [ ] Add `TierIndicator`: position corner dot, map tier → colour, hide at IDLE
- [ ] Set neutral `CFBundleDisplayName` and app icon in `app.json`

---

### E2.2 — Tier state machine + codeword activation

The core control flow of the entire app.

**Done when:**
- `TierStateMachine` enforces IDLE → T1 → T2 → T3 (monotonic; no downgrade during incident)
- Speaking the configured codeword for a tier escalates to that tier
- Each escalation sends a `TIER_CHANGE` RPC command to the Bare Worklet with `trigger: "codeword"`
- Detection works while the app is foregrounded

**Tasks:**
- [ ] Implement `TierStateMachine` in RN: state enum, `escalate(toTier)` with guard, dispatch `TIER_CHANGE` via bare-rpc
- [ ] Create `SafeHavenSpeech` Swift Expo module: start/stop `SFSpeechRecognizer` (on-device model), emit recognised words via RN EventEmitter
- [ ] `CodewordListener` component: compare recognised words against configured codewords, call `TierStateMachine.escalate()`
- [ ] Test: speak T1 → T2 → T3 words in sequence, confirm tier progression and Hypercore entries

---

### E2.3 — Hidden settings screen + QR pairing

Setup that's accessible to the user but invisible to anyone casually using the phone.

**Done when:**
- Long-press (≥2s) on disguise UI navigates to Settings — no visible button
- User can set display name and 3 unique codewords; settings persisted to `AsyncStorage`
- Settings shows QR code encoding `https://dashboard.safe-haven.app/#<pubkey>:<encKey>` and a Copy Link button
- QR scan on a second phone opens the receiver PWA and reads the fragment

**Tasks:**
- [ ] Create `SettingsScreen` with name input, 3 codeword inputs (uniqueness validation), Save button
- [ ] Add long-press gesture on `WeatherSkin` → navigate to Settings
- [ ] Read keypair from Bare Worklet via bare-rpc; pass to `QRGenerator`
- [ ] Render QR code with `react-native-qrcode-svg`; add Copy Link via `expo-clipboard`

---

## E3 — Audio + Video Capture

---

### E3.1 — Live audio capture → Hypercore (Tier 1)

**Done when:**
- Audio capture starts automatically on Tier 1
- AAC chunks (≤2s, 16kHz mono) flow from `expo-av` → Bare Worklet → `audio_chunk` Hypercore entries
- Capture continues through T2 and T3
- Audio continues for ≥60s after screen lock (`UIBackgroundModes: [audio]`)

**Tasks:**
- [ ] Configure `expo-av` for AAC recording; implement 2s buffer flush callback
- [ ] Wire `TIER_1_START` in `rpc-bridge.mjs` to start audio; `INCIDENT_END` to stop and flush
- [ ] Add `UIBackgroundModes: [audio]` via `app.json` Expo plugin
- [ ] Verify background operation: lock screen mid-incident, confirm Hypercore entries keep arriving

---

### E3.2 — Live video capture → Hypercore (Tier 2)

**Done when:**
- Video capture starts automatically on Tier 2
- H.264 chunks (≤2s, keyframe-aligned, 480p) flow to Bare Worklet → `video_chunk` entries
- Video arrives at browser within 3s of Tier 2 activation

**Tasks:**
- [ ] Configure `expo-camera`: H.264, 480p, rear-facing, continuous capture
- [ ] Implement keyframe-aligned 2s chunk flush; send to Bare Worklet via bare-rpc
- [ ] Wire `TIER_2_START` in `rpc-bridge.mjs` to start video capture

---

## E4 — GPS

---

### E4.1 — Live GPS tracking → Hypercore

**Done when:**
- GPS polling starts at Tier 1; `gps` entries appended every 5s with `lat`, `lng`, `accuracy`, `address`
- Entries appear on the browser map within 6s of a new position fix
- Polling stops cleanly on incident end

**Tasks:**
- [ ] Configure `expo-location`: high accuracy, 5s interval; add background location to `Info.plist`
- [ ] Callback → `GPS_UPDATE` RPC → `entry-writer.mjs` → `gps` entry (include `reverseGeocodeAsync` address)
- [ ] Browser `GPSMap` (Leaflet): place pin on first entry, update + draw trail on each subsequent entry

---

## E5 — On-Device ML

> All ML must be tested on a physical device. SoundAnalysis and Vision do not run in the iOS simulator.

---

### E5.1 — Sound classification → audio labels

**Done when:**
- `SafeHavenAI` Swift Expo module runs `SNClassifySoundRequest` continuously from Tier 1
- Emits `{ label, confidence, ts }` events for: `SHOUTING`, `CRYING`, `IMPACT`, `GLASS_BREAKING`, `EXTENDED_SILENCE`
- Events → `ai_label` Hypercore entries → appear on browser `AudioLabelRail` within 2s

**Tasks:**
- [ ] Create `SafeHavenAI` Swift Expo module: `SFSoundAnalysisEngine` + `SNClassifySoundRequest` + `SNResultsObserving` delegate
- [ ] Map Apple sound identifiers to SafeHaven label constants; emit via RN EventEmitter
- [ ] Wire RN label events → bare-rpc `AI_LABEL` command → `ai_label` Hypercore entry
- [ ] Browser `AudioLabelRail`: render incoming label chips, colour-coded (red/amber/grey), auto-scroll

---

### E5.2 — Auto-trigger engine

**Done when:**
- `SHOUTING` ≥0.70 confidence → auto Tier 1 if IDLE
- `IMPACT` / `SCREAMING` ≥0.75 → auto Tier 2 if ≤T1
- 15s cooldown between auto-triggers; manual codeword always overrides and resets cooldown
- `tier_change` entry records `trigger: "ai_auto"`

**Tasks:**
- [ ] Implement `AutoTriggerEngine` in RN: confidence filter, cooldown timer, event window counter
- [ ] Wire output → `TierStateMachine.escalate()` with `trigger: "ai_auto"` metadata
- [ ] Browser: show "Auto-triggered" badge on relevant timeline entries

---

### E5.3 — Video annotation (stretch — skip if time is tight)

**Done when:**
- `VNDetectHumanBodyPoseRequest` runs on 1-in-30 video frames
- `personCount` + `rapidMotion` flag → `ai_video_annotation` Hypercore entries
- Browser video player shows annotation overlay; persists last annotation on stream freeze

**Tasks:**
- [ ] Extend `SafeHavenAI` module: add `VNSequenceRequestHandler`, sample every 30th frame
- [ ] Emit annotation events → Bare Worklet → `ai_video_annotation` entry
- [ ] Browser: absolutely-positioned overlay on video player; freeze persistence

---

## E6 — Covert Triggers

---

### E6.1 — Back Tap + Action Button

**Done when:**
- Double Back Tap → T1 escalation while app is foregrounded
- Action Button (iPhone 15 Pro+) → T1 via a registered App Intent / Shortcut
- Both log `trigger: "hardware"` on the `tier_change` entry
- Shortcut setup guide shown in onboarding

**Tasks:**
- [ ] Create `SafeHavenTrigger` Swift Expo module: register Back Tap via Accessibility/`CMMotionManager` tap heuristic
- [ ] Register App Intent for Shortcuts / Action Button (iOS 17+)
- [ ] Emit trigger event → RN EventEmitter → `TierStateMachine.escalate(1, "hardware")`
- [ ] Add shortcut setup guide screen to onboarding flow

---

## E7 — Browser Receiver PWA

---

### E7.1 — Shell: DHT connect + Hypercore replication + standby screen

**Done when:**
- Vite app bundles `hyperdht` + `hypercore` for browser; deployed to GitHub Pages
- Reads `#pubkey:encKey` from URL fragment client-side; connects to DHT; replicates Hypercore
- Shows "Standby — connected to [name]" once P2P established; 30s timeout with error if not
- Auto-transitions to active incident mode on receiving `incident_start` entry
- Works on Chrome Android and Safari iOS 17+

**Tasks:**
- [ ] Vite project setup; bundle `hyperdht` browser.js + `hypercore` for browser target
- [ ] `InitModule`: parse fragment, instantiate DHT node, join incident topic
- [ ] `HypercoreClient`: open read-only replica, `createReadStream({ live: true })`, pipe to `EntryDispatcher`
- [ ] `StandbyScreen`: connection status indicator, sender name, 30s timeout error state
- [ ] Deploy to GitHub Pages; test QR scan → phone browser → standby state

---

### E7.2 — GPS map + incident timeline

**Done when:**
- Live pin + movement trail updates on each `gps` entry; address label shown
- Timeline shows all entry types chronologically, colour-coded, auto-scrolling to latest

**Tasks:**
- [ ] `GPSMap` (Leaflet): init on first `gps` entry, update pin + draw polyline trail, show address
- [ ] `IncidentTimeline`: virtualised list, colour rows by entry type, auto-scroll to bottom
- [ ] `EntryDispatcher`: route `gps` → map, all entries → timeline

---

### E7.3 — Audio label rail + risk banner

**Done when:**
- `AudioLabelRail`: scrolling chips with label, confidence %, timestamp; red/amber/grey coding
- `RiskBanner`: GREEN / AMBER / RED from last 60s of labels with one-line guidance text; updates within 2s

**Tasks:**
- [ ] `AudioLabelRail`: horizontal scroll, auto-scroll right, colour map by label severity
- [ ] `RiskBanner`: sliding 60s window aggregator; severity rules (IMPACT/SCREAMING → RED, SHOUTING → AMBER, else GREEN); guidance strings
- [ ] `EntryDispatcher`: route `ai_label` → both components

---

### E7.4 — Video player with AI annotation overlay

**Done when:**
- MSE `SourceBuffer` plays `video_chunk` entries in sequence; video visible within 3s of Tier 2
- iOS Safari fallback (Blob URL) for MSE-unsupported browsers
- AI annotation overlay (person count, motion flag) updates from `ai_video_annotation` entries
- Freeze-frame + staleness badge ("Last frame Xs ago") when no chunk for >5s

**Tasks:**
- [ ] `VideoPlayer`: init MSE `MediaSource`, append `video_chunk` data to `SourceBuffer`; detect stall
- [ ] Detect MSE support at runtime; implement Blob URL fallback
- [ ] Annotation overlay: absolutely-positioned div, update on each `ai_video_annotation` entry
- [ ] iOS Safari test: confirm video plays on a physical iPhone browser

---

### E7.5 — Tier 3 CTA: Call Police with Location

**Done when:**
- "Call Police with Location" button always visible; large + full-width red at Tier 3
- Tap shows confirmation sheet with sender name, address, coordinates
- Confirm → `tel:112` opens native dialler
- Copy does not claim guaranteed dispatch

**Tasks:**
- [ ] `CallPoliceButton`: render at all tiers, scale prominence with tier state
- [ ] Confirmation sheet: name, address from last `gps` entry, coords, "Call Now" action
- [ ] `window.location.href = 'tel:112'`; test on mobile browser confirms native dialler opens

---

## E8 — Evidence Vault

---

### E8.1 — Save Evidence: IndexedDB buffer + ZIP download

**Done when:**
- All replicated entries are cached in IndexedDB during the session (entries + media as Blobs)
- "Save Evidence" button packages a downloadable ZIP: `timeline.ndjson`, `gps-track.geojson`, `ai-labels.ndjson`, `media/audio-*.aac`, `media/video-*.mp4`
- Entirely client-side — nothing uploaded

**Tasks:**
- [ ] `SessionStore`: IndexedDB wrapper, `entries` store (keyPath: `seq`), `media` store
- [ ] Write every replicated entry to `SessionStore` before dispatching to renderers
- [ ] `SaveEvidenceButton`: build ZIP with `jszip` from IndexedDB contents; trigger browser download via `URL.createObjectURL`
- [ ] Test: 2-minute simulated incident → click Save → verify ZIP contents

---

## E9 — Onboarding + Pairing

---

### E9.1 — First-launch onboarding flow

**Done when:**
- Multi-step wizard on first launch: name → codewords (3, must be unique) → QR share step → shortcut guide
- Cannot skip codeword or QR steps
- `onboardingComplete` flag gates to disguise skin on subsequent launches
- "Reset Setup" action available in Settings

**Tasks:**
- [ ] `OnboardingFlow`: step wizard with progress indicator and validation
- [ ] Persist `onboardingComplete` to `AsyncStorage`; check on app start to route appropriately
- [ ] QR share step: show QR + "I've shared this with my contact" confirmation required to proceed
- [ ] Shortcut guide step: static screenshots for Back Tap and Action Button setup

---

### E9.2 — Receiver PWA: PWA installability

**Done when:**
- Dashboard is installable via "Add to Home Screen" on Chrome Android and Safari iOS
- Installed PWA opens directly to standby screen without browser chrome

**Tasks:**
- [ ] Add `manifest.json`: name, icons, `display: standalone`, `start_url`
- [ ] Add a minimal service worker for offline shell caching
- [ ] Test "Add to Home Screen" on both iOS and Android
