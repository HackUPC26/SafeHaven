import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc'
import { SIGNAL_WS } from './config'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const s = {
  ws: null,
  pc: null,
  token: null,
  onState: null,
  onStream: null,
  active: false,
  reconnectTimer: null,
  reconnectDelay: 2000,
}

export function startReceiving(token, onState, onStream) {
  s.token = token
  s.onState = onState
  s.onStream = onStream
  s.active = true
  s.reconnectDelay = 2000
  _connect()
}

export function stopReceiving() {
  s.active = false
  clearTimeout(s.reconnectTimer)
  _cleanup()
  s.onState?.('idle')
}

function _setState(state) {
  console.log('[receive]', state)
  s.onState?.(state)
}

function _connect() {
  if (!s.active) return
  _setState('connecting')

  const url = `${SIGNAL_WS}/ws?role=receiver&token=${encodeURIComponent(s.token)}`
  s.ws = new WebSocket(url)

  s.ws.onopen = () => {
    s.reconnectDelay = 2000
    _setState('waiting')
    _setupPC()
  }

  s.ws.onmessage = async (e) => {
    let msg
    try { msg = JSON.parse(e.data) } catch { return }

    if (msg.type === 'offer') {
      try {
        await s.pc?.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }))
        const answer = await s.pc.createAnswer()
        await s.pc.setLocalDescription(answer)
        _send({ type: 'answer', sdp: answer.sdp })
      } catch (err) {
        console.error('[receive] offer handling:', err)
      }
    } else if (msg.type === 'ice-candidate' && msg.candidate) {
      try { await s.pc?.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch {}
    } else if (msg.type === 'peer-disconnected') {
      s.onStream?.(null)
      _setState('waiting')
    }
  }

  s.ws.onerror = (e) => console.error('[receive] ws error:', e.message ?? e)

  s.ws.onclose = () => {
    if (!s.active) return
    _setState('reconnecting')
    s.reconnectTimer = setTimeout(() => {
      s.reconnectDelay = Math.min(s.reconnectDelay * 1.5, 30000)
      _connect()
    }, s.reconnectDelay)
  }
}

function _setupPC() {
  if (s.pc) { try { s.pc.close() } catch {} s.pc = null }

  s.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

  s.pc.onicecandidate = ({ candidate }) => {
    if (candidate && s.ws?.readyState === WebSocket.OPEN) {
      _send({ type: 'ice-candidate', candidate })
    }
  }

  s.pc.ontrack = (event) => {
    const stream = event.streams[0]
    if (stream) {
      s.onStream?.(stream)
      _setState('streaming')
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

function _send(obj) {
  if (s.ws?.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify(obj))
}

function _cleanup() {
  s.onStream?.(null)
  try { s.pc?.close() } catch {}
  s.pc = null
  try { s.ws?.close() } catch {}
  s.ws = null
}
