import { Category, Move, MOVES, Position } from '../data/moves'

export type FocusMode = 'balanced' | 'strength' | 'flow' | 'calm'
export type Intensity = 'gentle' | 'steady' | 'strong'

export interface Settings {
  minutes: number
  focus: FocusMode
  dumbbells: boolean
  intensity: Intensity
  voice: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  minutes: 20,
  focus: 'balanced',
  dumbbells: false,
  intensity: 'steady',
  voice: true,
}

export type Block = 'open' | 'warm' | 'main' | 'cool' | 'close'

export interface Step {
  key: string
  move: Move
  block: Block
  side?: 'right' | 'left'
  reps?: number
  secs: number
  round?: number
}

export interface Session {
  seed: number
  settings: Settings
  steps: Step[]
  totalSecs: number
}

/** Seconds given to get into position before each step. */
export const TRANSITION = 7

// ------------------------------------------------------------------ RNG

export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    pick<T>(xs: T[]): T {
      return xs[Math.floor(next() * xs.length)]
    },
    shuffle<T>(xs: T[]): T[] {
      const a = xs.slice()
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    },
    weighted<T>(xs: T[], w: (x: T) => number): T | undefined {
      const ws = xs.map(w)
      const total = ws.reduce((s, x) => s + x, 0)
      if (total <= 0) return undefined
      let r = next() * total
      for (let i = 0; i < xs.length; i++) {
        r -= ws[i]
        if (r <= 0) return xs[i]
      }
      return xs[xs.length - 1]
    },
  }
}
type Rng = ReturnType<typeof rng>

export const newSeed = () => Math.floor(Math.random() * 2 ** 31)

// ------------------------------------------------------------------ sizing

const INTENSITY: Record<Intensity, number> = { gentle: 0.75, steady: 1, strong: 1.3 }

export function breathCycleSecs(m: Move) {
  return (m.pattern ?? []).reduce((s, p) => s + p.secs, 0)
}

function size(m: Move, intensity: Intensity): { reps?: number; secs: number } {
  const k = INTENSITY[intensity]
  if (m.kind === 'reps') {
    const reps = Math.max(3, Math.round((m.reps ?? 10) * k))
    return { reps, secs: reps * m.tempo }
  }
  if (m.kind === 'breath') {
    const cycles = Math.max(2, Math.round((m.cycles ?? 4) * (intensity === 'gentle' ? 1 : k)))
    return { secs: cycles * breathCycleSecs(m) }
  }
  return { secs: Math.round(((m.secs ?? 30) * k) / 5) * 5 }
}

/** Total time a move takes including both sides and transitions. */
function cost(m: Move, s: Settings) {
  return (size(m, s.intensity).secs + TRANSITION) * (m.sided ? 2 : 1)
}

// ------------------------------------------------------------------ recipes

type Weights = Partial<Record<Category, number>>

interface Recipe {
  openBreaths: number
  warm: number
  cool: number
  main: Weights
  rounds: number
  closeRest: boolean
}

const RECIPES: Record<FocusMode, Recipe> = {
  balanced: {
    openBreaths: 1, warm: 0.15, cool: 0.15, rounds: 1, closeRest: true,
    main: { strength: 3, core: 2, pilates: 1.5, yoga: 2.5, stretch: 0.5 },
  },
  strength: {
    openBreaths: 1, warm: 0.15, cool: 0.12, rounds: 2, closeRest: false,
    main: { strength: 5, core: 3, pilates: 1, yoga: 0.4 },
  },
  flow: {
    openBreaths: 1, warm: 0.12, cool: 0.15, rounds: 1, closeRest: true,
    main: { yoga: 4, pilates: 2.5, core: 1, stretch: 1, strength: 0.4 },
  },
  calm: {
    openBreaths: 2, warm: 0.1, cool: 0.25, rounds: 1, closeRest: true,
    main: { yoga: 2.5, stretch: 3, pilates: 0.5 },
  },
}

const POSITION_ORDER: Position[] = ['standing', 'kneeling', 'quadruped', 'prone', 'seated', 'supine']
const rank = (p: Position) => POSITION_ORDER.indexOf(p)

const COOL_IDS = new Set([
  'forward-fold', 'cross-shoulder', 'triceps-stretch', 'quad-stretch', 'child', 'seated-fold',
  'butterfly', 'knees-chest', 'low-lunge', 'cobra',
])

/**
 * Order a list so the session moves "down to the floor" (standing → kneeling →
 * on all fours → lying), shuffling within each position and avoiding back-to-back
 * work on the same focus area where possible.
 */
function gravityOrder(moves: Move[], r: Rng): Move[] {
  const groups = new Map<number, Move[]>()
  for (const m of r.shuffle(moves)) {
    const k = rank(m.position)
    groups.set(k, [...(groups.get(k) ?? []), m])
  }
  const out: Move[] = []
  for (const k of [...groups.keys()].sort((a, b) => a - b)) {
    const pool = groups.get(k)!
    while (pool.length) {
      const prev = out[out.length - 1]
      let i = pool.findIndex((m) => !prev || m.focus[0] !== prev.focus[0])
      if (i < 0) i = 0
      out.push(pool.splice(i, 1)[0])
    }
  }
  return out
}

function available(s: Settings) {
  return MOVES.filter((m) => (m.equipment === 'dumbbells' ? s.dumbbells : true))
}

