import { requireOptionalNativeModule } from 'expo-modules-core';

const NativeSafeHavenAI = requireOptionalNativeModule('SafeHavenAI');

function missingSubscription() {
  return { remove() {} };
}

export default {
  isAvailable: Boolean(NativeSafeHavenAI),

  async isSoundClassificationAvailable() {
    if (!NativeSafeHavenAI?.isSoundClassificationAvailable) return false;
    return NativeSafeHavenAI.isSoundClassificationAvailable();
  },

  async startSoundClassification() {
    if (!NativeSafeHavenAI?.startSoundClassification) return false;
    return NativeSafeHavenAI.startSoundClassification();
  },

  async stopSoundClassification() {
    if (!NativeSafeHavenAI?.stopSoundClassification) return false;
    return NativeSafeHavenAI.stopSoundClassification();
  },

  addAudioLabelListener(listener) {
    if (!NativeSafeHavenAI?.addListener) return missingSubscription();
    return NativeSafeHavenAI.addListener('onAudioLabel', listener);
  },

  addClassificationDebugListener(listener) {
    if (!NativeSafeHavenAI?.addListener) return missingSubscription();
    return NativeSafeHavenAI.addListener('onAudioClassificationDebug', listener);
  },
};
