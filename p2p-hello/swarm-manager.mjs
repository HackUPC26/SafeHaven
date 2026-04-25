import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import { WebSocketServer } from 'ws'

const BROWSER_PORT = 8081

export async function createSwarmManager({ storagePath = './storage-core' } = {}) {
  const store = new Corestore(storagePath)
  const core = store.get({ name: 'incident-log' })
  await core.ready()

  // Native P2P peers (other Node processes / future bare worklets)
  const swarm = new Hyperswarm()
  swarm.join(core.discoveryKey, { server: true, client: true })
  swarm.on('connection', (socket) => {
    console.log('[swarm] Native peer connected')
    const stream = core.replicate(true, { live: true })
    socket.pipe(stream).pipe(socket)
    socket.on('error', () => {})
  })
  await swarm.flush()
  console.log('[swarm] Announced to DHT, key:', core.key.toString('hex'))

  // Browser replication relay — hypercore-protocol over WebSocket
  const wss = new WebSocketServer({ port: BROWSER_PORT })
  wss.on('connection', (ws) => {
    console.log('[swarm] Browser client connected')
    ws.binaryType = 'arraybuffer'
    const stream = core.replicate(true, { live: true })

    ws.on('message', (data) => {
      stream.write(Buffer.isBuffer(data) ? data : Buffer.from(data))
    })
    ws.on('close', () => stream.destroy())
    ws.on('error', () => stream.destroy())

    stream.on('data', (chunk) => {
      if (ws.readyState === 1) ws.send(chunk)
    })
    stream.on('error', () => {})
  })
  console.log(`[swarm] Browser relay on :${BROWSER_PORT}`)

  async function appendEntry(event) {
    await core.append(JSON.stringify(event))
  }

  async function close() {
    await swarm.destroy()
    wss.close()
    await store.close()
  }

  return { core, appendEntry, close }
}
