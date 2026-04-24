const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const Autobase = require('autobase')
const readline = require('readline')

async function main () {
  const store = new Corestore('./storage-sender')
  await store.ready()

  const base = new Autobase(store, null, {
    valueEncoding: 'json',
    open: (viewStore) => viewStore.get('messages', { valueEncoding: 'json' }),
    apply: async (nodes, view) => {
      for (const node of nodes) {
        await view.append(node.value)
      }
    }
  })

  await base.ready()

  console.log('=== SENDER ===')
  console.log('Bootstrap key:', base.key.toString('hex'))
  console.log('Share that key with the receiver (node receiver.js <key>).')
  console.log('Press ENTER to append "hello world". Ctrl+C to quit.')
  console.log()

  const swarm = new Hyperswarm()
  swarm.on('connection', (conn, info) => {
    const remote = info.publicKey.toString('hex').slice(0, 8)
    console.log('[peer connected]', remote)
    store.replicate(conn)
  })

  swarm.join(base.discoveryKey, { server: true, client: true })
  await swarm.flush()
  console.log('Swarming on discovery key. Waiting for receiver...')
  console.log()

  const rl = readline.createInterface({ input: process.stdin })
  rl.on('line', async () => {
    const msg = { text: 'hello world', time: new Date().toISOString() }
    await base.append(msg)
    console.log('[sent]', msg)
  })

  process.on('SIGINT', async () => {
    console.log('\nShutting down...')
    await swarm.destroy()
    await base.close()
    await store.close()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
