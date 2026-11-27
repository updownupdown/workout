import {
  Dumbbell, Flower2, Infinity as InfinityIcon, LucideIcon, Moon, Scale, StretchHorizontal, Sunrise, Target, Waves,
  Wind, Leaf, Zap, Footprints, Hand, Activity, Shapes,
} from 'lucide-react'
import type { Category, Focus } from '../data/moves'
import type { FocusMode, Target as TargetT } from '../engine/generator'

export const CAT_ICON: Record<Category, LucideIcon> = {
  breath: Wind,
  warmup: Sunrise,
  strength: Dumbbell,
  core: Target,
  pilates: InfinityIcon,
  yoga: Flower2,
  stretch: StretchHorizontal,
  rest: Moon,
}

export const FOCUS_MODE_ICON: Record<FocusMode, LucideIcon> = {
  balanced: Scale,
  strength: Dumbbell,
  flow: Waves,
  calm: Leaf,
}

export const TARGET_ICON: Record<TargetT, LucideIcon> = {
  any: Shapes,
  upper: Hand,
  lower: Footprints,
  core: Target,
  spine: Activity,
}

export const FOCUS_LABEL: Record<Focus, string> = {
  upper: 'Upper body',
  lower: 'Lower body',
  core: 'Core',
  spine: 'Spine',
  full: 'Full body',
  mind: 'Mind',
}

export { Zap }
