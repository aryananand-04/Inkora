import { useRef, useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas } from '../components/Canvas/Canvas'
import { Toolbar } from '../components/Canvas/Toolbar'
import { WordSelection } from '../components/Game/WordSelection'
import { WordHintDisplay } from '../components/Game/WordHintDisplay'
import { Timer } from '../components/Game/Timer'
import { Chat } from '../components/Chat/Chat'
import { VoiceControls } from '../components/Game/VoiceControls'
import { AudioSettings } from '../components/Game/AudioSettings'
import { SpeakingIndicator } from '../components/Game/SpeakingIndicator'
import { ThemeToggle } from '../components/ThemeToggle'
import { Wordmark } from '../components/Wordmark'
import { CategoryPicker, AiWordGenerator } from '../components/Game/WordSettings'
import { DrawingProvider } from '../context/DrawingContext'
import { useSocket } from '../context/SocketContext'
import { useDrawingSync } from '../hooks/useDrawingSync'
import { useRoom } from '../hooks/useRoom'
import { VoiceManager } from '../services/VoiceManager'
import type { CanvasHandle } from '../components/Canvas/Canvas'
import type { VoiceState } from '../hooks/useVoice'
import type { Player, RoomSettings, ScoringMode } from 'shared'
import { CONSTANTS, REACTION_EMOJIS } from 'shared'

// ── Floating emoji reactions ─────────────────────────────────────────────────

interface FloatingReaction {
  key: number
  emoji: string
  playerName: string
  x: number  // % offset across the canvas
}

let _reactionKey = 0

function useReactions() {
  const { socket } = useSocket()
  const [reactions, setReactions] = useState<FloatingReaction[]>([])

  useEffect(() => {
    const onReaction = ({ playerName, emoji }: { playerId: string; playerName: string; emoji: string }) => {
      const key = _reactionKey++
      setReactions(prev => [...prev.slice(-15), {
        key, emoji, playerName,
        x: 10 + Math.random() * 80,
      }])
      setTimeout(() => setReactions(prev => prev.filter(r => r.key !== key)), 2500)
    }
    socket.on('reaction', onReaction)
    return () => { socket.off('reaction', onReaction) }
  }, [socket])

  return reactions
}

