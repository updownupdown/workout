/**
 * Data-driven 2D mannequin.
 *
 * Every move is authored as a handful of keyframe *poses* (joint angles in
 * degrees). The renderer runs forward kinematics, auto-grounds the figure on
 * the floor, and tweens between keyframes. The same pose data could later
 * drive a 3D rig (see docs/PLAN.md), so poses are the long-lived asset.
 *
 * Conventions (side view, figure faces +x):
 *  - torso: direction pelvis→neck. 0 = upright, 90 = horizontal head-forward,
 *    -90 = horizontal head-back (lying on back).
 *  - spine: bend of the upper back relative to the lower back (+ = rounding
 *    forward, - = arching back). Arms hang off the upper back, legs off the pelvis.
 *  - head: tilt relative to the upper back (+ = chin down / forward).
 *  - Sh (shoulder flexion): 0 = arm hanging along torso, 90 = arm forward,
 *    180 = overhead. In front view this is abduction (out to the side).
 *  - El (elbow flexion): 0 = straight.
 *  - Hip (hip flexion): 0 = leg in line with torso, 90 = thigh forward.
 *    In front view this is abduction.
 *  - Knee (knee flexion): 0 = straight, + bends the shin back.
 *  - Ank: 0 = foot at 90° to shin, + points the toes.
 *  - Wr (wrist): 0 = hand continues the forearm, 90 = hand flat (pointing forward).
 *  "r" limbs are the near side in side view.
 */

export type View = 'side' | 'front'

export interface Pose {
  /** Whole-body rotation about the pelvis, filled in from floor contacts at compile time. */
  rot: number
  torso: number
  spine: number
  head: number
  lWr: number
  rWr: number
  lSh: number
  lEl: number
  rSh: number
  rEl: number
  lHip: number
  lKnee: number
  rHip: number
  rKnee: number
  lAnk: number
  rAnk: number
  // ---- 3D extras (ignored by the 2D solver; 0 = planar) --------------------
  /** Limb lifted out of the move's plane: side view = abduction (out to the side), front view = flexion (forward). */
  lShX: number
  rShX: number
  lHipX: number
  rHipX: number
  /** Limb twist about its own axis: + = external rotation (knee / elbow crease turns outward). */
  lShTw: number
  rShTw: number
  lHipTw: number
  rHipTw: number
  /** Upper-body rotation about the spine, + = chest turns to the figure's left. */
  twist: number
  /** Head turn, + = to the figure's left. */
  headTw: number
  /**
   * Whole-body lean out of the move's plane, about the floor (side view: toward
   * the figure's left; front view: forward). Used to shift weight over a foot.
   */
  tilt: number
  /** Trunk bend out of the move's plane (side view: side bend to the left; front view: forward). */
  bendX: number
}

export type PoseInput = Partial<Pose>

export const NEUTRAL: Pose = {
  rot: 0,
  torso: 0,
  spine: 0,
  head: 0,
  lWr: 0,
  rWr: 0,
  lSh: 0,
  lEl: 0,
  rSh: 0,
  rEl: 0,
  lHip: 0,
  lKnee: 0,
  rHip: 0,
  rKnee: 0,
  lAnk: 0,
  rAnk: 0,
  lShX: 0,
  rShX: 0,
  lHipX: 0,
  rHipX: 0,
  lShTw: 0,
  rShTw: 0,
  lHipTw: 0,
  rHipTw: 0,
  twist: 0,
  headTw: 0,
  tilt: 0,
  bendX: 0,
}

export const full = (p: PoseInput): Pose => ({ ...NEUTRAL, ...p })

export const L = {
  torso: 52,
  lowBack: 24,
  neck: 9,
  headR: 11.5,
  upperArm: 29,
  forearm: 26,
  hand: 7,
  thigh: 42,
  shin: 40,
  foot: 13,
  shoulderW: 15,
  hipW: 8,
}

export const W = {
  torso: 22,
  upperArm: 9.5,
  forearm: 8,
  thigh: 13,
  shin: 10,
  foot: 6,
}

export interface Pt {
  x: number
  y: number
}

export interface Limb {
  a: Pt
  b: Pt
  w: number
}

export interface Side {
  upper: Limb
  fore: Limb
  hand: Limb
  thigh: Limb
  shin: Limb
  foot: Limb
}

export interface Rig {
  pelvis: Pt
  mid: Pt
  neck: Pt
  head: Pt
  headAngle: number
  torso: Limb
  chest: Limb
  l: Side
  r: Side
  /** Points that can touch the floor (with radius). */
  contacts: { p: Pt; r: number }[]
}

const rad = (d: number) => (d * Math.PI) / 180
const dir = (deg: number): Pt => ({ x: Math.sin(rad(deg)), y: -Math.cos(rad(deg)) })
const add = (p: Pt, d: Pt, len: number): Pt => ({ x: p.x + d.x * len, y: p.y + d.y * len })

