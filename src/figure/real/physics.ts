import * as THREE from 'three'
import type { Anim } from '../anim'
import { type ContactName, type Pose, type View } from '../skeleton'
import type { Driver } from './rig'

/**
 * Physical plausibility checks for a posed figure, measured on the real
 * skinned mesh:
 *  - balance: whole-body centre of mass over the support area on the floor
 *  - clipping: limbs passing through each other (capsule overlap)
 *  - contacts: body parts that should touch the floor but float
 *  - joint limits: angles a body can't reach
 *
 * `settle()` nudges a keyframe to fix what it can. It runs offline
 * (scripts/realistic/bake-poses.cjs) and the results are baked into
 * src/data/settled3d.ts.
 */

/** Segment mass fractions (Winter, Biomechanics of Human Movement). */
const MASS: Record<string, number> = {
  head: 0.081, thorax: 0.216, abdomen: 0.139, pelvis: 0.142,
  upperArm: 0.028, forearm: 0.016, hand: 0.006,
  thigh: 0.1, calf: 0.0465, foot: 0.0145,
}

function segmentOf(bone: string, inHead: boolean): string | null {
  if (inHead) return 'head'
  if (bone === 'Pelvis' || bone === 'Spine') return 'pelvis'
  if (bone === 'Spine1') return 'abdomen'
  if (bone === 'Spine2' || bone === 'Neck' || /_Clavicle$/.test(bone)) return 'thorax'
  const m = /^([LR])_(UpperArm|Forearm|Hand|Finger\d*\w*|Thigh|Calf|Foot|Toe\w*)/.exec(bone)
  if (!m) return null
  const part = m[2].startsWith('Finger') ? 'hand' : m[2].startsWith('Toe') ? 'foot' : m[2][0].toLowerCase() + m[2].slice(1)
  return `${m[1]}.${part}`
}

interface Capsule {
  name: string
  a: string
  b: string
  /** Extend past b by this fraction of a→b (hands, feet). */
  ext: number
  r: number
}

/** Capsules for clipping checks, and the pairs that may legitimately touch. */
const CAPS: Omit<Capsule, 'r'>[] = [
  { name: 'abdomen', a: 'Pelvis', b: 'Spine2', ext: 0 },
  { name: 'chest', a: 'Spine2', b: 'Neck', ext: 0 },
  { name: 'head', a: 'Head', b: 'MNose', ext: 0 },
]
for (const S of ['L', 'R']) {
  CAPS.push(
    { name: `${S}.upperArm`, a: `${S}_UpperArm`, b: `${S}_Forearm`, ext: 0 },
    { name: `${S}.forearm`, a: `${S}_Forearm`, b: `${S}_Hand`, ext: 0 },
    { name: `${S}.hand`, a: `${S}_Hand`, b: `${S}_Finger2`, ext: 0.6 },
    { name: `${S}.thigh`, a: `${S}_Thigh`, b: `${S}_Calf`, ext: 0 },
    { name: `${S}.calf`, a: `${S}_Calf`, b: `${S}_Foot`, ext: 0 },
    { name: `${S}.foot`, a: `${S}_Foot`, b: `${S}_Toe0`, ext: 0.5 },
  )
}
const ALLOWED = new Set([
  'abdomen|chest', 'chest|head',
  'L.upperArm|L.forearm', 'L.forearm|L.hand', 'R.upperArm|R.forearm', 'R.forearm|R.hand',
  'L.thigh|L.calf', 'L.calf|L.foot', 'R.thigh|R.calf', 'R.calf|R.foot',
  'L.upperArm|chest', 'R.upperArm|chest', 'L.thigh|abdomen', 'R.thigh|abdomen',
  // thighs rest on each other and on the belly in deep folds; hands may hold anything
  'L.thigh|R.thigh',
])
const pairKey = (a: string, b: string) => (ALLOWED.has(`${a}|${b}`) || ALLOWED.has(`${b}|${a}`))

/** Clipping deeper than this (cm) counts. Skin is soft and capsules are rough. */
const CLIP_TOL = 2

