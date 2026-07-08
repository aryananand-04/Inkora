import { useState, useEffect, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'
import { DEFAULT_ROOM_SETTINGS } from 'shared'
import type { Player, GameState, RoomSettings, DrawEvent, WordHint, MessageEvent, GameOverEvent, TurnScore } from 'shared'
import { playCorrectSound, playTurnStartSound } from '../services/sounds'

interface RoomState {
  roomCode: string | null
  playerId: string | null
  playerName: string | null
  ownerId: string | null
  players: Player[]
  gameState: GameState
  settings: RoomSettings
  round: number
  rounds: number
  currentDrawing: DrawEvent[]
  allowDrawing: boolean
  wordChoices: string[] | null
  preSelectedWord: number
  pendingWordIndex: number | null
  currentWord: string | null
  wordHints: WordHint[] | null
  timeLeft: number
  drawingTime: number
  messages: MessageEvent[]
  closeGuessHint: string | null
  previousWord: string | null
  currentDrawerId: string | null
  correctGuessers: string[]                                   // ids who guessed this turn
  // brief end-of-turn reveal: the word + who scored what
  turnResult: { word: string; guessed: number; scores: TurnScore[] } | null
  gameOverData: GameOverEvent | null
  error: string | null
}

// Players can briefly appear twice (e.g. a join event arriving for someone
// already in the list on reconnect). Keep the list unique by id, last-write-wins.
function uniqueById(players: Player[]): Player[] {
  const map = new Map<string, Player>()
  for (const p of players) map.set(p.id, p)
  return [...map.values()]
}

const initialState: RoomState = {
  roomCode: null,
  playerId: null,
  playerName: null,
  ownerId: null,
  players: [],
  gameState: 'unstarted',
  settings: DEFAULT_ROOM_SETTINGS,
  round: 0,
  rounds: 3,
  currentDrawing: [],
  allowDrawing: false,
  wordChoices: null,
  preSelectedWord: 0,
  pendingWordIndex: null,
  currentWord: null,
  wordHints: null,
  timeLeft: 0,
  drawingTime: 80,
  messages: [],
  closeGuessHint: null,
  previousWord: null,
  currentDrawerId: null,
  correctGuessers: [],
  turnResult: null,
  gameOverData: null,
  error: null,
}

// ── Session persistence ────────────────────────────────────────────────────
const SESSION_KEY = 'inkora-session'

function saveSession(roomCode: string, playerName: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerName }))
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

function getSavedSession(): { roomCode: string; playerName: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.roomCode && parsed?.playerName) return parsed
  } catch { /* ignore */ }
  return null
}
// ── Module-level singleton ──────────────────────────────────────────────────
let _roomState: RoomState = initialState
const _subscribers = new Set<(s: RoomState) => void>()
let _registeredSocket: ReturnType<typeof useSocket>['socket'] | null = null

function _setRoomState(updater: RoomState | ((prev: RoomState) => RoomState)) {
  _roomState = typeof updater === 'function' ? updater(_roomState) : updater
  _subscribers.forEach(fn => fn(_roomState))
}
// ───────────────────────────────────────────────────────────────────────────

