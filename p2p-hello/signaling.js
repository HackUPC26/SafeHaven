import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { networkInterfaces } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 8080

// token -> { sender: WebSocket|null, receivers: Map<peerId, WebSocket> }
//
// Multi-receiver model: one camera (sender), arbitrarily many viewers. Each
// receiver gets its own peerId and its own SDP exchange with the sender.
// Messages flowing sender → server are tagged with peerId and routed to the
// matching receiver; messages flowing receiver → server are auto-tagged with
// that receiver's peerId before being forwarded to the sender.
const rooms = new Map()

function makePeerId() {
  return Math.random().toString(36).slice(2, 10)
}

// Polished receiver UI lives in ../receiver/ (the React PWA). Signaling
// server doubles as its static host so a single port serves both the page
// and the WebRTC signaling WS — the receiver hits /ws on the same origin
// it loaded from.
const STATIC = {
  '/':                  ['../receiver/index.html',        'text/html'],
  '/index.html':        ['../receiver/index.html',        'text/html'],
  '/manifest.json':     ['../receiver/manifest.json',     'application/json'],
  '/sw.js':             ['../receiver/sw.js',             'application/javascript'],
  '/icon.svg':          ['../receiver/icon.svg',          'image/svg+xml'],
  '/icon-maskable.svg': ['../receiver/icon-maskable.svg', 'image/svg+xml'],
  '/sender':            ['sender-demo.html',              'text/html'],
  '/sender.html':       ['sender-demo.html',              'text/html'],
}

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x')

  const entry = STATIC[pathname]
  if (entry) {
    try {
      const [file, ct] = entry
      res.writeHead(200, { 'Content-Type': ct + '; charset=utf-8' })
      res.end(readFileSync(join(__dirname, file)))
    } catch {
      res.writeHead(500); res.end('File read error')
    }
    return
  }

  res.writeHead(404); res.end()
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x')
  const role  = url.searchParams.get('role')
  const token = url.searchParams.get('token')

  // Legacy event bridge (no role/token) — log and accept
  if (!role || !token) {
    ws.on('message', (data) => console.log('[bridge]', data.toString()))
    return
  }

  if (!['sender', 'receiver'].includes(role)) {
    ws.close(4000, 'invalid role'); return
  }

  if (!rooms.has(token)) rooms.set(token, {
    sender: null,
    receivers: new Map(),
    // Cache the latest snapshot of incident state per room so a viewer that
    // joins mid-incident immediately sees current tier + GPS instead of
    // staring at "TIER 0 — Idle" until the next event happens to fire.
    state: { tierEvent: null, gpsEvent: null },
  })
  const room = rooms.get(token)
  const tag = token.slice(0, 8)

  if (role === 'sender') {
    // Only one camera per token. A new sender connecting while one is alive
    // is rejected so the live stream isn't disrupted by accidental dupes.
    if (room.sender?.readyState === 1) {
      console.log(`[${tag}] rejecting duplicate sender`)
      ws.close(4002, 'sender already connected')
      return
    }
    room.sender = ws
    console.log(`[${tag}] sender connected (receivers: ${room.receivers.size})`)

    // Make the sender open a PC for every receiver already in the room
    // (covers the case where the sender briefly dropped and reconnected).
    for (const [peerId, recvWs] of room.receivers) {
      if (recvWs.readyState === 1) {
        ws.send(JSON.stringify({ type: 'receiver-joined', peerId }))
      }
    }

    ws.on('message', (data) => {
      let msg
      try { msg = JSON.parse(data.toString()) } catch { return }
      // Broadcast events (tier/GPS/AI) — go to every receiver, no peerId routing.
      if (msg.type === 'event') {
        // Snapshot the relevant ones so a late-joining viewer can be caught up.
        const ev = msg.payload
        if (ev?.event_type === 'tier_changed' || ev?.event_type === 'incident_opened') {
          room.state.tierEvent = msg
        } else if (ev?.event_type === 'gps_update') {
          room.state.gpsEvent = msg
        }
        const out = JSON.stringify(msg)
        for (const recvWs of room.receivers.values()) {
          if (recvWs.readyState === 1) recvWs.send(out)
        }
        return
      }
      // SDP/ICE — point-to-point routing by peerId.
      const recv = msg.peerId && room.receivers.get(msg.peerId)
      if (recv?.readyState !== 1) return
      const { peerId, ...forward } = msg
      recv.send(JSON.stringify(forward))
    })

    ws.on('close', (code, reason) => {
      console.log(`[${tag}] sender disconnected code=${code} reason=${reason?.toString() || ''}`)
      if (room.sender === ws) room.sender = null
      for (const recvWs of room.receivers.values()) {
        if (recvWs.readyState === 1) {
          recvWs.send(JSON.stringify({ type: 'peer-disconnected' }))
        }
      }
      if (!room.sender && room.receivers.size === 0) rooms.delete(token)
    })
  } else {
    const peerId = makePeerId()
    room.receivers.set(peerId, ws)
    console.log(`[${tag}] receiver ${peerId} connected (sender present: ${room.sender?.readyState === 1})`)

    // Catch up the new viewer with whatever incident state the room is in.
    // Replay tier first so the banner colour is correct before GPS lands.
    if (room.state.tierEvent) ws.send(JSON.stringify(room.state.tierEvent))
    if (room.state.gpsEvent) ws.send(JSON.stringify(room.state.gpsEvent))

    // If sender is already streaming, ask it to set up a PC for this viewer.
    if (room.sender?.readyState === 1) {
      room.sender.send(JSON.stringify({ type: 'receiver-joined', peerId }))
    }

    ws.on('message', (data) => {
      let msg
      try { msg = JSON.parse(data.toString()) } catch { return }
      if (room.sender?.readyState === 1) {
        room.sender.send(JSON.stringify({ ...msg, peerId }))
      }
    })

    ws.on('close', (code, reason) => {
      console.log(`[${tag}] receiver ${peerId} disconnected code=${code} reason=${reason?.toString() || ''}`)
      if (room.receivers.get(peerId) === ws) room.receivers.delete(peerId)
      if (room.sender?.readyState === 1) {
        room.sender.send(JSON.stringify({ type: 'peer-disconnected', peerId }))
      }
      if (!room.sender && room.receivers.size === 0) rooms.delete(token)
    })
  }
})

function getLocalIP() {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return 'localhost'
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP()
  const base = `http://${ip}:${PORT}`
  console.log()
  console.log('╔══════════════════════════════════════════════╗')
  console.log(`║  SafeHaven Signaling Server  port ${PORT}         ║`)
  console.log('╠══════════════════════════════════════════════╣')
  console.log(`║  Receiver PWA:  ${base}/          ║`)
  console.log(`║  Browser Sender: ${base}/sender   ║`)
  console.log('╠══════════════════════════════════════════════╣')
  console.log(`║  Mobile: SIGNAL_HOST=${ip}:${PORT}  ║`)
  console.log('╚══════════════════════════════════════════════╝')
  console.log()
  console.log('Waiting for connections...')
})
