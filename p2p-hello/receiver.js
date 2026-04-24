const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const Autobase = require('autobase')

async function main () {
  const bootstrapHex = process.argv[2]
  if (!bootstrapHex) {
    console.error('Usage: node receiver.js <bootstrap-key-hex>')
    process.exit(1)
  }
  const bootstrapKey = Buffer.from(bootstrapHex, 'hex')

  const store = new Corestore('./storage-receiver')
  await store.ready()

  const base = new Autobase(store, bootstrapKey, {
    valueEncoding: 'json',
    open: (viewStore) => viewStore.get('messages', { valueEncoding: 'json' }),
    apply: async (nodes, view) => {
      for (const node of nodes) {
        await view.append(node.value)
      }
    }
  })

  await base.ready()

  console.log('=== RECEIVER ===')
  console.log('Following bootstrap key:', bootstrapHex)

  const swarm = new Hyperswarm()
  swarm.on('connection', (conn, info) => {
    const remote = info.publicKey.toString('hex').slice(0, 8)
    console.log('[peer connected]', remote)
    store.replicate(conn)
  })

  swarm.join(base.discoveryKey, { server: true, client: true })
  await swarm.flush()
  console.log('Swarming. Waiting for messages...')
  console.log()

  let cursor = base.view.length
  for (let i = 0; i < cursor; i++) {
    const block = await base.view.get(i)
    console.log('[existing]', block)
  }

  base.on('update', async () => {
    await base.update()
    const len = base.view.length
    for (let i = cursor; i < len; i++) {
      const block = await base.view.get(i)
      console.log('[received]', block)
    }
    cursor = len
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
