import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { networkInterfaces } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 8080

// token -> { sender: WebSocket|null, receiver: WebSocket|null }
const rooms = new Map()

const STATIC = {
  '/':            ['receiver-pwa/index.html', 'text/html'],
  '/index.html':  ['receiver-pwa/index.html', 'text/html'],
  '/sender':      ['sender-demo.html', 'text/html'],
  '/sender.html': ['sender-demo.html', 'text/html'],
}

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x')

  if (pathname === '/manifest.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      name: 'SafeHaven Receiver',
      short_name: 'SafeHaven',
      start_url: '/',
      display: 'standalone',
      background_color: '#1a1a2e',
      theme_color: '#e94560',
      icons: [],
    }))
    return
  }

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

  if (!rooms.has(token)) rooms.set(token, { sender: null, receiver: null })
  const room = rooms.get(token)
  const prev = room[role]
  if (prev?.readyState < 2) prev.close()
  room[role] = ws

  const peer = role === 'sender' ? 'receiver' : 'sender'
  const tag  = token.slice(0, 8)
  console.log(`[${tag}] ${role} connected`)

  // If the other side is already present, trigger offer creation
  if (room[peer]?.readyState === 1) {
    const target = role === 'receiver' ? room.sender : ws
    target?.send(JSON.stringify({ type: 'receiver-joined' }))
  }

  ws.on('message', (data) => {
    const peerWs = room[peer]
    if (peerWs?.readyState === 1) peerWs.send(data.toString())
  })

  ws.on('close', () => {
    console.log(`[${tag}] ${role} disconnected`)
    if (room[role] === ws) room[role] = null
    const peerWs = room[peer]
    if (peerWs?.readyState === 1) {
      peerWs.send(JSON.stringify({ type: 'peer-disconnected' }))
    }
    if (!room.sender && !room.receiver) rooms.delete(token)
  })
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
