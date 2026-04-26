// Auto-discovery: in dev, Metro's bundler URL is the laptop's LAN IP, so the
// signaling server (on the same machine, port 8080) is reachable at the same
// host. Override only when running outside the Metro flow (release build, or
// signaling on a different machine).
import { NativeModules } from 'react-native'

const PORT = '8080'
const AUTO_SIGNAL_HOST_VALUES = new Set([
  '',
  'auto',
  '<your-mac-lan>',
  '<your-mac-lan>:8080',
  'your-mac-lan',
  'your-mac-lan:8080',
])

function detectHost () {
  const envHost = normalizeEnvHost(process.env.EXPO_PUBLIC_SIGNAL_HOST)
  if (envHost) return envHost

  const hosts = getDevHostCandidates()
  const host = hosts.find(h => !isLocalhost(h)) ?? hosts[0]
  if (host) {
    return `${host}:${PORT}`
  }

  return `localhost:${PORT}`
}

function normalizeEnvHost (value) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  const canonical = raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '')
  if (AUTO_SIGNAL_HOST_VALUES.has(canonical)) return null
  return raw.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '')
}

function getDevHostCandidates () {
  const hosts = []
  for (const value of getDevURLCandidates()) {
    const host = parseHost(value)
    if (host && !hosts.includes(host)) hosts.push(host)
  }
  return hosts
}

function getDevURLCandidates () {
  const candidates = []
  const scriptURL = getScriptURL()
  if (scriptURL) candidates.push(scriptURL)

  const devLauncherManifest = parseJSON(NativeModules?.EXDevLauncher?.manifestString)
  pushManifestCandidates(candidates, devLauncherManifest)

  const exponentManifest = NativeModules?.ExponentConstants?.manifest
  pushManifestCandidates(
    candidates,
    typeof exponentManifest === 'string' ? parseJSON(exponentManifest) : exponentManifest
  )

  return candidates
}

function getScriptURL () {
  const sourceCode = NativeModules?.SourceCode
  if (sourceCode?.scriptURL) return sourceCode.scriptURL
  if (sourceCode?.getConstants) {
    try {
      return sourceCode.getConstants()?.scriptURL
    } catch {}
  }

  return null
}

function pushManifestCandidates (candidates, manifest) {
  if (!manifest) return
  const values = [
    manifest.hostUri,
    manifest.debuggerHost,
    manifest.bundleUrl,
    manifest.launchAsset?.url,
    manifest.extra?.expoClient?.hostUri,
    manifest.extra?.expoGo?.debuggerHost,
  ]
  for (const value of values) {
    if (value) candidates.push(value)
  }
}

function parseHost (value) {
  if (typeof value !== 'string') return null
  const withProtocol = /^[a-z]+:\/\//i.test(value) ? value : `http://${value}`
  try {
    const host = new URL(withProtocol).hostname
    return host || null
  } catch {
    const m = value.match(/^(?:[a-z]+:\/\/)?([^/:]+)/i)
    return m?.[1] ?? null
  }
}

function parseJSON (value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isLocalhost (host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

export const SIGNAL_HOST = detectHost()
export const SIGNAL_WS   = `ws://${SIGNAL_HOST}`
export const SIGNAL_HTTP = `http://${SIGNAL_HOST}`
console.log('[config] SIGNAL_HOST =', SIGNAL_HOST)
