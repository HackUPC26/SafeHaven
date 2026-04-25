import { WebSocketServer } from 'ws'

const PHONE_PORT = 8080

export function startRPCBridge({ onEvent } = {}) {
  const wss = new WebSocketServer({ port: PHONE_PORT })
  console.log(`[bridge] Phone bridge on :${PHONE_PORT}`)

  wss.on('connection', (socket, req) => {
    const tag = req.headers['x-client'] || 'unknown'
    console.log(`[bridge] Connected: ${tag}`)

    socket.on('message', async (data) => {
      let event
      try { event = JSON.parse(data.toString()) } catch { return }

      console.log('[bridge]', event.event_type, event)
      if (onEvent) await onEvent(event)

      // Broadcast to all other connected clients (receiver dashboards)
      for (const client of wss.clients) {
        if (client !== socket && client.readyState === 1) {
          client.send(data.toString())
        }
      }
    })

    socket.on('close', () => console.log('[bridge] Disconnected'))
    socket.on('error', () => {})
  })

  return wss
}
