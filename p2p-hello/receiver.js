import Autopass from 'autopass'
import Corestore from 'corestore'

async function main() {
    const store = new Corestore('./storage-receiver')
    const key = process.argv[2]
    const pair = Autopass.pair(store, key)

    const pass = await pair.finished()
    await pass.ready()

    console.log('=== Receiver ===')
    console.log('Listening from key:', key)

    const seen = new Set()
    await drain(pass, seen, '[existing]')

    pass.on('update', async () => {
        await drain(pass, seen, '[received]')
    })


    process.on('SIGINT', async () => {
        console.log('\nShutting down...')
        await pass.close()
        process.exit(0)
    })
}

function drain (pass, seen, tag) {
      return new Promise((resolve, reject) => {
          const stream = pass.list()
          stream.on('data', (entry) => {
              if (seen.has(entry.key)) return
              seen.add(entry.key)
              console.log(tag, entry.key, entry.value)
          })
          stream.on('end', resolve)
          stream.on('error', reject)
          })
      }

main().catch((err) => {
  console.error(err)
  process.exit(1)
})