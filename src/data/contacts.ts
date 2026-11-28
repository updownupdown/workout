import type { ContactName } from '../figure/skeleton'
import type { Move } from './moves'
import { SETTLED } from './settled'

type C = ContactName[] | null

// Common floor contacts
const LYING: C = ['head', 'back', 'pelvis', 'rHeel']
const HOOKED: C = ['head', 'back', 'pelvis', 'rToe', 'rHeel']
const BRIDGE: C = ['back', 'rToe', 'rHeel']
const ALL4: C = ['rHand', 'rKnee', 'rToe']
const PLANK_HANDS: C = ['rHand', 'rToe']
const PLANK_ARMS: C = ['rElbow', 'rHand', 'rToe']
const SEAT: C = ['pelvis', 'rHeel']
const KNEELING: C = ['rKnee', 'rToe']
const FEET: C = ['rHeel', 'rToe']
const SIT_X: C = ['pelvis', 'lKnee', 'rKnee']

/**
 * Floor contacts per keyframe. Declaring two or more contacts rotates the body
 * so they rest on the floor together; `npx tsx scripts/check-poses.ts` reports
 * any declared contact left floating.
 */
export const FLOOR: Record<string, C[]> = {
  'hip-hinge': [FEET, FEET],
  'squat-jump': [FEET, ['rToe']],
  'single-leg-deadlift': [FEET, FEET],
  'db-hammer-curl': [FEET, FEET],
  'band-deadlift': [FEET, FEET],
  'bridge-march': [BRIDGE, ['back', 'lToe', 'lHeel']],
  'side-plank-dips': [['rHand', 'rHeel'], ['rHand', 'rHeel']],
  'toe-touch-crunch': [['head', 'back', 'pelvis'], ['mid', 'pelvis']],
  'leg-circles': [LYING, LYING, LYING, LYING, LYING].map(() => ['head', 'back', 'pelvis', 'lHeel']),
  lizard: [['rHeel', 'lKnee', 'lToe'], ['rHeel', 'rHand', 'lKnee', 'lToe']],
  'cat-cow': [ALL4, ALL4],
  'split-squat': [['rHeel', 'lToe'], ['rHeel', 'lToe']],
  'db-lunge': [FEET, ['rHeel', 'lToe']],
  'push-up': [PLANK_HANDS, PLANK_HANDS],
  'knee-push-up': [['rHand', 'rKnee'], ['rHand', 'rKnee']],
  'mountain-climbers': [['rHand', 'lToe'], ['rHand', 'rToe']],
  'glute-bridge': [HOOKED, BRIDGE],
  'bridge-pose': [HOOKED, BRIDGE],
  'band-bridge': [HOOKED, BRIDGE],
  superman: [['back', 'pelvis', 'rToe'], ['mid', 'pelvis']],
  plank: [ALL4, PLANK_ARMS],
  'side-plank': [['rHand', 'rHeel'], ['rHand', 'rHeel']],
  'leg-lifts': [['head', 'back', 'pelvis'], ['head', 'back', 'pelvis']],
  hundred: [['mid', 'pelvis'], ['mid', 'pelvis']],
  'single-leg-stretch': [['mid', 'pelvis'], ['mid', 'pelvis']],
  bicycle: [['mid', 'pelvis'], ['mid', 'pelvis']],
  scissors: [['mid', 'pelvis'], ['mid', 'pelvis']],
  'double-leg-stretch': [['mid', 'pelvis'], ['mid', 'pelvis']],
  swimming: [['mid', 'pelvis'], ['mid', 'pelvis']],
  'dead-bug': [['head', 'back', 'pelvis'], ['head', 'back', 'pelvis'], ['head', 'back', 'pelvis'], ['head', 'back', 'pelvis']],
  'flutter-kicks': [['head', 'back', 'pelvis'], ['head', 'back', 'pelvis']],
  crunch: [HOOKED, ['mid', 'pelvis', 'rToe', 'rHeel']],
  'bird-dog': [ALL4, ['rHand', 'lKnee', 'lHeel']],
  'roll-up': [['head', 'back', 'pelvis', 'rHeel'], SEAT, SEAT, SEAT],
  'down-dog': [ALL4, ['rHand', 'rHeel', 'rToe']],
  child: [KNEELING, ['rHand', 'head', 'rKnee', 'rToe']],
  cobra: [['pelvis', 'rToe', 'rHand'], ['pelvis', 'rToe', 'rHand']],
  'warrior-2': [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  'warrior-1': [['rHeel', 'lToe'], ['rHeel', 'lHeel']],
  triangle: [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  'forward-fold': [FEET, FEET],
  'low-lunge': [['rHeel', 'lKnee', 'lToe'], ['rHeel', 'lKnee', 'lToe']],
  boat: [SEAT, ['pelvis']],
  'seated-fold': [SEAT, SEAT],
  'knees-chest': [HOOKED, ['head', 'back', 'pelvis']],
  'happy-baby': [HOOKED, ['head', 'back', 'pelvis']],
  'figure-four': [HOOKED, ['head', 'back', 'pelvis']],
  'legs-up': [HOOKED, ['head', 'back', 'pelvis']],
  savasana: [HOOKED, LYING],
  butterfly: [['pelvis'], SIT_X],
  'box-breath': [SIT_X, SIT_X], 'coherent-breath': [SIT_X, SIT_X], 'relax-478': [SIT_X, SIT_X], 'sigh-breath': [SIT_X, SIT_X],
  'extended-exhale': [SIT_X, SIT_X], 'triangle-breath': [SIT_X, SIT_X],
  'db-kickback': [FEET, FEET],
  inchworm: [FEET, ['rHand', 'rHeel', 'rToe'], PLANK_HANDS, ['rHand', 'rHeel', 'rToe']],
  'reverse-table': [['pelvis', 'rHeel', 'rHand'], ['rHand', 'rHeel', 'rToe']],
  'side-leg-lift': [['rHand', 'rHeel'], ['rHand', 'rHeel']],
  'toe-taps': [['head', 'back', 'pelvis'], ['head', 'pelvis', 'rToe'], ['head', 'back', 'pelvis'], ['head', 'pelvis', 'lToe']],
  sphinx: [['back', 'pelvis', 'rToe'], ['rElbow', 'rHand', 'pelvis', 'rToe']],
  puppy: [ALL4, ['rHand', 'rKnee', 'rToe']],
  'worlds-greatest': [['rHeel', 'lKnee', 'lToe'], ['rHeel', 'lKnee', 'lHand']],
  'floor-dips': [['rHand', 'rHeel'], ['rHand', 'rHeel']],
  'pike-push-up': [['rHand', 'rHeel', 'rToe'], ['rHand', 'rToe']],
  'shoulder-taps': [PLANK_HANDS, ['lHand', 'rToe']],
  'single-leg-bridge': [['head', 'pelvis', 'lToe', 'lHeel'], ['back', 'lHeel', 'lToe']],
  'plank-up-down': [PLANK_ARMS, PLANK_HANDS],
  'bear-hold': [ALL4, ['rHand', 'rToe']],
  'donkey-kick': [ALL4, ['rHand', 'lKnee', 'lToe']],
  'band-kickback': [ALL4, ['rHand', 'lKnee', 'lToe']],
  'db-floor-press': [HOOKED, HOOKED],
  'db-pullover': [HOOKED, HOOKED],
  'band-row': [SEAT, SEAT],
  'band-leg-press': [['head', 'back', 'pelvis', 'lHeel'], ['head', 'back', 'pelvis', 'lHeel']],
  'band-hamstring': [HOOKED, ['head', 'back', 'pelvis', 'lHeel']],
  'reverse-crunch': [['head', 'back', 'pelvis'], ['head', 'back']],
  'hollow-hold': [['head', 'back', 'pelvis'], ['mid', 'pelvis']],
  'spine-stretch': [SEAT, SEAT],
  'rolling-ball': [['pelvis'], ['back', 'mid']],
  'shoulder-bridge': [['back', 'lHeel', 'lToe'], ['back', 'lHeel', 'lToe']],
  swan: [['back', 'pelvis', 'rToe'], ['pelvis', 'rHand', 'rToe']],
  'seated-side-bend': [SIT_X, SIT_X],
  'high-lunge': [['rHeel', 'lToe'], ['rHeel', 'lToe']],
  pyramid: [['rHeel', 'lHeel'], ['rHeel', 'lHeel']],
  'half-lift': [FEET, FEET],
  'side-angle': [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  'reverse-warrior': [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  goddess: [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  star: [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  'sumo-squat': [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  'lateral-lunge': [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  camel: [KNEELING, KNEELING],
  locust: [['back', 'pelvis', 'rToe'], ['mid', 'pelvis']],
  'up-dog': [PLANK_HANDS, PLANK_HANDS],
  chaturanga: [PLANK_HANDS, PLANK_HANDS],
  garland: [FEET, FEET],
  dolphin: [['rElbow', 'rHand', 'rKnee', 'rToe'], ['rElbow', 'rHand', 'rHeel', 'rToe']],
  'half-moon': [FEET, ['rHeel', 'rHand']],
  pigeon: [ALL4, ['rKnee', 'pelvis', 'lKnee', 'lToe']],
  'calf-stretch': [['rHeel', 'lHeel'], ['rHeel', 'lHeel']],
  'standing-hamstring': [['lHeel', 'rHeel'], ['lHeel', 'rHeel']],
  'straddle-side': [['pelvis', 'lHeel', 'rHeel'], ['pelvis', 'lHeel', 'rHeel']],
}

export function applyFloor(moves: Move[]): Move[] {
  return moves.map((m) => {
    if (!FLOOR[m.id]) return { ...m, anim: { ...m.anim, id: m.id } }
    const baked = SETTLED[m.id]
    const frames = baked ? m.anim.frames.map((f, i) => (baked[i] ? { ...f, ...baked[i] } : f)) : m.anim.frames
    return { ...m, anim: { ...m.anim, id: m.id, frames, contacts: FLOOR[m.id] } }
  })
}