export interface Clip {
  a: string
  b: string
  depth: number
}

export interface Measure {
  /** COM horizontal distance outside the support area (cm); negative = inside by that much. */
  balance: number
  com: THREE.Vector3
  support: { x: number; z: number }[]
  clips: Clip[]
  /** Declared contacts and how far each floats above the floor (cm). */
  gaps: { c: ContactName; gap: number }[]
  limits: { k: keyof Pose; over: number }[]
}

// Joint ranges in the pose data's own conventions (degrees).
const LIMITS: Partial<Record<keyof Pose, [number, number]>> = {
  spine: [-65, 50], head: [-50, 60],
  lEl: [-6, 155], rEl: [-6, 155], lKnee: [-6, 160], rKnee: [-6, 160],
  lWr: [-90, 100], rWr: [-90, 100], lAnk: [-40, 95], rAnk: [-40, 95],
  lSh: [-95, 192], rSh: [-95, 192], lHip: [-50, 165], rHip: [-50, 165],
  lShX: [-45, 110], rShX: [-45, 110], lHipX: [-30, 75], rHipX: [-30, 75],
  lShTw: [-90, 90], rShTw: [-90, 90], lHipTw: [-45, 60], rHipTw: [-45, 60],
  twist: [-60, 60], headTw: [-70, 70], tilt: [-20, 20], bendX: [-45, 45],
}

export function limitErrors(p: Pose) {
  const out: { k: keyof Pose; over: number }[] = []
  for (const [k, [lo, hi]] of Object.entries(LIMITS) as [keyof Pose, [number, number]][]) {
    let v = p[k]
    // arm circles go all the way round
    if (k === 'lSh' || k === 'rSh') v = ((((v + 170) % 360) + 360) % 360) - 170
    if (v < lo) out.push({ k, over: lo - v })
    else if (v > hi) out.push({ k, over: v - hi })
  }
  return out
}

const _v = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _d = new THREE.Vector3()

/** Closest distance between segments p1-q1 and p2-q2. */
function segDist(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3) {
  const d1 = _a.subVectors(q1, p1)
  const d2 = _b.subVectors(q2, p2)
  const r = _c.subVectors(p1, p2)
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r)
  let s = 0, t = 0
  if (a <= 1e-9 && e <= 1e-9) return r.length()
  if (a <= 1e-9) t = Math.min(1, Math.max(0, f / e))
  else {
    const c = d1.dot(r)
    if (e <= 1e-9) s = Math.min(1, Math.max(0, -c / a))
    else {
      const b = d1.dot(d2), den = a * e - b * b
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0
      t = (b * s + f) / e
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)) }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)) }
    }
  }
  const c1 = _d.copy(p1).addScaledVector(d1, s)
  const c2 = _v.copy(p2).addScaledVector(d2, t)
  return c1.distanceTo(c2)
}

function hull(pts: { x: number; z: number }[]) {
  const p = [...pts].sort((a, b) => a.x - b.x || a.z - b.z)
  if (p.length < 3) return p
  const cross = (o: typeof p[0], a: typeof p[0], b: typeof p[0]) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
  const lo: typeof p = [], up: typeof p = []
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop()
    lo.push(q)
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop()
    up.push(q)
  }
  return lo.slice(0, -1).concat(up.slice(0, -1))
}

/** Signed distance from point to convex polygon (negative inside). */
function polyDist(h: { x: number; z: number }[], x: number, z: number) {
  if (h.length === 0) return Infinity
  if (h.length === 1) return Math.hypot(x - h[0].x, z - h[0].z)
  let inside = h.length >= 3
  let best = Infinity
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length]
    const ex = b.x - a.x, ez = b.z - a.z
    const L2 = ex * ex + ez * ez || 1
    const t = Math.min(1, Math.max(0, ((x - a.x) * ex + (z - a.z) * ez) / L2))
    best = Math.min(best, Math.hypot(x - a.x - ex * t, z - a.z - ez * t))
    if (ex * (z - a.z) - ez * (x - a.x) < 0) inside = false
  }
  return inside ? -best : best
}

