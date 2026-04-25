import { Worklet } from 'react-native-bare-kit'
import RPC from 'bare-rpc'
import b4a from 'b4a'
import bundle from '../backend/worklet.bundle.mjs'
import {
  CMD_PING,
  CMD_GET_PUBKEY,
  CMD_APPEND_ENTRY,
  CMD_GET_LENGTH,
  CMD_JOIN_SWARM,
} from '../backend/commands'

let worklet = null
let rpc = null
let startPromise = null

export function start() {
  if (startPromise) return startPromise
  startPromise = new Promise((resolve) => {
    const w = new Worklet()
    w.start('/app.bundle', bundle)
    worklet = w
    rpc = new RPC(w.IPC)
    resolve()
  })
  return startPromise
}

async function call(cmd, payload) {
  await start()
  const req = rpc.request(cmd)
  req.send(payload ?? '')
  const reply = await req.reply()
  const text = b4a.toString(reply)
  if (text.startsWith('ERR:')) throw new Error(text.slice(4))
  return text
}

export async function ping() {
  const text = await call(CMD_PING, 'ping')
  // PING now returns JSON with the worklet's boot log so we can see it in Metro
  try {
    const payload = JSON.parse(text)
    if (Array.isArray(payload.log)) {
      for (const line of payload.log) console.log(line)
    }
    if (payload.bootError) {
      throw new Error('worklet boot error: ' + payload.bootError)
    }
    return 'pong'
  } catch (e) {
    if (e.message && e.message.startsWith('worklet boot error:')) throw e
    return text
  }
}

export function getPubkey() {
  return call(CMD_GET_PUBKEY)
}

export async function appendEntry(entry) {
  const json = JSON.stringify(entry)
  const seq = await call(CMD_APPEND_ENTRY, json)
  return Number(seq)
}

export async function getLength() {
  const len = await call(CMD_GET_LENGTH)
  return Number(len)
}

export function joinSwarm() {
  return call(CMD_JOIN_SWARM)
}

export function stop() {
  if (worklet) {
    try { worklet.terminate() } catch {}
    worklet = null
    rpc = null
    startPromise = null
  }
}
