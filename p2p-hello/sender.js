import Autopass from 'autopass'
import Corestore from 'corestore'
import readline from 'readline'

const store = new Corestore('./sender-store')
const pass = new Autopass(store)

await pass.ready()

// create invite for receiver
const invite = await pass.createInvite()
console.log('\n📨 SHARE THIS INVITE WITH RECEIVER:\n')
console.log(invite)
console.log('\n-----------------------------\n')

// setup input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log('Type messages to send:\n')

rl.on('line', async (msg) => {
  await pass.add('message', msg)
  console.log('✔ sent:', msg)
})