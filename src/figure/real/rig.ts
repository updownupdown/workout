import { SETTLED3D } from '../../data/settled3d'
import { for3D } from '../../data/poses3d'
import * as THREE from 'three'
import {
  AnchorName,
  ContactName,
  contactOf,
  NEUTRAL,
  Pose,
  Pt,
  Rig,
  solve,
  View,
  PoseInput,
} from '../skeleton'
import { Anim, compile, Compiled, poseAt } from '../anim'
import { boneDQs, BoneDQ, dqsVertex } from './dqs'

/**
 * Drives a rigged, skinned human (3ds Max Biped skeleton, as used by the
 * Microsoft Rocketbox avatars) from the app's existing 2D pose data.
 *
 * The 2D forward kinematics already give us the direction of every body
 * segment for any pose. Moves are planar (side view = sagittal plane,
 * front view = frontal plane), so each bone only needs to turn by the change
 * in its segment's angle relative to the app's NEUTRAL pose:
 *
 *   boneWorld = Rz(-(θ_pose - θ_neutral)) · boneWorld_neutral
 *
 * That needs no per-bone axis conventions, never hits twist singularities and
 * works for any rig whose neutral stance matches NEUTRAL (arms down, legs
 * straight, feet flat). Grounding and floor contacts are then re-solved in 3D
 * against the actual skinned mesh, because the model's limb lengths differ a
 * little from the 2D mannequin.
 */

type Seg =
  | 'Pelvis' | 'Spine' | 'Spine1' | 'Spine2' | 'Neck' | 'Head'
  | `${'L' | 'R'}_${'UpperArm' | 'Forearm' | 'Hand' | 'Thigh' | 'Calf' | 'Foot'}`

const ORDER: Seg[] = [
  'Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'L_UpperArm', 'L_Forearm', 'L_Hand', 'R_UpperArm', 'R_Forearm', 'R_Hand',
  'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot',
]
const TORSO: Seg[] = ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']
const LEGS: Seg[] = ['L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot']

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------- mirroring
const PAIRS: [keyof Pose, keyof Pose][] = [
  ['lSh', 'rSh'], ['lEl', 'rEl'], ['lWr', 'rWr'], ['lHip', 'rHip'], ['lKnee', 'rKnee'], ['lAnk', 'rAnk'],
  ['lShX', 'rShX'], ['lHipX', 'rHipX'], ['lShTw', 'rShTw'], ['lHipTw', 'rHipTw'],
]
const swapLR = <T extends string>(n: T): T =>
  (n[0] === 'l' && n[1] === n[1].toUpperCase() ? 'r' + n.slice(1) : n[0] === 'r' && n[1] === n[1].toUpperCase() ? 'l' + n.slice(1) : n) as T

function mirrorFrame(f: PoseInput, view: View): PoseInput {
  const o: PoseInput = { ...f }
  for (const [a, b] of PAIRS) {
    delete o[a]
    delete o[b]
    if (f[b] !== undefined) o[a] = f[b]
    if (f[a] !== undefined) o[b] = f[a]
  }
  const neg: (keyof Pose)[] = view === 'front' ? ['torso', 'spine', 'head', 'rot', 'twist', 'headTw'] : ['twist', 'headTw', 'tilt', 'bendX']
  for (const k of neg) if (f[k] !== undefined) o[k] = -f[k]!
  return o
}

const mirrored = new WeakMap<Anim, Anim>()
/** The same move done on the other side. */
export const mirrorPose = (p: Pose, view: View) => mirrorFrame(p, view) as Pose

export function mirrorAnim(a: Anim): Anim {
  const hit = mirrored.get(a)
  if (hit) return hit
  const m: Anim = {
    ...a,
    anchor: swapLR(a.anchor),
    frames: a.frames.map((f) => mirrorFrame(f, a.view)),
    contacts: a.contacts?.map((c) => c?.map(swapLR)),
  }
  mirrored.set(a, m)
  return m
}

const TAU = Math.PI * 2
const DEG = Math.PI / 180
/** Relaxed collarbone drop from the model's T-pose, released as the arms go overhead. */
const CLAV_DROP = 0.16
const wrap = (a: number) => {
  a = (a + Math.PI) % TAU
  if (a < 0) a += TAU
  return a - Math.PI
}
/** Angle of a→b measured from "up" toward +x (2D rig uses SVG y-down). */
const ang = (a: Pt, b: Pt) => Math.atan2(b.x - a.x, -(b.y - a.y))

