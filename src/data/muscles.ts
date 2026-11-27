import type { Focus, Move, Muscle } from './moves'

const FROM_FOCUS: Record<Focus, Muscle[]> = {
  upper: ['arms', 'shoulders', 'chest'],
  lower: ['legs', 'glutes'],
  core: ['core'],
  spine: ['back'],
  full: ['legs', 'core'],
  mind: [],
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  arms: 'Arms',
  shoulders: 'Shoulders',
  chest: 'Chest',
  back: 'Back',
  core: 'Core',
  glutes: 'Glutes',
  legs: 'Legs',
  calves: 'Calves',
}

/** Muscles a move works (explicit, or inferred from its focus areas). */
export function workOf(m: Move): Muscle[] {
  if (m.cat === 'breath' || m.cat === 'rest') return []
  if (m.work) return m.work
  return [...new Set(m.focus.flatMap((f) => FROM_FOCUS[f]))]
}
