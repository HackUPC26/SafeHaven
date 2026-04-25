import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Worklet } from 'react-native-bare-kit'
import RPC from 'bare-rpc'

const workletBundle = require('../backend/worklet.bundle.js') as string
const CMD_PING = 1
type WorkletStatus = 'idle' | 'starting' | 'ok' | 'error'

export default function App() {
  const workletRef = useRef<InstanceType<typeof Worklet> | null>(null)
  const [status, setStatus] = useState<WorkletStatus>('idle')
  const [message, setMessage] = useState('Worklet starts on mount')

  useEffect(() => {
    let cancelled = false
    async function runSmokeTest() {
      setStatus('starting')
      setMessage('Starting Bare worklet...')
      try {
        const worklet = new Worklet()
        workletRef.current = worklet
        worklet.start('/worklet.bundle', workletBundle)
        const rpc = new RPC(worklet.IPC)
        const req = rpc.request(CMD_PING)
        req.send('ping')
        const reply = await req.reply()
        if (cancelled) return
        const replyText = reply.toString()
        console.log('[app] round-trip OK:', replyText)
        setStatus('ok')
        setMessage(`Bare Worklet OK\nRPC reply: "${replyText}"`)
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[app] worklet error:', msg)
        setStatus('error')
        setMessage(`Error: ${msg}`)
      }
    }
    runSmokeTest()
    return () => { cancelled = true; workletRef.current?.terminate(); workletRef.current = null }
  }, [])

  const dotColor = status === 'ok' ? '#22c55e' : status === 'error' ? '#ef4444' : '#eab308'

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SafeHaven</Text>
      <Text style={styles.subtitle}>Bare Worklet smoke test</Text>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.status}>{message}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
  dot: { width: 16, height: 16, borderRadius: 8, marginBottom: 12 },
  status: { fontSize: 16, textAlign: 'center', lineHeight: 26 }
})
