import Corestore from 'corestore'
import Autopass from 'autopass'
import readline from 'readline'
import process from 'process'

async function main () {
  const store = new Corestore('./storage-sender')
  const pass = new Autopass(store)
  await pass.ready()

  const invite = await pass.createInvite()

  console.log('=== SENDER ===')
  console.log('Invite:', invite)
  console.log('Share that with the receiver: node receiver.js <invite>')
  console.log('Press ENTER to add a "hello world" entry. Ctrl+C to quit.')
  console.log()

  pass.on('update', () => {
    console.log('[update] writers/entries changed')
  })

  let counter = 0
  const rl = readline.createInterface({ input: process.stdin })
  rl.on('line', async () => {
    const key = `hello-${counter++}`
    const value = JSON.stringify({ text: 'hello world', time: new Date().toISOString() })
    await pass.add(key, value)
    console.log('[sent]', key, value)
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
