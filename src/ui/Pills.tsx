import type { LucideIcon } from 'lucide-react'

export interface PillOption<T> {
  id: T
  label: string
  icon?: LucideIcon
  /** Optional category colour shown as a small dot. */
  dot?: string
}

interface Props<T> {
  label: string
  options: PillOption<T>[]
  isOn: (id: T) => boolean
  onPick: (id: T) => void
  /** Several can be on at once (checkboxes) instead of one (radio). */
  multi?: boolean
}

/** One consistent control for every choice: wrapping pills, all visible at once. */
export function Pills<T extends string | number>({ label, options, isOn, onPick, multi }: Props<T>) {
  return (
    <div className="pills" role={multi ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((o) => {
        const on = isOn(o.id)
        return (
          <button
            key={String(o.id)}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            className={`pill ${on ? 'on' : ''}`}
            onClick={() => onPick(o.id)}
          >
            {o.dot && <span className="pill-dot" style={{ background: o.dot }} />}
            {o.icon && <o.icon size={15} strokeWidth={2.2} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Field({ label, children, aside }: { label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="field">
      <div className="field-label">
        <span>{label}</span>
        {aside}
      </div>
      {children}
    </section>
  )
}
