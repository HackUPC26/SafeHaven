import { createSwarmManager } from './swarm-manager.mjs'
import { startRPCBridge } from './rpc-bridge.mjs'

async function main() {
  const { core, appendEntry, close } = await createSwarmManager()

  startRPCBridge({
    onEvent: async (event) => {
      await appendEntry({
        ...event,
        timestamp_iso: event.timestamp_iso ?? new Date().toISOString(),
      })
    },
  })

  const key = core.key.toString('hex')
  console.log()
  console.log('=== SafeHaven P2P ===')
  console.log('Core key :', key)
  console.log('Browser  : open web-spike and paste the key above')
  console.log()

  process.on('SIGINT', async () => {
    console.log('\nShutting down...')
    await close()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