function ReactionOverlay({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-xl">
      <AnimatePresence>
        {reactions.map(r => (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 1, y: -120, scale: 1.15 }}
            exit={{ opacity: 0, y: -180, scale: 0.9 }}
            transition={{ duration: 2.2, ease: 'easeOut' }}
            className="absolute bottom-10 flex flex-col items-center"
            style={{ left: `${r.x}%` }}
          >
            <span className="text-3xl drop-shadow">{r.emoji}</span>
            <span className="text-[10px] font-semibold text-white/90 bg-black/40 px-1.5 py-0.5 rounded-full mt-0.5">
              {r.playerName}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1 px-2 py-1 glass bg-surface/80 border border-border rounded-full shadow-lg">
      {REACTION_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="w-8 h-8 flex items-center justify-center text-lg rounded-full hover:bg-border/60 hover:scale-125 transition-all"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

function SettingRow({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-text-muted text-sm">{label}</span>
        <span className="text-text text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-[10px] text-text-faint mt-0.5">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

// --- Player card (desktop sidebar) ---

const PlayerCard = memo(function PlayerCard({ player, isSelf, isSpeaking, guessed }: { player: Player; isSelf: boolean; isSpeaking: boolean; guessed: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${
      isSelf
        ? 'bg-primary/15 border border-primary/20 text-primary'
        : 'bg-surface border border-border text-text hover:bg-surface-light'
    }`}>
      {/* State dot (player state only — speaking is shown by the mic) */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${
        player.state === 'drawing'  ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.6)]' :
        player.state === 'guessing' ? 'bg-blue-400'  :
        player.state === 'standby'  ? 'bg-green-400' :
        player.state === 'spectating' ? 'bg-purple-400' :
        'bg-border'
      }`} />

      <span className="truncate flex-1 font-medium">{player.name}</span>

      {/* Live talking indicator */}
      <SpeakingIndicator speaking={isSpeaking} />

      {guessed && (
        <span className="text-green-400 text-xs flex-shrink-0" title="Guessed the word">✓</span>
      )}

      {player.state === 'drawing' && (
        <span className="text-xs flex-shrink-0">✏️</span>
      )}
      {player.state === 'spectating' && (
        <span className="text-xs flex-shrink-0 text-text-muted">👁</span>
      )}

      <div className="relative flex-shrink-0 flex items-center gap-1">
        <span className="text-xs tabular-nums font-semibold">{player.score}</span>
        {player.lastScore > 0 && (
          <span
            key={`${player.id}-${player.score}`}
            className="score-pop absolute -top-4 right-0 text-green-400 text-xs font-bold whitespace-nowrap"
          >
            +{player.lastScore}
          </span>
        )}
      </div>
    </div>
  )
})

// --- Main component ---

function GameInner({ voice }: { voice: VoiceState }) {
  const canvasRef = useRef<CanvasHandle>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<RoomSettings | null>(null)
  const [wordInput, setWordInput] = useState('')

  const {
    roomCode, players, playerId, leaveRoom, currentDrawing,
    allowDrawing, wordChoices, preSelectedWord, wordHints, currentWord,
    round, rounds, timeLeft, drawingTime, chooseWord,
    messages, closeGuessHint, previousWord, currentDrawerId, sendMessage, voteKick,
    isOwner, settings, updateSettings, correctGuessers, turnResult, sendReaction,
  } = useRoom()

  const reactions = useReactions()

  const guessedSet = new Set(correctGuessers)

  const openSettings = () => {
    setSettingsDraft(settings)
    setWordInput('')
    setShowSettings(true)
  }

  const saveSettings = () => {
    if (!settingsDraft) return
    updateSettings(settingsDraft)
    setShowSettings(false)
  }

  const commitWordInput = () => {
    if (!wordInput.trim() || !settingsDraft) return
    const parsed = wordInput.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length >= 2)
    if (!parsed.length) return
    setSettingsDraft(d => d ? { ...d, customWords: [...d.customWords, ...parsed].slice(0, 200) } : d)
    setWordInput('')
  }

  const removeCustomWord = (i: number) => {
    setSettingsDraft(d => d ? { ...d, customWords: d.customWords.filter((_, idx) => idx !== i) } : d)
  }

  const { sendLine, sendFill, sendClear, sendUndo } = useDrawingSync(canvasRef, currentDrawing)

  const drawer = players.find(p => p.state === 'drawing')
  const choosingDrawer = currentDrawerId ? players.find(p => p.id === currentDrawerId) : null
  const currentPlayer = players.find(p => p.id === playerId)
  const hasActiveWord = wordHints !== null || allowDrawing

  // Live guess progress: how many of the eligible guessers have gotten it
  const guesserTotal = players.filter(p => p.connected && p.state !== 'spectating' && p.state !== 'drawing').length
  const guessedCount = correctGuessers.length

  const handleClear = () => { canvasRef.current?.clear(); sendClear() }
  const handleUndo = () => sendUndo()

  const isSpeaking = (p: Player) => {
    if (p.id === playerId) return voice.localSpeaking
    if (!roomCode) return false
    return voice.speakingPeers.has(VoiceManager.peerId(roomCode, p.id))
  }

  const centerContent = wordChoices ? (
    <span className="text-primary text-sm font-semibold animate-pulse">Choose a word…</span>
  ) : currentDrawerId && !drawer ? (
    playerId === currentDrawerId ? (
      <span className="text-primary text-sm font-semibold animate-pulse">Choose a word…</span>
    ) : (
      <span className="text-sm text-text-muted">
        <span className="text-yellow-400 font-bold">{choosingDrawer?.name ?? 'Someone'}</span> is choosing a word…
      </span>
    )
  ) : hasActiveWord && wordHints ? (
    <WordHintDisplay hints={wordHints} actualWord={allowDrawing ? currentWord : null} />
  ) : allowDrawing ? (
    <span className="text-sm text-primary font-semibold">Your turn to draw!</span>
  ) : drawer ? (
    <span className="text-sm text-text-muted">
      <span className="text-yellow-400 font-bold">{drawer.name}</span> is drawing
    </span>
  ) : previousWord ? (
    <span className="text-sm text-text-muted">
      Word was: <span className="text-yellow-400 font-bold">{previousWord}</span>
    </span>
  ) : (
    <span className="font-black text-lg tracking-tight"><Wordmark underline={false} /></span>
  )

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="relative z-20 h-14 flex-shrink-0 glass bg-surface/80 border-b border-border flex items-center px-4 gap-4">

        <span className="hidden sm:block font-black text-lg tracking-tight flex-shrink-0 w-32">
          <Wordmark underline={false} />
        </span>

        <div className="flex-1 flex items-center justify-center min-w-0 px-2">
          {centerContent}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {rounds > 0 && (
            <span className="hidden sm:block text-text-muted text-xs whitespace-nowrap">
              Round <span className="text-text font-semibold">{round}</span>
              <span className="text-text-faint"> / {rounds}</span>
            </span>
          )}

          {hasActiveWord && guesserTotal > 0 && (
            <span
              title="Players who have guessed"
              className="flex items-center gap-1 px-2 py-1 bg-surface-light border border-border rounded-lg text-xs tabular-nums whitespace-nowrap"
            >
              <span className="text-green-400">✓</span>
              <span className="text-text font-semibold">{guessedCount}</span>
              <span className="text-text-faint">/ {guesserTotal}</span>
            </span>
          )}

          {timeLeft > 0 && <Timer timeLeft={timeLeft} totalTime={drawingTime} />}

          {roomCode && (
            <div className="px-2.5 py-1 bg-surface-light border border-border rounded-lg text-xs font-mono text-text-muted tracking-widest">
              {roomCode}
            </div>
          )}

          {isOwner && (
            <button
              onClick={openSettings}
              title="Settings"
              className="w-7 h-7 flex items-center justify-center bg-surface-light hover:bg-border/60 border border-border rounded-lg text-text-muted hover:text-text text-sm transition-colors"
            >
              ⚙
            </button>
          )}

          <AudioSettings />

          <button
            onClick={() => setShowHelp(true)}
            title="Help"
            className="w-7 h-7 flex items-center justify-center bg-surface-light hover:bg-border/60 border border-border rounded-lg text-text-muted hover:text-text text-xs transition-colors font-bold"
          >
            ?
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0 p-2 gap-2 md:p-3 md:gap-3">

        {/* Player sidebar — desktop only */}
        <aside className="hidden md:flex w-44 flex-shrink-0 flex-col gap-2">
          <h2 className="text-text-muted text-xs uppercase tracking-wider font-semibold px-1">Players</h2>
          <div className="flex flex-col gap-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {players.map(p => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="group relative"
                >
                  <PlayerCard player={p} isSelf={p.id === playerId} isSpeaking={isSpeaking(p)} guessed={guessedSet.has(p.id)} />
                  {p.id !== playerId && p.connected && (
                    <button
                      onClick={() => voteKick(p.id)}
                      title="Vote to kick"
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-text-muted/40 hover:text-red-400 text-xs transition-all px-1"
                    >
                      ✕
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Voice controls */}
          <div className="mt-auto flex flex-col gap-2">
            <VoiceControls
              voice={voice}
              players={players}
              playerId={playerId}
              roomCode={roomCode}
            />
            <button
              onClick={leaveRoom}
              className="px-3 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm hover:bg-red-500/20 transition-colors border border-red-500/15 font-medium"
            >
              Leave
            </button>
          </div>
        </aside>

        {/* Center: canvas + toolbar + mobile players */}
        <main className="flex-1 flex flex-col gap-2 min-w-0">

          <div className="flex-1 min-h-0 relative">
            <Canvas
              ref={canvasRef}
              allowDrawing={allowDrawing}
              onLine={sendLine}
              onFill={sendFill}
              onClear={handleClear}
              onUndo={handleUndo}
            />
            {wordChoices && (
              <WordSelection
                words={wordChoices}
                preSelectedWord={preSelectedWord}
                timeLeft={CONSTANTS.WORD_CHOICE_TIMEOUT}
                onChoose={chooseWord}
              />
            )}

            {/* Emoji reactions — float up over the canvas */}
            <ReactionOverlay reactions={reactions} />
            {!allowDrawing && !wordChoices && <ReactionBar onReact={sendReaction} />}

            {/* End-of-turn reveal */}
            <AnimatePresence>
              {turnResult && !wordChoices && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm rounded-xl pointer-events-none px-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  >
                    <p className="text-white/70 text-sm mb-1">The word was</p>
                    <p className="text-3xl sm:text-4xl font-black text-white mb-3 break-words">{turnResult.word}</p>
                    <p className={`text-sm font-semibold ${turnResult.guessed > 0 ? 'text-green-400' : 'text-white/60'}`}>
                      {turnResult.guessed === 0
                        ? 'Nobody guessed it 😬'
                        : `${turnResult.guessed} ${turnResult.guessed === 1 ? 'player' : 'players'} guessed it 🎉`}
                    </p>

                    {/* Who scored what this turn */}
                    {turnResult.scores.length > 0 && (
                      <div className="mt-4 space-y-1 max-h-40 overflow-hidden">
                        {turnResult.scores.slice(0, 6).map((s, i) => (
                          <motion.div
                            key={s.playerId}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + i * 0.08 }}
                            className="flex items-center justify-between gap-6 px-4 py-1 bg-white/10 rounded-lg text-sm"
                          >
                            <span className="text-white/90 font-medium truncate max-w-40">{s.playerName}</span>
                            <span className="text-green-400 font-bold tabular-nums">+{s.points}</span>
                          </motion.div>
                        ))}
                        {turnResult.scores.length > 6 && (
                          <p className="text-white/50 text-xs">+{turnResult.scores.length - 6} more</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {allowDrawing && <Toolbar onClear={handleClear} onUndo={handleUndo} />}

          {/* Mobile: horizontal player strip */}
          <div className="md:hidden flex gap-1.5 overflow-x-auto pb-0.5">
            {players.map(p => (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs flex-shrink-0 border ${
                  p.id === playerId
                    ? 'bg-primary/15 border-primary/20 text-primary'
                    : 'bg-surface border-border text-text'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all ${
                  p.state === 'drawing'       ? 'bg-yellow-400' :
                  p.state === 'guessing'      ? 'bg-blue-400'   :
                  p.state === 'standby'       ? 'bg-green-400'  :
                  p.state === 'spectating'    ? 'bg-purple-400' :
                  'bg-border'
                }`} />
                <span className="max-w-20 truncate font-medium">{p.name}</span>
                <SpeakingIndicator speaking={isSpeaking(p)} />
                {guessedSet.has(p.id) && <span className="text-green-400 text-xs flex-shrink-0">✓</span>}
                {p.state === 'drawing' && <span className="text-xs flex-shrink-0">✏️</span>}
                {p.state === 'spectating' && <span className="text-xs flex-shrink-0 text-text-muted">👁</span>}
                <div className="relative">
                  <span className="font-bold tabular-nums">{p.score}</span>
                  {p.lastScore > 0 && (
                    <span
                      key={`m-${p.id}-${p.score}`}
                      className="score-pop absolute -top-3 left-0 text-green-400 text-[10px] font-bold"
                    >
                      +{p.lastScore}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Chat sidebar — desktop only */}
        <aside className="hidden md:flex w-56 flex-shrink-0 glass bg-surface/80 rounded-2xl border border-border flex-col overflow-hidden">
          <Chat
            messages={messages}
            onSend={sendMessage}
            playerState={currentPlayer?.state ?? 'standby'}
            closeGuessHint={closeGuessHint}
          />
        </aside>

      </div>

      {/* ── Mobile bottom bar ── */}
      <div className="md:hidden flex-shrink-0 flex items-center gap-2 px-3 py-2 glass bg-surface/80 border-t border-border">
        <button
          onClick={() => setShowMobileChat(true)}
          className="flex-1 py-2 bg-surface-light text-text text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-border/60 transition-colors border border-border"
        >
          <span>💬</span>
          <span>Chat</span>
          {messages.length > 0 && (
            <span className="bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {Math.min(messages.length, 9)}
            </span>
          )}
        </button>

        {voice.voiceReady && (
          <button
            onClick={voice.voiceMode === 'ptt' ? undefined : voice.toggleMute}
            onPointerDown={voice.voiceMode === 'ptt' ? () => voice.setPttActive(true) : undefined}
            onPointerUp={voice.voiceMode === 'ptt' ? () => voice.setPttActive(false) : undefined}
            onPointerLeave={voice.voiceMode === 'ptt' ? () => voice.setPttActive(false) : undefined}
            className={`px-3 py-2 text-sm rounded-xl transition-colors border ${
              voice.pttActive
                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : voice.muted
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : voice.localSpeaking
                ? 'bg-green-500/15 text-green-400 border-green-500/20'
                : 'bg-surface-light text-text-muted border-border'
            }`}
          >
            {voice.muted || (voice.voiceMode === 'ptt' && !voice.pttActive) ? '🔇' : '🎙'}
          </button>
        )}
        {voice.micError && (
          <span title={voice.micError} className="text-lg select-none">🔇</span>
        )}

        <button
          onClick={leaveRoom}
          className="px-4 py-2 bg-red-500/10 text-red-400 text-sm rounded-xl hover:bg-red-500/20 transition-colors border border-red-500/15"
        >
          Leave
        </button>
      </div>

      {/* ── Help modal ── */}
      {showHelp && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowHelp(false) }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass bg-surface/90 rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-text font-semibold">How to Play</h2>
              <button onClick={() => setShowHelp(false)} className="text-text-muted hover:text-text text-xl leading-none transition-colors">×</button>
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <div>
                <p className="text-text font-semibold mb-1.5">Drawing</p>
                <ul className="space-y-1">
                  <li>Click &amp; drag to draw</li>
                  <li>Click the fill tool then a spot to flood-fill</li>
                  <li><kbd className="bg-surface-light border border-border px-1.5 py-0.5 rounded text-xs text-text font-mono">Z</kbd> — Undo last stroke</li>
                  <li><kbd className="bg-surface-light border border-border px-1.5 py-0.5 rounded text-xs text-text font-mono">Del</kbd> — Clear canvas</li>
                </ul>
              </div>
              <div>
                <p className="text-text font-semibold mb-1.5">Voice</p>
                <ul className="space-y-1">
                  <li>Use the mic panel in the sidebar to switch PTT / Always-on</li>
                  <li><kbd className="bg-surface-light border border-border px-1.5 py-0.5 rounded text-xs text-text font-mono">Space</kbd> — Push-to-talk</li>
                </ul>
              </div>
              <div>
                <p className="text-text font-semibold mb-1.5">Guessing</p>
                <ul className="space-y-1">
                  <li>Type your guess in chat and press Enter</li>
                  <li>Score more points for guessing early</li>
                  <li>A yellow "So close!" banner means you're 1 letter off</li>
                </ul>
              </div>
              <div>
                <p className="text-text font-semibold mb-1.5">Scoring</p>
                <ul className="space-y-1">
                  <li>Guessers: 100 + time bonus (up to 200)</li>
                  <li>Drawer: up to 50 based on how many guessed correctly</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Settings modal ── */}
      {showSettings && settingsDraft && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass bg-surface/90 rounded-2xl border border-border p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-text font-semibold">Settings</h2>
              <p className="text-[11px] text-text-faint">Changes apply next turn</p>
            </div>

            <div className="space-y-5">
              <SettingRow label="Rounds" value={settingsDraft.rounds} min={Math.max(1, round)} max={10}
                onChange={v => setSettingsDraft(d => d ? { ...d, rounds: v } : d)} />
              <SettingRow label="Drawing time (s)" value={settingsDraft.drawingTime} min={30} max={180} step={10}
                onChange={v => setSettingsDraft(d => d ? { ...d, drawingTime: v } : d)} />
              <SettingRow label="Words per turn" value={settingsDraft.wordsPerTurn} min={1} max={5}
                onChange={v => setSettingsDraft(d => d ? { ...d, wordsPerTurn: v } : d)} />

              <CategoryPicker
                selected={settingsDraft.wordCategories}
                onChange={cats => setSettingsDraft(d => d ? { ...d, wordCategories: cats } : d)}
              />

              <div>
                <span className="text-text-muted text-sm font-medium block mb-2">Scoring mode</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['normal', 'competitive'] as ScoringMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSettingsDraft(d => d ? { ...d, scoringMode: mode } : d)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        settingsDraft.scoringMode === mode
                          ? mode === 'competitive'
                            ? 'bg-orange-500/20 border border-orange-500/50 text-orange-300'
                            : 'bg-primary/20 border border-primary/50 text-primary'
                          : 'bg-surface-light border border-border text-text-muted hover:text-text'
                      }`}
                    >
                      <div className="font-semibold capitalize">{mode}</div>
                      <div className="text-xs mt-0.5 opacity-70">
                        {mode === 'competitive' ? '50–500 pts' : '100–200 pts'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-text-muted text-sm font-medium">Custom words</span>
                  <span className="text-[11px] text-text-faint">{settingsDraft.customWords.length}/200</span>
                </div>

                {settingsDraft.customWords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 max-h-28 overflow-y-auto">
                    {settingsDraft.customWords.map((w, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/15 border border-primary/30 text-primary text-xs rounded-full"
                      >
                        {w}
                        <button onClick={() => removeCustomWord(i)} className="text-primary/60 hover:text-primary leading-none">×</button>
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
                    placeholder="Add words (comma or Enter)"
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
                    onWords={words => setSettingsDraft(d => d ? { ...d, customWords: [...new Set([...d.customWords, ...words])].slice(0, 200) } : d)}
                  />
                </div>

                {settingsDraft.customWords.length > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-text-muted/70 text-xs">Custom word chance</span>
                      <span className="text-text text-xs tabular-nums font-medium">{settingsDraft.customWordsChance}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={settingsDraft.customWordsChance}
                      onChange={e => setSettingsDraft(d => d ? { ...d, customWordsChance: Number(e.target.value) } : d)}
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

      {/* ── Mobile chat overlay ── */}
      {showMobileChat && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col justify-end"
          onClick={e => { if (e.target === e.currentTarget) setShowMobileChat(false) }}
        >
          <div className="glass bg-surface/90 h-2/3 rounded-t-3xl flex flex-col slide-up border-t border-border shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-text font-semibold text-sm">Chat</h2>
              <button
                onClick={() => setShowMobileChat(false)}
                className="text-text-muted hover:text-text text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Chat
                messages={messages}
                onSend={(msg) => { sendMessage(msg); setShowMobileChat(false) }}
                playerState={currentPlayer?.state ?? 'standby'}
                closeGuessHint={closeGuessHint}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export function Game({ voice }: { voice: VoiceState }) {
  return (
    <DrawingProvider>
      <GameInner voice={voice} />
    </DrawingProvider>
  )
}
