import type { ReactNode } from 'react'
import { Check, type LucideIcon } from 'lucide-react'

export interface ChoiceOption<T> {
  id: T
  label: ReactNode
  /** Accessible name when the label is not plain text. */
  name?: string
  icon?: LucideIcon | ((p: { size?: number }) => ReactNode)
}

interface Props<T> {
  label: string
  options: ChoiceOption<T>[]
  value: T
  onPick: (id: T) => void
  /** Icon above the label instead of beside it. */
  stacked?: boolean
  className?: string
}

/** One track for a short single choice: duration, focus, target, intensity. */
export function Segmented<T extends string | number>({ label, options, value, onPick, stacked, className = '' }: Props<T>) {
  return (
    <div className={`seg ${stacked ? 'stacked' : ''} ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.id === value
        const Icon = o.icon
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.name}
            className={`seg-btn ${on ? 'on' : ''}`}
            onClick={() => onPick(o.id)}
          >
            {Icon && <Icon size={18} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A grid of icon tiles for a longer single choice. Tapping the picked tile clears it. */
export function Tiles<T extends string>({
  label, options, value, onPick,
}: { label: string; options: ChoiceOption<T>[]; value: T | null; onPick: (id: T) => void }) {
  return (
    <div className="tiles" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.id === value
        const Icon = o.icon
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`tile ${on ? 'on' : ''}`}
            onClick={() => onPick(o.id)}
          >
            {Icon && <Icon size={22} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Several can be on at once, so each shows a checkbox. */
export function Checks<T extends string>({
  label, options, isOn, onToggle,
}: { label: string; options: ChoiceOption<T>[]; isOn: (id: T) => boolean; onToggle: (id: T) => void }) {
  return (
    <div className="checks" role="group" aria-label={label}>
      {options.map((o) => {
        const on = isOn(o.id)
        const Icon = o.icon
        return (
          <button
            key={o.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            className={`check-tile ${on ? 'on' : ''}`}
            onClick={() => onToggle(o.id)}
          >
            {Icon && <Icon size={18} />}
            <span className="check-label">{o.label}</span>
            <span className="box">{on && <Check size={13} strokeWidth={3.2} />}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Rising bars for an ordered level (0, 1, 2). */
export function LevelBars({ level, size = 18 }: { level: number; size?: number }) {
  const h = Math.round((size * 14) / 18)
  return (
    <svg width={size} height={h} viewBox="0 0 18 14" fill="currentColor" aria-hidden>
      <rect x="0" y="9" width="4" height="5" rx="1" />
      <rect x="7" y="5" width="4" height="9" rx="1" opacity={level >= 1 ? 1 : 0.28} />
      <rect x="14" y="0" width="4" height="14" rx="1" opacity={level >= 2 ? 1 : 0.28} />
    </svg>
  )
}
