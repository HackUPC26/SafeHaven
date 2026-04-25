
## 1. Project Snapshot
SafeHaven is currently a planning-phase repository for a covert personal safety product.

Current state:
- No mobile/web/backend application code yet.
- Repo contains BMAD installation files and planning artifacts.
- Product direction is documented and stable enough to start implementation.

## 2. Product Thesis
SafeHaven enables discreet emergency escalation when visible SOS behavior may increase danger.

Core flow:
1. Sender opens disguised iPhone app covertly.
2. Sender triggers tier escalation via codewords/hidden interaction.
3. Trusted contact receives live context in browser dashboard.
4. Receiver can take emergency action and optionally save evidence.

## 3. Primary Users
- Sender: person in danger, potentially under phone monitoring.
- Receiver: trusted contact who must quickly interpret signals and act.

## 4. MVP Scope (Execution Baseline)
Must-have loop:
- Disguised sender UI (weather skin)
- 3-tier escalation state machine
- Tier 1: audio + GPS
- Tier 2: add video
- Tier 3: emergency call-assist UX
- Receiver dashboard: media + map + timeline
- Append-only incident events

## 5. Architecture Direction (Current Decision)
### Sender (iPhone)
- On-device AI labeling via Neural Engine/CoreML (baseline labels in MVP)
- Append event/media metadata to Hypercore-style append-only log

### Transport/Discovery
- Hyperswarm/DHT-based peer discovery and replication model

### Receiver (Browser)
- Static dashboard bundle loaded once from server
- Incident data replication/rendering in near real-time
- Explicit "Save Evidence" action for persistence/export

Important caveat:
- Browser compatibility and production strategy for Hyperswarm remain open and may need a bridge/relay layer.

## 6. Data/Event Model (Current)
Canonical event types:
- incident_opened
- tier_changed
- gps_update
- audio_label
- video_state
- risk_state
- incident_closed

Suggested envelope:
- incident_id
- event_type
- timestamp_iso
- sender_device_id
- payload

## 7. Non-Functional Targets (Demo)
- Tier 1 context visible in <= 5s median
- Tier 2 video visible in <= 6s median
- GPS update cadence <= 5s
- AI label delay <= 2s (target)

## 8. Safety and Compliance Constraints
- Use "call assist" language unless verified dispatch integration exists.
- Avoid claiming guaranteed police response.
- Explicit permission/consent for microphone/camera/location.
- Position exported evidence as tamper-evident technical record, not legal certainty.

## 9. Risks to Track
1. Realtime reliability under varying networks.
2. False positives in AI auto-trigger path.
3. Storage growth for long incidents.
4. Overclaiming legal/emergency capabilities.

## 10. Current Repo Structure
- README.md
- _bmad/
- _bmad-output/
  - planning-artifacts/
    - SafeHaven-Market-Research-2026-04-25.md
    - SafeHaven-PM-Discovery-v1.md
    - SafeHaven-PRD-v1.md
    - SafeHaven-Product-Brief-v2.md
- docs/

## 11. Key Planning Artifacts
1. PRD baseline:
- /Users/ecemguvener/Desktop/hackupc/_bmad-output/planning-artifacts/SafeHaven-PRD-v1.md

2. Product framing + architecture narrative:
- /Users/ecemguvener/Desktop/hackupc/_bmad-output/planning-artifacts/SafeHaven-Product-Brief-v2.md

3. Market and positioning:
- /Users/ecemguvener/Desktop/hackupc/_bmad-output/planning-artifacts/SafeHaven-Market-Research-2026-04-25.md

4. PM execution framing:
- /Users/ecemguvener/Desktop/hackupc/_bmad-output/planning-artifacts/SafeHaven-PM-Discovery-v1.md

## 12. Immediate Build Plan (Recommended)
1. Scaffold codebase:
- mobile/ (React Native iOS)
- web/ (dashboard)
- server/ (bootstrap + optional signaling/relay)

2. Implement shared incident schema package.
3. Build sender tier state machine + local event append path.
4. Build receiver timeline/map shell consuming mocked replicated events.
5. Add live media transport and tier gating.
6. Add Save Evidence export package (metadata-first).

## 13. Open Technical Decisions
1. Hypercore media strategy:
- raw media chunks vs encrypted references.

2. Browser networking path for Hyperswarm:
- direct compatibility approach vs bridge/relay.

3. Encryption/key management:
- per-incident keys and export format.

4. Demo mode:
- live inference vs deterministic replay for reliability.

## 14. Git/Collaboration Notes
- Branch: main
- Recent commits indicate planning/docs iteration and remote merge activity.
- Before implementation starts, align team on one architecture path to avoid divergence.

## 15. Definition of "Context Complete"
A new engineer/agent should be able to read this file + PRD and immediately:
- understand the problem and MVP loop,
- know what exists vs what is missing,
- start building milestone 1 without additional discovery.
