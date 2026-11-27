import { ContactName, contactOf, floorOf, levelFor, Pose, solve, View } from './skeleton'

/**
 * Nudge a keyframe so every declared contact rests on the floor.
 *
 * Coordinate descent over the whole-body rotation and the joint angles,
 * minimising (contact gaps)² + a small penalty for moving away from the
 * authored angles. Runs offline (scripts/settle-poses.ts) and the result is
 * baked into src/data/settled.ts.
 */
const PARAMS: (keyof Pose)[] = [
  'rot', 'torso', 'spine', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lSh', 'rSh', 'lEl', 'rEl', 'lAnk', 'rAnk', 'lWr', 'rWr',
]
const COST: Partial<Record<keyof Pose, number>> = {
  rot: 0.0002, torso: 0.006, spine: 0.012, lHip: 0.006, rHip: 0.006, lKnee: 0.006, rKnee: 0.006,
  lSh: 0.004, rSh: 0.004, lEl: 0.004, rEl: 0.004, lAnk: 0.003, rAnk: 0.003, lWr: 0.002, rWr: 0.002,
}

export function contactGaps(pose: Pose, view: View, contacts: ContactName[]) {
  const rig = solve(pose, view)
  const floor = floorOf(rig)
  return contacts.map((c) => {
    const k = contactOf(rig, c)
    return floor - (k.p.y + k.r)
  })
}

function energy(p: Pose, base: Pose, view: View, contacts: ContactName[]) {
  let e = 0
  for (const g of contactGaps(p, view, contacts)) e += g * g
  for (const k of PARAMS) {
    const d = p[k] - base[k]
    e += (COST[k] ?? 0.02) * d * d
  }
  return e
}

export function settle(pose: Pose, view: View, contacts: ContactName[]): Pose {
  if (contacts.length === 0) return pose
  const base = { ...pose, rot: contacts.length >= 2 ? levelFor(pose, view, contacts) : 0 }
  let cur = { ...base }
  let e = energy(cur, base, view, contacts)
  // Front-view figures can't rotate their joints out of plane; only free what moves.
  for (const step of [24, 16, 8, 4, 2, 1, 0.5, 0.25]) {
    let improved = true
    let guard = 0
    while (improved && guard++ < 60) {
      improved = false
      for (const k of PARAMS) {
        for (const s of [step, -step]) {
          const next = { ...cur, [k]: cur[k] + s }
          const ne = energy(next, base, view, contacts)
          if (ne < e - 1e-6) {
            cur = next
            e = ne
            improved = true
          }
        }
      }
    }
  }
  return cur
}