export function useRoom() {
  const { socket, isConnected } = useSocket()
  const [state, localSetState] = useState<RoomState>(_roomState)

  // Subscribe to module-level state changes
  useEffect(() => {
    _subscribers.add(localSetState)
    // Sync immediately in case state changed since last render
    localSetState(_roomState)
    return () => { _subscribers.delete(localSetState) }
  }, [])

  // Register socket listeners exactly once per socket instance
  useEffect(() => {
    if (_registeredSocket === socket) return

    // Remove old listeners if socket changed
    if (_registeredSocket) {
      _registeredSocket.off('ready')
      _registeredSocket.off('update-players')
      _registeredSocket.off('player-join')
      _registeredSocket.off('player-leave')
      _registeredSocket.off('owner-change')
      _registeredSocket.off('next-turn')
      _registeredSocket.off('your-turn')
      _registeredSocket.off('word-chosen')
      _registeredSocket.off('update-wordhint')
      _registeredSocket.off('message')
      _registeredSocket.off('correct-guess')
      _registeredSocket.off('close-guess')
      _registeredSocket.off('game-over')
      _registeredSocket.off('settings-updated')
      _registeredSocket.off('kick-vote')
      _registeredSocket.off('drawer-kicked')
      _registeredSocket.off('game-reset')
      _registeredSocket.off('error')
    }

    _registeredSocket = socket

    const onReady = (data: any) => {
      console.log('[useRoom] Received ready event:', data)
      saveSession(data.roomCode, data.playerName)
      _setRoomState({
        roomCode: data.roomCode,
        playerId: data.playerId,
        playerName: data.playerName,
        ownerId: data.ownerId,
        players: uniqueById(data.players),
        gameState: data.gameState,
        settings: data.settings ?? DEFAULT_ROOM_SETTINGS,
        round: data.round,
        rounds: data.rounds,
        currentDrawing: data.currentDrawing ?? [],
        allowDrawing: data.allowDrawing ?? false,
        wordChoices: data.wordChoices ?? null,
        preSelectedWord: data.preSelectedWord ?? 0,
        pendingWordIndex: null,
        currentWord: data.currentWord ?? null,
        wordHints: data.wordHints ?? null,
        timeLeft: data.timeLeft ?? 0,
        drawingTime: data.drawingTimeSetting ?? 80,
        messages: [],
        closeGuessHint: null,
        previousWord: null,
        currentDrawerId: data.currentDrawerId ?? null,
        correctGuessers: [],
        turnResult: null,
        gameOverData: null,
        error: null,
      })
    }

    const onUpdatePlayers = (players: Player[]) => {
      const unique = uniqueById(players)
      _setRoomState(prev => ({
        ...prev,
        players: unique,
        allowDrawing: unique.find(p => p.id === prev.playerId)?.state === 'drawing',
      }))
    }

    const onPlayerJoin = (player: Player) => {
      // Upsert by id so a duplicate join (e.g. reconnect) replaces rather than duplicates
      _setRoomState(prev => ({ ...prev, players: uniqueById([...prev.players, player]) }))
    }

    const onPlayerLeave = ({ playerId }: { playerId: string }) => {
      _setRoomState(prev => ({ ...prev, players: prev.players.filter(p => p.id !== playerId) }))
    }

    const onOwnerChange = ({ playerId }: { playerId: string }) => {
      _setRoomState(prev => ({ ...prev, ownerId: playerId }))
    }

    const onNextTurn = (data: any) => {
      const prevWord: string | null = data.previousWord ?? null
      const reason: string | null = data.turnEndReason ?? null
      _setRoomState(prev => {
        let newMessages = prev.messages
        if (prevWord) {
          const reasonMsg =
            reason === 'all_guessed' ? `Everyone guessed it! The word was: ${prevWord}` :
            reason === 'drawer_kicked' ? `Drawer left. The word was: ${prevWord}` :
            `Time's up! The word was: ${prevWord}`
          newMessages = [...prev.messages, {
            playerId: '',
            playerName: '',
            content: reasonMsg,
            type: 'system' as const,
          }].slice(-200)
        }
        return {
          ...prev,
          round: data.round,
          players: uniqueById(data.players),
          gameState: 'ongoing',
          wordChoices: null,
          pendingWordIndex: null,
          currentWord: null,
          wordHints: null,
          timeLeft: 0,
          allowDrawing: false,
          previousWord: prevWord,
          currentDrawerId: data.drawerId ?? null,
          correctGuessers: [],
          turnResult: prevWord
            ? { word: prevWord, guessed: prev.correctGuessers.length, scores: data.turnScores ?? [] }
            : prev.turnResult,
          messages: newMessages,
        }
      })
      if (prevWord) setTimeout(() => _setRoomState(p => ({ ...p, turnResult: null })), 4500)
    }

    const onYourTurn = (data: any) => {
      _setRoomState(prev => ({
        ...prev,
        wordChoices: data.words,
        preSelectedWord: data.preSelectedWord,
        pendingWordIndex: null,
        previousWord: null,  // clear so header shows "Choose a word…" not "Word was: X"
        correctGuessers: [],
      }))
    }

    const onWordChosen = (data: any) => {
      playTurnStartSound()
      _setRoomState(prev => {
        const isDrawer = prev.wordChoices !== null
        const chosenIdx = prev.pendingWordIndex ?? prev.preSelectedWord
        const chosenWord = isDrawer ? (prev.wordChoices?.[chosenIdx] ?? null) : null
        return {
          ...prev,
          wordChoices: null,
          pendingWordIndex: null,
          wordHints: data.hints,
          currentWord: chosenWord,
          timeLeft: data.timeLeft,
          previousWord: null,
          turnResult: null,  // drawing started — drop the end-of-turn reveal
        }
      })
    }

    const onUpdateWordhint = (hints: WordHint[]) => {
      _setRoomState(prev => ({ ...prev, wordHints: hints }))
    }

    const onMessage = (data: MessageEvent) => {
      _setRoomState(prev => ({ ...prev, messages: [...prev.messages, data].slice(-200) }))
    }

    const onCorrectGuess = (data: { playerId: string; playerName: string }) => {
      playCorrectSound()
      _setRoomState(prev => ({
        ...prev,
        correctGuessers: prev.correctGuessers.includes(data.playerId)
          ? prev.correctGuessers
          : [...prev.correctGuessers, data.playerId],
        messages: [
          ...prev.messages,
          { playerId: data.playerId, playerName: data.playerName, content: `${data.playerName} guessed the word!`, type: 'correct' as const },
        ].slice(-200),
      }))
    }

    const onCloseGuess = ({ content }: { content: string }) => {
      _setRoomState(prev => ({ ...prev, closeGuessHint: content }))
      setTimeout(() => _setRoomState(prev => ({ ...prev, closeGuessHint: null })), 2000)
    }

    const onGameOver = (data: GameOverEvent) => {
      _setRoomState(prev => ({
        ...prev,
        gameState: 'gameOver',
        players: uniqueById(data.players),
        gameOverData: data,
        allowDrawing: false,
        timeLeft: 0,
        correctGuessers: [],
        turnResult: null,
      }))
    }

    const onSettingsUpdated = ({ settings }: { settings: RoomSettings }) => {
      // Keep the header's total-round count in sync when the owner changes it mid-game
      _setRoomState(prev => ({ ...prev, settings, rounds: settings.rounds }))
    }

    const onKickVote = (data: { targetId: string; currentVotes: number; votesNeeded: number }) => {
      _setRoomState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            playerId: '',
            playerName: '',
            content: `Kick vote: ${data.currentVotes}/${data.votesNeeded} votes`,
            type: 'system' as const,
          },
        ].slice(-200),
      }))
    }

    const onDrawerKicked = () => {
      _setRoomState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            playerId: '',
            playerName: '',
            content: 'The drawer was kicked — advancing to next turn…',
            type: 'system' as const,
          },
        ].slice(-200),
        wordHints: null,
        currentWord: null,
        timeLeft: 0,
        allowDrawing: false,
      }))
    }

    const onGameReset = () => {
      _setRoomState(prev => ({
        ...prev,
        gameState: 'unstarted',
        round: 0,
        wordChoices: null,
        pendingWordIndex: null,
        currentWord: null,
        wordHints: null,
        timeLeft: 0,
        allowDrawing: false,
        previousWord: null,
        currentDrawerId: null,
        correctGuessers: [],
        turnResult: null,
        gameOverData: null,
        messages: [],
        closeGuessHint: null,
      }))
    }

    const onError = ({ message, code }: { message: string; code?: string }) => {
      console.error('[useRoom] Error:', message)
      // Clear saved session if the room is gone or rejoin is impossible
      if (code === 'ROOM_NOT_FOUND' || code === 'GAME_OVER' || code === 'ROOM_FULL') {
        clearSession()
      }
      _setRoomState(prev => ({ ...prev, error: message }))
    }

    socket.on('ready', onReady)
    socket.on('update-players', onUpdatePlayers)
    socket.on('player-join', onPlayerJoin)
    socket.on('player-leave', onPlayerLeave)
    socket.on('owner-change', onOwnerChange)
    socket.on('next-turn', onNextTurn)
    socket.on('your-turn', onYourTurn)
    socket.on('word-chosen', onWordChosen)
    socket.on('update-wordhint', onUpdateWordhint)
    socket.on('message', onMessage)
    socket.on('correct-guess', onCorrectGuess)
    socket.on('close-guess', onCloseGuess)
    socket.on('game-over', onGameOver)
    socket.on('settings-updated', onSettingsUpdated)
    socket.on('kick-vote', onKickVote)
    socket.on('drawer-kicked', onDrawerKicked)
    socket.on('game-reset', onGameReset)
    socket.on('error', onError)
  }, [socket])

  // Auto-rejoin on connect if a saved session exists
  useEffect(() => {
    if (!isConnected || _roomState.roomCode) return
    const session = getSavedSession()
    if (!session) return
    console.log('[useRoom] Auto-rejoining room:', session.roomCode)
    socket.emit('join-room', { roomCode: session.roomCode, playerName: session.playerName })
  }, [isConnected, socket])

  const createRoom = useCallback((playerName: string, settings?: Partial<RoomSettings>, preferredCode?: string) => {
    if (!isConnected) {
      _setRoomState(prev => ({ ...prev, error: 'Not connected to server' }))
      return
    }
    _setRoomState(prev => ({ ...prev, error: null }))
    socket.emit('create-room', { playerName, settings, preferredCode })
  }, [socket, isConnected])

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    if (!isConnected) {
      _setRoomState(prev => ({ ...prev, error: 'Not connected to server' }))
      return
    }
    _setRoomState(prev => ({ ...prev, error: null }))
    socket.emit('join-room', { roomCode, playerName })
  }, [socket, isConnected])

  const toggleReady = useCallback(() => {
    if (!isConnected) return
    socket.emit('toggle-ready')
  }, [socket, isConnected])

  const leaveRoom = useCallback(() => {
    if (!isConnected) return
    clearSession()
    socket.emit('leave-room')
    _setRoomState(initialState)
  }, [socket, isConnected])

  const startGame = useCallback(() => {
    if (!isConnected) return
    socket.emit('start-game')
  }, [socket, isConnected])

  const playAgain = useCallback(() => {
    if (!isConnected) return
    socket.emit('play-again')
  }, [socket, isConnected])

  const sendMessage = useCallback((content: string) => {
    if (!isConnected) return
    socket.emit('message', { content })
  }, [socket, isConnected])

  const chooseWord = useCallback((wordIndex: number) => {
    if (!isConnected) return
    _setRoomState(prev => ({ ...prev, pendingWordIndex: wordIndex }))
    socket.emit('choose-word', { wordIndex })
  }, [socket, isConnected])

  const updateSettings = useCallback((settings: Partial<RoomSettings>) => {
    if (!isConnected) return
    socket.emit('update-settings', { settings })
  }, [socket, isConnected])

  const voteKick = useCallback((playerId: string) => {
    if (!isConnected) return
    socket.emit('kick-vote', { playerId })
  }, [socket, isConnected])

  const toggleSpectate = useCallback(() => {
    if (!isConnected) return
    socket.emit('toggle-spectate')
  }, [socket, isConnected])

  const sendReaction = useCallback((emoji: string) => {
    if (!isConnected) return
    socket.emit('reaction', { emoji })
  }, [socket, isConnected])

  const isOwner = state.playerId === state.ownerId
  const currentPlayer = state.players.find(p => p.id === state.playerId)

  return {
    ...state,
    isConnected,
    isOwner,
    currentPlayer,
    createRoom,
    joinRoom,
    toggleReady,
    toggleSpectate,
    leaveRoom,
    startGame,
    chooseWord,
    sendMessage,
    playAgain,
    updateSettings,
    voteKick,
    sendReaction,
  }
}
