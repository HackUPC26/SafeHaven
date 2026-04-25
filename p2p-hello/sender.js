import Corestore from 'corestore'
import Autopass from 'autopass'
import process from 'process'
import { WebSocketServer } from 'ws'

async function main () {
  const store = new Corestore('./storage-sender')
  const pass = new Autopass(store)
  await pass.ready()

  const invite = await pass.createInvite()

  console.log('=== SENDER ===')
  console.log('Invite:', invite)
  console.log('Share that with the receiver: node receiver.js <invite>')
  console.log()

  pass.on('update', () => {
    console.log('[update] writers/entries changed')
  })

  // WebSocket server — listens for events from the iPhone app
  const wss = new WebSocketServer({ port: 8080 })
  console.log('WebSocket server listening on port 8080')

  wss.on('connection', (socket) => {
    console.log('[bridge] Phone connected')

    socket.on('message', async (data) => {
      const event = JSON.parse(data)
      console.log('[bridge] Got event:', event)

      // write every phone event into the autopass log
      const key = `event-${Date.now()}`
      const value = JSON.stringify(event)
      await pass.add(key, value)
      console.log('[sent to autopass]', key, event.event_type)
    })

    socket.on('close', () => {
      console.log('[bridge] Phone disconnected')
    })
  })

  process.on('SIGINT', async () => {
    console.log('\nShutting down...')
    await pass.close()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
