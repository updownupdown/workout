import type { Step } from '../engine/generator'

export function fmtDur(secs: number) {
  const m = Math.round(secs / 60)
  return m < 1 ? `${Math.round(secs)} s` : `${m} min`
}

export function fmtClock(secs: number) {
  const s = Math.max(0, Math.ceil(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function stepLabel(st: Step) {
  if (st.move.kind === 'reps') return `${st.reps} reps`
  if (st.move.kind === 'breath') return fmtDur(st.secs)
  return `${st.secs} s`
}
