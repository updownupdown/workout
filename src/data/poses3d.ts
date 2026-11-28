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
/**
 * Cross-legged seat, figure facing the viewer: thighs forward and out and
 * turned out at the hip (kneecaps up), shins crossed with the right one in
 * front. Fitted to knee and ankle targets on both bodies.
 */
const CROSS_LEGGED: PoseInput = {
  rHip: 73, rHipX: 48, rHipTw: 83, rKnee: 119, rAnk: 10,
  lHip: 73, lHipX: 47, lHipTw: 78, lKnee: 130, lAnk: 10,
}
/** Soles together, knees out (butterfly), from knees up to knees low. */
const SOLES_TOGETHER: PoseInput[] = [
  { lHip: 87, rHip: 87, lHipX: 46, rHipX: 46, lHipTw: 85, rHipTw: 85, lKnee: 141, rKnee: 141, lAnk: 10, rAnk: 10 },
  { lHip: 78, rHip: 78, lHipX: 38, rHipX: 38, lHipTw: 84, rHipTw: 84, lKnee: 143, rKnee: 143, lAnk: 10, rAnk: 10 },
]
/** Hands resting on the knees while sitting cross-legged. */
const HANDS_ON_KNEES: PoseInput = { lSh: 12, rSh: 12, lShX: 48, rShX: 48, lEl: 22, rEl: 22, lShTw: -50, rShTw: -50 }
/** Hands clasped in front of the chest (front view). */
const PRAYER: PoseInput = { lSh: 15, rSh: 15, lShX: 50, rShX: 50, lEl: 100, rEl: 100, lShTw: -90, rShTw: -90 }
/** Hands laced behind the head, elbows wide (side view, relative to the trunk). Fitted to elbow and wrist targets. */
const HANDS_BEHIND_HEAD: PoseInput = { lSh: 192, rSh: 192, lShX: 35, rShX: 35, lShTw: -90, rShTw: -90, lEl: 110, rEl: 110 }
/** Lying on the back, arms resting on the floor by the sides. */
const ARMS_DOWN: PoseInput = { lSh: -8, rSh: -8, lShX: 18, rShX: 18, lEl: 0, rEl: 0 }
/** Hands on the hips, elbows out and back (side view). Fitted to elbow and wrist targets. */
const HANDS_ON_HIPS: PoseInput = { lSh: -4.5, rSh: -4.5, lShX: 18, rShX: 18, lShTw: -65, rShTw: -65, lEl: 47, rEl: 47 }
/** Top of an upright row: elbows high and out, hands in front of the chest (front view). */
const ROW_TOP: PoseInput = { lSh: 88, rSh: 88, lShX: 22, rShX: 22, lShTw: -75, rShTw: -75, lEl: 152, rEl: 152 }
/** Arms wrapped round the shoulders, left arm on top (front view). */
const HUG: PoseInput = { lSh: 115, lShX: 107, lShTw: -31, lEl: 113, rSh: 150, rShX: 110, rShTw: -7, rEl: 102 }
const HANDS: ContactName[] = ['lHand', 'rHand']