function fill(pool: Move[], budget: number, s: Settings, r: Rng, weight: (m: Move) => number, used: Set<string>) {
  const out: Move[] = []
  let left = budget
  for (let guard = 0; guard < 200 && left > 20; guard++) {
    const candidates = pool.filter((m) => !used.has(m.id) && cost(m, s) <= left + 15)
    const m = r.weighted(candidates, (m) => {
      let w = weight(m)
      // Mild preference for lower levels when gentle, higher when strong.
      if (s.intensity === 'gentle') w *= m.level === 1 ? 1.5 : m.level === 3 ? 0.3 : 0.8
      if (s.intensity === 'strong') w *= m.level >= 2 ? 1.4 : 0.8
      // Prefer dumbbell work when the user said they have them.
      if (s.dumbbells && m.equipment === 'dumbbells') w *= 1.6
      return w
    })
    if (!m) break
    used.add(m.id)
    out.push(m)
    left -= cost(m, s)
  }
  return out
}

function toSteps(moves: Move[], block: Block, s: Settings, round?: number): Step[] {
  const steps: Step[] = []
  for (const m of moves) {
    const { reps, secs } = size(m, s.intensity)
    const sides: (Step['side'] | undefined)[] = m.sided ? ['right', 'left'] : [undefined]
    for (const side of sides) {
      steps.push({
        key: `${block}-${round ?? 0}-${m.id}-${side ?? 'both'}`,
        move: m,
        block,
        side,
        reps,
        secs,
        round,
      })
    }
  }
  return steps
}

export function generate(settings: Settings, seed: number = newSeed()): Session {
  const r = rng(seed)
  const recipe = RECIPES[settings.focus]
  const total = settings.minutes * 60
  const pool = available(settings)
  const used = new Set<string>()

  // Opening breath
  const breaths = r.shuffle(pool.filter((m) => m.cat === 'breath')).slice(0, recipe.openBreaths)
  breaths.forEach((m) => used.add(m.id))

  // Closing rest (+ a breath for calm sessions)
  const close: Move[] = []
  if (recipe.closeRest && settings.minutes >= 15) close.push(pool.find((m) => m.id === 'savasana')!)
  close.forEach((m) => used.add(m.id))

  const fixed = [...breaths, ...close].reduce((t, m) => t + cost(m, settings), 0)
  const flexible = Math.max(120, total - fixed)

  const warm = gravityOrder(
    fill(pool.filter((m) => m.cat === 'warmup'), flexible * recipe.warm, settings, r, () => 1, used),
    r,
  )
  const coolMoves = gravityOrder(
    fill(pool.filter((m) => COOL_IDS.has(m.id)), flexible * recipe.cool, settings, r, (m) => (m.cat === 'stretch' ? 2 : 1), used),
    r,
  )
  const spent = [...warm, ...coolMoves].reduce((t, m) => t + cost(m, settings), 0)
  const mainBudget = Math.max(60, (flexible - spent) / recipe.rounds)
  const main = gravityOrder(
    fill(
      pool.filter((m) => recipe.main[m.cat] && !COOL_IDS.has(m.id)),
      mainBudget,
      settings,
      r,
      (m) => recipe.main[m.cat] ?? 0,
      used,
    ),
    r,
  )

  const steps: Step[] = [...toSteps(breaths, 'open', settings), ...toSteps(warm, 'warm', settings)]
  for (let round = 1; round <= recipe.rounds; round++) {
    steps.push(...toSteps(main, 'main', settings, recipe.rounds > 1 ? round : undefined))
  }
  steps.push(...toSteps(coolMoves, 'cool', settings), ...toSteps(close, 'close', settings))

  return { seed, settings, steps, totalSecs: sessionSecs(steps) }
}

export function sessionSecs(steps: Step[]) {
  return steps.reduce((t, st) => t + st.secs + TRANSITION, 0)
}

/** Swap one move (and its other side / other rounds) for a fresh one from the same family. */
export function swapMove(session: Session, moveId: string, block: Block): Session {
  const r = rng(session.seed ^ Math.floor(Math.random() * 1e9))
  const s = session.settings
  const old = session.steps.find((st) => st.move.id === moveId && st.block === block)
  if (!old) return session
  const inUse = new Set(session.steps.map((st) => st.move.id))
  const sameFamily = (m: Move) =>
    block === 'cool'
      ? COOL_IDS.has(m.id)
      : block === 'open' || block === 'close'
        ? m.cat === old.move.cat
        : m.cat === old.move.cat || (block === 'main' && RECIPES[s.focus].main[m.cat] && !COOL_IDS.has(m.id))
  const candidates = available(s).filter((m) => !inUse.has(m.id) && sameFamily(m) && m.cat !== 'rest')
  if (!candidates.length) return session
  // Prefer the same position so the flow stays smooth.
  const pick =
    r.weighted(candidates, (m) => (m.cat === old.move.cat ? 3 : 1) * (m.position === old.move.position ? 2 : 1)) ??
    candidates[0]
  const steps: Step[] = []
  const done = new Set<number | undefined>()
  for (const st of session.steps) {
    if (st.move.id === moveId && st.block === block) {
      if (!done.has(st.round)) {
        done.add(st.round)
        steps.push(...toSteps([pick], block, s, st.round))
      }
      continue
    }
    steps.push(st)
  }
  return { ...session, steps, totalSecs: sessionSecs(steps) }
}
