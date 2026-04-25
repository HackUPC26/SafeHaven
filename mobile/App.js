// Tier 0 = inactive, 1 = audio+GPS, 2 = video, 3 = emergency

import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { connect, send } from './services/bridge';
import { loadSettings } from './services/settings';
import { startBroadcast, stopBroadcast } from './services/broadcast';
import SettingsScreen from './screens/SettingsScreen';

const DEFAULT_CODEWORDS = { TIER1: 'sunny', TIER2: 'cloudy', TIER3: 'stormy' };

const HOURS = [
  {t:'Now',i:'☀️',c:22},{t:'13h',i:'🌤',c:23},{t:'14h',i:'⛅',c:23},
  {t:'15h',i:'🌥',c:21},{t:'16h',i:'⛅',c:20},{t:'17h',i:'☀️',c:20},
  {t:'18h',i:'🌇',c:18},{t:'19h',i:'🌙',c:16},
];

const DAYS = [
  {d:'Today',i:'☀️',lo:15,hi:23},{d:'Wed',i:'🌤',lo:14,hi:22},
  {d:'Thu',i:'⛅',lo:13,hi:20},{d:'Fri',i:'🌧',lo:12,hi:17},
  {d:'Sat',i:'🌦',lo:14,hi:19},{d:'Sun',i:'☀️',lo:16,hi:24},
  {d:'Mon',i:'☀️',lo:17,hi:26},{d:'Tue',i:'🌤',lo:15,hi:24},
];