const ON_KNEES: Reach[] = [{ hand: 'L', to: 'L_Calf', d: 13 }, { hand: 'R', to: 'R_Calf', d: 13 }]
const ON_FEET: Reach[] = [{ hand: 'L', to: 'L_Foot', d: 7 }, { hand: 'R', to: 'R_Foot', d: 7 }]
const ON_SHINS: Reach[] = [{ hand: 'L', to: 'L_Calf', d: 12 }, { hand: 'R', to: 'R_Calf', d: 12 }]
const ON_HEAD: Reach[] = [{ hand: 'L', to: 'Neck', d: 13 }, { hand: 'R', to: 'Neck', d: 13 }]
const PALMS: Reach[] = [{ hand: 'L', to: 'R_Hand', d: 6 }]
const SOLES: Reach = { hand: 'L', from: 'L_Foot', to: 'R_Foot', d: 11 }

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
    frames: SOLES_TOGETHER.map((legs) => ({ ...legs, ...HANDS_ON_KNEES, lShX: 55, rShX: 55, lEl: 40, rEl: 40 })),
    // feet rest on their outer edges
    contacts: [['pelvis', 'lHeel', 'rHeel'], ['pelvis', 'lHeel', 'rHeel']],
    reach: [[...ON_FEET, SOLES], [...ON_FEET, SOLES]],
  },
  'straddle-side': { frames: both({ lHip: 50, rHip: 50, lHipX: 45, rHipX: 45 }, 2), contacts: [['pelvis', 'lHeel', 'rHeel'], ['pelvis', 'lHeel', 'rHeel']] },

  // front view: arms in front of the body, not through it
  'open-hug': {
    frames: [{ lShX: -15, rShX: -15 }, HUG],
    reach: [null, [{ hand: 'L', to: 'R_UpperArm', d: 8 }, { hand: 'R', to: 'L_UpperArm', d: 10 }]],
  },
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
  'db-upright-row': { frames: [null, ROW_TOP] },
  'hip-hinge': { frames: both(HANDS_ON_HIPS, 2) },
  // knees wide, palms together at the chest with the elbows inside the knees
  garland: { frames: [null, { lHipX: 35, rHipX: 35, lHipTw: 30, rHipTw: 30, lSh: 35, rSh: 35, lEl: 110, rEl: 110, lShX: 15, rShX: 15 }], reach: [null, PALMS] },
  // hands on the low back (the heels are out of reach of this trunk's arch)
  // thighs upright with the hips over the knees, toes tucked; hands on the low back
  camel: {
    frames: [null, { ...HANDS_ON_HIPS, lSh: -25, rSh: -25, lAnk: 50, rAnk: 50, rot: -6 }],
    contacts: [['rKnee', 'rToe'], ['rKnee', 'lKnee', 'rToe', 'lToe']],
  },
  // sole against the standing thigh, palms together overhead
  tree: { reach: [null, [{ hand: 'L', from: 'L_Foot', to: 'R_Thigh', d: 30 }, ...PALMS]] },
  // fold with fingertips by the feet, then a flat back with hands on the shins
  'half-lift': {
    reach: [
      [{ hand: 'L', to: 'L_Foot', d: 12 }, { hand: 'R', to: 'R_Foot', d: 12 }],
      [{ hand: 'L', to: 'L_Calf', d: 20 }, { hand: 'R', to: 'R_Calf', d: 20 }],
    ],
  },
  'happy-baby': { frames: [ARMS_DOWN, null], touch: [HANDS, null], reach: [null, ON_FEET] },
  'rolling-ball': { reach: both(ON_SHINS, 2) },
  dancer: { reach: [null, [{ hand: 'R', to: 'R_Foot', d: 7 }]] },
  'quad-stretch': { reach: [null, [{ hand: 'R', to: 'R_Foot', d: 7 }]] },

  // hands behind the head: elbows out to the sides
  'good-morning': { frames: both(HANDS_BEHIND_HEAD, 2), reach: both(ON_HEAD, 2) },
  // shoulders curl off the floor; only the low back and pelvis stay down
  bicycle: {
    frames: [{ ...HANDS_BEHIND_HEAD, twist: -28 }, { ...HANDS_BEHIND_HEAD, twist: 28 }],
    contacts: [['pelvis'], ['pelvis']],
    reach: both(ON_HEAD, 2),
  },

  // lying down: arms rest on the floor
  savasana: { frames: [ARMS_DOWN, ARMS_DOWN], touch: hands(2) },
  'glute-bridge': { frames: [ARMS_DOWN, null], touch: hands(2) },
  'bridge-pose': { frames: [ARMS_DOWN, null], touch: hands(2) },
  'band-bridge': { frames: [ARMS_DOWN, null], touch: hands(2) },
  'single-leg-bridge': { frames: [ARMS_DOWN, null], touch: hands(2) },
  'shoulder-bridge': { touch: hands(2) },
  'bridge-march': { touch: hands(2) },
  'knees-chest': { frames: [ARMS_DOWN, null], touch: [HANDS, null] },
  // right ankle rests on the left knee; hands draw the left thigh in
  'figure-four': {
    frames: [ARMS_DOWN, { rHipTw: 45, lSh: 60, rSh: 60, lEl: 40, rEl: 40 }],
    touch: [HANDS, null],
    reach: [null, [
      { hand: 'L', to: 'L_Thigh', d: 30 }, { hand: 'R', to: 'L_Thigh', d: 30 },
      { hand: 'R', from: 'R_Foot', to: 'L_Calf', d: 9 },
    ]],
  },
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
