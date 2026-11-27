import type { Muscle } from '../data/moves'
import type { Settings } from './generator'

export interface Theme {
  id: string
  label: string
  /** Settings the theme applies when picked. */
  set: Partial<Settings>
  /** Moves that show up much more often. */
  boost: string[]
  /** Muscles that get a milder boost. */
  work?: Muscle[]
}

export const THEMES: Theme[] = [
  {
    id: 'hips', label: 'Hip opener', set: { focus: 'flow', target: 'lower' }, work: ['glutes'],
    boost: ['pigeon', 'low-lunge', 'lizard', 'butterfly', 'garland', 'goddess', 'figure-four', 'happy-baby', 'worlds-greatest', 'warrior-2', 'straddle-side', 'leg-swings', 'sumo-squat'],
  },
  {
    id: 'back', label: 'Back care', set: { focus: 'calm', target: 'spine', intensity: 'gentle' }, work: ['back', 'core'],
    boost: ['cat-cow', 'child', 'sphinx', 'cobra', 'bird-dog', 'knees-chest', 'puppy', 'glute-bridge', 'dead-bug', 'superman', 'locust', 'half-lift', 'hip-hinge', 'band-pull-apart'],
  },
  {
    id: 'post-run', label: 'Post-run', set: { focus: 'calm', target: 'lower' }, work: ['legs', 'calves'],
    boost: ['calf-stretch', 'quad-stretch', 'standing-hamstring', 'pigeon', 'figure-four', 'low-lunge', 'down-dog', 'forward-fold', 'seated-fold', 'legs-up', 'band-hamstring', 'butterfly'],
  },
  {
    id: 'wake', label: 'Wake-up', set: { focus: 'flow', intensity: 'gentle', minutes: 10 },
    boost: ['sun-reach', 'cat-cow', 'down-dog', 'arm-circles', 'side-bend', 'open-hug', 'mountain', 'low-lunge', 'cobra', 'half-lift', 'high-lunge'],
  },
  {
    id: 'desk', label: 'Desk reset', set: { focus: 'calm', target: 'spine', intensity: 'gentle', minutes: 10 }, work: ['shoulders', 'back'],
    boost: ['neck-release', 'chest-opener', 'cross-shoulder', 'triceps-stretch', 'open-hug', 'cat-cow', 'forward-fold', 'side-bend', 'band-pull-apart', 'puppy', 'sphinx'],
  },
  {
    id: 'core', label: 'Core burner', set: { focus: 'strength', target: 'core' }, work: ['core'],
    boost: ['plank', 'side-plank', 'dead-bug', 'hollow-hold', 'bicycle', 'hundred', 'toe-touch-crunch', 'side-plank-dips', 'mountain-climbers', 'reverse-crunch', 'scissors', 'boat'],
  },
  {
    id: 'strength', label: 'Full strength', set: { focus: 'strength', intensity: 'strong' }, work: ['legs', 'chest', 'back'],
    boost: ['squat', 'push-up', 'goblet-squat', 'db-row', 'db-press', 'db-rdl', 'db-thruster', 'single-leg-deadlift', 'squat-jump', 'pike-push-up'],
  },
  {
    id: 'band', label: 'Band workout', set: { focus: 'strength', band: true },
    boost: ['band-pull-apart', 'band-row', 'band-curl', 'band-press', 'band-squat', 'band-walk', 'band-bridge', 'band-kickback', 'band-leg-press', 'band-lateral-raise', 'band-deadlift', 'band-hamstring'],
  },
  {
    id: 'wind', label: 'Wind down', set: { focus: 'calm', intensity: 'gentle' },
    boost: ['relax-478', 'extended-exhale', 'child', 'legs-up', 'happy-baby', 'knees-chest', 'butterfly', 'seated-fold', 'figure-four', 'savasana', 'sphinx'],
  },
]

export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t]))
