// ── Sound preferences (persisted, shared store) ──────────────────────────
// Every player controls these locally; nothing is server-synced. Each play
// function self-guards on its preference so all call sites respect the toggle.

export type SoundKey = 'ticking' | 'selection' | 'chat'
export type SoundPrefs = Record<SoundKey, boolean>

const PREF_KEY = 'inkora-sound-prefs'
const DEFAULTS: SoundPrefs = { ticking: true, selection: true, chat: true }

function loadPrefs(): SoundPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

let prefs: SoundPrefs = loadPrefs()
const listeners = new Set<() => void>()

export function getSoundPrefs(): SoundPrefs {
  return prefs
}

export function setSoundPref(key: SoundKey, value: boolean): void {
  prefs = { ...prefs, [key]: value }
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
  } catch {
    // ignore write failures (private mode, etc.)
  }
  listeners.forEach(l => l())
}

export function subscribeSoundPrefs(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// ── Tone engine ──────────────────────────────────────────────────────────

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.25, delay = 0) {
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const gainNode = ac.createGain()
    osc.connect(gainNode)
    gainNode.connect(ac.destination)
    osc.frequency.value = freq
    osc.type = type
    const start = ac.currentTime + delay
    gainNode.gain.setValueAtTime(gain, start)
    gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.start(start)
    osc.stop(start + duration)
  } catch {}
}

// ── Sounds (each gated by its preference) ────────────────────────────────

export function playCorrectSound() {
  if (!prefs.chat) return
  tone(523, 0.1, 'sine', 0.3, 0)      // C5
  tone(659, 0.1, 'sine', 0.3, 0.1)    // E5
  tone(784, 0.25, 'sine', 0.3, 0.2)   // G5
}

export function playTurnStartSound() {
  if (!prefs.selection) return
  tone(440, 0.12, 'sine', 0.2, 0)
  tone(554, 0.18, 'sine', 0.2, 0.12)
}

export function playTimerWarningSound() {
  if (!prefs.ticking) return
  tone(330, 0.07, 'square', 0.12)
}
