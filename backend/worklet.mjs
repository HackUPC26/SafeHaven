import RPC from 'bare-rpc'

const CMD_PING = 1

const rpc = new RPC(BareKit.IPC, onRequest)

function onRequest (req) {
  if (req.command === CMD_PING) {
    console.log('[worklet] ping:', req.data.toString())
    req.reply('pong')
  }
}

console.log('[worklet] SafeHaven worklet started')
