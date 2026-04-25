# SafeHaven Product Brief v2
Date: 2026-04-25

## One-Line Pitch
SafeHaven is a covert safety app disguised as an everyday app that lets people in danger silently escalate from live audio to full evidence capture using voice, hidden gestures, and AI-assisted auto-triggering.

## Problem
People in danger often cannot safely call for help.

In domestic abuse and coercive-control contexts, visible SOS behavior can increase risk. Existing tools are usually either:
- passive (location sharing without intervention), or
- overt (panic/SOS interfaces that can be noticed).

The missing capability is discreet, real-time trusted-contact intervention with evidence continuity.

## Solution
SafeHaven combines:
- Disguised sender app UI (weather/podcast/notes/clock skins)
- Covert activation (Back Tap, Action Button, shortcut, Siri phrase)
- Three-tier escalation through codewords and optional AI auto-trigger
- Trusted-contact browser dashboard (no app install)
- Tamper-evident incident log and evidence export flow

### PEARS Sponsor Track
SafeHaven is built on the **Pear protocol** (Hypercore + Hyperswarm + Bare runtime) to compete in the PEARS sponsor track. All incident data is transmitted exclusively peer-to-peer between the sender's iPhone and the trusted contact's browser. No cloud backend stores or proxies sensitive data. The only server is a static file host that delivers the receiver PWA bundle once on first load.

## Target Users
- Primary: people at risk of intimate partner violence and coercive control
- Secondary: people walking alone at night, students, travelers, elderly users
- Decision-maker in incident: trusted contact who needs immediate, interpretable context

## Product Experience
### Sender (iPhone)
- App appears as normal utility UI.
- User can trigger discreetly and speak everyday codewords.
- Escalation tiers activate with minimal visible change.
- Optional on-device AI detects danger signals when user cannot act.

### Receiver (Browser Dashboard)
- Opens a pre-shared dashboard link/key.
- Receives live incident data in near real-time.
- Sees map, timeline, media state, AI labels, and emergency call assist.
- Can explicitly save/export evidence post-incident.

## Tier Escalation Model
- Tier 1: Audio + GPS + timeline events
- Tier 2: Audio + Video + GPS + timeline events
- Tier 3: High-priority emergency state + immediate call-assist UX + continued logging

## Core Technical Architecture (Updated)
### Architecture Summary
Sender (iPhone):
- Neural Engine / CoreML inference annotates audio/video on-device
- Data appended to Hypercore append-only log:
  - media chunks (or references)
  - AI label metadata (near real-time)
  - GPS coordinates
  - tier events + timeline markers

Discovery and transport:
- Hyperswarm (DHT) used for trusted peer discovery + replication path

Receiver (browser dashboard):
- Replicates Hypercore stream in near real-time
- Renders video state, AI overlays, audio labels, map, and incident timeline
- Optional evidence persistence only when receiver explicitly clicks Save Evidence

### Dashboard Delivery Model
One-time bootstrap:
- Browser requests static dashboard bundle (HTML/CSS/JS) from static server (CDN or GitHub Pages)
- After load, sensitive incident flow is exclusively peer-to-peer — the static server is never contacted again

Runtime model:
- Browser JS ↔ `hyperdht` browser build ↔ Holepunch public DHT bootstrap nodes (peer discovery only) ↔ Sender iPhone peer
- Actual incident data flows directly browser ↔ iPhone via WebRTC data channels (Noise-encrypted)
- Incident data buffered in memory and IndexedDB for session continuity
- Explicit user action required for durable evidence export/download

### Receiver Dashboard Elements (Browser PWA)
- **Live video feed** with AI annotation overlays (person count, posture, scene context). Last frame + annotations persist with staleness timestamp if feed freezes.
- **Audio label rail** — scrolling timeline of AI audio labels, timestamped and colour-coded: red for IMPACT/SCREAMING, amber for SHOUTING, grey for SILENCE.
- **Live GPS map** — pin, address, coordinates, movement trail.
- **AI risk assessment banner** — synthesises all signals: green / amber / red with actionable guidance text.
- **Incident timeline** — chronological colour-coded events (tier changes, AI triggers, GPS updates).
- **"Call Police with Location"** — primary action button, large, red, always visible, pre-loaded with live GPS coordinates.
- **"Save Evidence"** — secondary button, packages session data for download.
- **Session header** — person's name, active tier badge, session duration, P2P connection status.

