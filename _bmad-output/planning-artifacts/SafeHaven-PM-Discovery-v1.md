# SafeHaven PM Discovery v1
Date: 2026-04-25
Owner: PM Fallback (bmad-agent-pm equivalent)

## 1. Product Decision Summary
Primary target scenario: **coercive-control and high-risk personal safety incidents where visible help-seeking is unsafe**.

Primary value proposition: **covert activation + trusted-contact live witness + actionable escalation**.

MVP architecture decision (for hackathon reliability):
- Keep sender/receiver media path practical and demo-stable.
- Use append-only incident log semantics for timeline integrity.
- Treat full legal-grade evidence claims as post-MVP.

## 2. User Jobs To Be Done (JTBD)
1. When I feel unsafe and cannot visibly call for help, I need to silently alert someone I trust so they can monitor and act.
2. When the situation escalates, I need escalation options that do not require obvious phone interaction.
3. As a trusted contact, I need clear, real-time context and a single obvious next action under stress.
4. After an incident, I need incident records that are time-ordered and hard to tamper with.

## 3. Core Personas
### A. Primary User (At-risk individual)
- Environment: monitored phone, social pressure, high stakes
- Needs: stealth, low friction, plausible deniability, reliability
- Failure intolerance: high (false negatives are costly)

### B. Trusted Contact (Receiver)
- Environment: receives sudden alert under stress
- Needs: interpretability, confidence, one-tap action path
- Failure intolerance: medium-high (confusion delays action)

## 4. Problem Framing
Current safety tools are often either overt or passive.
- Overt tools can increase danger if discovered.
- Passive tools (location-only) lack intervention context.
- Receivers are overloaded by raw streams with little guidance.

SafeHaven differentiates by combining stealth + progressive escalation + receiver decision support.

## 5. MVP Requirements (Product-Critical)
1. Disguised sender UI (weather skin minimum).
2. Covert activation path (at least one hidden trigger + one codeword path).
3. Tiered incident state machine:
- Tier 1: audio + GPS
- Tier 2: add video
- Tier 3: emergency call-assist prominence
4. Receiver dashboard with:
- media surfaces,
- location/map,
- timeline,
- call-assist CTA.
5. Tamper-evident timeline semantics (append-only event model).

## 6. PM Scope Cuts (to Protect Demo Reliability)
Cut or defer if unstable:
- fully automated emergency dispatch claims,
- multi-contact routing complexity,
- heavy post-processing/forensics pipelines,
- broad disguise catalog beyond 1-2 skins.

## 7. Product Risks and Controls
1. Safety overclaim risk
- Control: "call assist" language, no guaranteed dispatch claim.

2. False AI trigger risk
- Control: confidence threshold + cooldown + visible receiver confirmation state.

3. Connectivity/realtime reliability risk
- Control: pre-demo tested path, fallback to lower-bandwidth mode.

4. Evidence admissibility ambiguity
- Control: position as tamper-evident chronology, not legal guarantee.

## 8. Acceptance Criteria (PM Sign-Off)
1. User can activate Tier 1 covertly in <= 2 steps.
2. Receiver receives Tier 1 context (audio + map + timeline) in <= 5s median.
3. Escalation to Tier 2 and Tier 3 is monotonic and visible on timeline.
4. Receiver can identify next action in < 3 seconds from dashboard.
5. End-to-end incident replay remains time-ordered and complete.

## 9. North-Star Metrics 
- Time-to-trusted-contact-awareness (TTA)
- Escalation completion rate (Tier1->Tier2 when needed)
- Receiver action confidence score
- False positive and false negative rates for auto-trigger layer

## 11. Open Decisions (PM Required)
1. Evidence model for MVP: metadata-first vs media bundle export.
2. Hyperswarm web compatibility path: direct browser path vs relay bridge.
3. AI in demo: live inference vs deterministic replay for reliability.
4. Default disguise for demo: weather vs podcast.

## 12. PM Recommendation
Ship the smallest credible loop:
- Covert trigger -> live witness context -> escalation -> explicit emergency action.

This loop is the product thesis. Everything else should be evaluated by whether it makes this loop faster, safer, and more reliable.
