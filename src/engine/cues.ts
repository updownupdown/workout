// Voice, chimes and screen wake lock. All optional and fail-soft.

let voiceOn = true
export const setVoice = (on: boolean) => {
  voiceOn = on
  if (!on) window.speechSynthesis?.cancel()
}

let preferred: SpeechSynthesisVoice | null = null
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() ?? []
  preferred =
    vs.find((v) => /en/i.test(v.lang) && /(samantha|google uk english female|serena|karen|natural)/i.test(v.name)) ??
    vs.find((v) => /^en/i.test(v.lang)) ??
    null
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice()
  window.speechSynthesis.onvoiceschanged = pickVoice
}

export function say(text: string, { interrupt = true } = {}) {
  if (!voiceOn || !('speechSynthesis' in window)) return
  if (interrupt) window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  if (preferred) u.voice = preferred
  u.rate = 0.98
  u.pitch = 1
  window.speechSynthesis.speak(u)
}

let ctx: AudioContext | null = null
/** Must be called from a user gesture once (iOS) to unlock audio. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    // iOS also needs an utterance from a gesture before speech works later.
    if (voiceOn && 'speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
  } catch {
    /* ignore */
  }
}

export function chime(kind: 'tick' | 'go' | 'done' | 'soft' = 'tick') {
  if (!ctx) return
  const now = ctx.currentTime
  const notes: Record<typeof kind, number[]> = {
    tick: [880],
    go: [660, 990],
    done: [523, 659, 784],
    soft: [392],
  }
  notes[kind].forEach((f, i) => {
    const o = ctx!.createOscillator()
    const g = ctx!.createGain()
    o.type = 'sine'
    o.frequency.value = f
    const t0 = now + i * 0.12
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(kind === 'soft' ? 0.06 : 0.14, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (kind === 'done' ? 0.6 : 0.25))
    o.connect(g).connect(ctx!.destination)
    o.start(t0)
    o.stop(t0 + 0.7)
  })
}

let lock: WakeLockSentinel | null = null
export async function keepAwake(on: boolean) {
  try {
    if (on && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen')
    } else if (!on && lock) {
      await lock.release()
      lock = null
    }
  } catch {
    /* not supported or denied */
  }
}
