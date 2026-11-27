// Chimes and screen wake lock. All optional and fail-soft.

let chimesOn = true
export const setChimes = (on: boolean) => {
  chimesOn = on
}

let ctx: AudioContext | null = null
/** Must be called from a user gesture once (iOS) to unlock audio. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* ignore */
  }
}

export function chime(kind: 'tick' | 'go' | 'done' | 'soft' = 'tick') {
  if (!ctx || !chimesOn) return
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
