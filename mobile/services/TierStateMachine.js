import { send } from './bridge';

export const Tier = { IDLE: 0, T1: 1, T2: 2, T3: 3 };

let _tier = Tier.IDLE;
const _listeners = new Set();

export function getTier() {
  return _tier;
}

// Monotonic guard: only escalates, never downgrades.
// Returns true if the tier actually changed.
export function escalate(toTier, trigger = 'codeword') {
  if (toTier <= _tier) return false;
  const fromTier = _tier;
  _tier = toTier;

  send({
    event_type: fromTier === Tier.IDLE ? 'incident_opened' : 'tier_changed',
    fromTier,
    toTier,
    trigger,
  });

  _listeners.forEach(fn => fn(_tier, fromTier, trigger));
  return true;
}

// Returns an unsubscribe function.
export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function resetMachine() {
  _tier = Tier.IDLE;
}
