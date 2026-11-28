import {
  AnchorName,
  ContactName,
  levelFor,
  bounds,
  ease,
  floorOf,
  full,
  lerpPose,
  Pose,
  PoseInput,
  Rig,
  shift,
  solve,
  View,
  anchorPoint,
} from './skeleton'

export interface Anim {
  /** The move this animation belongs to (for per-body baked poses). */
  id?: string
  view: View
  /** Joint kept fixed horizontally while the figure moves (feet for squats, hands for crawls). */
  anchor: AnchorName
  /** Keyframes. For 'loop' one full cycle = one rep. For 'hold' the figure flows into the last frame. */
  frames: PoseInput[]
  mode: 'loop' | 'hold'
  /** Optional relative weights for each segment (loop: frames.length segments, hold: frames.length-1). */
  beats?: number[]
  props?: 'dumbbells' | 'band'
  /** Where a resistance band runs: between two points, or a loop around the thighs. */
  band?: [BandPoint, BandPoint][] | 'thighs'
  /**
   * Body parts touching the floor in each keyframe (same order as frames).
   * Two or more contacts rotate the whole body so they all rest on the floor.
   */
  contacts?: (ContactName[] | null | undefined)[]
  /** 3D only: extra floor contacts per keyframe (see data/poses3d.ts). */
  touch?: (ContactName[] | null | undefined)[]
  /** Loop whose last frame equals the first (e.g. +360°): no wrap-around segment. */
  closed?: boolean
  /** Pose the "breathing" idle subtly modulates while holding. */
  breathe?: boolean
}

export type BandPoint = 'lHand' | 'rHand' | 'lFoot' | 'rFoot' | 'lToe' | 'rToe' | 'lKnee' | 'rKnee' | 'anchor'

export interface Compiled {
  anim: Anim
  poses: Pose[]
  view: { x0: number; x1: number; y0: number; y1: number }
}

const cache = new WeakMap<Anim, Compiled>()

export function place(rig: Rig, anchor: AnchorName) {
  const ground = floorOf(rig)
  const a = anchorPoint(rig, anchor)
  shift(rig, -a.x, -ground)
  return rig
}

export function compile(anim: Anim): Compiled {
  const hit = cache.get(anim)
  if (hit) return hit
  const poses = anim.frames.map((f, i) => {
    const p = full(f)
    const c = anim.contacts?.[i]
    if (c && c.length >= 2 && f.rot === undefined) p.rot = levelFor(p, anim.view, c)
    return p
  })
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = 0
  const segs = anim.mode === 'loop' && !anim.closed ? poses.length : Math.max(1, poses.length - 1)
  const N = 12
  for (let s = 0; s < segs; s++) {
    for (let i = 0; i <= N; i++) {
      const a = poses[s]
      const b = poses[(s + 1) % poses.length]
      const rig = place(solve(lerpPose(a, b, i / N), anim.view), anim.anchor)
      const bb = bounds(rig)
      x0 = Math.min(x0, bb.x0)
      x1 = Math.max(x1, bb.x1)
      y0 = Math.min(y0, bb.y0)
    }
  }
  // Square-ish framing with padding, centred horizontally.
  const pad = 14
  x0 -= pad
  x1 += pad
  y0 -= pad
  y1 += pad * 0.8
  const w = x1 - x0
  const h = y1 - y0
  if (w < h * 1.15) {
    const extra = (h * 1.15 - w) / 2
    x0 -= extra
    x1 += extra
  } else if (h < w * 0.62) {
    y0 -= w * 0.62 - h
  }
  const c = { anim, poses, view: { x0, x1, y0, y1 } }
  cache.set(anim, c)
  return c
}

/**
 * Pose at time t (seconds) for a given rep tempo.
 * loop: cycles every `tempo` seconds. hold: transitions over `tempo` seconds then holds.
 */
export function poseAt(c: Compiled, t: number, tempo: number): Pose {
  const { poses, anim } = c
  if (poses.length === 1) return breathe(poses[0], t, anim)
  const segs = anim.mode === 'loop' && !anim.closed ? poses.length : poses.length - 1
  const weights = anim.beats && anim.beats.length === segs ? anim.beats : new Array(segs).fill(1)
  const total = weights.reduce((a, b) => a + b, 0)
  let u: number
  if (anim.mode === 'loop') {
    u = ((t % tempo) + tempo) % tempo / tempo
  } else {
    u = Math.min(1, Math.max(0, t / tempo))
    if (u >= 1) return breathe(poses[poses.length - 1], t - tempo, anim)
  }
  let acc = 0
  for (let s = 0; s < segs; s++) {
    const w = weights[s] / total
    if (u <= acc + w || s === segs - 1) {
      const local = w === 0 ? 1 : (u - acc) / w
      return lerpPose(poses[s], poses[(s + 1) % poses.length], ease(Math.min(1, Math.max(0, local))))
    }
    acc += w
  }
  return poses[0]
}

function breathe(p: Pose, t: number, anim: Anim): Pose {
  if (anim.breathe === false) return p
  // ~5 s breathing cycle: tiny lift of the chest and arms.
  const b = Math.sin((t / 5) * Math.PI * 2) * 0.5 + 0.5
  return { ...p, head: p.head - b * 1.5, lSh: p.lSh + b * 2, rSh: p.rSh + b * 2, torso: p.torso - b * 0.6 }
}
