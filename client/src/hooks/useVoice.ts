import { useEffect, useRef, useState, useCallback } from 'react'
import { VoiceManager } from '../services/VoiceManager'
import type { Player } from 'shared'

export type VoiceMode = 'always' | 'ptt'

export interface VoiceState {
  voiceReady: boolean
  micError: string | null
  muted: boolean
  voiceMode: VoiceMode
  pttActive: boolean
  localSpeaking: boolean
  speakingPeers: Set<string>      // PeerJS peer IDs currently speaking
  mutedPeers: Set<string>         // PeerJS peer IDs we've silenced
  peerVolumes: Map<string, number> // PeerJS peer ID → 0–1
  toggleMute: () => void
  toggleVoiceMode: () => void
  setPttActive: (active: boolean) => void
  muteRemotePeer: (peerId: string, muted: boolean) => void
  setRemoteVolume: (peerId: string, volume: number) => void
}

interface VoiceParams {
  roomCode: string | null
  playerId: string | null
  players: Player[]
}

function loadVoiceMode(): VoiceMode {
  try { return (localStorage.getItem('voiceMode') as VoiceMode) ?? 'always' } catch { return 'always' }
}

function saveVoiceMode(mode: VoiceMode) {
  try { localStorage.setItem('voiceMode', mode) } catch {}
}

export function useVoice({ roomCode, playerId, players }: VoiceParams): VoiceState {
  const vmRef = useRef<VoiceManager | null>(null)
  const [voiceReady, setVoiceReady] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)  // off by default — player turns it on
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(loadVoiceMode)
  const [pttActive, setPttActiveState] = useState(false)
  const [localSpeaking, setLocalSpeaking] = useState(false)
  const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set())
  const [mutedPeers, setMutedPeers] = useState<Set<string>>(new Set())
  const [peerVolumes, setPeerVolumes] = useState<Map<string, number>>(new Map())

  // Which playerIds we've already called
  const calledRef = useRef<Set<string>>(new Set())
  // Stable refs for mode/muted so event handlers don't go stale
  const voiceModeRef = useRef(voiceMode)
  const mutedRef = useRef(muted)
  voiceModeRef.current = voiceMode
  mutedRef.current = muted

  // Create / destroy VoiceManager when room is entered / left
  useEffect(() => {
    if (!roomCode || !playerId) return

    const vm = new VoiceManager()
    vmRef.current = vm
    calledRef.current = new Set()

    // Wire VAD callbacks before init
    vm.onLocalSpeaking = (s) => setLocalSpeaking(s)
    vm.onRemoteSpeaking = (peerId, s) => {
      setSpeakingPeers(prev => {
        const next = new Set(prev)
        if (s) next.add(peerId); else next.delete(peerId)
        return next
      })
    }

    vm.init(roomCode, playerId)
      .then(() => {
        setVoiceReady(true)
        // Connected on room entry, but off by default: the player explicitly
        // turns voice on (unmute / PTT). This holds across lobby → game since
        // the VoiceManager lives at the app level for the whole room session.
        vm.mute(true)
      })
      .catch((err: Error) => {
        const denied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        setMicError(denied ? 'Microphone access denied' : `Voice unavailable: ${err.message}`)
        console.warn('[VoiceManager] init failed:', err)
      })

    return () => {
      vm.destroy()
      vmRef.current = null
      setVoiceReady(false)
      setMicError(null)
      setMuted(true)  // reset to off for the next room
      setPttActiveState(false)
      setLocalSpeaking(false)
      setSpeakingPeers(new Set())
      setMutedPeers(new Set())
      setPeerVolumes(new Map())
      calledRef.current = new Set()
    }
  }, [roomCode, playerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Diff the player list — call newcomers, hang up departed ones
  useEffect(() => {
    const vm = vmRef.current
    if (!vm || !vm.ready || !roomCode || !playerId) return

    const connected = new Map(
      players.filter(p => p.id !== playerId && p.connected).map(p => [p.id, p])
    )

    for (const [pid] of connected) {
      if (!calledRef.current.has(pid)) {
        calledRef.current.add(pid)
        vm.callPeer(roomCode, pid)
      }
    }

    for (const pid of [...calledRef.current]) {
      if (!connected.has(pid)) {
        calledRef.current.delete(pid)
        vm.hangupPeer(roomCode, pid)
      }
    }
  }, [players, voiceReady, roomCode, playerId])

  // Spacebar PTT
  useEffect(() => {
    if (!voiceReady) return

    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (voiceModeRef.current !== 'ptt') return
      setPttActiveState(true)
      vmRef.current?.mute(false)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (voiceModeRef.current !== 'ptt') return
      setPttActiveState(false)
      // Restore to the user's chosen muted state
      vmRef.current?.mute(mutedRef.current || true)
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [voiceReady])

  // --- Actions ---

  const toggleMute = useCallback(() => {
    const vm = vmRef.current
    if (!vm) return
    setMuted(prev => {
      const next = !prev
      // In PTT mode, mute toggle only applies when PTT is not active
      if (voiceModeRef.current === 'always') vm.mute(next)
      return next
    })
  }, [])

  const toggleVoiceMode = useCallback(() => {
    setVoiceModeState(prev => {
      const next: VoiceMode = prev === 'always' ? 'ptt' : 'always'
      saveVoiceMode(next)
      const vm = vmRef.current
      if (vm) {
        if (next === 'ptt') {
          // Entering PTT — mute until spacebar is held
          vm.mute(true)
          setPttActiveState(false)
        } else {
          // Entering always-on — restore to muted state
          vm.mute(mutedRef.current)
        }
      }
      return next
    })
  }, [])

  const setPttActive = useCallback((active: boolean) => {
    if (voiceModeRef.current !== 'ptt') return
    setPttActiveState(active)
    vmRef.current?.mute(!active)
  }, [])

  const muteRemotePeer = useCallback((peerId: string, muted: boolean) => {
    vmRef.current?.muteRemote(peerId, muted)
    setMutedPeers(prev => {
      const next = new Set(prev)
      if (muted) next.add(peerId); else next.delete(peerId)
      return next
    })
  }, [])

  const setRemoteVolume = useCallback((peerId: string, volume: number) => {
    vmRef.current?.setRemoteVolume(peerId, volume)
    setPeerVolumes(prev => new Map(prev).set(peerId, volume))
  }, [])

  return {
    voiceReady, micError, muted, voiceMode, pttActive,
    localSpeaking, speakingPeers, mutedPeers, peerVolumes,
    toggleMute, toggleVoiceMode, setPttActive,
    muteRemotePeer, setRemoteVolume,
  }
}
