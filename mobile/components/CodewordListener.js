import { useEffect, useRef, useCallback } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { Tier, escalate } from '../services/TierStateMachine';

// Invisible component — always listening while foregrounded.
// Reads codewords from settings prop so user-configured phrases work immediately.
export default function CodewordListener({ codewords }) {
  const runningRef = useRef(false);
  const mountedRef = useRef(false); // guards against restart after unmount

  const startListening = useCallback(async () => {
    if (!mountedRef.current || runningRef.current) return;
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      console.warn('[CodewordListener] speech permission denied');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      requiresOnDeviceRecognition: true,
      continuous: true,
      interimResults: true,
    });
    runningRef.current = true;
    console.log('[CodewordListener] listening');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startListening();
    return () => {
      mountedRef.current = false;
      if (runningRef.current) {
        ExpoSpeechRecognitionModule.stop();
        runningRef.current = false;
      }
    };
  }, [startListening]);

  // iOS stops recognition after ~1 min of silence — restart automatically.
  // mountedRef guard prevents restart after the component has unmounted.
  useSpeechRecognitionEvent('end', () => {
    runningRef.current = false;
    if (!mountedRef.current) return;
    setTimeout(startListening, 300);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.toLowerCase().trim() ?? '';
    if (!transcript) return;

    const t1 = codewords?.TIER1?.toLowerCase();
    const t2 = codewords?.TIER2?.toLowerCase();
    const t3 = codewords?.TIER3?.toLowerCase();

    // Check highest tier first so a T3 phrase always wins over any T1 substring
    if (t3 && transcript.includes(t3)) {
      escalate(Tier.T3, 'codeword');
    } else if (t2 && transcript.includes(t2)) {
      escalate(Tier.T2, 'codeword');
    } else if (t1 && transcript.includes(t1)) {
      escalate(Tier.T1, 'codeword');
    }
  });

  // On recoverable errors, restart after a short delay.
  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[CodewordListener] error:', event.error, event.message);
    runningRef.current = false;
    if (!mountedRef.current) return;
    const retryable = ['no-speech', 'network', 'audio-capture'];
    if (retryable.includes(event.error)) {
      setTimeout(startListening, 1000);
    }
  });

  return null;
}
