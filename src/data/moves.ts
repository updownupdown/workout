import type { Anim } from '../figure/anim'
import type { PoseInput } from '../figure/skeleton'

export type Category = 'warmup' | 'strength' | 'core' | 'pilates' | 'yoga' | 'stretch' | 'breath' | 'rest'
export type Position = 'standing' | 'kneeling' | 'quadruped' | 'prone' | 'supine' | 'seated'
export type Focus = 'upper' | 'lower' | 'core' | 'spine' | 'full' | 'mind'

export interface BreathPhase {
  kind: 'in' | 'hold' | 'out'
  secs: number
}

export interface Move {
  id: string
  name: string
  cat: Category
  position: Position
  focus: Focus[]
  /** reps: count reps at `tempo` s each. time: run for `secs`. breath: run `cycles` of `pattern`. */
  kind: 'reps' | 'time' | 'breath'
  reps?: number
  secs?: number
  /** Seconds per rep (loop anim) or seconds to flow into the pose (hold anim). */
  tempo: number
  sided?: boolean
  equipment?: 'dumbbells'
  level: 1 | 2 | 3
  cues: string[]
  anim: Anim
  pattern?: BreathPhase[]
  cycles?: number
}

// ---------------------------------------------------------------------------
// Reusable base poses (see figure/skeleton.ts for angle conventions)
// ---------------------------------------------------------------------------

const QUAD: PoseInput = {
  torso: 78, head: -10,
  lSh: 78, rSh: 78, lWr: 90, rWr: 90,
  lHip: 78, rHip: 78, lKnee: 90, rKnee: 90, lAnk: 90, rAnk: 90,
}
const PLANK: PoseInput = { torso: 69, lSh: 69, rSh: 69, lWr: 90, rWr: 90, lAnk: 5, rAnk: 5 }
const PUSH_DOWN: PoseInput = { torso: 80, lSh: 0, rSh: 0, lEl: 80, rEl: 80, lWr: 90, rWr: 90, lAnk: 5, rAnk: 5 }
const SUPINE: PoseInput = { torso: -90 }
const HOOK: PoseInput = { torso: -90, lHip: 45, rHip: 45, lKnee: 125, rKnee: 125, lAnk: 10, rAnk: 10 }
const PRONE: PoseInput = { torso: 90, lSh: 180, rSh: 180, lAnk: 90, rAnk: 90, head: -10 }
const PILATES_CURL = { spine: 30, head: 15 }
const SEATED_FRONT: PoseInput = {
  lHip: 80, rHip: 80, lKnee: 150, rKnee: 150,
  lSh: 22, rSh: 22, lEl: 45, rEl: 45,
}
const SEATED_SIDE: PoseInput = { lHip: 90, rHip: 90, lAnk: -10, rAnk: -10, lSh: 20, rSh: 20 }
const KNEEL: PoseInput = { lKnee: 90, rKnee: 90, lAnk: 90, rAnk: 90 }

const sym = (sh: number, el = 0): PoseInput => ({ lSh: sh, rSh: sh, lEl: el, rEl: el })
const legs = (hip: number, knee = 0, ank = 0): PoseInput => ({
  lHip: hip, rHip: hip, lKnee: knee, rKnee: knee, lAnk: ank, rAnk: ank,
})

const hold = (view: Anim['view'], anchor: Anim['anchor'], ...frames: PoseInput[]): Anim => ({
  view, anchor, frames, mode: 'hold',
})
const loop = (view: Anim['view'], anchor: Anim['anchor'], ...frames: PoseInput[]): Anim => ({
  view, anchor, frames, mode: 'loop',
})

const BREATH_FIG: Anim = {
  view: 'front',
  anchor: 'pelvis',
  mode: 'loop',
  breathe: false,
  frames: [SEATED_FRONT, { ...SEATED_FRONT, lSh: 27, rSh: 27, lEl: 48, rEl: 48, head: -3 }],
}

// ---------------------------------------------------------------------------

