import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRoom } from '../hooks/useRoom'
import { usePlayer } from '../hooks/usePlayer'
import { ThemeToggle } from '../components/ThemeToggle'
import { Doodles } from '../components/Doodles'
import { VoiceControls } from '../components/Game/VoiceControls'
import { SpeakingIndicator } from '../components/Game/SpeakingIndicator'
import { VoiceManager } from '../services/VoiceManager'
import type { VoiceState } from '../hooks/useVoice'
import { CategoryPicker, AiWordGenerator } from '../components/Game/WordSettings'
import type { Player, RoomSettings, ScoringMode } from 'shared'

function SettingRow({ label, value, min, max, step = 1, onChange, disabled }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-text-muted text-sm">{label}</span>
        <span className="text-text text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary disabled:opacity-40"
      />
      <div className="flex justify-between text-[10px] text-text-faint mt-0.5">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

export function Lobby({ roomCode, voice }: { roomCode: string; voice: VoiceState }) {
  const { players, playerId, isOwner, settings, error, toggleReady, toggleSpectate, leaveRoom, startGame, updateSettings, voteKick } = useRoom()
  const { currentPlayer, changeName } = usePlayer()
  const [showNameChange, setShowNameChange] = useState(false)
  const [newName, setNewName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [draft, setDraft] = useState<RoomSettings>(settings)
  const [wordInput, setWordInput] = useState('')

  const handleNameChange = () => {
    if (newName.trim()) changeName(newName.trim())
    setShowNameChange(false)
    setNewName('')
  }

  const openSettings = () => {
    setDraft(settings)
    setWordInput('')
    setShowSettings(true)
  }

  const commitWordInput = () => {
    if (!wordInput.trim()) return
    const parsed = wordInput.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length >= 2)
    if (parsed.length === 0) return
    setDraft(d => ({ ...d, customWords: [...d.customWords, ...parsed].slice(0, 200) }))
    setWordInput('')
  }

  const removeCustomWord = (i: number) => {
    setDraft(d => ({ ...d, customWords: d.customWords.filter((_, idx) => idx !== i) }))
  }

  const saveSettings = () => {
    updateSettings(draft)
    setShowSettings(false)
  }

  const connectedPlayers = players.filter(p => p.connected)
  const activePlayers = connectedPlayers.filter(p => p.state !== 'spectating')
  const allReady = activePlayers.length >= 2 && activePlayers.every(p => p.state === 'ready')

  const isSpeaking = (p: Player) =>
    p.id === playerId
      ? voice.localSpeaking
      : voice.speakingPeers.has(VoiceManager.peerId(roomCode, p.id))

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">

      {/* Word-doodle backdrop */}
      <Doodles />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >

        {/* Header with room code */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-text mb-1">Waiting for players</h1>
          <p className="text-text-muted text-sm mb-5">Share this code with friends to join</p>
          <div className="flex items-center justify-center gap-2">
            {roomCode.split('').map((digit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07, duration: 0.3 }}
                className="w-12 h-16 flex items-center justify-center bg-surface border-2 border-primary/50 rounded-2xl shadow-[0_0_20px_rgba(139,92,246,0.2)]"
              >
                <span className="text-2xl font-black font-mono text-text tracking-tighter">{digit}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-text-muted text-sm mt-3 font-medium">Room code</p>
        </div>

        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl mb-4 text-center text-sm">
            {error}
          </div>
        )}

        {/* Player List */}
        <div className="bg-surface rounded-2xl border border-border mb-4 overflow-hidden shadow-lg shadow-black/5">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Players</h2>
            <span className="text-xs text-text-muted">{activePlayers.length}/{settings.maxPlayers} playing</span>
          </div>
          <div className="divide-y divide-border">
            {players.map((player, idx) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    player.state === 'spectating' ? 'bg-purple-400' :
                    player.state === 'ready' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' :
                    'bg-border'
                  }`} />
                  <span className={`truncate font-medium ${player.id === currentPlayer?.id ? 'text-primary' : 'text-text'}`}>
                    {player.name}
                  </span>
                  {player.connected && <SpeakingIndicator speaking={isSpeaking(player)} />}
                  {player.id === currentPlayer?.id && (
                    <span className="text-xs text-text-muted flex-shrink-0">(you)</span>
                  )}
                  {player.id === currentPlayer?.id && isOwner && (
                    <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded-md flex-shrink-0 font-medium">
                      Host
                    </span>
                  )}
                  {player.state === 'spectating' && (
                    <span className="text-xs bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded-md flex-shrink-0">
                      👁 Spectating
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className={`text-sm font-medium ${
                    player.state === 'spectating' ? 'text-purple-400' :
                    player.state === 'ready' ? 'text-green-400' : 'text-text-muted'
                  }`}>
                    {player.state === 'spectating' ? 'Spectating' :
                     player.state === 'ready' ? 'Ready ✓' : 'Not ready'}
                  </span>
                  {player.id !== currentPlayer?.id && player.connected && (
                    <button
                      onClick={() => voteKick(player.id)}
                      title="Vote to kick"
                      className="text-text-muted/40 hover:text-red-400 text-xs transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            {players.length === 0 && (
              <div className="px-4 py-6 text-center text-text-muted text-sm">No players yet</div>
            )}
          </div>
        </div>

        {/* Settings summary */}
        <div className="bg-surface rounded-2xl border border-border mb-4 px-4 py-3 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-text">Settings</h2>
            {isOwner && (
              <button
                onClick={openSettings}
                className="text-xs text-primary hover:text-primary-light transition-colors font-medium"
              >
                Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <span className="text-text-muted">Max players</span><span className="text-text text-right font-medium">{settings.maxPlayers}</span>
            <span className="text-text-muted">Rounds</span><span className="text-text text-right font-medium">{settings.rounds}</span>
            <span className="text-text-muted">Drawing time</span><span className="text-text text-right font-medium">{settings.drawingTime}s</span>
            <span className="text-text-muted">Words per turn</span><span className="text-text text-right font-medium">{settings.wordsPerTurn}</span>
            <span className="text-text-muted">Scoring</span>
            <span className={`text-right font-semibold ${settings.scoringMode === 'competitive' ? 'text-orange-400' : 'text-text'}`}>
              {settings.scoringMode === 'competitive' ? 'Competitive' : 'Normal'}
            </span>
            <span className="text-text-muted">Visibility</span>
            <span className={`text-right font-medium ${settings.isPublic ? 'text-green-400' : 'text-text'}`}>
              {settings.isPublic ? 'Public' : 'Private'}
            </span>
            <span className="text-text-muted">Word packs</span>
            <span className="text-text text-right font-medium">{settings.wordCategories.length}</span>
            {settings.customWords.length > 0 && (
              <>
                <span className="text-text-muted">Custom words</span>
                <span className="text-primary text-right font-medium">{settings.customWords.length} words ({settings.customWordsChance}%)</span>
              </>
            )}
          </div>
        </div>

        {/* Voice chat — available from the lobby; state carries into the game */}
        <div className="bg-surface rounded-2xl border border-border mb-4 px-4 py-3 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-text">Voice chat</h2>
            <span className="text-[11px] text-text-faint">Off by default · turn on to talk</span>
          </div>
          {voice.micError ? (
            <p className="text-xs text-red-400">{voice.micError}</p>
          ) : !voice.voiceReady ? (
            <p className="text-xs text-text-faint">Connecting microphone…</p>
          ) : (
            <VoiceControls voice={voice} players={players} playerId={playerId} roomCode={roomCode} />
          )}
        </div>

        {activePlayers.length < 2 && (
          <p className="text-text-muted text-center text-sm mb-4">Need at least 2 players to start</p>
        )}

        {/* Actions */}
        <div className="space-y-2.5">
          {currentPlayer?.state !== 'spectating' && (
            <button
              onClick={toggleReady}
              className={`w-full px-6 py-3.5 rounded-xl font-semibold transition-all ${
                currentPlayer?.state === 'ready'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                  : 'bg-green-500 text-white hover:brightness-110 shadow-lg shadow-green-500/25'
              }`}
            >
              {currentPlayer?.state === 'ready' ? 'Cancel Ready' : 'Ready Up'}
            </button>
          )}

          <button
            onClick={toggleSpectate}
            className={`w-full px-6 py-3 rounded-xl font-medium transition-colors ${
              currentPlayer?.state === 'spectating'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25'
                : 'bg-surface-light text-text-muted border border-border hover:bg-border/60'
            }`}
          >
            {currentPlayer?.state === 'spectating' ? '👁 Stop Spectating' : '👁 Spectate'}
          </button>

          {isOwner && activePlayers.length >= 2 && (
            <button
              onClick={startGame}
              disabled={!allReady}
              className={`w-full px-6 py-3.5 rounded-xl font-semibold transition-all ${
                allReady
                  ? 'bg-primary text-white hover:brightness-110 shadow-md shadow-primary/20'
                  : 'bg-surface-light text-text-muted border border-border cursor-not-allowed'
              }`}
            >
              {allReady
                ? 'Start Game'
                : `Waiting for all to ready up (${activePlayers.filter(p => p.state === 'ready').length}/${activePlayers.length})`}
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setNewName(currentPlayer?.name || ''); setShowNameChange(true) }}
              className="flex-1 px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-muted hover:bg-surface-light hover:text-text transition-colors"
            >
              Change Name
            </button>
            <button
              onClick={leaveRoom}
              className="flex-1 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm hover:bg-red-500/20 transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      </motion.div>

      {/* Name Change Modal */}
      {showNameChange && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-surface rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl"
          >
            <h3 className="text-text font-semibold mb-4">Change Name</h3>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNameChange()}
              placeholder="New name"
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 bg-surface-light rounded-xl border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 mb-4 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNameChange(false); setNewName('') }}
                className="flex-1 px-4 py-2.5 bg-surface-light text-text-muted rounded-xl hover:bg-border/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNameChange}
                disabled={!newName.trim()}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl hover:brightness-110 transition-all disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-surface rounded-2xl border border-border p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <h3 className="text-text font-semibold mb-5">Room Settings</h3>
            <div className="space-y-5">
              <SettingRow label="Max players" value={draft.maxPlayers} min={2} max={10} onChange={v => setDraft(d => ({ ...d, maxPlayers: v }))} disabled={false} />
              <SettingRow label="Rounds" value={draft.rounds} min={1} max={10} onChange={v => setDraft(d => ({ ...d, rounds: v }))} disabled={false} />
              <SettingRow label="Drawing time (s)" value={draft.drawingTime} min={30} max={180} step={10} onChange={v => setDraft(d => ({ ...d, drawingTime: v }))} disabled={false} />
              <SettingRow label="Words per turn" value={draft.wordsPerTurn} min={1} max={5} onChange={v => setDraft(d => ({ ...d, wordsPerTurn: v }))} disabled={false} />
              <SettingRow label="Players per network (IP)" value={draft.clientsPerIpLimit} min={1} max={10} onChange={v => setDraft(d => ({ ...d, clientsPerIpLimit: v }))} disabled={false} />

              {/* Public room toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-text-muted text-sm font-medium block">Public room</span>
                  <span className="text-[11px] text-text-faint">Anyone can find and join from the home page</span>
                </div>
                <button
                  onClick={() => setDraft(d => ({ ...d, isPublic: !d.isPublic }))}
                  role="switch"
                  aria-checked={draft.isPublic}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${
                    draft.isPublic ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    draft.isPublic ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <CategoryPicker
                selected={draft.wordCategories}
                onChange={cats => setDraft(d => ({ ...d, wordCategories: cats }))}
              />

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-text-muted text-sm font-medium">Scoring mode</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['normal', 'competitive'] as ScoringMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setDraft(d => ({ ...d, scoringMode: m }))}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        draft.scoringMode === m
                          ? m === 'competitive'
                            ? 'bg-orange-500/20 border border-orange-500/50 text-orange-300'
                            : 'bg-primary/20 border border-primary/50 text-primary'
                          : 'bg-surface-light border border-border text-text-muted hover:text-text'
                      }`}
                    >
                      <div className="font-semibold capitalize">{m}</div>
                      <div className="text-xs mt-0.5 opacity-70">
                        {m === 'competitive' ? '50–500 pts' : '100–200 pts'}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-text-faint mt-1.5">
                  {draft.scoringMode === 'competitive'
                    ? 'Quadratic time bonus — guess early for huge points.'
                    : 'Linear time bonus — balanced scoring for everyone.'}
                </p>
              </div>

              {/* Custom words */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-text-muted text-sm font-medium">Custom words</span>
                  <span className="text-[11px] text-text-faint">{draft.customWords.length}/200</span>
                </div>

                {draft.customWords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 max-h-28 overflow-y-auto">
                    {draft.customWords.map((w, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/15 border border-primary/30 text-primary text-xs rounded-full"
                      >
                        {w}
                        <button
                          onClick={() => removeCustomWord(i)}
                          className="text-primary/60 hover:text-primary leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wordInput}
                    onChange={e => setWordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitWordInput() } }}
                    placeholder="Add words (comma or Enter to separate)"
                    className="flex-1 px-3 py-2 bg-surface-light rounded-xl border border-border text-text text-sm placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={commitWordInput}
                    className="px-3 py-2 bg-primary/15 border border-primary/30 text-primary text-sm rounded-xl hover:bg-primary/25 transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-2">
                  <AiWordGenerator
                    onWords={words => setDraft(d => ({ ...d, customWords: [...new Set([...d.customWords, ...words])].slice(0, 200) }))}
                  />
                </div>

                {draft.customWords.length > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-text-muted/70 text-xs">Custom word chance</span>
                      <span className="text-text text-xs tabular-nums font-medium">{draft.customWordsChance}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={draft.customWordsChance}
                      onChange={e => setDraft(d => ({ ...d, customWordsChance: Number(e.target.value) }))}
                      className="w-full accent-primary"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2.5 bg-surface-light text-text-muted rounded-xl hover:bg-border/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl hover:brightness-110 transition-all"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
