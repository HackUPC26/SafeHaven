// Turns continuous audio/video buffers from native modules into discrete
// Hypercore entries of ≤2 seconds each.
//
// Usage:
//   const chunker = new MediaChunker(entryWriter)
//   chunker.start()
//   chunker.pushAudio(aacBuffer)          // call on every AAC frame from expo-av
//   chunker.pushVideo(h264Buffer, true)   // call on every H.264 frame from expo-camera
//   await chunker.stop()                  // flushes remaining data

const FLUSH_INTERVAL_MS = 2000
const MAX_BUFFER_BYTES = 1024 * 1024  // 1 MB cap — force flush before OOM

export class MediaChunker {
  #writer

  #audioIndex = 0
  #audioBufs = []
  #audioBufBytes = 0
  #audioChunkStart = 0
  #audioTimer = null

  #videoIndex = 0
  #videoBufs = []
  #videoBufBytes = 0
  #videoChunkStart = 0
  #videoFirstIsKeyframe = false
  #videoTimer = null

  constructor (writer) {
    this.#writer = writer
  }

  start () {
    const now = Date.now()
    this.#audioChunkStart = now
    this.#videoChunkStart = now
    this.#audioTimer = setInterval(() => { this.#flushAudio().catch(noop) }, FLUSH_INTERVAL_MS)
    this.#videoTimer = setInterval(() => { this.#flushVideo().catch(noop) }, FLUSH_INTERVAL_MS)
  }

  async stop () {
    clearInterval(this.#audioTimer)
    clearInterval(this.#videoTimer)
    this.#audioTimer = null
    this.#videoTimer = null
    await this.#flushAudio()
    await this.#flushVideo()
  }

  // buffer: Buffer | Uint8Array containing a raw AAC frame from AVAudioEngine
  pushAudio (buffer) {
    this.#audioBufs.push(Buffer.from(buffer))
    this.#audioBufBytes += buffer.byteLength ?? buffer.length
    if (this.#audioBufBytes >= MAX_BUFFER_BYTES) this.#flushAudio().catch(noop)
  }

  // buffer: Buffer | Uint8Array containing a raw H.264 NAL unit
  // isKeyframe: true for IDR / SPS+PPS frames (AVCaptureSession sets this flag)
  pushVideo (buffer, isKeyframe = false) {
    if (this.#videoBufs.length === 0 && isKeyframe) {
      this.#videoFirstIsKeyframe = true
    }
    this.#videoBufs.push(Buffer.from(buffer))
    this.#videoBufBytes += buffer.byteLength ?? buffer.length
    if (this.#videoBufBytes >= MAX_BUFFER_BYTES) this.#flushVideo().catch(noop)
  }

  async #flushAudio () {
    if (this.#audioBufBytes === 0) return

    // Swap buffers before the async write so incoming frames go into fresh storage.
    const ts = this.#audioChunkStart
    const duration = Date.now() - ts
    const bufs = this.#audioBufs
    this.#audioBufs = []
    this.#audioBufBytes = 0
    this.#audioChunkStart = Date.now()

    const data = Buffer.concat(bufs).toString('base64')
    await this.#writer.append({
      type: 'audio_chunk',
      ts,
      payload: {
        chunkIndex: this.#audioIndex++,
        duration,
        format: 'aac',
        data,
        aiLabels: []     // populated by E5 AI layer when available
      }
    })
  }

  async #flushVideo () {
    if (this.#videoBufBytes === 0) return

    const ts = this.#videoChunkStart
    const duration = Date.now() - ts
    const keyFrame = this.#videoFirstIsKeyframe
    const bufs = this.#videoBufs
    this.#videoBufs = []
    this.#videoBufBytes = 0
    this.#videoFirstIsKeyframe = false
    this.#videoChunkStart = Date.now()

    const data = Buffer.concat(bufs).toString('base64')
    await this.#writer.append({
      type: 'video_chunk',
      ts,
      payload: {
        chunkIndex: this.#videoIndex++,
        duration,
        format: 'h264',
        data,
        keyFrame
      }
    })
  }
}

function noop (err) { if (err) console.error('[media-chunker]', err) }
