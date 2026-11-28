import type { Anim, Reach } from '../figure/anim'
import type { AnchorName, ContactName, PoseInput, View } from '../figure/skeleton'

/**
 * Corrections for the 3D figure, where the 2D drawing took liberties a real
 * body can't (arms passing through the torso in front view, hands lifted
 * off the floor so they show in profile, …). Applied on top of the move's
 * own keyframes before the 3D settle (src/data/settled3d.ts).
 */
export interface Fix3D {
  view?: View
  anchor?: AnchorName
  /** Merged into the move's keyframes, by index. */
  frames?: (PoseInput | null)[]
  /** Replace the keyframes entirely (when the view changes). */
  replace?: PoseInput[]
  /** Floor contacts per keyframe for the 3D settle (replaces the 2D ones). */
  contacts?: (ContactName[] | null)[]
  /** Extra floor contacts per keyframe, added to the move's own. */
  touch?: (ContactName[] | null)[]
  /** Hands holding on to the body, per keyframe. */
  reach?: (Reach[] | null)[]
}

// ---------------------------------------------------------------- building blocks
/** Cross-legged seat, figure facing the viewer: thighs forward and out, shins crossed. */
const CROSS_LEGGED: PoseInput = { lHip: 55, rHip: 55, lHipX: 75, rHipX: 75, lKnee: 150, rKnee: 150, lAnk: 0, rAnk: 0 }
/** Hands resting on the knees while sitting cross-legged. */
const HANDS_ON_KNEES: PoseInput = { lSh: 12, rSh: 12, lShX: 48, rShX: 48, lEl: 22, rEl: 22, lShTw: -50, rShTw: -50 }
/** Hands clasped in front of the chest (front view). */
const PRAYER: PoseInput = { lSh: 15, rSh: 15, lShX: 50, rShX: 50, lEl: 100, rEl: 100, lShTw: -90, rShTw: -90 }
/** Hands laced behind the head, elbows wide (side view, relative to the trunk). */
const HANDS_BEHIND_HEAD: PoseInput = { lSh: 170, rSh: 170, lShX: 55, rShX: 55, lEl: 140, rEl: 140 }
/** Lying on the back, arms resting on the floor by the sides. */
const ARMS_DOWN: PoseInput = { lSh: -8, rSh: -8, lShX: 18, rShX: 18, lEl: 0, rEl: 0 }
const HANDS: ContactName[] = ['lHand', 'rHand']

const ON_KNEES: Reach[] = [{ hand: 'L', to: 'L_Calf', d: 13 }, { hand: 'R', to: 'R_Calf', d: 13 }]
const ON_FEET: Reach[] = [{ hand: 'L', to: 'L_Foot', d: 7 }, { hand: 'R', to: 'R_Foot', d: 7 }]
const ON_SHINS: Reach[] = [{ hand: 'L', to: 'L_Calf', d: 12 }, { hand: 'R', to: 'R_Calf', d: 12 }]
const ON_HEAD: Reach[] = [{ hand: 'L', to: 'Neck', d: 13 }, { hand: 'R', to: 'Neck', d: 13 }]
const PALMS: Reach[] = [{ hand: 'L', to: 'R_Hand', d: 6 }]

const BREATH: Fix3D = {
  frames: [{ ...CROSS_LEGGED, ...HANDS_ON_KNEES }, { ...CROSS_LEGGED, ...HANDS_ON_KNEES, lSh: 14, rSh: 14 }],
  contacts: [['pelvis'], ['pelvis']],
  reach: [ON_KNEES, ON_KNEES],
}
const both = <T,>(p: T, n: number): T[] => Array.from({ length: n }, () => p)
const hands = (n: number) => both(HANDS, n)

