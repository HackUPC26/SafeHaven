import { useState, useEffect, useRef } from 'react'
import {
  StyleSheet, Text, View, Pressable, TextInput,
  Clipboard, Alert, SafeAreaView,
} from 'react-native'
import { RTCView } from 'react-native-webrtc'
import * as Location from 'expo-location'
import { startBroadcast, stopBroadcast, getLocalStream } from './services/broadcast'
import { startReceiving, stopReceiving } from './services/receive'
import { SIGNAL_HTTP } from './services/config'
import {
  ping as workletPing,
  getPubkey as workletGetPubkey,
  getLength as workletGetLength,
  appendEntry as workletAppendEntry,
  joinSwarm as workletJoinSwarm,
} from './services/worklet-rpc'

const CODEWORDS = { TIER1: 'sunny', TIER2: 'cloudy', TIER3: 'storm' }

function generateToken() {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

// Stable token for this app session
const SESSION_TOKEN = generateToken()

const BROADCAST_LABELS = {
  idle:               null,
  connecting:         'Starting…',
  ready:              'Ready — share invite',
  streaming:          '● Live',
  reconnecting:       'Reconnecting…',
  'permission-error': 'Camera/mic denied',
}

const RECEIVE_LABELS = {
  idle:        'Waiting…',
  connecting:  'Connecting…',
  waiting:     'Waiting for sender…',
  streaming:   '● Live',
  reconnecting:'Reconnecting…',
}

export default function App() {
  const [tier, setTier]                     = useState(0)
  const [broadcastState, setBroadcastState] = useState('idle')
  const [localStreamUrl, setLocalStreamUrl] = useState(null)

  // Receiver mode state
  const [receiverMode, setReceiverMode]       = useState(false)
  const [receiveState, setReceiveState]       = useState('idle')
  const [remoteStreamUrl, setRemoteStreamUrl] = useState(null)

  const locationRef = useRef(null)

  // Boot the Bare worklet and log its pubkey so a receiver can tail it
  useEffect(() => {
    (async () => {
      try {
        await workletPing()
        const pubkey = await workletGetPubkey()
        console.log('[worklet] core pubkey:', pubkey)
        const length = await workletGetLength()
        console.log('[worklet] core length:', length)
      } catch (err) {
        console.error('[worklet] boot failed:', err)
      }
    })()
  }, [])

  // Join the Hyperswarm DHT once an incident is open
  useEffect(() => {
    if (tier < 1) return
    workletJoinSwarm()
      .then((topic) => console.log('[worklet] swarm joined topic:', topic))
      .catch((err) => console.error('[worklet] joinSwarm failed:', err))
  }, [tier >= 1])

  // Start/stop broadcast based on tier
  useEffect(() => {
    if (tier >= 1) {
      startBroadcast(SESSION_TOKEN, (state) => {
        setBroadcastState(state)
        // Show camera preview as soon as media is acquired (ready state)
        if (state === 'ready' || state === 'streaming') {
          const stream = getLocalStream()
          setLocalStreamUrl(stream ? stream.toURL() : null)
        }
        if (state === 'idle') setLocalStreamUrl(null)
      })
    } else {
      stopBroadcast()
      setBroadcastState('idle')
      setLocalStreamUrl(null)
    }
  }, [tier >= 1])  // re-runs only when crossing the 0/1 boundary

  // GPS tracking at tier 1+
  useEffect(() => {
    if (tier >= 1) startGPS()
    else           stopGPS()
  }, [tier])

  function logEvent(event) {
    workletAppendEntry({ ...event, ts: new Date().toISOString() })
      .catch((err) => console.error('[worklet] append failed:', err))
  }

  function activate() {
    if (tier === 0) { setTier(1); logEvent({ event_type: 'incident_opened', tier: 1 }) }
  }

  function checkCodeword(text) {
    const word = text.toLowerCase().trim()

    // Hidden receiver mode: type "recv:<token>" to watch a sender's stream
    if (word.startsWith('recv:')) {
      // Strip any angle brackets the user may have copied with the token display
      const token = word.slice(5).trim().replace(/[<>[\]{}'"\s]/g, '')
      if (token) {
        setReceiverMode(true)
        setReceiveState('connecting')
        startReceiving(token, setReceiveState, (stream) => {
          setRemoteStreamUrl(stream ? stream.toURL() : null)
        })
      }
      return
    }

    if (word === CODEWORDS.TIER1 && tier === 0) { setTier(1); logEvent({ event_type: 'tier_changed', tier: 1 }) }
    if (word === CODEWORDS.TIER2 && tier === 1) { setTier(2); logEvent({ event_type: 'tier_changed', tier: 2 }) }
    if (word === CODEWORDS.TIER3 && tier === 2) { setTier(3); logEvent({ event_type: 'tier_changed', tier: 3 }) }
  }

  function exitReceiverMode() {
    stopReceiving()
    setReceiverMode(false)
    setRemoteStreamUrl(null)
    setReceiveState('idle')
  }

  async function startGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    locationRef.current = await Location.watchPositionAsync(
      { timeInterval: 5000, distanceInterval: 5 },
      (loc) => logEvent({ event_type: 'gps_update', lat: loc.coords.latitude, lng: loc.coords.longitude }),
    )
  }

  function stopGPS() {
    locationRef.current?.remove()
    locationRef.current = null
  }

  const inviteUrl = `${SIGNAL_HTTP}/#${SESSION_TOKEN}`

  function copyInvite() {
    Clipboard.setString(inviteUrl)
    Alert.alert('Copied', 'Paste the URL in a browser to receive the stream.')
  }

  // ── Receiver mode: full-screen view ───────────────────────────────────────
  if (receiverMode) {
    const isStreaming = receiveState === 'streaming'
    return (
      <View style={styles.receiverContainer}>
        {remoteStreamUrl
          ? <RTCView streamURL={remoteStreamUrl} style={StyleSheet.absoluteFill} objectFit="cover" />
          : (
            <View style={styles.receiverPlaceholder}>
              <Text style={styles.receiverPlaceholderText}>
                {RECEIVE_LABELS[receiveState] ?? receiveState}
              </Text>
            </View>
          )
        }

        {/* Status badge */}
        <View style={[styles.receiverBadge, isStreaming && styles.receiverBadgeLive]}>
          <Text style={styles.receiverBadgeText}>
            {RECEIVE_LABELS[receiveState] ?? receiveState}
          </Text>
        </View>

        {/* Close button */}
        <Pressable style={styles.receiverClose} onPress={exitReceiverMode}>
          <Text style={styles.receiverCloseText}>✕</Text>
        </Pressable>
      </View>
    )
  }
  // ──────────────────────────────────────────────────────────────────────────

  const label = BROADCAST_LABELS[broadcastState]
  const isLive = broadcastState === 'streaming'

  return (
    <View style={styles.container}>
      {/* Weather disguise UI */}
      <Text style={styles.city}>Barcelona</Text>
      <Text style={styles.temp}>22°C</Text>
      <Text style={styles.description}>Partly Cloudy</Text>

      <TextInput
        style={styles.hiddenInput}
        onChangeText={checkCodeword}
        placeholder="Search weather…"
        placeholderTextColor="rgba(255,255,255,0.5)"
      />

      <Pressable style={styles.hiddenTrigger} onPress={activate} />

      {/* Tier dot indicator */}
      {tier > 0 && (
        <View style={[styles.dot, tier === 3 ? styles.dotRed : styles.dotOrange]} />
      )}

      {/* Broadcast status overlay — only visible when active */}
      {tier >= 1 && label && (
        <View style={[styles.broadcastBadge, isLive && styles.broadcastLive]}>
          <Text style={styles.broadcastText}>{label}</Text>
        </View>
      )}

      {/* Live camera preview — small corner thumbnail when broadcasting */}
      {localStreamUrl && (
        <RTCView
          streamURL={localStreamUrl}
          style={styles.cameraPreview}
          objectFit="cover"
          mirror={false}
          zOrder={1}
        />
      )}

      {/* Invite URL — shown when broadcast is active */}
      {tier >= 1 && (
        <Pressable style={styles.inviteBox} onPress={copyInvite}>
          <Text style={styles.inviteLabel}>TAP TO COPY INVITE LINK</Text>
          <Text style={styles.inviteToken} numberOfLines={1}>{SESSION_TOKEN}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#87CEEB',
    alignItems: 'center', justifyContent: 'center',
  },
  city:        { fontSize: 32, color: 'white', fontWeight: '300' },
  temp:        { fontSize: 80, color: 'white', fontWeight: '200' },
  description: { fontSize: 18, color: 'white', opacity: 0.8 },
  hiddenInput: {
    marginTop: 40, color: 'white',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)',
    width: 160, textAlign: 'center', fontSize: 14,
  },
  hiddenTrigger: {
    position: 'absolute', bottom: 0, right: 0, width: 80, height: 80,
  },
  dot: {
    position: 'absolute', top: 60, right: 20, width: 8, height: 8, borderRadius: 4,
  },
  dotOrange: { backgroundColor: 'orange' },
  dotRed:    { backgroundColor: 'red' },

  broadcastBadge: {
    position: 'absolute', top: 60, left: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  broadcastLive: { backgroundColor: 'rgba(220,38,38,0.75)' },
  broadcastText: { color: 'white', fontSize: 12, fontWeight: '600' },

  inviteBox: {
    position: 'absolute', bottom: 32,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, alignItems: 'center',
    maxWidth: '80%',
  },
  inviteLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: 1 },
  inviteToken: { color: 'white', fontFamily: 'monospace', fontSize: 12, marginTop: 2 },

  cameraPreview: {
    position: 'absolute', bottom: 100, right: 16,
    width: 90, height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },

  // Receiver mode
  receiverContainer: {
    flex: 1, backgroundColor: '#000',
  },
  receiverPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  receiverPlaceholderText: {
    color: 'rgba(255,255,255,0.4)', fontSize: 16,
  },
  receiverBadge: {
    position: 'absolute', top: 56, left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12,
  },
  receiverBadgeLive: { backgroundColor: 'rgba(220,38,38,0.8)' },
  receiverBadgeText: { color: 'white', fontSize: 13, fontWeight: '600' },
  receiverClose: {
    position: 'absolute', top: 52, right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  receiverCloseText: { color: 'white', fontSize: 16, fontWeight: '700' },
})
