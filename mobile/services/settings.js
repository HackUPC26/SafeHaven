import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  NAME: '@safehaven:name',
  CODEWORDS: '@safehaven:codewords',
  PAIRING_ID: '@safehaven:pairingId',
};

const DEFAULT_CODEWORDS = { TIER1: 'sunny', TIER2: 'cloudy', TIER3: 'storm' };

function generatePairingId() {
  const pubkey = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const encKey = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
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
      id = generatePairingId();
      await AsyncStorage.setItem(KEYS.PAIRING_ID, id);
    }

    return { name: name || '', codewords, pairingId: id };
  } catch {
    return { name: '', codewords: DEFAULT_CODEWORDS, pairingId: generatePairingId() };
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