function segAngles(rig: Rig): Record<Seg, number> {
  const T = ang(rig.pelvis, rig.mid)
  const Tu = ang(rig.mid, rig.neck)
  const H = ang(rig.neck, rig.head)
  const out = {
    Pelvis: T,
    Spine: T + wrap(Tu - T) * 0.15,
    Spine1: T + wrap(Tu - T) * 0.55,
    Spine2: Tu,
    Neck: Tu + wrap(H - Tu) * 0.45,
    Head: H,
  } as Record<Seg, number>
  for (const s of ['l', 'r'] as const) {
    const S = s === 'l' ? 'L' : 'R'
    const side = rig[s]
    out[`${S}_UpperArm`] = ang(side.upper.a, side.upper.b)
    out[`${S}_Forearm`] = ang(side.fore.a, side.fore.b)
    out[`${S}_Hand`] = ang(side.hand.a, side.hand.b)
    out[`${S}_Thigh`] = ang(side.thigh.a, side.thigh.b)
    out[`${S}_Calf`] = ang(side.shin.a, side.shin.b)
    out[`${S}_Foot`] = ang(side.foot.a, side.foot.b)
  }
  return out
}

const ANCHOR_BONE: Record<AnchorName, string> = {
  pelvis: 'Pelvis', neck: 'Neck', head: 'Head',
  lFoot: 'L_Foot', rFoot: 'R_Foot', lHand: 'L_Hand', rHand: 'R_Hand',
  lKnee: 'L_Calf', rKnee: 'R_Calf', lToe: 'L_Toe0', rToe: 'R_Toe0',
}

const Z = new THREE.Vector3(0, 0, 1)
const _q = new THREE.Quaternion()
const _p = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _p2 = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()

interface ViewState {
  view: View
  yaw: number
  neutral: Map<Seg, THREE.Quaternion>
  theta0: Record<Seg, number>
  /** Hand direction and palm normal (world) in the neutral stance. */
  hand: Record<'L' | 'R', { d: THREE.Vector3; p: THREE.Vector3 }>
  /** Relaxed collarbone local rotations, restored before every pose. */
  clav: Record<'L' | 'R', THREE.Quaternion>
}

export class Driver {
  readonly root: THREE.Object3D
  readonly meshes: THREE.SkinnedMesh[] = []
  private bones = new Map<string, THREE.Bone>()
  private rest = new Map<THREE.Bone, { q: THREE.Quaternion; p: THREE.Vector3 }>()
  /** Vertex ids (mesh index, vertex index) per body part, for floor contacts. */
  readonly parts = new Map<ContactName, [number, number][]>()
  /** Every n-th vertex, for finding the lowest point fast. */
  readonly sample: [number, number][] = []
  /** Sampled head vertices, kept apart: hair and scalp give a little against the floor. */
  readonly headSample: [number, number][] = []
  /** How far the back of the head may press into the floor (cm): hair, a bun, soft tissue. */
  readonly headSink: number
  private views = new Map<View, ViewState>()
  private cur: ViewState | null = null
  private compiled = new WeakMap<Anim, Compiled>()
  private dq: BoneDQ[] = []
  /** Height of the surface the figure stands on. */
  floorY = 0

  /** Character key, for poses baked against this body (src/data/settled3d.ts). */
  readonly key: string

