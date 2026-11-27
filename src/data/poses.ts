import type { Anim } from '../figure/anim'
import type { PoseInput } from '../figure/skeleton'

// ---------------------------------------------------------------------------
// Reusable base poses (see figure/skeleton.ts for angle conventions)
// ---------------------------------------------------------------------------

export const QUAD: PoseInput = {
  torso: 78, head: -10,
  lSh: 78, rSh: 78, lWr: 90, rWr: 90,
  lHip: 78, rHip: 78, lKnee: 90, rKnee: 90, lAnk: 90, rAnk: 90,
}
export const PLANK: PoseInput = { torso: 69, lSh: 69, rSh: 69, lWr: 90, rWr: 90, lAnk: 5, rAnk: 5 }
export const PUSH_DOWN: PoseInput = { torso: 80, lSh: 0, rSh: 0, lEl: 80, rEl: 80, lWr: 90, rWr: 90, lAnk: 5, rAnk: 5 }
export const SUPINE: PoseInput = { torso: -90 }
export const HOOK: PoseInput = { torso: -90, lHip: 50, rHip: 50, lKnee: 125, rKnee: 125, lAnk: 15, rAnk: 15 }
export const PRONE: PoseInput = { torso: 90, lSh: 180, rSh: 180, lAnk: 90, rAnk: 90, head: -10 }
export const PILATES_CURL = { spine: 30, head: 15 }
export const SEATED_FRONT: PoseInput = {
  lHip: 85, rHip: 85, lKnee: 172, rKnee: 172, lAnk: 90, rAnk: 90,
  lSh: 22, rSh: 22, lEl: 45, rEl: 45,
}
export const SEATED_SIDE: PoseInput = { lHip: 90, rHip: 90, lAnk: -10, rAnk: -10, lSh: 20, rSh: 20 }
export const KNEEL: PoseInput = { lKnee: 90, rKnee: 90, lAnk: 90, rAnk: 90 }

export const sym = (sh: number, el = 0): PoseInput => ({ lSh: sh, rSh: sh, lEl: el, rEl: el })
export const legs = (hip: number, knee = 0, ank = 0): PoseInput => ({
  lHip: hip, rHip: hip, lKnee: knee, rKnee: knee, lAnk: ank, rAnk: ank,
})

export const hold = (view: Anim['view'], anchor: Anim['anchor'], ...frames: PoseInput[]): Anim => ({
  view, anchor, frames, mode: 'hold',
})
export const loop = (view: Anim['view'], anchor: Anim['anchor'], ...frames: PoseInput[]): Anim => ({
  view, anchor, frames, mode: 'loop',
})

export const BREATH_FIG: Anim = {
  view: 'front',
  anchor: 'pelvis',
  mode: 'loop',
  breathe: false,
  frames: [SEATED_FRONT, { ...SEATED_FRONT, lSh: 27, rSh: 27, lEl: 48, rEl: 48, head: -3 }],
}


/** Standing on all fours with knees hovering. */
export const BEAR: PoseInput = { ...QUAD, torso: 72, lSh: 72, rSh: 72, lHip: 100, rHip: 100, lKnee: 105, rKnee: 105, lAnk: 5, rAnk: 5 }
/** Seated, legs long in front. */
export const LONG_SIT: PoseInput = { lHip: 90, rHip: 90, lAnk: -10, rAnk: -10, lSh: 10, rSh: 10 }

export const withBand = (anim: Anim, band: Anim['band']): Anim => ({ ...anim, props: 'band', band })
export const withWeights = (anim: Anim): Anim => ({ ...anim, props: 'dumbbells' })