function chain(
  view: View,
  m: 1 | -1,
  Tu: number,
  T: number,
  shoulder: Pt,
  hip: Pt,
  sh: number,
  el: number,
  wr: number,
  hp: number,
  kn: number,
  ank: number,
): Side {
  const upperA = Tu + m * (180 - sh)
  const elbow = add(shoulder, dir(upperA), L.upperArm)
  const foreA = upperA - m * el
  const wrist = add(elbow, dir(foreA), L.forearm)
  const handEnd = add(wrist, dir(foreA - m * wr), L.hand)

  const thighA = T + m * (180 - hp)
  const knee = add(hip, dir(thighA), L.thigh)
  const shinA = thighA + m * kn
  const ankle = add(knee, dir(shinA), L.shin)
  const footA = shinA - m * 90 + m * ank
  const footLen = view === 'front' ? L.foot * 0.55 : L.foot
  const toe = add(ankle, dir(footA), footLen)

  return {
    upper: { a: shoulder, b: elbow, w: W.upperArm },
    fore: { a: elbow, b: wrist, w: W.forearm },
    hand: { a: wrist, b: handEnd, w: 7 },
    thigh: { a: hip, b: knee, w: W.thigh },
    shin: { a: knee, b: ankle, w: W.shin },
    foot: { a: ankle, b: toe, w: W.foot },
  }
}

export function solve(pose: Pose, view: View): Rig {
  const T = pose.torso + pose.rot
  const Tu = T + pose.spine
  const pelvis = { x: 0, y: 0 }
  const mid = add(pelvis, dir(T), L.lowBack)
  const td = dir(Tu)
  const neck = add(mid, td, L.torso - L.lowBack)
  const headAngle = Tu + pose.head
  const head = add(neck, dir(headAngle), L.neck + L.headR * 0.85)
  const perp = { x: Math.cos(rad(Tu)), y: Math.sin(rad(Tu)) }
  const hperp = { x: Math.cos(rad(T)), y: Math.sin(rad(T)) }
  const shoulderBase = add(neck, td, -5)

  let lSh: Pt, rSh: Pt, lHip: Pt, rHip: Pt
  let lm: 1 | -1, rm: 1 | -1
  if (view === 'front') {
    // Figure faces the viewer: its right side is on screen-left.
    rSh = add(shoulderBase, perp, -L.shoulderW)
    lSh = add(shoulderBase, perp, L.shoulderW)
    rHip = add(pelvis, hperp, -L.hipW)
    lHip = add(pelvis, hperp, L.hipW)
    rm = -1
    lm = 1
  } else {
    rSh = lSh = shoulderBase
    rHip = lHip = pelvis
    rm = lm = 1
  }

  const l = chain(view, lm, Tu, T, lSh, lHip, pose.lSh, pose.lEl, pose.lWr, pose.lHip, pose.lKnee, pose.lAnk)
  const r = chain(view, rm, Tu, T, rSh, rHip, pose.rSh, pose.rEl, pose.rWr, pose.rHip, pose.rKnee, pose.rAnk)

  const contacts: Rig['contacts'] = [
    { p: head, r: L.headR },
    { p: neck, r: W.torso / 2 },
    { p: pelvis, r: W.torso / 2 },
    { p: mid, r: W.torso / 2 },
  ]
  for (const s of [l, r]) {
    contacts.push(
      { p: s.upper.b, r: W.upperArm / 2 },
      { p: s.fore.b, r: W.forearm / 2 },
      { p: s.hand.b, r: 3.5 },
      { p: s.thigh.b, r: W.thigh / 2 },
      { p: s.shin.b, r: W.shin / 2 },
      { p: s.foot.b, r: W.foot / 2 },
    )
  }

  return {
    pelvis,
    mid,
    neck,
    head,
    headAngle,
    torso: { a: pelvis, b: mid, w: W.torso },
    chest: { a: mid, b: neck, w: W.torso + 2 },
    l,
    r,
    contacts,
  }
}

const KEYS = Object.keys(NEUTRAL) as (keyof Pose)[]

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t
  return out
}

export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** Lowest point of a rig (largest y, since SVG y grows downward). */
export function floorOf(rig: Rig): number {
  let m = -Infinity
  for (const c of rig.contacts) m = Math.max(m, c.p.y + c.r)
  return m
}

export function bounds(rig: Rig) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity
  for (const c of rig.contacts) {
    x0 = Math.min(x0, c.p.x - c.r)
    x1 = Math.max(x1, c.p.x + c.r)
    y0 = Math.min(y0, c.p.y - c.r)
    y1 = Math.max(y1, c.p.y + c.r)
  }
  return { x0, x1, y0, y1 }
}

