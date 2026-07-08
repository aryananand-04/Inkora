// PeerJS is loaded lazily in init() — it's only needed once the player is in a
// room and enables voice, so it stays out of the initial bundle.
import type Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'

const VAD_INTERVAL_MS = 80
const VAD_THRESHOLD = 0.018  // RMS fraction; tuned empirically

function startVAD(
  stream: MediaStream,
  ctx: AudioContext,
  onSpeaking: (speaking: boolean) => void,
): () => void {
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)
  const buf = new Uint8Array(analyser.frequencyBinCount)
  let prev = false

  const id = setInterval(() => {
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += (v - 128) ** 2
    const rms = Math.sqrt(sum / buf.length) / 128
    const speaking = rms > VAD_THRESHOLD
    if (speaking !== prev) { prev = speaking; onSpeaking(speaking) }
  }, VAD_INTERVAL_MS)

  return () => { clearInterval(id); source.disconnect() }
}

export class VoiceManager {
  private peer: Peer | null = null
  private localStream: MediaStream | null = null
  private connections = new Map<string, MediaConnection>()
  private audioElements = new Map<string, HTMLAudioElement>()
  private vadCleanups = new Map<string, () => void>()   // 'local' | peerId → cleanup
  private audioCtx: AudioContext | null = null

  // Callbacks — set before calling init()
  onLocalSpeaking: ((speaking: boolean) => void) | null = null
  onRemoteSpeaking: ((peerId: string, speaking: boolean) => void) | null = null

  static peerId(roomCode: string, playerId: string): string {
    const room = roomCode.toLowerCase().replace(/[^a-z0-9]/g, '')
    const pid = playerId.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    return `inkora-${room}-${pid}`
  }

  async init(roomCode: string, playerId: string): Promise<void> {
    const { default: Peer } = await import('peerjs')

    // Echo / noise cancellation at the browser level
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    })

    this.audioCtx = new AudioContext()

    // Local VAD
    const localCleanup = startVAD(this.localStream, this.audioCtx, (s) => {
      this.onLocalSpeaking?.(s)
    })
    this.vadCleanups.set('local', localCleanup)

    const id = VoiceManager.peerId(roomCode, playerId)
    this.peer = new Peer(id)

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => { off(); resolve() }
      const onError = (err: Error & { type?: string }) => {
        off()
        if (err.type === 'unavailable-id') {
          // Stale peer from previous session — fall back to random ID
          this.peer = new Peer()
          this.peer.once('open', () => resolve())
          this.peer.once('error', reject)
        } else {
          reject(err)
        }
      }
      const off = () => { this.peer!.off('open', onOpen); this.peer!.off('error', onError) }
      this.peer!.on('open', onOpen)
      this.peer!.on('error', onError)
    })

    this.peer.on('call', (call) => {
      call.answer(this.localStream!)
      this.registerCall(call)
    })
  }

  callPeer(roomCode: string, playerId: string): void {
    if (!this.peer || !this.localStream) return
    const id = VoiceManager.peerId(roomCode, playerId)
    if (this.connections.has(id)) return
    const call = this.peer.call(id, this.localStream)
    if (call) this.registerCall(call)
  }

  private registerCall(call: MediaConnection): void {
    this.connections.set(call.peer, call)

    call.on('stream', (stream) => {
      this.attachAudio(call.peer, stream)
      // Remote VAD — analyse without routing to AudioContext destination
      if (this.audioCtx) {
        const cleanup = startVAD(stream, this.audioCtx, (s) => {
          this.onRemoteSpeaking?.(call.peer, s)
        })
        this.vadCleanups.set(call.peer, cleanup)
      }
    })

    const onClose = () => {
      this.vadCleanups.get(call.peer)?.()
      this.vadCleanups.delete(call.peer)
      this.detachAudio(call.peer)
      this.connections.delete(call.peer)
      this.onRemoteSpeaking?.(call.peer, false)
    }
    call.on('close', onClose)
    call.on('error', onClose)
  }

  private attachAudio(peerId: string, stream: MediaStream): void {
    let el = this.audioElements.get(peerId)
    if (!el) {
      el = document.createElement('audio')
      el.autoplay = true
      document.body.appendChild(el)
      this.audioElements.set(peerId, el)
    }
    el.srcObject = stream
  }

  private detachAudio(peerId: string): void {
    const el = this.audioElements.get(peerId)
    if (!el) return
    el.srcObject = null
    el.remove()
    this.audioElements.delete(peerId)
  }

  hangupPeer(roomCode: string, playerId: string): void {
    const id = VoiceManager.peerId(roomCode, playerId)
    this.vadCleanups.get(id)?.()
    this.vadCleanups.delete(id)
    this.connections.get(id)?.close()
    this.connections.delete(id)
    this.detachAudio(id)
    this.onRemoteSpeaking?.(id, false)
  }

  // Mute / unmute local mic
  mute(muted: boolean): void {
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !muted
    }
  }

  // Mute / unmute a specific remote peer's audio
  muteRemote(peerId: string, muted: boolean): void {
    const el = this.audioElements.get(peerId)
    if (el) el.muted = muted
  }

  // 0–1 volume for a specific remote peer
  setRemoteVolume(peerId: string, volume: number): void {
    const el = this.audioElements.get(peerId)
    if (el) el.volume = Math.max(0, Math.min(1, volume))
  }

  destroy(): void {
    for (const cleanup of this.vadCleanups.values()) cleanup()
    this.vadCleanups.clear()
    for (const conn of this.connections.values()) conn.close()
    this.connections.clear()
    for (const id of [...this.audioElements.keys()]) this.detachAudio(id)
    for (const track of this.localStream?.getTracks() ?? []) track.stop()
    this.localStream = null
    this.audioCtx?.close()
    this.audioCtx = null
    this.peer?.destroy()
    this.peer = null
  }

  get ready(): boolean {
    return !!this.peer && !this.peer.destroyed
  }
}
