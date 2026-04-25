// Actual app 
// Tier 0 = nothing happening, app looks like a normal weather app
// Tier 1 = incident started, recording audio + sending GPS
// Tier 2 = escalated, now also recording video
// Tier 3 = emergency, receiver sees a big "call for help" button

import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

export default function App() {
  const [tier, setTier] = useState(0);
  // Smt to change when user actions
  function activate(){
    if (tier === 0 ) {
      setTier(1);
    }
  }
  return (
  <View style={styles.container}>

  <Text style={styles.city}>Barcelona</Text>
  <Text style={styles.temp}>22°C</Text>
  <Text style={styles.description}>Partly Cloudy</Text>

  <Pressable style={styles.hiddenTrigger} onPress={activate} />

  {tier > 0 && (
    <View style={[styles.dot, tier === 3 ? styles.dotRed : styles.dotOrange]} />
  )}

</View>

  );
}


// CSS in JS
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