export const MOVES: Move[] = [
  // ----------------------------------------------------------------- breath
  {
    id: 'box-breath', name: 'Box breathing', cat: 'breath', position: 'seated', focus: ['mind'],
    kind: 'breath', tempo: 2, level: 1, cycles: 5,
    pattern: [{ kind: 'in', secs: 4 }, { kind: 'hold', secs: 4 }, { kind: 'out', secs: 4 }, { kind: 'hold', secs: 4 }],
    cues: ['Sit tall, shoulders soft', 'Breathe through the nose', 'Let the square set the pace'],
    anim: BREATH_FIG,
  },
  {
    id: 'coherent-breath', name: 'Coherent breathing', cat: 'breath', position: 'seated', focus: ['mind'],
    kind: 'breath', tempo: 2, level: 1, cycles: 6,
    pattern: [{ kind: 'in', secs: 5.5 }, { kind: 'out', secs: 5.5 }],
    cues: ['Slow, even breaths', 'Belly rises first, then ribs', 'No pause at the top or bottom'],
    anim: BREATH_FIG,
  },
  {
    id: 'relax-478', name: '4-7-8 breath', cat: 'breath', position: 'seated', focus: ['mind'],
    kind: 'breath', tempo: 2, level: 1, cycles: 4,
    pattern: [{ kind: 'in', secs: 4 }, { kind: 'hold', secs: 7 }, { kind: 'out', secs: 8 }],
    cues: ['In through the nose', 'Hold gently, no strain', 'Long sigh out through the mouth'],
    anim: BREATH_FIG,
  },
  {
    id: 'sigh-breath', name: 'Physiological sigh', cat: 'breath', position: 'seated', focus: ['mind'],
    kind: 'breath', tempo: 2, level: 1, cycles: 6,
    pattern: [{ kind: 'in', secs: 2.5 }, { kind: 'in', secs: 1 }, { kind: 'out', secs: 6 }],
    cues: ['Big breath in, then a second sip on top', 'Long, slow exhale', 'Feel your shoulders drop'],
    anim: BREATH_FIG,
  },

  // ----------------------------------------------------------------- warm-up
  {
    id: 'sun-reach', name: 'Sunrise reach', cat: 'warmup', position: 'standing', focus: ['upper', 'spine'],
    kind: 'reps', reps: 5, tempo: 7, level: 1,
    cues: ['Inhale, sweep the arms up', 'Exhale, float them down', 'Move with your breath'],
    anim: { ...loop('front', 'pelvis', sym(8), { ...sym(172), head: -8 }) },
  },
  {
    id: 'arm-circles', name: 'Arm circles', cat: 'warmup', position: 'standing', focus: ['upper'],
    kind: 'reps', reps: 8, tempo: 2.4, level: 1,
    cues: ['Big, slow circles', 'Keep the ribs down', 'Shoulders away from the ears'],
    anim: { ...loop('side', 'rFoot', sym(0), sym(90), sym(180), sym(270), sym(360)), closed: true },
  },
  {
    id: 'march', name: 'March in place', cat: 'warmup', position: 'standing', focus: ['lower', 'full'],
    kind: 'reps', reps: 12, tempo: 1.4, level: 1,
    cues: ['Knees up to hip height', 'Opposite arm swings forward', 'Stay tall'],
    anim: loop('side', 'pelvis',
      { rHip: 75, rKnee: 85, lSh: 45, rSh: -30, lEl: 20, rEl: 20 }, { lEl: 20, rEl: 20 },
      { lHip: 75, lKnee: 85, rSh: 45, lSh: -30, lEl: 20, rEl: 20 }, { lEl: 20, rEl: 20 }),
  },
  {
    id: 'star-jacks', name: 'Star jacks', cat: 'warmup', position: 'standing', focus: ['full'],
    kind: 'reps', reps: 16, tempo: 1.2, level: 2,
    cues: ['Light on your feet', 'Arms and legs open together', 'Step it out for low impact'],
    anim: loop('front', 'pelvis', sym(8), { ...sym(155), lHip: 22, rHip: 22 }),
  },
  {
    id: 'side-bend', name: 'Standing side bend', cat: 'warmup', position: 'standing', focus: ['spine'],
    kind: 'reps', reps: 4, tempo: 6, sided: true, level: 1,
    cues: ['Reach up and over', 'Both feet rooted', 'Breathe into the long side'],
    anim: loop('front', 'pelvis',
      { lSh: 10, rSh: 172 },
      { torso: 8, spine: 18, head: 8, lSh: 14, rSh: 178, lHip: 8, rHip: -8 }),
  },
  {
    id: 'neck-release', name: 'Neck release', cat: 'warmup', position: 'standing', focus: ['upper', 'mind'],
    kind: 'reps', reps: 3, tempo: 7, level: 1,
    cues: ['Ear toward shoulder', 'Let the head be heavy', 'Slow from side to side'],
    anim: loop('front', 'pelvis', { head: -24, ...sym(6) }, { head: 24, ...sym(6) }),
  },
  {
    id: 'cat-cow', name: 'Cat–cow', cat: 'warmup', position: 'quadruped', focus: ['spine'],
    kind: 'reps', reps: 6, tempo: 6, level: 1,
    cues: ['Exhale, round the spine up', 'Inhale, drop the belly, lift the gaze', 'Hands under shoulders, knees under hips'],
    anim: loop('side', 'rKnee',
      { ...QUAD, torso: 70, spine: 22, head: 28, lSh: 92, rSh: 92, lHip: 70, rHip: 70 },
      { ...QUAD, torso: 84, spine: -18, head: -28, lSh: 66, rSh: 66, lHip: 84, rHip: 84 }),
  },

  // ----------------------------------------------------------------- strength
  {
    id: 'squat', name: 'Squat', cat: 'strength', position: 'standing', focus: ['lower'],
    kind: 'reps', reps: 12, tempo: 3, level: 1,
    cues: ['Sit back like there is a chair', 'Knees track over toes', 'Drive up through the heels'],
    anim: loop('side', 'rFoot', sym(90),
      { torso: 35, head: -20, ...sym(125), ...legs(115, 100, -20) }),
  },
  {
    id: 'split-squat', name: 'Split squat', cat: 'strength', position: 'standing', focus: ['lower'],
    kind: 'reps', reps: 8, tempo: 3.5, sided: true, level: 2,
    cues: ['Long stance, front heel down', 'Drop the back knee straight down', 'Torso stays tall'],
    anim: loop('side', 'rFoot',
      { rHip: 20, rKnee: 20, lHip: -20, lKnee: 0, lAnk: 40, ...sym(5, 10) },
      { rHip: 90, rKnee: 90, lHip: -20, lKnee: 60, lAnk: 0, ...sym(5, 10) }),
  },
  {
    id: 'push-up', name: 'Push-up', cat: 'strength', position: 'prone', focus: ['upper', 'core'],
    kind: 'reps', reps: 10, tempo: 2.6, level: 2,
    cues: ['Body in one long line', 'Elbows angle back, not out', 'Chest to just above the floor'],
    anim: loop('side', 'rFoot', PLANK, PUSH_DOWN),
  },
  {
    id: 'knee-push-up', name: 'Knee push-up', cat: 'strength', position: 'kneeling', focus: ['upper'],
    kind: 'reps', reps: 10, tempo: 2.6, level: 1,
    cues: ['Knees down, hips in line', 'Lower with control', 'Press the floor away'],
    anim: loop('side', 'rKnee',
      { torso: 54, lSh: 54, rSh: 54, lWr: 90, rWr: 90, lKnee: 40, rKnee: 40, lAnk: 60, rAnk: 60 },
      { torso: 72, lSh: -8, rSh: -8, lEl: 80, rEl: 80, lWr: 90, rWr: 90, lKnee: 40, rKnee: 40, lAnk: 60, rAnk: 60 }),
  },
  {
    id: 'glute-bridge', name: 'Glute bridge', cat: 'strength', position: 'supine', focus: ['lower', 'core'],
    kind: 'reps', reps: 12, tempo: 3.5, level: 1,
    cues: ['Feet hip-width, close to the hips', 'Squeeze the glutes to lift', 'Ribs stay down'],
    anim: loop('side', 'rFoot', HOOK,
      { torso: -118, spine: 18, head: 10, lSh: -28, rSh: -28, ...legs(-8, 100, 5) }),
  },
  {
    id: 'superman', name: 'Superman', cat: 'strength', position: 'prone', focus: ['spine', 'upper'],
    kind: 'reps', reps: 10, tempo: 3, level: 1,
    cues: ['Lift arms, chest and legs together', 'Gaze stays down', 'Pause at the top'],
    anim: loop('side', 'pelvis', PRONE,
      { ...PRONE, spine: -15, lSh: 175, rSh: 175, ...legs(-10, 0, 90) }),
  },
  {
    id: 'plank', name: 'Forearm plank', cat: 'core', position: 'prone', focus: ['core', 'full'],
    kind: 'time', secs: 30, tempo: 3, level: 1,
    cues: ['Elbows under shoulders', 'Squeeze glutes and thighs', 'Breathe steadily'],
    anim: hold('side', 'rFoot', QUAD,
      { torso: 80, lSh: 80, rSh: 80, lEl: 90, rEl: 90, lAnk: 5, rAnk: 5 }),
  },
  {
    id: 'side-plank', name: 'Side plank', cat: 'core', position: 'prone', focus: ['core'],
    kind: 'time', secs: 20, tempo: 3, sided: true, level: 2,
    cues: ['Stack shoulder over wrist', 'Lift the hips high', 'Top arm reaches to the sky'],
    anim: hold('front', 'rFoot',
      { torso: -74, rSh: 74, lSh: 12, lEl: 60 },
      { torso: -62, rSh: 62, lSh: 118 }),
  },
  {
    id: 'db-curl', name: 'Biceps curl', cat: 'strength', position: 'standing', focus: ['upper'],
    kind: 'reps', reps: 12, tempo: 3, level: 1, equipment: 'dumbbells',
    cues: ['Elbows pinned to your sides', 'Curl up, lower slowly', 'No swinging'],
    anim: { ...loop('side', 'rFoot', sym(2, 8), sym(8, 140)), props: 'dumbbells' },
  },
  {
    id: 'db-press', name: 'Overhead press', cat: 'strength', position: 'standing', focus: ['upper'],
    kind: 'reps', reps: 10, tempo: 3, level: 2, equipment: 'dumbbells',
    cues: ['Weights start at shoulder height', 'Press straight up', 'Brace the core, ribs down'],
    anim: { ...loop('front', 'pelvis', sym(90, 90), sym(168, 10)), props: 'dumbbells' },
  },
  {
    id: 'db-row', name: 'Bent-over row', cat: 'strength', position: 'standing', focus: ['upper', 'spine'],
    kind: 'reps', reps: 10, tempo: 3, level: 2, equipment: 'dumbbells',
    cues: ['Hinge with a flat back', 'Pull elbows toward hips', 'Squeeze the shoulder blades'],
    anim: {
      ...loop('side', 'rFoot',
        { torso: 70, head: -15, ...sym(70), ...legs(80, 20, -10) },
        { torso: 70, head: -15, ...sym(0, 70), ...legs(80, 20, -10) }),
      props: 'dumbbells',
    },
  },
  {
    id: 'db-rdl', name: 'Romanian deadlift', cat: 'strength', position: 'standing', focus: ['lower', 'spine'],
    kind: 'reps', reps: 10, tempo: 4, level: 2, equipment: 'dumbbells',
    cues: ['Soft knees, push hips back', 'Weights glide down the thighs', 'Stand tall and squeeze'],
    anim: {
      ...loop('side', 'rFoot', sym(2), { torso: 75, head: -15, ...sym(75), ...legs(83, 15, -7) }),
      props: 'dumbbells',
    },
  },
  {
    id: 'db-lateral', name: 'Lateral raise', cat: 'strength', position: 'standing', focus: ['upper'],
    kind: 'reps', reps: 12, tempo: 3, level: 1, equipment: 'dumbbells',
    cues: ['Slight bend in the elbows', 'Lift to shoulder height', 'Lower slower than you lift'],
    anim: { ...loop('front', 'pelvis', sym(10, 10), sym(86, 10)), props: 'dumbbells' },
  },

  // ----------------------------------------------------------------- core / pilates
  {
    id: 'leg-lifts', name: 'Leg lifts', cat: 'core', position: 'supine', focus: ['core'],
    kind: 'reps', reps: 10, tempo: 3.6, level: 2,
    cues: ['Low back stays heavy on the mat', 'Legs long and together', 'Lower slowly'],
    anim: loop('side', 'pelvis', { ...SUPINE, ...legs(8, 0, 30) }, { ...SUPINE, ...legs(88, 0, 30) }),
  },
  {
    id: 'hundred', name: 'The hundred', cat: 'pilates', position: 'supine', focus: ['core'],
    kind: 'time', secs: 40, tempo: 1, level: 2,
    cues: ['Curl head and shoulders up', 'Pump the arms, small and quick', 'In for five pumps, out for five'],
    anim: loop('side', 'pelvis',
      { ...SUPINE, ...PILATES_CURL, ...sym(14), ...legs(45, 0, 40) },
      { ...SUPINE, ...PILATES_CURL, ...sym(28), ...legs(45, 0, 40) }),
  },
  {
    id: 'single-leg-stretch', name: 'Single-leg stretch', cat: 'pilates', position: 'supine', focus: ['core'],
    kind: 'reps', reps: 10, tempo: 2.6, level: 2,
    cues: ['Curl up and stay up', 'Pull one knee in, extend the other', 'Switch smoothly'],
    anim: loop('side', 'pelvis',
      { ...SUPINE, ...PILATES_CURL, ...sym(45, 30), rHip: 125, rKnee: 125, lHip: 40, lAnk: 40 },
      { ...SUPINE, ...PILATES_CURL, ...sym(45, 30), lHip: 125, lKnee: 125, rHip: 40, rAnk: 40 }),
  },
  {
    id: 'dead-bug', name: 'Dead bug', cat: 'core', position: 'supine', focus: ['core'],
    kind: 'reps', reps: 8, tempo: 4, level: 1,
    cues: ['Low back pressed down', 'Opposite arm and leg reach away', 'Exhale as you extend'],
    anim: loop('side', 'pelvis',
      { ...SUPINE, ...sym(90), ...legs(90, 90) },
      { ...SUPINE, lSh: 90, rSh: 170, rHip: 90, rKnee: 90, lHip: 15, lKnee: 0 },
      { ...SUPINE, ...sym(90), ...legs(90, 90) },
      { ...SUPINE, rSh: 90, lSh: 170, lHip: 90, lKnee: 90, rHip: 15, rKnee: 0 }),
  },
  {
    id: 'bicycle', name: 'Bicycle crunch', cat: 'core', position: 'supine', focus: ['core'],
    kind: 'reps', reps: 12, tempo: 2.4, level: 2,
    cues: ['Hands light behind the head', 'Elbow toward opposite knee', 'Slow beats fast'],
    anim: loop('side', 'pelvis',
      { ...SUPINE, spine: 32, head: 10, ...sym(165, 150), rHip: 110, rKnee: 110, lHip: 30 },
      { ...SUPINE, spine: 32, head: 10, ...sym(165, 150), lHip: 110, lKnee: 110, rHip: 30 }),
  },
  {
    id: 'crunch', name: 'Crunch', cat: 'core', position: 'supine', focus: ['core'],
    kind: 'reps', reps: 15, tempo: 2.4, level: 1,
    cues: ['Feet flat, knees bent', 'Curl the ribs toward the hips', 'Chin off the chest'],
    anim: loop('side', 'rFoot', { ...HOOK, ...sym(15) }, { ...HOOK, spine: 38, head: 15, ...sym(30) }),
  },
  {
    id: 'mountain-climbers', name: 'Mountain climbers', cat: 'core', position: 'prone', focus: ['core', 'full'],
    kind: 'reps', reps: 16, tempo: 1.3, level: 2,
    cues: ['Shoulders over wrists', 'Drive the knees in', 'Hips stay low'],
    anim: loop('side', 'rHand',
      { ...PLANK, rHip: 100, rKnee: 110 },
      { ...PLANK, lHip: 100, lKnee: 110 }),
  },
  {
    id: 'bird-dog', name: 'Bird dog', cat: 'core', position: 'quadruped', focus: ['core', 'spine'],
    kind: 'reps', reps: 8, tempo: 4, sided: true, level: 1,
    cues: ['Reach long, not high', 'Hips stay square', 'Pause and breathe at full reach'],
    anim: loop('side', 'lHand', QUAD, { ...QUAD, lSh: 178, rHip: -17, rKnee: 0, rAnk: 60 }),
  },
  {
    id: 'flutter-kicks', name: 'Flutter kicks', cat: 'core', position: 'supine', focus: ['core'],
    kind: 'time', secs: 30, tempo: 0.9, level: 2,
    cues: ['Legs long, toes soft', 'Small, quick kicks', 'Low back stays down'],
    anim: loop('side', 'pelvis',
      { ...SUPINE, lHip: 12, rHip: 30, lAnk: 40, rAnk: 40 },
      { ...SUPINE, lHip: 30, rHip: 12, lAnk: 40, rAnk: 40 }),
  },
  {
    id: 'roll-up', name: 'Roll-up', cat: 'pilates', position: 'supine', focus: ['core', 'spine'],
    kind: 'reps', reps: 5, tempo: 8, level: 2,
    cues: ['Peel up one vertebra at a time', 'Reach past your toes', 'Roll down slower than you came up'],
    anim: {
      ...loop('side', 'pelvis',
        { ...SUPINE, ...sym(180), lAnk: -10, rAnk: -10 },
        { torso: -40, spine: 35, head: 15, ...sym(110), ...legs(50, 0, -10) },
        { torso: 45, spine: 25, head: 10, ...sym(150), ...legs(135, 0, -10) },
        { torso: -40, spine: 35, head: 15, ...sym(110), ...legs(50, 0, -10) }),
      beats: [1.2, 1, 1, 1.4],
    },
  },

  // ----------------------------------------------------------------- yoga
  {
    id: 'mountain', name: 'Mountain pose', cat: 'yoga', position: 'standing', focus: ['mind', 'full'],
    kind: 'time', secs: 30, tempo: 3, level: 1,
    cues: ['Feet grounded, crown lifts', 'Palms open forward', 'Soft, steady breath'],
    anim: hold('front', 'pelvis', {}, { ...sym(14), lHip: 2, rHip: 2 }),
  },
  {
    id: 'down-dog', name: 'Downward dog', cat: 'yoga', position: 'quadruped', focus: ['full', 'lower'],
    kind: 'time', secs: 30, tempo: 3, level: 1,
    cues: ['Hips up and back', 'Press the floor away', 'Heels reach toward the floor'],
    anim: hold('side', 'rFoot', QUAD,
      { torso: 135, head: 5, ...sym(180), lWr: 45, rWr: 45, ...legs(110, 0, -25) }),
  },
  {
    id: 'child', name: "Child's pose", cat: 'yoga', position: 'kneeling', focus: ['spine', 'mind'],
    kind: 'time', secs: 40, tempo: 4, level: 1,
    cues: ['Big toes together, knees wide', 'Sink the hips toward the heels', 'Forehead rests, breathe into the back'],
    anim: hold('side', 'rKnee', { ...KNEEL, ...sym(5) },
      { torso: 110, head: 10, ...sym(195), lWr: 0, ...legs(182, 165, 90) }),
  },
  {
    id: 'cobra', name: 'Cobra', cat: 'yoga', position: 'prone', focus: ['spine'],
    kind: 'time', secs: 20, tempo: 3, level: 1,
    cues: ['Hands under shoulders', 'Lift the chest, not the shoulders', 'Hips stay down'],
    anim: hold('side', 'pelvis',
      { torso: 90, ...sym(20, 70), lWr: 90, rWr: 90, lAnk: 90, rAnk: 90 },
      { torso: 90, spine: -40, head: -15, ...sym(30, 20), lWr: 90, rWr: 90, lAnk: 90, rAnk: 90 }),
  },
  {
    id: 'warrior-2', name: 'Warrior II', cat: 'yoga', position: 'standing', focus: ['lower', 'full'],
    kind: 'time', secs: 30, tempo: 3, sided: true, level: 1,
    cues: ['Front knee over ankle', 'Arms long, shoulders soft', 'Gaze past the front fingers'],
    anim: hold('front', 'pelvis', { lHip: 20, rHip: 20, ...sym(10) },
      { rHip: 80, rKnee: 80, lHip: 35, ...sym(90) }),
  },
  {
    id: 'warrior-1', name: 'Warrior I', cat: 'yoga', position: 'standing', focus: ['lower', 'spine'],
    kind: 'time', secs: 30, tempo: 3, sided: true, level: 2,
    cues: ['Front knee bends to 90°', 'Back heel grounded', 'Reach up through the fingertips'],
    anim: hold('side', 'rFoot', { rHip: 20, rKnee: 15, lHip: -25, lAnk: -10 },
      { spine: -6, ...sym(175), rHip: 80, rKnee: 80, lHip: -35, lAnk: -25 }),
  },
  {
    id: 'tree', name: 'Tree pose', cat: 'yoga', position: 'standing', focus: ['mind', 'lower'],
    kind: 'time', secs: 30, tempo: 3, sided: true, level: 1,
    cues: ['Foot to calf or inner thigh, never the knee', 'Hands meet overhead', 'Find a still point to gaze at'],
    anim: hold('front', 'rFoot', {}, { lHip: 60, lKnee: 125, ...sym(165, 32) }),
  },
  {
    id: 'chair', name: 'Chair pose', cat: 'yoga', position: 'standing', focus: ['lower'],
    kind: 'time', secs: 25, tempo: 3, level: 2,
    cues: ['Sit back, weight in the heels', 'Arms reach up alongside the ears', 'Long spine'],
    anim: hold('side', 'rFoot', {}, { torso: 25, ...sym(185), ...legs(80, 75, -20) }),
  },
  {
    id: 'forward-fold', name: 'Forward fold', cat: 'stretch', position: 'standing', focus: ['lower', 'spine'],
    kind: 'time', secs: 30, tempo: 4, level: 1,
    cues: ['Bend the knees as much as you need', 'Let the head hang', 'Sway gently side to side'],
    anim: hold('side', 'rFoot', sym(175), { torso: 130, spine: 25, head: 10, ...sym(155, 10), ...legs(130, 8) }),
  },
  {
    id: 'low-lunge', name: 'Low lunge', cat: 'yoga', position: 'kneeling', focus: ['lower'],
    kind: 'time', secs: 30, tempo: 4, sided: true, level: 1,
    cues: ['Back knee down, front knee over ankle', 'Sink the hips forward', 'Lift the chest and arms'],
    anim: hold('side', 'rFoot',
      { rHip: 90, rKnee: 90, lHip: -10, lKnee: 80, lAnk: 90, ...sym(5) },
      { spine: -10, ...sym(170), rHip: 95, rKnee: 100, lHip: -35, lKnee: 60, lAnk: 90 }),
  },
  {
    id: 'triangle', name: 'Triangle', cat: 'yoga', position: 'standing', focus: ['lower', 'spine'],
    kind: 'time', secs: 30, tempo: 4, sided: true, level: 2,
    cues: ['Long legs, wide stance', 'Hinge sideways over the front leg', 'Top arm reaches straight up'],
    anim: hold('front', 'pelvis', { lHip: 40, rHip: 40, ...sym(90) },
      { torso: -70, rHip: 110, lHip: -30, rSh: 80, lSh: 110 }),
  },
  {
    id: 'boat', name: 'Boat pose', cat: 'yoga', position: 'seated', focus: ['core'],
    kind: 'time', secs: 20, tempo: 3, level: 2,
    cues: ['Lift the chest, lean back slightly', 'Shins parallel or legs straight', 'Arms reach forward'],
    anim: hold('side', 'pelvis', { lHip: 85, rHip: 85, lKnee: 80, rKnee: 80, ...sym(20) },
      { torso: -35, ...sym(55), ...legs(95, 0, 20) }),
  },
  {
    id: 'bridge-pose', name: 'Bridge pose', cat: 'yoga', position: 'supine', focus: ['spine', 'lower'],
    kind: 'time', secs: 30, tempo: 3, level: 1,
    cues: ['Feet under knees', 'Lift through the hips', 'Roll the shoulders under'],
    anim: hold('side', 'rFoot', HOOK,
      { torso: -118, spine: 18, head: 10, lSh: -28, rSh: -28, ...legs(-8, 100, 5) }),
  },

  // ----------------------------------------------------------------- stretch
  {
    id: 'seated-fold', name: 'Seated forward fold', cat: 'stretch', position: 'seated', focus: ['lower', 'spine'],
    kind: 'time', secs: 40, tempo: 4, level: 1,
    cues: ['Lengthen up first', 'Fold from the hips', 'Hold your shins, ankles or feet'],
    anim: hold('side', 'pelvis', { ...SEATED_SIDE, ...sym(175) },
      { torso: 50, spine: 25, head: 10, ...sym(160), ...legs(140, 0, -10) }),
  },
  {
    id: 'quad-stretch', name: 'Standing quad stretch', cat: 'stretch', position: 'standing', focus: ['lower'],
    kind: 'time', secs: 25, tempo: 3, sided: true, level: 1,
    cues: ['Heel toward your glute', 'Knees side by side', 'Stand tall, tuck the pelvis'],
    anim: hold('side', 'lFoot', {}, { rHip: -5, rKnee: 150, rAnk: 40, rSh: -21, lSh: 70 }),
  },
  {
    id: 'knees-chest', name: 'Knees to chest', cat: 'stretch', position: 'supine', focus: ['spine', 'lower'],
    kind: 'time', secs: 30, tempo: 3, level: 1,
    cues: ['Hug both knees in', 'Low back melts into the mat', 'Rock gently if it feels good'],
    anim: hold('side', 'pelvis', HOOK, { ...SUPINE, ...sym(55, 95), ...legs(125, 125, 20) }),
  },
  {
    id: 'cross-shoulder', name: 'Cross-body shoulder', cat: 'stretch', position: 'standing', focus: ['upper'],
    kind: 'time', secs: 25, tempo: 3, sided: true, level: 1,
    cues: ['Arm across at chest height', 'Draw it in with the other hand', 'Keep the shoulder down'],
    anim: hold('front', 'pelvis', sym(8), { rSh: -85, lSh: 35, lEl: 115 }),
  },
  {
    id: 'triceps-stretch', name: 'Overhead triceps', cat: 'stretch', position: 'standing', focus: ['upper'],
    kind: 'time', secs: 25, tempo: 3, sided: true, level: 1,
    cues: ['Hand reaches down your back', 'Other hand eases the elbow', 'Head stays tall'],
    anim: hold('front', 'pelvis', sym(8), { rSh: 172, rEl: 150, lSh: 150, lEl: 125 }),
  },
  {
    id: 'butterfly', name: 'Butterfly', cat: 'stretch', position: 'seated', focus: ['lower'],
    kind: 'time', secs: 40, tempo: 3, level: 1,
    cues: ['Soles of the feet together', 'Let the knees fall open', 'Sit tall, then fold if you like'],
    anim: hold('front', 'pelvis', { ...legs(40, 30), ...sym(15, 10) }, { ...legs(72, 150), ...sym(22, 30) }),
  },

  // ----------------------------------------------------------------- rest
  {
    id: 'savasana', name: 'Rest', cat: 'rest', position: 'supine', focus: ['mind'],
    kind: 'time', secs: 60, tempo: 4, level: 1,
    cues: ['Let everything go heavy', 'Palms up, eyes soft', 'Nothing to do now'],
    anim: hold('side', 'pelvis', HOOK, { ...SUPINE, ...sym(18), ...legs(0, 0, 10) }),
  },
]

export const MOVE_BY_ID: Record<string, Move> = Object.fromEntries(MOVES.map((m) => [m.id, m]))

export const CAT_META: Record<Category, { label: string; color: string }> = {
  warmup: { label: 'Warm-up', color: '#ffc766' },
  strength: { label: 'Strength', color: '#ff8a5c' },
  core: { label: 'Core', color: '#ffb057' },
  pilates: { label: 'Pilates', color: '#ff7eb6' },
  yoga: { label: 'Yoga', color: '#b69cff' },
  stretch: { label: 'Stretch', color: '#5fd8c0' },
  breath: { label: 'Breath', color: '#78c6ff' },
  rest: { label: 'Rest', color: '#9aa7ff' },
}