// hold-press hook — fires onFire after durationMs, shows progress 0→1
function useHold(onFire, durationMs = 3000) {
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const anim = useRef(null);

  function begin() {
    anim.current = Animated.timing(progress, {
      toValue: 1, duration: durationMs, useNativeDriver: false,
    });
    anim.current.start();
    timer.current = setTimeout(() => {
      progress.setValue(0);
      onFire();
    }, durationMs);
  }

  function cancel() {
    clearTimeout(timer.current);
    if (anim.current) anim.current.stop();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  return { progress, begin, cancel };
}

export default function App() {
  const [tier, setTier] = useState(0);
  const [sent, setSent] = useState(false);
  const [settings, setSettings] = useState({ name: '', codewords: DEFAULT_CODEWORDS, pairingId: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const locationRef = useRef(null);

  useEffect(() => {
    connect();
    loadSettings().then(s => setSettings(s));
  }, []);

  // SOS trigger — hold H/L row 3s
  const sos = useHold(() => {
    setSent(true);
    setTimeout(() => setSent(false), 1200);
    if (tier === 0) {
      setTier(1);
      send({ event_type: 'incident_opened', tier: 1 });
    }
  }, 3000);

  useEffect(() => {
    if (tier >= 1) startGPS();
    if (tier === 0) stopGPS();
  }, [tier]);

  // Silent broadcast: starts at tier ≥ 1 (audio + video tracks; the receiver
  // PWA decides what to render). No UI surface — disguise stays intact.
  // Token = pubkey portion of pairingId so the receiver page's existing
  // /#<token> flow works unchanged.
  useEffect(() => {
    if (!settings.pairingId) return;
    const token = settings.pairingId.split(':')[0];
    if (tier >= 1) startBroadcast(token);
    else stopBroadcast();
  }, [tier >= 1, settings.pairingId]);

  function checkCodeword(text) {
    const word = text.toLowerCase().trim();
    const cw = settings.codewords;
    if (word === cw.TIER1 && tier === 0) { setTier(1); send({ event_type: 'tier_changed', tier: 1 }); }
    if (word === cw.TIER2 && tier === 1) { setTier(2); send({ event_type: 'tier_changed', tier: 2 }); }
    if (word === cw.TIER3 && tier === 2) { setTier(3); send({ event_type: 'tier_changed', tier: 3 }); }
  }

  async function startGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    locationRef.current = await Location.watchPositionAsync(
      { timeInterval: 5000, distanceInterval: 5 },
      (loc) => send({ event_type: 'gps_update', lat: loc.coords.latitude, lng: loc.coords.longitude })
    );
  }

  function stopGPS() {
    if (locationRef.current) { locationRef.current.remove(); locationRef.current = null; }
  }

  function handleSettingsClose(opts) {
    setSettingsOpen(false);
    if (opts?.reset) {
      loadSettings().then(s => setSettings(s));
    }
  }

  const bgColor = sos.progress.interpolate({ inputRange: [0, 1], outputRange: ['transparent', 'rgba(255,255,255,0.15)'] });

  return (
    <>
      <LinearGradient colors={['#1a6da8','#3a9fd6','#6ac4ee','#a8dff5']} style={styles.flex}>
        <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
          <View style={styles.topPad} />

          {/* City + temp — long-press 2s opens hidden settings */}
          <View style={styles.center}>
            <Pressable onLongPress={() => setSettingsOpen(true)} delayLongPress={2000}>
              <Text style={styles.city}>Barcelona</Text>
            </Pressable>
            <Text style={styles.temp}>22°</Text>
            <Text style={styles.desc}>Mostly Sunny</Text>

            {/* H/L row — SOS trigger (hold 3s) */}
            <Animated.View style={[styles.hlRow, { backgroundColor: bgColor }]}>
              <Pressable
                onPressIn={sos.begin}
                onPressOut={sos.cancel}
                style={styles.hlPressable}
              >
                <Text style={styles.hlText}>H:24°  L:15°</Text>
              </Pressable>
            </Animated.View>
          </View>

          {/* tiny status dot */}
          {tier > 0 && (
            <View style={[styles.dot, tier === 3 ? styles.dotRed : styles.dotOrange]} />
          )}

          {/* silent sent flash */}
          {sent && <View style={styles.sentFlash} />}

          {/* hidden codeword input */}
          <TextInput
            style={styles.hiddenInput}
            onChangeText={checkCodeword}
            placeholder="Search weather..."
            placeholderTextColor="rgba(255,255,255,0.4)"
          />

          {/* hourly strip */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>UV INDEX 6 · FEELS LIKE 24°</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {HOURS.map((h, i) => (
                <View key={i} style={styles.hourItem}>
                  <Text style={styles.hourTime}>{h.t}</Text>
                  <Text style={styles.hourIcon}>{h.i}</Text>
                  <Text style={styles.hourTemp}>{h.c}°</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* 10-day */}
          <View style={[styles.card, styles.mt12]}>
            <Text style={styles.cardLabel}>10-DAY FORECAST</Text>
            {DAYS.map((d, i) => (
              <View key={i} style={[styles.dayRow, i > 0 && styles.dayBorder]}>
                <Text style={styles.dayName}>{d.d}</Text>
                <Text style={styles.dayIcon}>{d.i}</Text>
                <Text style={styles.dayLo}>{d.lo}°</Text>
                <View style={styles.dayBar} />
                <Text style={styles.dayHi}>{d.hi}°</Text>
              </View>
            ))}
          </View>

          {/* extra cards grid */}
          <View style={styles.grid}>
            {[['HUMIDITY','62%','Dew point 14°'],['VISIBILITY','24 km','Perfectly clear'],
              ['WIND','14 km/h','NE — sea breeze'],['UV INDEX','6','High. Wear sunscreen']].map(([l,v,s],i)=>(
              <View key={i} style={styles.miniCard}>
                <Text style={styles.miniLabel}>{l}</Text>
                <Text style={styles.miniVal}>{v}</Text>
                <Text style={styles.miniSub}>{s}</Text>
              </View>
            ))}
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </LinearGradient>

      {settingsOpen && (
        <SettingsScreen
          visible={settingsOpen}
          onClose={handleSettingsClose}
          settings={settings}
          onSettingsChange={updated => setSettings(prev => ({ ...prev, ...updated }))}
        />
      )}
    </>
  );
}

const glass = {
  backgroundColor: 'rgba(255,255,255,0.18)',
  borderRadius: 18,
  borderWidth: 0.5,
  borderColor: 'rgba(255,255,255,0.3)',
};

const styles = StyleSheet.create({
  flex:        { flex: 1 },
  topPad:      { height: 60 },
  bottomPad:   { height: 48 },
  center:      { alignItems: 'center' },
  city:        { fontSize: 34, fontWeight: '600', color: 'white' },
  temp:        { fontSize: 96, fontWeight: '200', color: 'white', lineHeight: 100 },
  desc:        { fontSize: 20, color: 'white', opacity: 0.9 },
  hlRow:       { borderRadius: 20, marginTop: 6 },
  hlPressable: { paddingHorizontal: 16, paddingVertical: 6 },
  hlText:      { fontSize: 18, color: 'white', opacity: 0.85 },
  dot:         { position: 'absolute', top: 60, right: 20, width: 8, height: 8, borderRadius: 4 },
  dotOrange:   { backgroundColor: 'orange' },
  dotRed:      { backgroundColor: 'red' },
  sentFlash:   { position: 'absolute', top: '45%', left: '47%', width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,255,120,0.9)' },
  hiddenInput: { alignSelf: 'center', marginTop: 8, width: 160, textAlign: 'center', color: 'white', fontSize: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)' },
  card:        { ...glass, margin: 16, marginBottom: 0, padding: 14 },
  mt12:        { marginTop: 12 },
  cardLabel:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3, marginBottom: 10 },
  hourItem:    { width: 52, alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  hourTime:    { color: 'white', fontSize: 15, opacity: 0.9 },
  hourIcon:    { fontSize: 22 },
  hourTemp:    { color: 'white', fontSize: 15 },
  dayRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dayBorder:   { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.2)' },
  dayName:     { flex: 1, color: 'white', fontSize: 17, fontWeight: '500' },
  dayIcon:     { fontSize: 22, marginRight: 12 },
  dayLo:       { color: 'rgba(255,255,255,0.65)', fontSize: 17, marginRight: 10 },
  dayBar:      { width: 80, height: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.6)', marginRight: 10 },
  dayHi:       { color: 'white', fontSize: 17 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', margin: 10, marginBottom: 0, gap: 10 },
  miniCard:    { ...glass, width: '47%', padding: 14 },
  miniLabel:   { fontSize: 12, color: 'white', opacity: 0.7, letterSpacing: 0.5 },
  miniVal:     { fontSize: 28, fontWeight: '500', color: 'white', marginTop: 4 },
  miniSub:     { fontSize: 13, color: 'white', opacity: 0.75, marginTop: 4 },
});