export type AnchorName =
  | 'pelvis'
  | 'neck'
  | 'head'
  | 'lFoot'
  | 'rFoot'
  | 'lHand'
  | 'rHand'
  | 'lKnee'
  | 'rKnee'
  | 'lToe'
  | 'rToe'

export function anchorPoint(rig: Rig, a: AnchorName): Pt {
  switch (a) {
    case 'pelvis':
      return rig.pelvis
    case 'neck':
      return rig.neck
    case 'head':
      return rig.head
    case 'lFoot':
      return rig.l.shin.b
    case 'rFoot':
      return rig.r.shin.b
    case 'lHand':
      return rig.l.fore.b
    case 'rHand':
      return rig.r.fore.b
    case 'lKnee':
      return rig.l.thigh.b
    case 'rKnee':
      return rig.r.thigh.b
    case 'lToe':
      return rig.l.foot.b
    case 'rToe':
      return rig.r.foot.b
  }
}

/** Translate a rig in place. */
export function shift(rig: Rig, dx: number, dy: number) {
  const seen = new Set<Pt>()
  const mv = (p: Pt) => {
    if (seen.has(p)) return
    seen.add(p)
    p.x += dx
    p.y += dy
  }
  mv(rig.pelvis)
  mv(rig.mid)
  mv(rig.neck)
  mv(rig.head)
  for (const s of [rig.l, rig.r]) {
    for (const limb of Object.values(s) as Limb[]) {
      mv(limb.a)
      mv(limb.b)
    }
  }
  for (const c of rig.contacts) mv(c.p)
}

/** Body parts that can be declared as touching the floor in a keyframe. */
export type ContactName =
  | 'head' | 'back' | 'mid' | 'pelvis'
  | 'lElbow' | 'rElbow' | 'lHand' | 'rHand'
  | 'lKnee' | 'rKnee' | 'lHeel' | 'rHeel' | 'lToe' | 'rToe'

export function contactOf(rig: Rig, c: ContactName): { p: Pt; r: number } {
  switch (c) {
    case 'head': return { p: rig.head, r: L.headR }
    case 'back': return { p: rig.neck, r: W.torso / 2 }
    case 'mid': return { p: rig.mid, r: W.torso / 2 }
    case 'pelvis': return { p: rig.pelvis, r: W.torso / 2 }
    case 'lElbow': return { p: rig.l.upper.b, r: W.upperArm / 2 }
    case 'rElbow': return { p: rig.r.upper.b, r: W.upperArm / 2 }
    case 'lHand': return { p: rig.l.hand.b, r: 3.5 }
    case 'rHand': return { p: rig.r.hand.b, r: 3.5 }
    case 'lKnee': return { p: rig.l.thigh.b, r: W.thigh / 2 }
    case 'rKnee': return { p: rig.r.thigh.b, r: W.thigh / 2 }
    case 'lHeel': return { p: rig.l.shin.b, r: W.shin / 2 }
    case 'rHeel': return { p: rig.r.shin.b, r: W.shin / 2 }
    case 'lToe': return { p: rig.l.foot.b, r: W.foot / 2 }
    case 'rToe': return { p: rig.r.foot.b, r: W.foot / 2 }
  }
}

/**
 * Find the whole-body rotation that puts the two outermost declared contacts
 * level with each other and lowest on the body, so both rest on the floor.
 */
export function levelFor(pose: Pose, view: View, contacts: ContactName[]): number {
  if (contacts.length < 2) return 0
  const rig0 = solve({ ...pose, rot: 0 }, view)
  const pts = contacts.map((c) => contactOf(rig0, c))
  // the two contacts farthest apart define the floor line
  let a = 0, b = 1, best = -1
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].p.x - pts[j].p.x, pts[i].p.y - pts[j].p.y)
      if (d > best) { best = d; a = i; b = j }
    }
  const p1 = pts[a], p2 = pts[b]
  const vx = p2.p.x - p1.p.x, vy = p2.p.y - p1.p.y
  const len = Math.hypot(vx, vy)
  if (len < 1) return 0
  const phi = Math.atan2(vy, vx)
  const s = Math.max(-1, Math.min(1, (p1.r - p2.r) / len))
  const cands = [Math.asin(s) - phi, Math.PI - Math.asin(s) - phi].map((th) => {
    let d = (th * 180) / Math.PI
    while (d > 180) d -= 360
    while (d < -180) d += 360
    return d
  })
  let pick = cands[0], score = Infinity
  for (const d of cands) {
    const rig = solve({ ...pose, rot: d }, view)
    const ground = floorOf(rig)
    const cy = Math.max(...contacts.map((c) => { const k = contactOf(rig, c); return k.p.y + k.r }))
    // prefer contacts that end up lowest, then the smaller rotation
    const sc = (ground - cy) * 10 + Math.abs(d) * 0.01
    if (sc < score) { score = sc; pick = d }
  }
  return pick
}
