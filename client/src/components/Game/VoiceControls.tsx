import type { VoiceState } from '../../hooks/useVoice'
import type { Player } from 'shared'
import { VoiceManager } from '../../services/VoiceManager'

interface Props {
  voice: VoiceState
  players: Player[]
  playerId: string | null
  roomCode: string | null
}

export function VoiceControls({ voice, players, playerId, roomCode }: Props) {
  const { voiceReady, micError, muted, voiceMode, pttActive, localSpeaking,
    speakingPeers, mutedPeers, peerVolumes,
    toggleMute, toggleVoiceMode, setPttActive, muteRemotePeer, setRemoteVolume } = voice

  if (micError) {
    return (
      <div className="px-2 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center">
        {micError}
      </div>
    )
  }

  if (!voiceReady) return null

  const remotePlayers = players.filter(p => p.id !== playerId && p.connected)

  return (
    <div className="flex flex-col gap-1.5">
      {/* Mode toggle + mute row */}
      <div className="flex items-center gap-1">
        {/* Voice mode toggle */}
        <button
          onClick={toggleVoiceMode}
          title={voiceMode === 'ptt' ? 'Switch to always-on' : 'Switch to push-to-talk'}
          className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-colors border ${
            voiceMode === 'ptt'
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-surface-light text-text-muted border-border'
          }`}
        >
          {voiceMode === 'ptt' ? 'PTT' : 'Always'}
        </button>

        {/* Mute self (only meaningful in always-on) */}
        <button
          onClick={toggleMute}
          title={muted ? 'Unmute mic' : 'Mute mic'}
          className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors border ${
            muted
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : localSpeaking
              ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_6px_rgba(74,222,128,0.4)]'
              : 'bg-surface-light text-text-muted border-border'
          }`}
        >
          {muted ? '🔇' : '🎙'}
        </button>
      </div>

      {/* PTT hold button */}
      {voiceMode === 'ptt' && (
        <button
          onPointerDown={() => setPttActive(true)}
          onPointerUp={() => setPttActive(false)}
          onPointerLeave={() => setPttActive(false)}
          className={`w-full py-1.5 rounded-lg text-xs font-medium border select-none transition-colors ${
            pttActive
              ? 'bg-green-500/30 text-green-300 border-green-500/40 shadow-[0_0_8px_rgba(74,222,128,0.3)]'
              : 'bg-surface-light text-text-muted border-border'
          }`}
        >
          {pttActive ? '● Transmitting' : 'Hold to talk (Space)'}
        </button>
      )}

      {/* Per-player remote controls */}
      {remotePlayers.length > 0 && (
        <div className="mt-0.5 space-y-1">
          {remotePlayers.map(p => {
            if (!roomCode) return null
            const peerId = VoiceManager.peerId(roomCode, p.id)
            const isMuted = mutedPeers.has(peerId)
            const vol = peerVolumes.get(peerId) ?? 1
            const isSpeaking = speakingPeers.has(peerId)

            return (
              <div key={p.id} className="flex items-center gap-1.5">
                {/* Speaking indicator */}
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all ${
                  isSpeaking ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]' : 'bg-border'
                }`} />

                <span className="text-[10px] text-text-muted truncate flex-1 min-w-0">{p.name}</span>

                {/* Volume slider */}
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={isMuted ? 0 : vol}
                  disabled={isMuted}
                  onChange={e => setRemoteVolume(peerId, Number(e.target.value))}
                  className="w-12 accent-primary disabled:opacity-40"
                />

                {/* Mute remote */}
                <button
                  onClick={() => muteRemotePeer(peerId, !isMuted)}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  className={`text-[11px] transition-colors flex-shrink-0 ${
                    isMuted ? 'text-red-400' : 'text-gray-600 hover:text-gray-300'
                  }`}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
