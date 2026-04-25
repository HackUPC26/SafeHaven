import AsyncStorage from '@react-native-async-storage/async-storage';
import { start as startWorklet, getPubkey } from './worklet-rpc';

const KEYS = {
  NAME: '@safehaven:name',
  CODEWORDS: '@safehaven:codewords',
  PAIRING_ID: '@safehaven:pairingId',
};

const DEFAULT_CODEWORDS = { TIER1: 'sunny', TIER2: 'cloudy', TIER3: 'storm' };

function randomHex32() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Real Hypercore pubkey from the worklet, paired with a random encryption key.
// Falls back to fully random hex if the worklet isn't reachable yet (so the
// settings screen still works pre-boot — the pairing id will be regenerated
// next launch once the worklet comes up).
async function generatePairingId() {
  let pubkey;
  try {
    await startWorklet();
    pubkey = await getPubkey();
  } catch (err) {
    console.warn('[settings] could not get worklet pubkey, falling back:', err.message ?? err);
    pubkey = randomHex32();
  }
  const encKey = randomHex32();
  return `${pubkey}:${encKey}`;
}

export async function loadSettings() {
  try {
    const [name, codewordsJson, pairingId] = await Promise.all([
      AsyncStorage.getItem(KEYS.NAME),
      AsyncStorage.getItem(KEYS.CODEWORDS),
      AsyncStorage.getItem(KEYS.PAIRING_ID),
    ]);

    const codewords = codewordsJson ? JSON.parse(codewordsJson) : DEFAULT_CODEWORDS;
    let id = pairingId;
    if (!id) {
      id = await generatePairingId();
      await AsyncStorage.setItem(KEYS.PAIRING_ID, id);
    }

    return { name: name || '', codewords, pairingId: id };
  } catch {
    return { name: '', codewords: DEFAULT_CODEWORDS, pairingId: await generatePairingId() };
  }
}

export async function saveSettings({ name, codewords }) {
  await Promise.all([
    AsyncStorage.setItem(KEYS.NAME, name),
    AsyncStorage.setItem(KEYS.CODEWORDS, JSON.stringify(codewords)),
  ]);
}

export async function resetSettings() {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
