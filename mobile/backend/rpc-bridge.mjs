// Routes bare-rpc IPC commands from React Native into the Bare Worklet modules.
//
// Command flow (Architecture §2.2):
//   React Native  ──bare-rpc──►  rpc-bridge  ──►  entry-writer / media-chunker
//
// E1.3 commands: START_INCIDENT, STOP_INCIDENT, TIER_CHANGE, GPS, AI_LABEL
// E1.4 commands: AUDIO_BUFFER, VIDEO_FRAME  → MediaChunker
//
// Usage (in worklet.mjs):
//   import IPC from 'bare-ipc'
//   import { createBridge } from './rpc-bridge.mjs'
//   const bridge = createBridge(ipc, { entryWriter, incidentCore })

import RPC from 'bare-rpc'
import { MediaChunker } from './media-chunker.mjs'

export function createBridge (ipc, { entryWriter, incidentCore }) {
  const chunker = new MediaChunker(entryWriter)
  const rpc = new RPC(ipc, dispatch)

  async function dispatch (req) {
    switch (req.command) {
      case 'START_INCIDENT': {
        await entryWriter.append({
          type: 'incident_start',
          ts: Date.now(),
          payload: req.data
        })
        chunker.start()
        req.reply({ ok: true })
        break
      }

      case 'STOP_INCIDENT': {
        await chunker.stop()
        await entryWriter.append({
          type: 'incident_end',
          ts: Date.now(),
          payload: {
            finalTier: req.data.finalTier,
            durationMs: req.data.durationMs,
            entryCount: incidentCore.core.length
          }
        })
        req.reply({ ok: true })
        break
      }

      case 'TIER_CHANGE': {
        await entryWriter.append({
          type: 'tier_change',
          ts: Date.now(),
          payload: req.data   // { fromTier, toTier, trigger, codeword? }
        })
        req.reply({ ok: true })
        break
      }

      case 'GPS': {
        await entryWriter.append({
          type: 'gps',
          ts: Date.now(),
          payload: req.data   // { lat, lng, accuracy, heading, speed, address }
        })
        req.reply({ ok: true })
        break
      }

      case 'AI_LABEL': {
        await entryWriter.append({
          type: 'ai_label',
          ts: Date.now(),
          payload: req.data   // { label, confidence, source }
        })
        req.reply({ ok: true })
        break
      }

      // ── E1.4: media intake ───────────────────────────────────────────────

      // Sent by expo-av / AVAudioEngine on every AAC buffer (~20ms frames).
      // data: base64-encoded AAC buffer.
      case 'AUDIO_BUFFER': {
        chunker.pushAudio(Buffer.from(req.data.data, 'base64'))
        req.reply({ ok: true })
        break
      }

      // Sent by expo-camera / AVCaptureSession on every H.264 frame (~33ms).
      // data: base64-encoded NAL unit. isKeyframe: true for IDR/SPS+PPS frames.
      case 'VIDEO_FRAME': {
        chunker.pushVideo(Buffer.from(req.data.data, 'base64'), req.data.isKeyframe ?? false)
        req.reply({ ok: true })
        break
      }

      default:
        req.reply({ ok: false, error: `unknown command: ${req.command}` })
    }
  }

  return rpc
}
