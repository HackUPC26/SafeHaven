import SafeHavenAI from '../modules/safe-haven-ai';
import { send } from './bridge';

const VALID_LABELS = new Set([
  'SHOUTING',
  'SCREAMING',
  'CRYING',
  'IMPACT',
  'GUNSHOT',
  'SLAP',
  'DOOR_SLAM',
  'GLASS_BREAKING',
  'EXTENDED_SILENCE',
]);

let labelSubscription = null;
let debugSubscription = null;
let videoAnnotationSubscription = null;
let classifierStarted = false;
let videoAnnotationStarted = false;

function normalizeConfidence(confidence) {
  const value = Number(confidence);
  if (Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  return 0;
}

function forwardAudioLabel(payload) {
  if (!payload || !VALID_LABELS.has(payload.label)) return false;

  const confidence = normalizeConfidence(payload.confidence);
  const source = payload.source || 'SoundAnalysis';
  const rawIdentifier = payload.rawIdentifier || payload.raw_identifier || payload.label;

  console.log('[ai] audio label:', payload.label, confidence.toFixed(2), rawIdentifier);

  send({
    event_type: 'ai_label',
    label: payload.label,
    confidence,
    source,
    raw_identifier: rawIdentifier,
  });

  return true;
}

function ensureLabelSubscription() {
  if (labelSubscription) return;

  labelSubscription = SafeHavenAI.addAudioLabelListener((payload) => {
    forwardAudioLabel(payload);
  });
}

function ensureDebugSubscription() {
  if (debugSubscription || typeof __DEV__ === 'undefined' || !__DEV__) return;

  debugSubscription = SafeHavenAI.addClassificationDebugListener((payload) => {
    const classifications = Array.isArray(payload?.classifications)
      ? payload.classifications
      : [];
    const summary = classifications
      .map((item) => {
        const confidence = normalizeConfidence(item?.confidence).toFixed(2);
        const mappedLabel = item?.mappedLabel ? ` -> ${item.mappedLabel}` : '';
        return `${item?.identifier ?? 'unknown'} ${confidence}${mappedLabel}`;
      })
      .join(', ');

    if (summary) {
      console.log('[ai:debug] raw classifications:', summary);
    }
  });
}

function normalizeVideoAnnotation(payload) {
  if (!payload) return null;

  const personCount = Number(payload.personCount);
  const confidence = normalizeConfidence(payload.confidence);
  const poseFlags = Array.isArray(payload.poseFlags) ? payload.poseFlags : [];

  return {
    personCount: Number.isFinite(personCount) ? Math.max(0, Math.round(personCount)) : 0,
    rapidMotion: !!payload.rapidMotion,
    sceneContext: payload.sceneContext || 'camera',
    poseFlags,
    confidence,
    source: payload.source || 'Vision',
  };
}

function forwardVideoAnnotation(payload) {
  const annotation = normalizeVideoAnnotation(payload);
  if (!annotation) return false;

  console.log(
    '[ai] video annotation:',
    `${annotation.personCount} person(s)`,
    annotation.rapidMotion ? 'rapid motion' : 'calm',
    annotation.confidence.toFixed(2)
  );

  send({
    event_type: 'ai_video_annotation',
    annotation,
  });

  return true;
}

function ensureVideoAnnotationSubscription() {
  if (videoAnnotationSubscription) return;

  videoAnnotationSubscription = SafeHavenAI.addVideoAnnotationListener((payload) => {
    forwardVideoAnnotation(payload);
  });
}

export async function startSoundClassification() {
  if (classifierStarted) return true;

  ensureLabelSubscription();
  ensureDebugSubscription();

  try {
    const available = await SafeHavenAI.isSoundClassificationAvailable();
    if (!available) {
      console.warn('[ai] native sound classification unavailable; demo shim remains available in development');
      return false;
    }

    classifierStarted = await SafeHavenAI.startSoundClassification();
    if (!classifierStarted) {
      console.warn('[ai] native sound classification did not start');
    }
    return classifierStarted;
  } catch (err) {
    classifierStarted = false;
    console.warn('[ai] failed to start sound classification:', err?.message ?? err);
    return false;
  }
}

export async function stopSoundClassification() {
  if (!classifierStarted && !labelSubscription) return true;

  try {
    await SafeHavenAI.stopSoundClassification();
  } catch (err) {
    console.warn('[ai] failed to stop sound classification:', err?.message ?? err);
  } finally {
    classifierStarted = false;
    labelSubscription?.remove?.();
    labelSubscription = null;
    debugSubscription?.remove?.();
    debugSubscription = null;
  }

  return true;
}

export async function startVideoAnnotation() {
  if (videoAnnotationStarted) return true;

  ensureVideoAnnotationSubscription();

  try {
    const available = await SafeHavenAI.isVideoAnnotationAvailable();
    if (!available) {
      console.warn('[ai] native video annotation unavailable');
      return false;
    }

    videoAnnotationStarted = await SafeHavenAI.startVideoAnnotation();
    if (!videoAnnotationStarted) {
      console.warn('[ai] native video annotation did not start');
    }
    return videoAnnotationStarted;
  } catch (err) {
    videoAnnotationStarted = false;
    console.warn('[ai] failed to start video annotation:', err?.message ?? err);
    return false;
  }
}

export async function stopVideoAnnotation() {
  if (!videoAnnotationStarted && !videoAnnotationSubscription) return true;

  try {
    await SafeHavenAI.stopVideoAnnotation();
  } catch (err) {
    console.warn('[ai] failed to stop video annotation:', err?.message ?? err);
  } finally {
    videoAnnotationStarted = false;
    videoAnnotationSubscription?.remove?.();
    videoAnnotationSubscription = null;
  }

  return true;
}

export function emitDemoLabel(label, confidence = 0.9) {
  return forwardAudioLabel({
    label,
    confidence,
    source: 'SoundAnalysis',
    rawIdentifier: `demo:${label}`,
  });
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  global.__safehavenEmitAiLabel = emitDemoLabel;
  global.__safehavenEmitVideoAnnotation = forwardVideoAnnotation;
}
