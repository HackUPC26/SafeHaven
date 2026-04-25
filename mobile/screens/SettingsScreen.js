import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { saveSettings, resetSettings } from '../services/settings';
import { SIGNAL_HTTP } from '../services/config';

const CODEWORD_TIERS = [
  {
    key: 'TIER1',
    label: 'Tier 1 — Audio + GPS',
    shortLabel: 'Tier 1',
    suggestions: [
      'I need to check the forecast',
      'Can you check the humidity',
      'The weather is changing',
    ],
  },
  {
    key: 'TIER2',
    label: 'Tier 2 — Video',
    shortLabel: 'Tier 2',
    suggestions: [
      'Should I bring a jacket today',
      'What is the temperature outside',
      'It might rain later',
    ],
  },
  {
    key: 'TIER3',
    label: 'Tier 3 — Emergency',
    shortLabel: 'Tier 3',
    suggestions: [
      'I might need an umbrella later',
      'The wind is picking up',
      'Can you see the storm clouds',
    ],
  },
];

const GOOD_PHRASE_GUIDE = [
  'Sounds completely natural',
  'Could be said to anyone',
  'Not suspicious if overheard',
  'Fits the disguise theme',
];

const AVOID_PHRASES = ['Help me', 'Emergency', 'Call police', 'SOS'];