## Privacy and Evidence Model
- Append-only incident log for tamper-evident chronology
- Default minimize-retention posture (session-first)
- Post-incident persistence is explicit and intentional (Save Evidence action)
- Evidence package includes timeline + metadata + associated media references/chunks

### Evidence Vault
During an incident, the Hypercore log builds the evidence trail automatically. Every entry is cryptographically chained — audio chunks, video chunks, AI labels, GPS coordinates, tier changes — all timestamped and signed in the append-only log. This structure is inherently tamper-evident, making it viable for legal proceedings.

Post-incident, the trusted contact clicks **"Save Evidence"** to download:
- Full Hypercore session export (NDJSON timeline)
- Associated media chunk references
- AI label log with timestamps and confidence scores
- GPS track (coordinates + timestamps)
- PDF evidence report: timestamps, coordinates, AI labels, and key video frames

Nothing persists on the receiver's device without this explicit consent action.

## Onboarding and Pairing Flow

### First-time Setup (Sender)
1. User installs SafeHaven (bare-expo app).
2. App runs onboarding: choose disguise skin, configure 3 codewords, set trusted contact.
3. App generates an incident keypair (Hypercore public key + shared encryption key).
4. App shows a **QR code** and a **shareable link** (`https://dashboard.safe-haven.app/#<pubkey>:<encryptionKey>`).
   - The `#fragment` is never sent to the static server.
5. User sends the link/QR to their trusted contact via any channel (SMS, email, messaging app).
6. Setup guidance for Back Tap or Action Button as a hidden activation shortcut.

### Trusted Contact Setup (Receiver)
1. Contact opens the shared link in any modern browser.
2. Browser downloads the static PWA bundle once.
3. Browser reads the keypair from the URL fragment (client-side only).
4. Dashboard enters standby mode — shows "Waiting for connection."
5. When an incident starts, the browser auto-connects via Hyperswarm DHT and begins replicating.

## Neural Engine AI Layers
1. Auto-trigger from sound classification
- Escalating voices -> Tier 1
- Screaming/impact-like events -> Tier 2
- Sustained distress -> Tier 3 (policy-based)

2. Audio labeling for receiver clarity
- Labels such as SHOUTING, CRYING, IMPACT, GLASS BREAKING, EXTENDED SILENCE

3. Video annotation metadata
- Person count, rapid motion flags, scene cues
- Last-known annotation persistence if stream degrades

## MVP Scope (36 Hours)
### Must Have
- Weather disguise skin
- Three codeword tiers
- Tier 1 audio + GPS
- Tier 2 video
- Tier 3 emergency call-assist UX
- Incident timeline
- Baseline AI audio labels
- Hypercore append log + receiver replication demo path

### Should Have
- Podcast disguise skin
- AI risk banner (LOW/MEDIUM/HIGH)
- Export evidence package from dashboard

### Nice to Have
- Multi-contact routing
- Rolling media buffer retention policies
- PDF incident summary export

## Success Criteria
- Tier 1 activation to receiver feedback <= 5s median
- Tier 2 video visible <= 6s median
- GPS refresh <= 5s cadence
- AI label visibility <= 2s after event
- Complete live demo without manual reset

## Risks and Mitigations
- False positives from AI triggers:
  - confidence thresholds + cooldown windows + manual override
- P2P connectivity variability:
  - pre-shared key setup + test path + controlled network for demo
- Overclaiming emergency response:
  - use "call assist" language unless direct dispatch integration is verified
- Evidence/legal assumptions:
  - present as tamper-evident technical log, not guaranteed legal admissibility

## Demo Flow (2-3 minutes)
1. Show disguised app (weather) and normal interaction
2. Trigger Tier 1 phrase -> receiver sees audio + GPS + timeline
3. Trigger Tier 2 phrase -> receiver sees video + labels
4. Trigger Tier 3 phrase -> emergency call-assist + risk state
5. Show AI auto-trigger clip (user cannot act scenario)
6. Show Save Evidence action and exported incident package concept

## Positioning
"When visible help is dangerous, SafeHaven brings a trusted witness in silently."

## Immediate Build Decisions
1. Media in Hypercore: raw chunks vs encrypted chunk references
2. Hyperswarm browser strategy: direct compatibility approach vs bridge layer for web clients
3. Evidence package format: NDJSON timeline + media bundle manifest
4. Demo reliability mode: live inference vs deterministic replay for final stage demo
