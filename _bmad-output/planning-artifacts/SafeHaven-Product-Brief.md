# SafeHaven Product Brief

## Product Name
SafeHaven

## One-Line Summary
A covert safety app disguised as an everyday phone utility that lets users silently escalate emergencies to a trusted contact through voice, hidden gestures, and AI-triggered detection.

## Problem
People in dangerous situations often cannot safely call for help. In many abuse scenarios, phones are monitored, and visible safety actions can escalate risk. Existing tools are usually passive (location sharing) or obvious (panic/SOS UI), and they fail when users cannot interact with the device.

## Target Users
- Primary: people at risk of domestic/intimate partner violence.
- Secondary: people walking alone at night, students, travelers, elderly users.
- Secondary actor: trusted contacts who need immediate, interpretable context.

## Why Now
- Safety fear is rising, especially for women walking alone at night.
- Tech-enabled coercive control is common in abusive relationships.
- Real-time mobile capabilities (WebRTC, on-device ML) now enable covert, low-latency intervention workflows.

## Core Value Proposition
SafeHaven provides "silent witness + actionable context" when visible help-seeking is unsafe.

It combines:
- Covert appearance (disguise skin)
- Hidden activation
- Tiered escalation (audio -> video -> emergency assist)
- Trusted-contact web dashboard (no app install)
- Optional on-device AI safety net for automatic escalation signals

## Product Experience
### Sender (person in danger)
- App looks like normal utility (weather for MVP).
- User activates covertly via shortcut/gesture and/or speaks codewords.
- App escalates through 3 tiers without obvious UI changes.

### Receiver (trusted contact)
- Opens link in browser.
- Sees live audio/video/location based on tier.
- Gets timeline and risk-relevant labels.
- Uses clear emergency action button when needed.

## Tier System (MVP)
- Tier 1: audio + location.
- Tier 2: audio + video + location.
- Tier 3: high-priority alert + emergency call assist.

## Differentiation
- Covert by design, not just "faster SOS".
- Human-in-the-loop trusted contact model.
- Tiered escalation instead of binary panic flow.
- AI-assisted interpretation of noisy live streams.

## MVP Scope (36 Hours)
### Must Have
- One disguise skin (weather).
- Codeword-based tier transitions.
- WebRTC audio/video streaming.
- Live GPS on receiver map.
- Timeline event logging.
- Tier 3 emergency call assist UI.

### Should Have
- AI audio labels on dashboard.
- Auto-trigger prototype from detected distress signals.
- Second skin (podcast).

### Nice to Have
- Encrypted evidence upload.
- Multi-contact routing.
- Exportable incident report.

## Success Criteria
- Tier 1 stream visible to receiver in <= 5 seconds.
- Tier 2 video visible in <= 6 seconds.
- Location updates <= 5 second cadence.
- Full demo run with no manual recovery.
- Judges clearly understand stealth advantage in under 30 seconds.

## Risks and Mitigations
- False positives from AI triggers:
  - Confidence thresholds, cooldown windows, and manual override.
- Legal/claim overreach:
  - Use "call assist" language unless verified direct dispatch exists.
- Demo reliability (permissions/network):
  - Pre-demo media permission checklist and fallback recording.
- Privacy concerns:
  - Explicit consent, minimal retention, secure metadata storage.

## Go-To-Market Direction (Post-Hackathon)
- Pilot with university safety groups and NGOs.
- Safety advisor partnerships for trauma-informed UX and legal guidance.
- Freemium model: core safety free, premium secure evidence/history features.

## 2-3 Minute Pitch Narrative
1. Problem: visible help can be dangerous.
2. Reveal: app appears normal.
3. Escalation demo: Tier 1 -> Tier 2 -> Tier 3.
4. AI fallback: acts when user cannot.
5. Close: "Voice, touch, and when both fail, AI listening on your behalf."

## Immediate Next Decisions
1. Primary pitch lens: domestic abuse stealth vs broader personal safety.
2. AI implementation for demo: real classifier vs deterministic simulation.
3. Evidence scope: timeline-only vs encrypted media in MVP.
