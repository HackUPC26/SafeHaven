# SafeHaven MVP PRD (Hackathon Build)

## 1. Product Summary
SafeHaven is a covert emergency-assistance mobile app disguised as an everyday utility. It enables a user in danger to silently escalate from passive monitoring to emergency response through hidden triggers and codewords, while streaming live context to a trusted contact.

Core principle: the user should not need to place a visible call or perform suspicious interactions during a crisis.

### PEARS Sponsor Track
SafeHaven is built on the **Pear protocol** (Hypercore + Hyperswarm) for the PEARS sponsor track. All incident data flows exclusively peer-to-peer between the sender iPhone and the trusted contact's browser — no cloud backend, no signalling server, no STUN/TURN. The only server is a static file host that delivers the receiver dashboard bundle once on first load. Sensitive data never touches it.

## 2. Problem Statement
Current safety tools fail in high-risk situations because:
- A visible safety app can increase danger if a threat actor monitors the phone.
- Traditional SOS flows require overt actions (open app, dial, message).
- Location-sharing apps are often passive and not real-time evidence systems.
- Trusted contacts receive raw, incomplete information under stress.

## 3. Target Users
- Primary: people at risk of domestic or intimate partner violence.
- Secondary: people walking alone at night, students, elderly users, travelers.
- Receiver persona: trusted contact who needs immediate, interpretable context and one-tap escalation.

## 4. Goals and Non-Goals
### Goals (Hackathon MVP)
- Provide covert activation and 3-tier escalation.
- Stream live audio/video to a trusted contact web dashboard.
- Provide live location and incident timeline.
- Demonstrate emergency escalation UX via a "Call Police" action.
- Show at least one AI auto-trigger and one AI annotation path.

### Non-Goals (MVP)
- Production-grade stealth against forensic device analysis.
- Automatic direct dispatch integration with 911 systems in all regions.
- Full legal chain-of-custody guarantees.
- Multi-platform parity beyond the chosen demo stack.

## 5. Success Metrics (Demo-Oriented)
- Tier 1 activation to receiver audio stream: <= 5 seconds median.
- Tier 2 escalation to live video visible: <= 6 seconds median.
- Location updates on dashboard: refresh <= 5 seconds.
- AI sound label latency on dashboard: <= 2 seconds from event.
- End-to-end demo completion without manual recovery: 1 full run.

## 6. MVP Functional Requirements
### 6.1 Sender App (Disguised iPhone App)
- User can select one disguise skin (MVP requires Weather).
- App opens to disguise UI with no obvious SOS indicators.
- User configures 3 codewords mapped to tiers.
- Hidden activation supported (at minimum one of: Back Tap, Action Button, Shortcut launch).
- App can listen while foregrounded and detect codewords.

### 6.2 Three-Tier Escalation
- Tier 1: start live audio + live GPS to trusted contact.
- Tier 2: add live video stream.
- Tier 3: high-priority alert + expose "Call Police" action.
- Escalation must be monotonic during incident (1 -> 2 -> 3 only).
- Timeline event logged on each tier change.

### 6.3 Trusted Contact Dashboard (Web)
- Link-based access (no app install required).
- Real-time audio stream (Tier 1+).
- Real-time video stream (Tier 2+).
- Real-time map with user marker and address.
- Timeline panel with timestamps and event types.
- Persistent visible "Call Police" action (prominent at Tier 3).

### 6.4 Evidence Capture (MVP Baseline)
- Receiver can start/stop local screen recording guidance OR click save event metadata.
- Incident timeline and key metadata are persisted (timestamp, tier, location).
- If media retention is implemented, mark as encrypted-at-rest or demo-only.

## 7. AI / Neural Engine Extension (Demo Slice)
### Must-build AI features
- Sound classification auto-trigger:
  - Raised voices -> auto Tier 1.
  - Scream/impact-like event -> auto Tier 2.
- Real-time audio labels on dashboard:
  - Examples: SHOUTING, CRYING, IMPACT, GLASS BREAKING, EXTENDED SILENCE.

### Should-build AI features
- Video annotations metadata (person count, rapid movement).
- Heuristic risk banner (LOW/MEDIUM/HIGH) from combined signals.

### Stretch
- Auto-escalation to Tier 3 if sustained distress threshold is met.
- Last-known visual annotation persistence when stream freezes.

## 8. System Design (Pear Protocol / P2P)

### Stack

| Layer | Technology |
|---|---|
| Sender app framework | React Native (Expo) via `bare-expo` template |
| Sender P2P runtime | Bare Worklet (`react-native-bare-kit`) |
| P2P data log | Hypercore (append-only, cryptographically chained) |
| P2P transport | Hyperswarm DHT (UDP holepunch + Noise encryption) |
| Peer store | Corestore (manages Hypercore key namespacing) |
| Video/audio capture | `expo-camera`, `expo-av` (native bridge to AVFoundation) |
| GPS | `expo-location` (native bridge to CoreLocation) |
| On-device AI | CoreML + SoundAnalysis framework (custom native Expo module) |
| Covert triggers | Back Tap / Action Button (custom native Expo module) |
| Receiver | Static PWA (HTML/JS bundle served from CDN/GitHub Pages) |
| Receiver P2P | `hyperdht` browser build + `hypercore` browser bundle |
| Receiver transport | WebRTC data channels via Holepunch public DHT bootstrap nodes |
| Evidence storage | IndexedDB (session buffer) + explicit "Save Evidence" download |
| Backend | **None** — fully serverless except static file host |

### Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│  React Native UI (Expo / Hermes)                    │
│  Disguise skin · Tier display · Onboarding          │
│                    ↕ bare-rpc IPC                   │
│  Bare Worklet (react-native-bare-kit)               │
│  Hypercore log · Corestore · Hyperswarm DHT         │
│                    ↕ native module bridge            │
│  Native iOS Modules                                 │
│  expo-camera · expo-av · expo-location              │
│  CoreML (SoundAnalysis + Vision) · Back Tap         │
└─────────────────────────────────────────────────────┘
              ↕ Hyperswarm DHT (UDP / Noise)
              ↕ Public bootstrap: hyperdht.org nodes
              ↓
┌─────────────────────────────────────────────────────┐
│  Browser PWA (downloaded once from static host)     │
│  hyperdht browser.js · hypercore browser bundle     │
│  Hypercore replication over WebRTC data channels    │
│  Renders: video · audio labels · map · timeline     │
│  Actions: Call Police · Save Evidence               │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. Sender app starts: Bare Worklet creates a Hypercore + Corestore, announces on Hyperswarm DHT using the incident keypair.
2. Pairing: app generates QR code and shareable URL containing `#<pubkey>:<encryptionKey>` (fragment never sent to server).
3. Trusted contact opens the URL: browser downloads the static PWA bundle, reads keypair from URL fragment, joins Hyperswarm DHT via `hyperdht` browser build.
4. Browser connects to sender peer via WebRTC data channel (brokered through Holepunch public bootstrap nodes).
5. Browser begins replicating the Hypercore from the sender in real time.
6. As the sender appends entries (audio chunks, video chunks, GPS, AI labels, tier events), they appear in the browser within 2–3 seconds.
7. Browser renders each entry type: video frames to player, AI labels to scrolling rail, GPS to map pin, tier changes to timeline.
8. At Tier 3: "Call Police with Location" button becomes primary CTA (pre-loaded with coordinates).
9. Post-incident: trusted contact clicks "Save Evidence" to package the Hypercore session data as a downloadable bundle (timeline JSON + media + AI labels + GPS track).

### No-Server Guarantee
- Static file host: serves JS/HTML bundle only. Zero knowledge of any incident.
- Holepunch DHT bootstrap nodes: facilitate peer discovery only. Zero knowledge of Hypercore content (all data is encrypted with the shared key).
- All audio, video, GPS, AI metadata, and timeline data flows exclusively between the sender device and the receiver browser via encrypted Hyperswarm connections.

## 9. Safety, Privacy, and Legal Notes
- User-facing copy must avoid claiming guaranteed police dispatch.
- "Call Police" should launch device dialer with prepared details, not promise direct API dispatch unless integrated and verified.
- Clearly mark demo-only behavior for any mocked emergency flow.
- Include consent notice on first launch for audio/video/location collection.
- Store minimum necessary data and auto-expire demo incidents if possible.

## 10. 36-Hour Delivery Plan
### Must Have
- Weather disguise screen.
- Codeword tier detection.
- Tier 1 audio + location streaming.
- Tier 2 video streaming.
- Tier 3 UI alert + call action.
- Timeline events.
- AI sound classification demo path.
- Dashboard audio labels.

### Should Have
- Podcast disguise skin.
- AI risk banner.
- Minimal encrypted evidence upload.
- Guided onboarding for shortcut/back tap setup.

### Nice to Have
- Multi-contact support.
- PDF incident export.
- Route-deviation and motion heuristics.

## 11. Acceptance Criteria (Demo Pass/Fail)
- Presenter can trigger Tier 1 by codeword and browser dashboard receives audio + GPS via Hypercore replication.
- Presenter can escalate Tier 2 and browser dashboard receives live video within ≤3 seconds (P2P latency acceptable).
- Presenter can escalate Tier 3 and receiver sees prominent "Call Police with Location" CTA.
- Timeline shows at least: incident start, tier changes, location updates — all as Hypercore entries.
- AI auto-trigger can be demonstrated with a prepared audio sample triggering automatic tier escalation.
- Dashboard displays at least two AI audio labels (e.g. SHOUTING, IMPACT) during demo.
- Hypercore replication is demonstrably P2P: no cloud backend involved in incident data flow.
- "Save Evidence" packages and downloads incident data from the browser session.

## 12. Demo Script (2-3 minutes)
1. Show disguised weather app UI.
2. Trigger Tier 1 phrase; switch to dashboard audio + map.
3. Trigger Tier 2 phrase; show live video.
4. Trigger Tier 3 phrase; show emergency action and timeline.
5. Play simulated escalation audio; show AI auto-trigger + labels.
6. Close with "voice, touch, and AI fallback" message.

## 13. Edge Cases and Mitigations
- Phone locked/in pocket:
  - Mitigation: setup guidance prioritizes quick unlock + shortcut paths.
- Long recordings consume storage:
  - Mitigation: rolling buffer and event-based retention.
- False positives from AI sound detection:
  - Mitigation: confidence threshold + cooldown + user-tunable sensitivity (if time permits).
- Stream freeze/network loss:
  - Mitigation: last-known location + last AI annotations + reconnect state.

## 14. Immediate Build Backlog (First 8 Tasks)
1. Create sender app shell with weather disguise and tier state machine.
2. Add codeword detection pipeline and local tier transitions.
3. Implement WebRTC sender->receiver audio stream.
4. Add GPS capture and dashboard map rendering.
5. Add Tier 2 video stream toggle/escalation.
6. Build timeline event model and UI panel.
7. Integrate sound classification events into tier engine.
8. Add dashboard audio label rail and risk badge.
