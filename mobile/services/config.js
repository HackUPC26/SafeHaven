// Auto-discovery: in dev, Metro's bundler URL is the laptop's LAN IP, so the
// signaling server (on the same machine, port 8080) is reachable at the same
// host. Override only when running outside the Metro flow (release build, or
// signaling on a different machine).
import { NativeModules } from 'react-native'

const PORT = '8080'

function detectHost () {
  if (process.env.EXPO_PUBLIC_SIGNAL_HOST) return process.env.EXPO_PUBLIC_SIGNAL_HOST
  const url = NativeModules?.SourceCode?.scriptURL
  if (url) {
    const m = url.match(/^https?:\/\/([^/:]+)/)
    if (m) return `${m[1]}:${PORT}`
  }
  return `localhost:${PORT}`
}

export const SIGNAL_HOST = detectHost()
export const SIGNAL_WS   = `ws://${SIGNAL_HOST}`
export const SIGNAL_HTTP = `http://${SIGNAL_HOST}`
console.log('[config] SIGNAL_HOST =', SIGNAL_HOST)
