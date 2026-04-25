// Actual app
// Tier 0 = nothing happening, app looks like a normal weather app
// Tier 1 = incident started, recording audio + sending GPS
// Tier 2 = escalated, now also recording video
// Tier 3 = emergency, receiver sees a big "call for help" button

import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput } from 'react-native';

const CODEWORDS = { TIER1: 'sunny', TIER2: 'cloudy', TIER3: 'storm' };

export default function App() {
  const [tier, setTier] = useState(0);

  function activate() {
    if (tier === 0) setTier(1);
  }

  function checkCodeword(text) {
    const word = text.toLowerCase().trim();
    if (word === CODEWORDS.TIER1 && tier === 0) setTier(1);
    if (word === CODEWORDS.TIER2 && tier === 1) setTier(2);
    if (word === CODEWORDS.TIER3 && tier === 2) setTier(3);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.city}>Barcelona</Text>
      <Text style={styles.temp}>22°C</Text>
      <Text style={styles.description}>Partly Cloudy</Text>

      <TextInput
        style={styles.hiddenInput}
        onChangeText={checkCodeword}
        placeholder="Search weather..."
        placeholderTextColor="rgba(255,255,255,0.5)"
      />

      <Pressable style={styles.hiddenTrigger} onPress={activate} />

      {tier > 0 && (
        <View style={[styles.dot, tier === 3 ? styles.dotRed : styles.dotOrange]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#87CEEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  city:        { fontSize: 32, color: 'white', fontWeight: '300' },
  temp:        { fontSize: 80, color: 'white', fontWeight: '200' },
  description: { fontSize: 18, color: 'white', opacity: 0.8 },
  hiddenInput: {
    marginTop: 40,
    color: 'white',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    width: 160,
    textAlign: 'center',
    fontSize: 14,
  },
  hiddenTrigger: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 80, height: 80,
  },
  dot: {
    position: 'absolute',
    top: 60, right: 20,
    width: 8, height: 8,
    borderRadius: 4,
  },
  dotOrange: { backgroundColor: 'orange' },
  dotRed:    { backgroundColor: 'red' },
});
