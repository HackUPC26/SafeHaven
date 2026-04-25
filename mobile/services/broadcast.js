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
  pc: null,
  stream: null,
  token: null,
  onState: null,
  active: false,
  reconnectTimer: null,
  reconnectDelay: 2000,
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startBroadcast(token, onState) {
  s.token = token
  s.onState = onState
  s.active = true
  s.reconnectDelay = 2000
  _connect()
}

export function stopBroadcast() {
  s.active = false
  clearTimeout(s.reconnectTimer)
  _cleanup()
  s.onState?.('idle')
}

export function getLocalStream() {
  return s.stream
}

// ─── Signaling connection ─────────────────────────────────────────────────────

function _connect() {
  if (!s.active) return
  _setState('connecting')

  s.ws = new WebSocket(
    `${SIGNAL_WS}/ws?role=sender&token=${encodeURIComponent(s.token)}`
  )

  s.ws.onopen = async () => {
    s.reconnectDelay = 2000
    // Acquire media right away — camera opens before any receiver joins so
    // there is zero extra latency once the receiver connects.
    const ok = await _acquireMedia()
    if (ok) _setState('ready')
  }

  s.ws.onmessage = async (e) => {
    let msg
    try { msg = JSON.parse(e.data) } catch { return }

    switch (msg.type) {
      case 'receiver-joined':
        // A receiver has connected using our token — set up the peer
        // connection and push an offer immediately.
        _setupPC()
        await _createOffer()
        break

      case 'answer':
        try {
          await s.pc?.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: msg.sdp })
          )
        } catch (err) {
          console.error('[broadcast] setRemoteDescription:', err)
        }
        break

      case 'ice-candidate':
        if (msg.candidate) {
          try { await s.pc?.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch {}
        }
        break

      case 'peer-disconnected':
        // Receiver left; go back to ready so the next receiver can join
        // without the sender needing to do anything.
        try { s.pc?.close() } catch {}
        s.pc = null
        _setState('ready')
        break
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

// ─── WebRTC peer connection ───────────────────────────────────────────────────

function _setupPC() {
  if (s.pc) { try { s.pc.close() } catch {} s.pc = null }

  s.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

  // Add already-acquired tracks — no getUserMedia delay here
  s.stream?.getTracks().forEach(track => s.pc.addTrack(track, s.stream))

  s.pc.onicecandidate = ({ candidate }) => {
    if (candidate && s.ws?.readyState === WebSocket.OPEN) {
      _send({ type: 'ice-candidate', candidate })
    }
  }

  s.pc.onconnectionstatechange = () => {
    const cs = s.pc?.connectionState
    if (cs === 'connected')    _setState('streaming')
    if (cs === 'disconnected') _setState('reconnecting')
    if (cs === 'failed') {
      try { s.pc.close() } catch {}
      s.pc = null
      clearTimeout(s.reconnectTimer)
      s.reconnectTimer = setTimeout(_connect, 2000)
      _setState('reconnecting')
    }
  }
}

async function _createOffer() {
  if (!s.pc) return
  try {
    const offer = await s.pc.createOffer()
    await s.pc.setLocalDescription(offer)
    _send({ type: 'offer', sdp: offer.sdp })
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
  try { s.pc?.close() } catch {}
  s.pc = null
  try { s.ws?.close() } catch {}
  s.ws = null
}