export class Physics {
  /** Per sampled vertex: segment index and mass weight. */
  private w: { mi: number; i: number; m: number }[] = []
  private caps: Capsule[] = []

  constructor(readonly d: Driver) {
    const headSet = new Set<THREE.Object3D>()
    d.bone('Head').traverse((o) => headSet.add(o))
    const bySeg = new Map<string, { mi: number; i: number }[]>()
    for (const [mi, i] of d.sample) {
      const m = d.meshes[mi]
      const g = m.geometry
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight
      let best = 0
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
      const b = m.skeleton.bones[si.getComponent(i, best)]
      const seg = segmentOf(b.name.replace(/^Bip01_?/, ''), headSet.has(b))
      if (!seg) continue
      if (!bySeg.has(seg)) bySeg.set(seg, [])
      bySeg.get(seg)!.push({ mi, i })
    }
    for (const [seg, vs] of bySeg) {
      const mass = MASS[seg.replace(/^[LR]\./, '')] ?? 0
      for (const v of vs) this.w.push({ ...v, m: mass / vs.length })
    }
  }

  /** Fit capsule radii to the mesh in the current pose (call once in a neutral stance). */
  fitCapsules() {
    const d = this.d
    this.caps = []
    const pos = (n: string) => d.bone(n).getWorldPosition(new THREE.Vector3())
    const segs = new Map<string, { mi: number; i: number }[]>()
    const headSet = new Set<THREE.Object3D>()
    d.bone('Head').traverse((o) => headSet.add(o))
    for (const { mi, i } of this.w) {
      const m = d.meshes[mi]
      const g = m.geometry
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight
      let best = 0
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
      const b = m.skeleton.bones[si.getComponent(i, best)]
      let seg = segmentOf(b.name.replace(/^Bip01_?/, ''), headSet.has(b))!
      if (seg === 'pelvis' || seg === 'abdomen') seg = 'abdomen'
      if (seg === 'thorax') seg = 'chest'
      if (!segs.has(seg)) segs.set(seg, [])
      segs.get(seg)!.push({ mi, i })
    }
    for (const c of CAPS) {
      const a = pos(c.a), b0 = pos(c.b)
      const b = b0.clone().addScaledVector(b0.clone().sub(a), c.ext)
      const vs = segs.get(c.name) ?? []
      const ds: number[] = []
      const ab = b.clone().sub(a)
      const L2 = ab.lengthSq()
      for (const { mi, i } of vs) {
        const p = d.vtx(mi, i, _v)
        const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / L2))
        ds.push(p.distanceTo(a.clone().addScaledVector(ab, t)))
      }
      ds.sort((x, y) => x - y)
      // the torso is wider than it is deep: use a low percentile so arms by the sides don't clip
      const q = c.name === 'abdomen' || c.name === 'chest' ? 0.3 : 0.5
      this.caps.push({ ...c, r: ds.length ? ds[Math.floor(ds.length * q)] : 4 })
    }
    return this.caps.map((c) => ({ name: c.name, r: +c.r.toFixed(1) }))
  }

  com(out = new THREE.Vector3()) {
    out.set(0, 0, 0)
    let m = 0
    for (const v of this.w) {
      out.addScaledVector(this.d.vtx(v.mi, v.i, _v), v.m)
      m += v.m
    }
    return out.multiplyScalar(1 / m)
  }

  clips(): Clip[] {
    const d = this.d
    const seg = this.caps.map((c) => {
      const a = d.bone(c.a).getWorldPosition(new THREE.Vector3())
      const b = d.bone(c.b).getWorldPosition(new THREE.Vector3())
      b.addScaledVector(b.clone().sub(a), c.ext)
      return { c, a, b }
    })
    const out: Clip[] = []
    for (let i = 0; i < seg.length; i++)
      for (let j = i + 1; j < seg.length; j++) {
        const A = seg[i], B = seg[j]
        if (pairKey(A.c.name, B.c.name)) continue
        const depth = A.c.r + B.c.r - segDist(A.a, A.b, B.a, B.b)
        if (depth > CLIP_TOL) out.push({ a: A.c.name, b: B.c.name, depth: depth - CLIP_TOL })
      }
    return out
  }

  /** Measure the currently posed figure. */
  measure(contacts: ContactName[] = [], pose?: Pose): Measure {
    const d = this.d
    const low = d.lowest()
    const pts: { x: number; z: number }[] = []
    for (const [mi, i] of d.sample) {
      const p = d.vtx(mi, i, _v)
      if (p.y < low + 1.2) pts.push({ x: p.x, z: p.z })
    }
    const h = hull(pts)
    const com = this.com()
    return {
      balance: polyDist(h, com.x, com.z),
      com,
      support: h,
      clips: this.clips(),
      gaps: contacts.map((c) => ({ c, gap: d.minY(d.parts.get(c) ?? []) - low })),
      limits: pose ? limitErrors(pose) : [],
    }
  }

  /** Parts touching the floor in the current pose (feet, hands, knees, …). */
  touching(): ContactName[] {
    const d = this.d
    const low = d.lowest()
    const out: ContactName[] = []
    for (const [c, ids] of d.parts) if (d.minY(ids) - low < 0.8) out.push(c)
    return out
  }

  /**
   * Nudge a keyframe toward physical plausibility while staying close to the
   * authored pose: contacts stay on the floor, the centre of mass sits over the
   * support with a little margin, limbs don't pass through each other, and
   * joints stay in range.
   */
  settle(pose: Pose, view: View, contacts: ContactName[], opts: { balance?: boolean } = {}): { pose: Pose; before: number; after: number } {
    const d = this.d
    const balance = opts.balance ?? true
    const energy = (p: Pose) => {
      d.pose(p, view)
      const low = d.lowest()
      let e = 0
      for (const c of contacts) {
        const g = d.minY(d.parts.get(c) ?? []) - low
        e += 4 * g * g
      }
      if (balance) {
        const pts: { x: number; z: number }[] = []
        for (const [mi, i] of d.sample) {
          const q = d.vtx(mi, i, _v)
          if (q.y < low + 1.2) pts.push({ x: q.x, z: q.z })
        }
        const com = this.com()
        const out = polyDist(hull(pts), com.x, com.z) + 2.5
        if (out > 0) e += 3 * out * out
      }
      for (const c of this.clips()) e += 2 * c.depth * c.depth
      for (const l of limitErrors(p)) e += 1 * l.over * l.over
      for (const k of PARAMS) {
        const dk = p[k] - pose[k]
        e += (COST[k] ?? 0.01) * dk * dk
      }
      for (const [l, r] of pairs) {
        const a = p[l] - pose[l] - (p[r] - pose[r])
        e += 0.05 * a * a
      }
      return e
    }
    const dirs = directions(view)
    // Limbs authored as a pair (both arms or both legs moving together) stay a pair.
    const pairs = SIDE_PAIRS.filter(([l, r]) => Math.abs(pose[l] - pose[r]) < 1)
    let cur = { ...pose }
    let e = energy(cur)
    const before = e
    for (const step of [8, 4, 2, 1, 0.5]) {
      let improved = true
      let guard = 0
      while (improved && guard++ < 25) {
        improved = false
        for (const dir of dirs) {
          for (const s of [step, -step]) {
            const next = { ...cur }
            for (const [k, w] of dir) next[k] += w * s
            const ne = energy(next)
            if (ne < e - 1e-4) {
              cur = next
              e = ne
              improved = true
              break
            }
          }
        }
      }
    }
    return { pose: cur, before, after: e }
  }
}

