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
- Browser requests static dashboard bundle (HTML/CSS/JS) from static server
- After load, sensitive incident flow is peer-to-peer

Runtime model:
- Browser JS <-> Hyperswarm network <-> Sender iPhone peer
- Incident data buffered in memory and IndexedDB for session continuity
- Explicit user action required for durable evidence export/download

## Privacy and Evidence Model
- Append-only incident log for tamper-evident chronology
- Default minimize-retention posture (session-first)
- Post-incident persistence is explicit and intentional (Save Evidence action)
- Evidence package includes timeline + metadata + associated media references/chunks

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
