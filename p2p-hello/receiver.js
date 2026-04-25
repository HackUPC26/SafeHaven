import Autopass from 'autopass'
import Corestore from 'corestore'

const invite = process.argv[2]

if (!invite) {
  console.log('❌ Provide invite from sender')
  process.exit(1)
}

const store = new Corestore('./receiver-store')

// pair with sender
const pair = Autopass.pair(store, invite)

const pass = await pair.finished()
await pass.ready()

console.log('🔗 Paired successfully!')
console.log('👂 Listening for messages...\n')

// listen for updates
pass.on('update', async () => {
  const stream = pass.list()

  for await (const entry of stream) {
    if (entry.key === 'message') {
      console.log('📩 received:', entry.value.toString())
    }
  }
})