const PARAMS: (keyof Pose)[] = [
  'rot', 'torso', 'spine', 'head', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lAnk', 'rAnk',
  'lSh', 'rSh', 'lEl', 'rEl', 'lWr', 'rWr', 'lShX', 'rShX', 'lHipX', 'rHipX', 'tilt', 'bendX',
]
// Cost per degree² of moving away from the authored angle.
const COST: Partial<Record<keyof Pose, number>> = {
  rot: 0.001, torso: 0.02, spine: 0.03, head: 0.02,
  lHip: 0.012, rHip: 0.012, lKnee: 0.012, rKnee: 0.012, lAnk: 0.004, rAnk: 0.004,
  lSh: 0.01, rSh: 0.01, lEl: 0.01, rEl: 0.01, lWr: 0.004, rWr: 0.004,
  lShX: 0.01, rShX: 0.01, lHipX: 0.02, rHipX: 0.02, tilt: 0.03, bendX: 0.03,
}

type Dir = [keyof Pose, number][]

const SIDE_PAIRS: [keyof Pose, keyof Pose][] = [
  ['lSh', 'rSh'], ['lEl', 'rEl'], ['lWr', 'rWr'], ['lHip', 'rHip'], ['lKnee', 'rKnee'], ['lAnk', 'rAnk'],
  ['lShX', 'rShX'], ['lHipX', 'rHipX'],
]