  constructor(model: THREE.Object3D, key = '') {
    this.key = key
    this.headSink = key === 'ava' ? 4 : 1.5
    this.root = new THREE.Group()
    this.root.add(model)
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        const b = o as THREE.Bone
        this.bones.set(b.name.replace(/^Bip01_?/, '') || 'Bip01', b)
        this.rest.set(b, { q: b.quaternion.clone(), p: b.position.clone() })
      }
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh
        m.frustumCulled = false
        this.meshes.push(m)
      }
    })
    this.indexParts()
  }

  bone(n: string) {
    const b = this.bones.get(n)
    if (!b) throw new Error('missing bone ' + n)
    return b
  }

  private indexParts() {
    const headSet = new Set<THREE.Object3D>()
    this.bone('Head').traverse((o) => headSet.add(o))
    const name = (b: THREE.Object3D) => (headSet.has(b) ? 'Head' : b.name.replace(/^Bip01_?/, ''))
    const add = (k: ContactName, id: [number, number]) => {
      if (!this.parts.has(k)) this.parts.set(k, [])
      this.parts.get(k)!.push(id)
    }
    const bindPos = (m: THREE.SkinnedMesh, bn: string) => {
      const i = m.skeleton.bones.indexOf(this.bone(bn))
      return new THREE.Vector3().setFromMatrixPosition(m.skeleton.boneInverses[i].clone().invert())
    }
    this.meshes.forEach((m, mi) => {
      // hair (alpha-tested cards) is soft: it doesn't hold the body off the floor
      if ((m.material as THREE.Material).alphaTest > 0) return
      const g = m.geometry
      const si = g.attributes.skinIndex
      const sw = g.attributes.skinWeight
      const pos = g.attributes.position
      const elbows = { L: bindPos(m, 'L_Forearm'), R: bindPos(m, 'R_Forearm') }
      const knees = { L: bindPos(m, 'L_Calf'), R: bindPos(m, 'R_Calf') }
      for (let i = 0; i < pos.count; i++) {
        let best = 0
        for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
        const n = name(m.skeleton.bones[si.getComponent(i, best)])
        if (i % 3 === 0) (n === 'Head' ? this.headSample : this.sample).push([mi, i])
        const p = _v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix)
        const id: [number, number] = [mi, i]
        if (n === 'Head') add('head', id)
        else if (n === 'Spine2' || n === 'Neck') add('back', id)
        else if (n === 'Spine1') add('mid', id)
        else if (n === 'Pelvis' || n === 'Spine') add('pelvis', id)
        for (const S of ['L', 'R'] as const) {
          const s = S.toLowerCase() as 'l' | 'r'
          if ((n === `${S}_UpperArm` || n === `${S}_Forearm`) && p.distanceTo(elbows[S]) < 9) add(`${s}Elbow` as ContactName, id)
          if (n.startsWith(`${S}_Hand`) || n.startsWith(`${S}_Finger`)) add(`${s}Hand` as ContactName, id)
          if ((n === `${S}_Thigh` || n === `${S}_Calf`) && p.distanceTo(knees[S]) < 10) add(`${s}Knee` as ContactName, id)
          if (n === `${S}_Foot`) add(`${s}Heel` as ContactName, id)
          if (n === `${S}_Toe0`) add(`${s}Toe` as ContactName, id)
        }
      }
    })
  }

  private resetBones() {
    for (const [b, r] of this.rest) {
      b.quaternion.copy(r.q)
      b.position.copy(r.p)
    }
    this.root.position.set(0, 0, 0)
  }

  /** Bake the rig's "NEUTRAL" stance for a view: facing +x (side) or +z (front), arms by the sides. */
  private viewState(view: View): ViewState {
    const hit = this.views.get(view)
    if (hit) return hit
    this.resetBones()
    this.root.rotation.set(0, 0, 0)
    this.root.updateMatrixWorld(true)
    const head = this.bone('Head').getWorldPosition(new THREE.Vector3())
    const nose = this.bone('MNose').getWorldPosition(new THREE.Vector3())
    const f = nose.sub(head)
    const phi = Math.atan2(f.x, f.z)
    const yaw = (view === 'side' ? Math.PI / 2 : 0) - phi
    this.root.rotation.y = yaw
    this.root.updateMatrixWorld(true)

    // T-poses are modelled with the shoulders shrugged a little. Drop the
    // collarbones to a relaxed height before hanging the arms.
    for (const S of ['L', 'R'] as const) {
      const clav = this.bone(`${S}_Clavicle`)
      const a = clav.getWorldPosition(new THREE.Vector3())
      const d = this.bone(`${S}_UpperArm`).getWorldPosition(new THREE.Vector3()).sub(a).normalize()
      const axis = d.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
      this.setWorldQuat(clav, _q.setFromAxisAngle(axis, -CLAV_DROP).multiply(clav.getWorldQuaternion(_p)).clone())
    }
    // Lower the T-pose arms to hang by the sides with a little daylight.
    for (const S of ['L', 'R'] as const) {
      const up = this.bone(`${S}_UpperArm`)
      const fore = this.bone(`${S}_Forearm`)
      const a = up.getWorldPosition(new THREE.Vector3())
      const b = fore.getWorldPosition(new THREE.Vector3())
      const d = b.sub(a).normalize()
      const out = new THREE.Vector3(d.x, 0, d.z).normalize()
      const target = new THREE.Vector3(0, -1, 0).addScaledVector(out, Math.tan((9 * Math.PI) / 180)).normalize()
      this.setWorldQuat(up, _q.setFromUnitVectors(d, target).multiply(up.getWorldQuaternion(_p)).clone())
      // Relax the hand so the palm faces the thigh.
      const hand = this.bone(`${S}_Hand`)
      hand.rotateX(S === 'L' ? -0.15 : 0.15)
    }
    this.root.updateMatrixWorld(true)
    const neutral = new Map<Seg, THREE.Quaternion>()
    for (const s of ORDER) neutral.set(s, this.bone(s).getWorldQuaternion(new THREE.Quaternion()))
    const hand = {} as ViewState['hand']
    for (const S of ['L', 'R'] as const) {
      const h = this.bone(`${S}_Hand`).getWorldPosition(new THREE.Vector3())
      const mid = this.bone(`${S}_Finger2`).getWorldPosition(new THREE.Vector3())
      const thumb = this.bone(`${S}_Finger0`).getWorldPosition(new THREE.Vector3())
      const d = mid.sub(h).normalize()
      const t = thumb.sub(h)
      t.addScaledVector(d, -t.dot(d)).normalize()
      // palm faces the body: thumb × fingers on the right hand, mirrored on the left
      const p = S === 'R' ? t.clone().cross(d) : d.clone().cross(t)
      hand[S] = { d, p: p.normalize() }
    }
    const clav = {
      L: this.bone('L_Clavicle').quaternion.clone(),
      R: this.bone('R_Clavicle').quaternion.clone(),
    }
    const st: ViewState = { view, yaw, neutral, theta0: segAngles(solve(NEUTRAL, view)), hand, clav }
    // remember the lowered-arm locals as the new rest for unposed children (hands, fingers)
    this.views.set(view, st)
    return st
  }

  private setWorldQuat(b: THREE.Object3D, qw: THREE.Quaternion) {
    b.parent!.getWorldQuaternion(_p)
    b.quaternion.copy(_p.invert().multiply(qw))
    b.updateMatrixWorld(true)
  }

  /** Pose the skeleton (no grounding). */
  pose(p: Pose, view: View) {
    if (this.cur?.view !== view) {
      this.cur = this.viewState(view)
    }
    const st = this.cur
    // tilt: lean out of the move's plane (world x is in-plane horizontal in both views)
    this.root.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (view === 'side' ? -1 : 1) * p.tilt * DEG)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw))
    this.root.position.set(0, 0, 0)
    this.root.updateMatrixWorld(true)
    const th = segAngles(solve(p, view))
    // Deep hip flexion (child's pose, down dog, squats): tip the pelvis toward
    // the thighs, as a real pelvis does, so the hip skin is not folded 150°.
    if (view === 'side') {
      const hip = (p.lHip + p.rHip) / 2
      th.Pelvis -= ((Math.max(0, hip - 80) * 0.35) * Math.PI) / 180
    }
    const turn = (s: Seg) => _q.setFromAxisAngle(Z, -wrap(th[s] - st.theta0[s]))
    const plane = (s: Seg) => {
      turn(s).multiply(st.neutral.get(s)!)
      this.setWorldQuat(this.bone(s), _q)
    }
    TORSO.forEach(plane)
    for (const S of ['L', 'R'] as const) this.bone(`${S}_Clavicle`).quaternion.copy(st.clav[S])
    this.root.updateMatrixWorld(true)

    // Shoulders: lift the collarbones as the arms go overhead (scapulohumeral
    // rhythm). Moves the shoulder joint up so the skin doesn't fold.
    const spine2 = this.bone('Spine2').getWorldPosition(new THREE.Vector3())
    const bodyUp = this.bone('Neck').getWorldPosition(new THREE.Vector3()).sub(spine2).normalize()
    for (const S of ['L', 'R'] as const) {
      const sh = S === 'L' ? p.lSh : p.rSh
      const lift = smooth(60, 175, sh) * (0.12 + CLAV_DROP)
      if (lift <= 0) continue
      const clav = this.bone(`${S}_Clavicle`)
      const a = clav.getWorldPosition(new THREE.Vector3())
      const d = this.bone(`${S}_UpperArm`).getWorldPosition(new THREE.Vector3()).sub(a).normalize()
      const axis = d.cross(bodyUp).normalize()
      _q2.setFromAxisAngle(axis, lift).multiply(clav.getWorldQuaternion(_p2))
      this.setWorldQuat(clav, _q2)
    }

    const F0 = view === 'side' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)
    const chestFwd = F0.clone().applyQuaternion(turn('Spine2'))
    const shoulderRight = this.bone('R_UpperArm').getWorldPosition(new THREE.Vector3())
      .sub(this.bone('L_UpperArm').getWorldPosition(new THREE.Vector3())).normalize()
    for (const S of ['L', 'R'] as const) {
      plane(`${S}_UpperArm`)
      plane(`${S}_Forearm`)
      this.poseHand(S, S === 'L' ? p.lWr : p.rWr, turn(`${S}_Hand`).clone(), st)
      const s = S === 'L' ? 'l' : 'r'
      this.limbExtra(S, 'arm', p[`${s}ShX`], p[`${s}ShTw`], view === 'side' ? shoulderRight : chestFwd, view)
    }
    if (p.twist || p.headTw) this.twistUpper(p.twist, p.headTw)
    if (p.bendX) this.bendUpper((view === 'side' ? chestFwd : shoulderRight).clone().multiplyScalar(-1), p.bendX)

    LEGS.forEach(plane)
    const pelvisFwd = F0.clone().applyQuaternion(turn('Pelvis'))
    const hipRight = this.bone('R_Thigh').getWorldPosition(new THREE.Vector3())
      .sub(this.bone('L_Thigh').getWorldPosition(new THREE.Vector3())).normalize()
    for (const S of ['L', 'R'] as const) {
      const s = S === 'L' ? 'l' : 'r'
      this.limbExtra(S, 'leg', p[`${s}HipX`], p[`${s}HipTw`], view === 'side' ? hipRight : pelvisFwd, view)
    }
    this.skin()
  }

  /**
   * Out-of-plane motion for a whole limb, about its root joint:
   *  x  - lift the limb out of the move's plane (side view: out to its own
   *       side; front view: forward), in degrees
   *  tw - twist about the limb's own axis, + = external rotation
   */
  private limbExtra(S: 'L' | 'R', kind: 'arm' | 'leg', x: number, tw: number, out: THREE.Vector3, view: View) {
    if (!x && !tw) return
    const chain = kind === 'arm'
      ? [`${S}_UpperArm`, `${S}_Forearm`, `${S}_Hand`]
      : [`${S}_Thigh`, `${S}_Calf`, `${S}_Foot`]
    const a = this.bone(chain[0]).getWorldPosition(new THREE.Vector3())
    const d = this.bone(chain[1]).getWorldPosition(new THREE.Vector3()).sub(a).normalize()
    const sgn = S === 'R' ? 1 : -1
    const R = new THREE.Quaternion()
    if (x) {
      const n = view === 'side' ? out.clone().multiplyScalar(sgn) : out
      const axis = d.clone().cross(n)
      if (axis.lengthSq() > 1e-6) R.setFromAxisAngle(axis.normalize(), x * DEG)
    }
    if (tw) R.multiply(new THREE.Quaternion().setFromAxisAngle(d, tw * sgn * DEG))
    this.rotateChain(chain, R)
  }

  private rotateChain(chain: string[], R: THREE.Quaternion) {
    const qs = chain.map((n) => this.bone(n).getWorldQuaternion(new THREE.Quaternion()))
    chain.forEach((n, i) => this.setWorldQuat(this.bone(n), R.clone().multiply(qs[i])))
  }

  /** Bend the trunk out of plane about `axis` (through the lumbar spine). */
  private bendUpper(axis: THREE.Vector3, deg: number) {
    const names = ['Spine1', 'Spine2', 'L_Clavicle', 'R_Clavicle', 'Neck', 'Head',
      'L_UpperArm', 'L_Forearm', 'L_Hand', 'R_UpperArm', 'R_Forearm', 'R_Hand']
    const qs = names.map((n) => this.bone(n).getWorldQuaternion(new THREE.Quaternion()))
    const part = new THREE.Quaternion().setFromAxisAngle(axis, deg * 0.5 * DEG)
    const all = new THREE.Quaternion().setFromAxisAngle(axis, deg * DEG)
    // half at the lower back, the rest above it; the head stays near level
    const head = new THREE.Quaternion().setFromAxisAngle(axis, deg * 0.6 * DEG)
    names.forEach((n, i) => {
      const R = n === 'Spine1' ? part : n === 'Head' || n === 'Neck' ? head : all
      this.setWorldQuat(this.bone(n), R.clone().multiply(qs[i]))
    })
  }

  /** Turn the chest (and everything above it) about the spine; + = to the figure's left. */
  private twistUpper(twist: number, headTw: number) {
    const s1 = this.bone('Spine1').getWorldPosition(new THREE.Vector3())
    const up = this.bone('Neck').getWorldPosition(new THREE.Vector3()).sub(s1).normalize()
    const names = ['Spine1', 'Spine2', 'Neck', 'Head',
      'L_UpperArm', 'L_Forearm', 'L_Hand', 'R_UpperArm', 'R_Forearm', 'R_Hand']
    const qs = names.map((n) => this.bone(n).getWorldQuaternion(new THREE.Quaternion()))
    const full = new THREE.Quaternion().setFromAxisAngle(up, twist * DEG)
    const half = new THREE.Quaternion().setFromAxisAngle(up, twist * 0.45 * DEG)
    const head = new THREE.Quaternion().setFromAxisAngle(up, (twist + headTw) * DEG)
    names.forEach((n, i) => {
      const R = n === 'Spine1' ? half : n === 'Head' ? head : n === 'Neck' ? full.clone().slerp(head, 0.4) : full
      this.setWorldQuat(this.bone(n), R.clone().multiply(qs[i]))
    })
  }

  /**
   * Hands: the 2D data only says how far the wrist bends. A hand that bends a
   * lot (flat on the floor, push-up, down dog) must turn palm-down, which in a
   * real arm comes from forearm rotation. Blend from the neutral palm-in hand
   * toward palm-facing-the-push as the wrist bends, splitting the twist
   * between forearm and wrist so neither skin region wrings.
   */
  private poseHand(S: 'L' | 'R', wr: number, qPlane: THREE.Quaternion, st: ViewState) {
    const fore = this.bone(`${S}_Forearm`)
    const hand = this.bone(`${S}_Hand`)
    const h = st.hand[S].d.clone().applyQuaternion(qPlane)
    const pPlane = st.hand[S].p.clone().applyQuaternion(qPlane)
    const f = hand.getWorldPosition(new THREE.Vector3()).sub(fore.getWorldPosition(new THREE.Vector3())).normalize()
    const pPush = f.clone().addScaledVector(h, -f.dot(h))
    const s = pPush.length() > 0.05 ? smooth(15, 70, Math.abs(wr)) : 0
    let phi = 0
    if (s > 0) {
      pPush.normalize()
      const p1 = pPlane.clone().multiplyScalar(1 - s).addScaledVector(pPush, s)
      p1.addScaledVector(h, -p1.dot(h)).normalize()
      phi = Math.atan2(new THREE.Vector3().crossVectors(pPlane, p1).dot(h), pPlane.dot(p1))
    }
    if (phi !== 0) {
      _q2.setFromAxisAngle(f, phi * 0.5).multiply(fore.getWorldQuaternion(_p2))
      this.setWorldQuat(fore, _q2)
    }
    _q2.setFromAxisAngle(h, phi).multiply(qPlane).multiply(st.neutral.get(`${S}_Hand`)!)
    this.setWorldQuat(hand, _q2)
  }

  /** Refresh the per-bone dual quaternions after posing. */
  private skin() {
    this.root.updateMatrixWorld(true)
    this.meshes.forEach((m, i) => (this.dq[i] = boneDQs(m, this.dq[i])))
  }

  vtx(mi: number, i: number, out: THREE.Vector3) {
    return dqsVertex(this.meshes[mi], this.dq[mi], i, out)
  }

  minY(ids: [number, number][]) {
    let y = Infinity
    for (const [mi, i] of ids) y = Math.min(y, this.vtx(mi, i, _w).y)
    return y
  }

  /** Lowest point of the posed mesh. */
  lowest() {
    return Math.min(this.minY(this.sample), this.minY(this.headSample) + this.headSink)
  }

  /** Height of a body part's lowest point (the head counts its give against the floor). */
  partY(c: ContactName) {
    const y = this.minY(this.parts.get(c) ?? [])
    return c === 'head' ? y + this.headSink : y
  }

  /** Re-level a keyframe so its declared floor contacts rest on the floor with this body's proportions. */
  private level(p: Pose, view: View, contacts: ContactName[]): Pose {
    const rig = solve(p, view)
    const pts = contacts.map((c) => contactOf(rig, c))
    let a = 0, b = 1, best = -1
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].p.x - pts[j].p.x, pts[i].p.y - pts[j].p.y)
        if (d > best) { best = d; a = i; b = j }
      }
    const A = this.parts.get(contacts[a])
    const B = this.parts.get(contacts[b])
    if (!A || !B) return p
    const err = (d: number) => {
      this.pose({ ...p, rot: p.rot + d }, view)
      const ya = this.minY(A), yb = this.minY(B)
      const low = this.lowest()
      // both contacts level, and nothing else meaningfully below them
      return Math.abs(ya - yb) + Math.max(0, Math.min(ya, yb) - low - 1.5) * 2
    }
    let bestD = 0, bestE = err(0)
    for (let k = 1; k <= 60 && bestE > 0.4; k++) {
      for (const d of [k * 0.5, -k * 0.5]) {
        const e = err(d)
        if (e < bestE - 0.05) { bestE = e; bestD = d }
      }
    }
    return { ...p, rot: p.rot + bestD }
  }

  /** Compile a move for this body: re-level keyframes with ≥2 floor contacts. */
  compile(src: Anim): Compiled {
    const hit = this.compiled.get(src)
    if (hit) return hit
    const anim = for3D(src)
    const base = compile(anim)
    const baked = anim.id ? SETTLED3D[this.key]?.[anim.id] : undefined
    if (baked) {
      const out = { ...base, poses: base.poses.map((p, i) => ({ ...p, ...baked[i] })) }
      this.compiled.set(src, out)
      return out
    }
    const poses = base.poses.map((p, i) => {
      const c = anim.contacts?.[i]
      return c && c.length >= 2 ? this.level(p, anim.view, c) : p
    })
    const out = { ...base, poses }
    this.compiled.set(src, out)
    return out
  }

  /** Pose at time t, grounded on the floor and pinned at the move's anchor. */
  update(anim: Anim, t: number, tempo: number, flip = false) {
    const c = this.compile(anim)
    const { view, anchor } = c.anim
    let p = poseAt(c, t, tempo)
    if (flip) p = mirrorPose(p, view)
    this.pose(p, view)
    const low = this.lowest()
    const a = this.bone(ANCHOR_BONE[flip ? swapLR(anchor) : anchor]).getWorldPosition(_v)
    this.root.position.set(-a.x, this.floorY - low, 0)
    this.skin()
    return p
  }

  /** The view (side or front) the 3D figure plays a move in. */
  viewOf(anim: Anim) {
    return this.compile(anim).anim.view
  }

  /** World-space bounds of the figure across one cycle of a move. */
  bounds(anim: Anim, tempo: number, flip = false) {
    const box = new THREE.Box3()
    const n = anim.mode === 'loop' ? 10 : 4
    for (let i = 0; i <= n; i++) {
      const t = anim.mode === 'loop' ? (i / n) * tempo : (i / n) * tempo * 1.2
      this.update(anim, t, tempo, flip)
      for (const [mi, k] of this.sample) box.expandByPoint(this.vtx(mi, k, _w))
      for (const [mi, k] of this.headSample) box.expandByPoint(this.vtx(mi, k, _w))
    }
    return box
  }
}
