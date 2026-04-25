import Hypercore from 'hypercore'
import RAM from 'random-access-memory'
import b4a from 'b4a'

const logEl = document.getElementById('log')
const statusEl = document.getElementById('status')

function log(msg, cls = 'info') {
  const el = document.createElement('div')
  el.className = cls
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`
  logEl.prepend(el)
}

// Expose start() so the button can call it
window.start = async function start() {
  const hexKey = document.getElementById('key-field').value.trim()
  if (hexKey.length !== 64) { log('Key must be 64 hex chars', 'err'); return }

  const wsUrl = `ws://${location.hostname}:8081`
  statusEl.textContent = `Connecting to ${wsUrl} …`
  log(`Replicating core: ${hexKey.slice(0, 12)}…`)

  const key = b4a.from(hexKey, 'hex')
  const core = new Hypercore(RAM, key)
  await core.ready()
  log(`Core ready — local length: ${core.length}`)

  const ws = new WebSocket(wsUrl)
  ws.binaryType = 'arraybuffer'

  ws.onopen = async () => {
    statusEl.textContent = `Live — connected to ${wsUrl}`
    log('WebSocket open — starting hypercore replication')

    // hypercore-protocol replication stream (we are the non-initiator side)
    const stream = core.replicate(false, { live: true })

    // WebSocket → hypercore stream
    ws.onmessage = (e) => {
      stream.write(e.data instanceof ArrayBuffer ? Buffer.from(e.data) : e.data)
    }
    ws.onclose = () => { stream.destroy(); statusEl.textContent = 'Disconnected'; log('WebSocket closed', 'err') }
    ws.onerror = () => { stream.destroy(); log('WebSocket error', 'err') }

    // hypercore stream → WebSocket
    stream.on('data', (chunk) => { if (ws.readyState === 1) ws.send(chunk) })
    stream.on('error', (err) => log(`Stream error: ${err.message}`, 'err'))

    // Watch for new entries — this fires each time the sender appends
    let seen = core.length
    core.on('append', async () => {
      while (seen < core.length) {
        const raw = await core.get(seen++)
        try {
          const entry = JSON.parse(raw.toString())
          log(`ENTRY #${seen - 1}: ${JSON.stringify(entry)}`, 'entry')
        } catch {
          log(`ENTRY #${seen - 1}: (binary) ${b4a.toString(raw, 'hex')}`, 'entry')
        }
      }
    })
  }

  ws.onerror = () => {
    statusEl.textContent = 'Connection failed'
    log(`Could not reach ${wsUrl} — is sender.js running?`, 'err')
  }
}

// Auto-connect if key is in URL hash: #<hexkey>
const hashKey = location.hash.slice(1).split(':')[0]
if (hashKey.length === 64) {
  document.getElementById('key-field').value = hashKey
  window.start()
}