/**
 * Side-view data often declares only the near-side contact. When both limbs
 * of a pair are posed the same, the far one touches too.
 */
export function withPairs(pose: Pose, contacts: ContactName[]): ContactName[] {
  const same = (...ks: string[]) => ks.every((k) => Math.abs(pose[`l${k}` as keyof Pose] - pose[`r${k}` as keyof Pose]) < 2)
  const out = new Set(contacts)
  for (const c of contacts) {
    const m = /^([lr])(Hand|Elbow|Knee|Heel|Toe)$/.exec(c)
    if (!m) continue
    const chain = m[2] === 'Hand' ? ['Sh', 'El', 'Wr'] : m[2] === 'Elbow' ? ['Sh'] : m[2] === 'Knee' ? ['Hip', 'Knee'] : ['Hip', 'Knee', 'Ank']
    if (same(...chain)) out.add(`${m[1] === 'l' ? 'r' : 'l'}${m[2]}` as ContactName)
  }
  return [...out]
}

/**
 * Search directions: every joint on its own, plus combinations that keep the
 * feet's angle to the floor (so a foot that is flat stays flat while the body
 * leans or the hips move back).
 */
function directions(view: View): Dir[] {
  const out: Dir[] = PARAMS.map((k) => [[k, 1]])
  for (const [l, r] of SIDE_PAIRS) out.push([[l, 1], [r, 1]])
  // foot angle = T + m(180 - hip) + m knee - m 90 + m ank  (m = +1 side, front: r = -1, l = +1)
  const m = { l: 1, r: view === 'front' ? -1 : 1 }
  const ankFor = (s: 'l' | 'r', dT: number, dHip: number, dKnee: number) => -dT * m[s] + dHip - dKnee
  for (const k of ['rot', 'torso'] as const)
    out.push([[k, 1], ['lAnk', ankFor('l', 1, 0, 0)], ['rAnk', ankFor('r', 1, 0, 0)]])
  for (const s of ['l', 'r'] as const) {
    out.push([[`${s}Hip`, 1], [`${s}Ank`, ankFor(s, 0, 1, 0)]])
    out.push([[`${s}Knee`, 1], [`${s}Ank`, ankFor(s, 0, 0, 1)]])
    // squat-style: knee bends twice as much as the hip, foot flat
    out.push([[`${s}Hip`, 1], [`${s}Knee`, 2], [`${s}Ank`, ankFor(s, 0, 1, 2)]])
  }
  // both hips back (hinge) keeping the trunk's angle and feet flat
  out.push([['lHip', 1], ['rHip', 1], ['lAnk', ankFor('l', 0, 1, 0)], ['rAnk', ankFor('r', 0, 1, 0)]])
  // shift the hips over one foot, trunk kept upright
  out.push([['tilt', 1], ['bendX', -1]])
  return out
}

/** Floor contacts the settle should hold for keyframe i (null: whatever touches already). */
export function contactsFor(anim: Anim, i: number, pose: Pose): ContactName[] | null {
  const base = anim.contacts?.[i]
  const extra = anim.touch?.[i]
  if (!base && !extra) return null
  const all = [...new Set([...(base ?? []), ...(extra ?? [])])]
  return anim.view === 'side' ? withPairs(pose, all) : all
}
