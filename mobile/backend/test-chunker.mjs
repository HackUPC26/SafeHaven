// Reassembly verification for media-chunker (E1.4 acceptance test).
// Runs in Node.js — no device, no Bare runtime needed.
//
//   node mobile/backend/test-chunker.mjs
//
// Passes when:
//   - Audio entries flushed every ≤2s
//   - Video entries flushed every ≤2s, first chunk flagged keyFrame=true
//   - Reassembled bytes match original synthetic data
//   - Heap stays under 50 MB through a 5-second recording

import { writeFileSync } from 'fs'
import { MediaChunker } from './media-chunker.mjs'

// ── Mock entry writer ───────────────────────────────────────────────────────

const audioEntries = []
const videoEntries = []

const mockWriter = {
  async append (entry) {
    if (entry.type === 'audio_chunk') audioEntries.push(entry)
    else if (entry.type === 'video_chunk') videoEntries.push(entry)
  }
}

// ── Synthetic media frames ──────────────────────────────────────────────────

// 20ms AAC frame @ ~128kbps mono = ~320 bytes
function makeAudioFrame (index) {
  const buf = Buffer.alloc(320)
  buf.writeUInt32BE(index, 0)  // frame index embedded for reassembly check
  return buf
}

// H.264 NAL unit: keyframes ~8 KB (SPS+PPS+IDR), P-frames ~1 KB
// Keyframe every 60 frames ≈ every 2 seconds at 30 fps
function makeVideoFrame (index, isKeyframe) {
  const buf = Buffer.alloc(isKeyframe ? 8192 : 1024)
  buf.writeUInt32BE(index, 0)
  buf[4] = isKeyframe ? 1 : 0
  return buf
}

// ── Run the chunker ─────────────────────────────────────────────────────────

const TEST_DURATION_MS = 5200   // >5s → at least 2 full flush cycles
const AUDIO_INTERVAL_MS = 20
const VIDEO_INTERVAL_MS = 33

const chunker = new MediaChunker(mockWriter)
chunker.start()

let audioIndex = 0
let videoIndex = 0
let totalAudioBytes = 0
let totalVideoBytes = 0

const audioTimer = setInterval(() => {
  const frame = makeAudioFrame(audioIndex++)
  totalAudioBytes += frame.length
  chunker.pushAudio(frame)
}, AUDIO_INTERVAL_MS)

const videoTimer = setInterval(() => {
  const isKeyframe = videoIndex % 60 === 0
  const frame = makeVideoFrame(videoIndex, isKeyframe)
  totalVideoBytes += frame.length
  chunker.pushVideo(frame, isKeyframe)
  videoIndex++
}, VIDEO_INTERVAL_MS)

setTimeout(async () => {
  clearInterval(audioTimer)
  clearInterval(videoTimer)
  await chunker.stop()

  // ── Check flush timing ────────────────────────────────────────────────────

  console.log(`\n── Audio chunks (${audioEntries.length} total) ─────────────────────────`)
  for (const e of audioEntries) {
    const bytes = Buffer.from(e.payload.data, 'base64').length
    console.log(`  #${e.payload.chunkIndex}  duration=${e.payload.duration}ms  bytes=${bytes}`)
    assert(e.payload.duration <= 2200, `Audio chunk duration ${e.payload.duration}ms exceeds 2s flush window`)
    assert(e.payload.format === 'aac', 'Audio format must be aac')
  }
  assert(audioEntries.length >= 2, `Expected ≥2 audio flushes in ${TEST_DURATION_MS}ms`)

  console.log(`\n── Video chunks (${videoEntries.length} total) ─────────────────────────`)
  for (const e of videoEntries) {
    const bytes = Buffer.from(e.payload.data, 'base64').length
    console.log(`  #${e.payload.chunkIndex}  keyFrame=${e.payload.keyFrame}  duration=${e.payload.duration}ms  bytes=${bytes}`)
    assert(e.payload.duration <= 2200, `Video chunk duration ${e.payload.duration}ms exceeds 2s flush window`)
    assert(e.payload.format === 'h264', 'Video format must be h264')
  }
  assert(videoEntries.length >= 2, `Expected ≥2 video flushes in ${TEST_DURATION_MS}ms`)
  assert(videoEntries[0].payload.keyFrame === true, 'First video chunk must be keyFrame=true')

  // ── Reassembly ────────────────────────────────────────────────────────────

  const audioCat = Buffer.concat(audioEntries.map(e => Buffer.from(e.payload.data, 'base64')))
  assert(audioCat.readUInt32BE(0) === 0, 'Reassembled audio: first frame index must be 0')
  assert(audioCat.length === totalAudioBytes, `Reassembled audio byte count mismatch: ${audioCat.length} vs ${totalAudioBytes}`)

  const videoCat = Buffer.concat(videoEntries.map(e => Buffer.from(e.payload.data, 'base64')))
  assert(videoCat.readUInt32BE(0) === 0, 'Reassembled video: first frame index must be 0')
  assert(videoCat[4] === 1, 'Reassembled video: first frame must be a keyframe')
  assert(videoCat.length === totalVideoBytes, `Reassembled video byte count mismatch: ${videoCat.length} vs ${totalVideoBytes}`)

  writeFileSync('/tmp/safehaven-reassembled-audio.aac', audioCat)
  writeFileSync('/tmp/safehaven-reassembled-video.h264', videoCat)
  console.log('\n── Reassembled files ────────────────────────────────────────────────')
  console.log('  /tmp/safehaven-reassembled-audio.aac  ', audioCat.length, 'bytes')
  console.log('  /tmp/safehaven-reassembled-video.h264 ', videoCat.length, 'bytes')

  // ── Memory stability ──────────────────────────────────────────────────────

  const heapMB = process.memoryUsage().heapUsed / 1024 / 1024
  console.log(`\n── Memory after ${TEST_DURATION_MS}ms continuous recording ───────────────`)
  console.log(`  Heap: ${heapMB.toFixed(1)} MB`)
  assert(heapMB < 50, `Heap usage ${heapMB.toFixed(1)} MB exceeds 50 MB limit`)

  console.log('\n✓  All assertions passed\n')
}, TEST_DURATION_MS)

// ── Helpers ─────────────────────────────────────────────────────────────────

function assert (condition, message) {
  if (!condition) {
    console.error(`\n✗  FAIL: ${message}`)
    process.exit(1)
  }
}