export default function SettingsScreen({ visible, onClose, settings, onSettingsChange }) {
  const [name, setName] = useState(settings.name);
  const [codewords, setCodewords] = useState({ ...settings.codewords });
  const [saved, setSaved] = useState(false);

  // The receiver browser PWA reads the token from the URL fragment. The
  // sender (broadcast.js) signs into the same token via App.js, which uses
  // the pubkey half of pairingId. Show the URL whole so the operator types
  // it verbatim into a browser — no string slicing required.
  const streamToken = (settings.pairingId || '').split(':')[0];
  const pairingUrl = `${SIGNAL_HTTP}/#${streamToken}`;

  function validateCodewords() {
    const vals = [codewords.TIER1.trim(), codewords.TIER2.trim(), codewords.TIER3.trim()];
    if (vals.some(v => !v)) return 'All three codewords are required.';
    if (new Set(vals).size < 3) return 'Each codeword must be unique.';
    return null;
  }

  async function handleSave() {
    const err = validateCodewords();
    if (err) { Alert.alert('Invalid codewords', err); return; }

    const cleaned = {
      TIER1: codewords.TIER1.trim().toLowerCase(),
      TIER2: codewords.TIER2.trim().toLowerCase(),
      TIER3: codewords.TIER3.trim().toLowerCase(),
    };
    await saveSettings({ name: name.trim(), codewords: cleaned });
    onSettingsChange({ name: name.trim(), codewords: cleaned });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleCopyLink() {
    await Clipboard.setStringAsync(pairingUrl);
    Alert.alert('Copied', 'Pairing link copied to clipboard.');
  }

  function handleSuggestionSelect(key, phrase) {
    setCodewords(prev => ({ ...prev, [key]: phrase }));
  }

  function handleReset() {
    Alert.alert(
      'Reset SafeHaven',
      'This will erase all settings and regenerate your pairing key. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive', onPress: async () => {
            await resetSettings();
            onClose({ reset: true });
          },
        },
      ],
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>SafeHaven</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Identity */}
            <Section title="IDENTITY">
              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name (shown to receiver)"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
              />
            </Section>

            {/* Trigger Words */}
            <Section title="TRIGGER WORDS">
              <Text style={styles.hint}>Type these into the search bar to escalate the alert tier.</Text>
              {CODEWORD_TIERS.map(({ key, label }) => (
                <View key={key} style={styles.codewordRow}>
                  <Text style={styles.codewordLabel}>{label}</Text>
                  <TextInput
                    style={[styles.input, styles.codewordInput]}
                    value={codewords[key]}
                    onChangeText={v => setCodewords(prev => ({ ...prev, [key]: v }))}
                    placeholder={`word for ${key.toLowerCase()}`}
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
              <CodewordGuide codewords={codewords} onSelect={handleSuggestionSelect} />
            </Section>

            {/* Pairing */}
            <Section title="TRUSTED CONTACT PAIRING">
              <Text style={styles.hint}>Share this QR code or link with your trusted contact to connect them to your dashboard.</Text>
              <View style={styles.qrWrap}>
                <QRCode
                  value={pairingUrl}
                  size={180}
                  color={colors.text}
                  backgroundColor={colors.cardBg}
                />
              </View>
              <Text selectable style={styles.tokenText}>{pairingUrl}</Text>
            </Section>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, saved && styles.saveBtnSaved]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save Settings'}</Text>
            </TouchableOpacity>

            {/* Danger */}
            <Section title="DANGER ZONE">
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>Reset Setup</Text>
              </TouchableOpacity>
            </Section>

            <View style={{ height: 48 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function CodewordGuide({ codewords, onSelect }) {
  return (
    <View style={styles.guideWrap}>
      <Text style={styles.guideEyebrow}>SUGGESTIONS - tap to select</Text>
      {CODEWORD_TIERS.map(({ key, shortLabel, suggestions }) => (
        <View key={key} style={styles.suggestionGroup}>
          <Text style={styles.suggestionTier}>{shortLabel}</Text>
          {suggestions.map(phrase => {
            const selected = codewords[key]?.trim().toLowerCase() === phrase.toLowerCase();
            return (
              <TouchableOpacity
                key={phrase}
                style={[styles.suggestionPill, selected && styles.suggestionPillSelected]}
                onPress={() => onSelect(key, phrase)}
                activeOpacity={0.75}
              >
                <Text style={[styles.suggestionText, selected && styles.suggestionTextSelected]}>
                  &quot;{phrase}&quot;
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.guideColumns}>
        <View style={[styles.guideCard, styles.goodGuideCard]}>
          <Text style={[styles.guideCardTitle, styles.goodGuideTitle]}>✓ GOOD PHRASES</Text>
          {GOOD_PHRASE_GUIDE.map(item => (
            <Text key={item} style={styles.guideBullet}>· {item}</Text>
          ))}
        </View>
        <View style={[styles.guideCard, styles.avoidGuideCard]}>
          <Text style={[styles.guideCardTitle, styles.avoidGuideTitle]}>× AVOID</Text>
          {AVOID_PHRASES.map(item => (
            <Text key={item} style={styles.avoidPhrase}>&quot;{item}&quot;</Text>
          ))}
        </View>
      </View>

      <View style={styles.privacyNote}>
        <Text style={styles.privacyTitle}>🔒 On-device only</Text>
        <Text style={styles.privacyBody}>
          Voice detection runs entirely on your device. Audio is never recorded, stored, or sent anywhere.
        </Text>
      </View>
    </View>
  );
}

const colors = {
  bg: '#0f1117',
  cardBg: '#1c1f2a',
  border: '#2a2d3a',
  text: '#e8eaf0',
  muted: '#555870',
  mutedText: '#9699a8',
  accent: '#4a90d9',
  accentSoft: '#182541',
  good: '#8df2bf',
  goodBg: '#102323',
  goodBorder: '#24533f',
  danger: '#e05252',
  dangerSoft: '#ff99ad',
  dangerBg: '#201322',
  dangerBorder: '#633044',
  purple: '#a790ff',
  purpleBg: '#17182d',
  purpleBorder: '#3a3566',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: colors.muted },

  section: { marginTop: 28, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', color: colors.muted,
    letterSpacing: 1.2, marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },

  label: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.muted, marginBottom: 14, lineHeight: 19 },

  input: {
    backgroundColor: '#13161f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  codewordRow: { marginBottom: 12 },
  codewordLabel: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  codewordInput: {},

  guideWrap: { marginTop: 8 },
  guideEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  suggestionGroup: { marginBottom: 14 },
  suggestionTier: {
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 8,
    fontWeight: '600',
  },
  suggestionPill: {
    backgroundColor: '#161a25',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  suggestionPillSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  suggestionText: { color: colors.mutedText, fontSize: 14, lineHeight: 19 },
  suggestionTextSelected: { color: '#a9ccff' },
  guideColumns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  guideCard: {
    flex: 1,
    minHeight: 154,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  goodGuideCard: {
    backgroundColor: colors.goodBg,
    borderColor: colors.goodBorder,
  },
  avoidGuideCard: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  guideCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  goodGuideTitle: { color: colors.good },
  avoidGuideTitle: { color: colors.dangerSoft },
  guideBullet: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  avoidPhrase: {
    color: colors.mutedText,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  privacyNote: {
    backgroundColor: colors.purpleBg,
    borderColor: colors.purpleBorder,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  privacyTitle: {
    color: colors.purple,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  privacyBody: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },

  qrWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    marginBottom: 14,
  },
  tokenText: {
    color: colors.text,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    paddingVertical: 8,
  },

  saveBtn: {
    marginHorizontal: 20,
    marginTop: 28,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnSaved: { backgroundColor: '#3aa06a' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  resetBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
