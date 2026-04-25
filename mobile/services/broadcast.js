import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  registerGlobals,
} from 'react-native-webrtc'
import { Camera } from 'expo-camera'
import { SIGNAL_WS } from './config'

registerGlobals()

// States (in order of progression):
//   connecting  → signaling WS being opened
//   ready       → media acquired, waiting for a receiver to join
//   streaming   → WebRTC connected, media flowing
//   reconnecting→ transient failure, will retry
//   permission-error → camera/mic denied (terminal until app restart)

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const s = {
  ws: null,
  pcs: new Map(), // peerId -> RTCPeerConnection (one per viewer)
  stream: null,
  token: null,
  onState: null,
  active: false,
  reconnectTimer: null,
  reconnectDelay: 2000,
  // Events emitted while the WS is still connecting are buffered here and
  // flushed on open. Without this, the very first tier_changed (e.g. tier 1)
  // is lost because broadcast() is started by the same render that fires the
  // event — the WS hasn't even been constructed yet.
  pending: [],
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function startBroadcast(token, onState) {
  // Idempotent: a re-entry with the same token (e.g. tier 2 → 3) must not
  // open a second sender socket — the signaling server kicks the previous
  // one for that role, which then races its own reconnect timer.
  if (s.active && s.token === token) {
    if (onState) s.onState = onState
    return
  }
  if (s.active) _cleanup()
  s.token = token
  s.onState = onState
  s.active = true
  s.reconnectDelay = 2000
  // Acquire media BEFORE opening the WS so we never race with `receiver-joined`
  // arriving while getUserMedia is still pending. (Previously the first viewer
  // of a fresh sender got an offer with zero tracks.)
  _setState('connecting')
  await _acquireMedia()
  if (!s.active) return
  _connect()
}

export function stopBroadcast() {
  s.active = false
  clearTimeout(s.reconnectTimer)
  s.pending = []
  _cleanup()
  s.onState?.('idle')
}

export function getLocalStream() {
  return s.stream
}

// Event channel piggybacked on the sender's signaling WS. The signaling
// server fans these out to every receiver in the room. Used by the bridge
// to surface tier/GPS/AI events on the demo viewer in real time — Hypercore
// is still the source of truth (event log), this is the live UX channel.
//
// Events emitted while the WS is connecting (or briefly between reconnects)
// are buffered and flushed on the next open — without this, the event that
// triggered the broadcast in the first place (e.g. tier 1 incident_opened)
// is lost because it fires synchronously with the React state change.
export function sendEvent(payload) {
  const msg = JSON.stringify({ type: 'event', payload })
  if (s.ws?.readyState === WebSocket.OPEN) {
    s.ws.send(msg)
    return true
  }
  if (s.active) {
    s.pending.push(msg)
    return true
  }
  return false
}

// ─── Signaling connection ─────────────────────────────────────────────────────

function _connect() {
  if (!s.active) return
  _setState('connecting')

  s.ws = new WebSocket(
    `${SIGNAL_WS}/ws?role=sender&token=${encodeURIComponent(s.token)}`
  )

  s.ws.onopen = () => {
    s.reconnectDelay = 2000
    // Media was already acquired in startBroadcast(). If it failed back then
    // we wouldn't have a stream — surface that as permission-error.
    if (!s.stream) { _setState('permission-error'); return }
    _setState('ready')
    // Flush any events buffered while the WS was opening (or while we were
    // briefly between reconnects). This is the path that delivers tier 1's
    // incident_opened to the viewer.
    if (s.pending.length) {
      for (const msg of s.pending) s.ws.send(msg)
      s.pending = []
    }
  }

  s.ws.onmessage = async (e) => {
    let msg
    try { msg = JSON.parse(e.data) } catch { return }
    const { peerId } = msg

    switch (msg.type) {
      case 'receiver-joined':
        // A new viewer joined under this peerId — set up a dedicated PC and
        // push an offer just to them. Other viewers are unaffected.
        if (peerId) await _setupPeer(peerId)
        break

      case 'answer': {
        const pc = peerId && s.pcs.get(peerId)
        if (!pc) break
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }))
        } catch (err) {
          console.error('[broadcast] setRemoteDescription:', err)
        }
        break
      }

      case 'ice-candidate': {
        const pc = peerId && s.pcs.get(peerId)
        if (pc && msg.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch {}
        }
        break
      }

      case 'peer-disconnected': {
        const pc = peerId && s.pcs.get(peerId)
        if (pc) { try { pc.close() } catch {} }
        if (peerId) s.pcs.delete(peerId)
        if (s.pcs.size === 0) _setState('ready')
        break
      }
    }
  }

  s.ws.onerror = (e) => console.error('[broadcast] ws error:', e.message ?? e)

  s.ws.onclose = () => {
    if (!s.active) return
    _setState('reconnecting')
    s.reconnectTimer = setTimeout(() => {
      s.reconnectDelay = Math.min(s.reconnectDelay * 1.5, 30000)
      _connect()
    }, s.reconnectDelay)
  }
}

// ─── Media acquisition ────────────────────────────────────────────────────────

async function _acquireMedia() {
  if (s.stream) return true

  const camPerm = await Camera.requestCameraPermissionsAsync()
  const micPerm = await Camera.requestMicrophonePermissionsAsync()
  console.log('[broadcast] cam:', camPerm.status, 'mic:', micPerm.status)

  if (camPerm.status !== 'granted' || micPerm.status !== 'granted') {
    console.error('[broadcast] permissions not granted', { cam: camPerm.status, mic: micPerm.status })
    _setState('permission-error')
    return false
  }

  try {
    s.stream = await mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: 'user' },
    })
    return true
  } catch (err) {
    console.error('[broadcast] getUserMedia failed:', err)
    // Graceful fallback: stream audio only if camera is unavailable
    try {
      s.stream = await mediaDevices.getUserMedia({ audio: true, video: false })
      console.warn('[broadcast] audio-only fallback active')
      return true
    } catch (err2) {
      console.error('[broadcast] audio-only fallback also failed:', err2)
      _setState('permission-error')
      return false
    }
  }
}

// ─── WebRTC peer connection (one per viewer) ──────────────────────────────────

async function _setupPeer(peerId) {
  // Tear down any prior PC for this peer (e.g. they reconnected).
  const prev = s.pcs.get(peerId)
  if (prev) { try { prev.close() } catch {} }

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  s.pcs.set(peerId, pc)

  s.stream?.getTracks().forEach(track => pc.addTrack(track, s.stream))

  pc.onicecandidate = ({ candidate }) => {
    if (candidate && s.ws?.readyState === WebSocket.OPEN) {
      _send({ type: 'ice-candidate', peerId, candidate })
    }
  }

  pc.onconnectionstatechange = () => {
    const cs = pc.connectionState
    if (cs === 'connected') _setState('streaming')
    if (cs === 'failed') {
      try { pc.close() } catch {}
      s.pcs.delete(peerId)
      if (s.pcs.size === 0) _setState('ready')
    }
  }

  try {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    _send({ type: 'offer', peerId, sdp: offer.sdp })
  } catch (err) {
    console.error('[broadcast] createOffer:', err)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _send(obj) {
  if (s.ws?.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify(obj))
}

function _setState(state) {
  console.log('[broadcast]', state)
  s.onState?.(state)
}

function _cleanup() {
  try { s.stream?.getTracks().forEach(t => t.stop()) } catch {}
  s.stream = null
  for (const pc of s.pcs.values()) { try { pc.close() } catch {} }
  s.pcs.clear()
  try { s.ws?.close() } catch {}
  s.ws = null
}