export const FIX3D: Record<string, Fix3D> = {
  // seated, facing the viewer: in 2D the shins folded back under the body
  'box-breath': BREATH,
  'coherent-breath': BREATH,
  'relax-478': BREATH,
  'sigh-breath': BREATH,
  'extended-exhale': BREATH,
  'triangle-breath': BREATH,
  'seated-side-bend': { frames: both(CROSS_LEGGED, 2), contacts: [['pelvis'], ['pelvis']] },
  butterfly: {
    frames: [
      { lHip: 62, rHip: 62, lHipX: 60, rHipX: 60, lKnee: 150, rKnee: 150, lAnk: 0, rAnk: 0, ...HANDS_ON_KNEES, lShX: 55, rShX: 55, lEl: 40, rEl: 40 },
      { lHip: 70, rHip: 70, lHipX: 58, rHipX: 58, lKnee: 150, rKnee: 150, lAnk: 0, rAnk: 0, ...HANDS_ON_KNEES, lShX: 55, rShX: 55, lEl: 40, rEl: 40 },
    ],
    contacts: [['pelvis'], ['pelvis']],
    reach: [ON_FEET, ON_FEET],
  },
  'straddle-side': { frames: both({ lHip: 50, rHip: 50, lHipX: 45, rHipX: 45 }, 2), contacts: [['pelvis', 'lHeel', 'rHeel'], ['pelvis', 'lHeel', 'rHeel']] },

  // front view: arms in front of the body, not through it
  'open-hug': { frames: [{ lShX: -15, rShX: -15 }, { lSh: 90, rSh: 90, lShX: 70, rShX: 70, lEl: 40, rEl: 40 }] },
  'band-pull-apart': { frames: [{ lSh: 90, rSh: 90, lShX: 85, rShX: 85, lEl: 0, rEl: 0 }, { lShX: -5, rShX: -5 }] },
  'sumo-squat': { frames: both(PRAYER, 2), reach: both(PALMS, 2) },
  'lateral-lunge': { frames: both(PRAYER, 2), reach: both(PALMS, 2) },
  'band-walk': { frames: both(PRAYER, 2), reach: both(PALMS, 2) },
  'cross-shoulder': {
    frames: [null, { rSh: 90, rShX: 115, rEl: 0, lSh: 30, lShX: 70, lEl: 100, lShTw: -90 }],
    reach: [null, [{ hand: 'L', to: 'R_Forearm', d: 7 }]],
  },
  'triceps-stretch': {
    frames: [null, { rSh: 172, rEl: 150, rShTw: 90, lSh: 160, lEl: 90, lShTw: 90 }],
    reach: [null, [{ hand: 'L', to: 'R_Forearm', d: 6 }]],
  },
  'db-upright-row': { frames: [null, { lShX: 20, rShX: 20, lShTw: -90, rShTw: -90 }] },
  'happy-baby': { frames: [ARMS_DOWN, null], touch: [HANDS, null], reach: [null, ON_FEET] },
  'rolling-ball': { reach: both(ON_SHINS, 2) },
  dancer: { reach: [null, [{ hand: 'R', to: 'R_Foot', d: 7 }]] },
  'quad-stretch': { reach: [null, [{ hand: 'R', to: 'R_Foot', d: 7 }]] },

  // hands behind the head: elbows out to the sides
  'good-morning': { frames: both(HANDS_BEHIND_HEAD, 2), reach: both(ON_HEAD, 2) },
  bicycle: { frames: [{ ...HANDS_BEHIND_HEAD, twist: -28 }, { ...HANDS_BEHIND_HEAD, twist: 28 }], reach: both(ON_HEAD, 2) },

  // lying down: arms rest on the floor
  savasana: { frames: [ARMS_DOWN, ARMS_DOWN], touch: hands(2) },
  'glute-bridge': { frames: [ARMS_DOWN, null], touch: hands(2) },
  'bridge-pose': { frames: [ARMS_DOWN, null], touch: hands(2) },
  'band-bridge': { frames: [ARMS_DOWN, null], touch: hands(2) },
  'single-leg-bridge': { frames: [ARMS_DOWN, null], touch: hands(2) },
  'shoulder-bridge': { touch: hands(2) },
  'bridge-march': { touch: hands(2) },
  'knees-chest': { frames: [ARMS_DOWN, null], touch: [HANDS, null] },
  'figure-four': { frames: [ARMS_DOWN, null], touch: [HANDS, null] },
  'legs-up': { frames: [ARMS_DOWN, ARMS_DOWN], touch: hands(2) },
  'leg-lifts': { frames: both(ARMS_DOWN, 2), touch: hands(2) },
  'flutter-kicks': { frames: both(ARMS_DOWN, 2), touch: hands(2) },
  'leg-circles': { frames: both(ARMS_DOWN, 5), touch: hands(5) },
  'toe-taps': { frames: both(ARMS_DOWN, 4), touch: hands(4) },
  'reverse-crunch': { frames: [ARMS_DOWN, { ...ARMS_DOWN, lSh: -14, rSh: -14 }], touch: hands(2) },
  'hollow-hold': { frames: [ARMS_DOWN, null], touch: [HANDS, null] },
  crunch: { touch: [HANDS, null] },
  'roll-up': { touch: [HANDS, null, null, null] },
  'db-floor-press': { touch: [['lElbow', 'rElbow'], null] },
  locust: { frames: [{ lShX: 10, rShX: 10 }, null], touch: [HANDS, null] },
  superman: { touch: [HANDS, null] },
  sphinx: { touch: [HANDS, null] },

  // all fours and folds
  child: {
    frames: [null, { lSh: 178, rSh: 178, lEl: 0, rEl: 0, lWr: 0, rWr: 0, lHip: 152, rHip: 152, lKnee: 150, rKnee: 150, lHipX: 14, rHipX: 14, lAnk: 85, rAnk: 85 }],
    contacts: [['rKnee', 'rToe'], ['lHand', 'rHand', 'rKnee', 'rToe']],
  },
  puppy: { frames: [null, { lSh: 188, rSh: 188, lEl: 0, rEl: 0, lWr: 0, rWr: 0 }] },
  dolphin: { frames: [{ lSh: 90, rSh: 90, lEl: 90, rEl: 90, lWr: 0, rWr: 0, lHip: 90, rHip: 90 }, null] },
  pigeon: {
    frames: [null, { torso: 25, rHip: 80, rKnee: 105, rHipTw: -75, rHipX: 20, rAnk: 0, lHip: -40, lKnee: 0, lAnk: 85 }],
    contacts: [null, ['rKnee', 'rHeel', 'lKnee', 'lToe', 'pelvis']],
  },
}

const fixed = new WeakMap<Anim, Anim>()

/** A move's animation as the 3D figure should play it. */
export function for3D(anim: Anim): Anim {
  const f = anim.id ? FIX3D[anim.id] : undefined
  if (!f) return anim
  const hit = fixed.get(anim)
  if (hit) return hit
  const frames = f.replace ?? anim.frames.map((fr, i) => (f.frames?.[i] ? { ...fr, ...f.frames[i] } : fr))
  const out: Anim = {
    ...anim,
    view: f.view ?? anim.view,
    anchor: f.anchor ?? anim.anchor,
    frames,
    contacts: f.contacts ?? (f.replace ? undefined : anim.contacts),
    touch: f.touch,
    reach: f.reach,
  }
  fixed.set(anim, out)
  return out
}
