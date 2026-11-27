import { useCallback, useEffect, useReducer, useRef } from 'react'
import { breathCycleSecs, Session, Step, TRANSITION } from '../engine/generator'
import { Figure } from '../figure/Figure'
import { BreathPhase, CAT_META } from '../data/moves'
import { chime, keepAwake, say, unlockAudio } from '../engine/cues'
import { fmtClock, stepLabel } from './format'

interface Props {
  session: Session
  onExit: () => void
  onDone: () => void
}

type Phase = 'ready' | 'work'

interface Clock {
  i: number
  phase: Phase
  t: number
  paused: boolean
  fired: Set<string>
}

/** Breath level 0..1 and current phase at time t. */
export function breathAt(pattern: BreathPhase[], t: number) {
  const cycle = pattern.reduce((s, p) => s + p.secs, 0)
  const totalIn = pattern.filter((p) => p.kind === 'in').reduce((s, p) => s + p.secs, 0)
  let tc = ((t % cycle) + cycle) % cycle
  let level = 0
  for (let k = 0; k < pattern.length; k++) {
    const p = pattern[k]
    const f = Math.min(1, tc / p.secs)
    const easeF = 0.5 - Math.cos(f * Math.PI) / 2
    if (tc <= p.secs) {
      if (p.kind === 'in') level = level + (p.secs / totalIn) * easeF
      if (p.kind === 'out') level = level * (1 - easeF)
      return { level: Math.min(1, level), phase: p, index: k, remaining: p.secs - tc, cycle: Math.floor(t / cycle) }
    }
    if (p.kind === 'in') level += p.secs / totalIn
    if (p.kind === 'out') level = 0
    tc -= p.secs
  }
  return { level: 0, phase: pattern[0], index: 0, remaining: 0, cycle: 0 }
}

const PHASE_WORD = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out' }

function announce(st: Step, first: boolean, prev?: Step) {
  const name = st.move.name
  if (prev && prev.move.id === st.move.id && st.side === 'left') return 'Switch sides.'
  const side = st.side ? `, ${st.side} side` : ''
  const amount =
    st.move.kind === 'reps' ? `${st.reps} reps` : st.move.kind === 'breath' ? '' : `${st.secs} seconds`
  return `${first ? "Let's begin. " : 'Next, '}${name}${side}. ${amount}`.trim()
}

export function Player({ session, onExit, onDone }: Props) {
  const steps = session.steps
  const clock = useRef<Clock>({ i: 0, phase: 'ready', t: 0, paused: false, fired: new Set() })
  const [, render] = useReducer((x: number) => x + 1, 0)

  const once = (key: string, fn: () => void) => {
    const c = clock.current
    if (c.fired.has(key)) return
    c.fired.add(key)
    fn()
  }

  const goto = useCallback(
    (i: number) => {
      const c = clock.current
      if (i >= steps.length) {
        chime('done')
        say('Session complete. Nice work.')
        onDone()
        return
      }
      c.i = Math.max(0, i)
      c.phase = 'ready'
      c.t = 0
      c.fired = new Set()
      render()
    },
    [steps.length, onDone],
  )

  // Main loop
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const c = clock.current
      if (!c.paused) {
        c.t += dt
        const st = steps[c.i]
        const m = st.move
        if (c.phase === 'ready') {
          once(`ann`, () => say(announce(st, c.i === 0, steps[c.i - 1])))
          for (const n of [3, 2, 1]) if (c.t >= TRANSITION - n) once(`rt${n}`, () => chime('tick'))
          if (c.t >= TRANSITION) {
            c.phase = 'work'
            c.t = 0
            chime('go')
            if (m.kind === 'time') say(m.cues[0])
            if (m.kind === 'reps') say('Go')
          }
        } else {
          if (m.kind === 'breath' && m.pattern) {
            const b = breathAt(m.pattern, c.t)
            once(`b${b.cycle}-${b.index}`, () => {
              if (b.cycle === 0 || b.phase.kind !== 'hold') say(b.cycle < 2 ? PHASE_WORD[b.phase.kind] : b.phase.kind === 'in' ? 'In' : 'Out')
              else chime('soft')
            })
          }
          if (m.kind === 'reps' && st.reps) {
            const rep = Math.floor(c.t / m.tempo) + 1
            if (rep === st.reps && st.reps > 3) once('last', () => say('Last one'))
          }
          if (m.kind === 'time' && st.secs >= 30 && c.t >= st.secs / 2) once('half', () => say('Halfway'))
          if (m.kind !== 'reps') {
            for (const n of [3, 2, 1]) if (c.t >= st.secs - n) once(`wt${n}`, () => chime('tick'))
          }
          if (c.t >= st.secs) {
            goto(c.i + 1)
            raf = requestAnimationFrame(tick)
            return
          }
        }
        render()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, goto])

  // Wake lock, pause when hidden, keyboard shortcuts
  useEffect(() => {
    unlockAudio()
    void keepAwake(true)
    const onVis = () => {
      if (document.hidden) {
        clock.current.paused = true
        render()
      } else void keepAwake(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        togglePause()
      } else if (e.key === 'ArrowRight') goto(clock.current.i + 1)
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Escape') onExit()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('keydown', onKey)
    return () => {
      void keepAwake(false)
      window.speechSynthesis?.cancel()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const togglePause = () => {
    unlockAudio()
    clock.current.paused = !clock.current.paused
    if (clock.current.paused) window.speechSynthesis?.cancel()
    render()
  }
  const back = () => {
    const c = clock.current
    if (c.phase === 'work' && c.t > 3) {
      c.phase = 'ready'
      c.t = TRANSITION - 3
      c.fired = new Set(['ann'])
      render()
    } else goto(c.i - 1)
  }

  const c = clock.current
  const st = steps[c.i]
  const m = st.move
  const meta = CAT_META[m.cat]
  const next = steps[c.i + 1]

  // Figure time
  let figT = 0
  let breath: ReturnType<typeof breathAt> | null = null
  if (m.kind === 'breath' && m.pattern) {
    if (c.phase === 'work') {
      breath = breathAt(m.pattern, c.t)
      figT = breath.level
    }
  } else if (m.anim.mode === 'hold') {
    figT = c.phase === 'ready' ? Math.max(0, c.t - 1) : m.tempo + c.t
  } else {
    figT = c.phase === 'ready' ? 0 : c.t
  }

  const workLeft = st.secs - (c.phase === 'work' ? c.t : 0)
  const elapsedBefore = steps.slice(0, c.i).reduce((s, x) => s + x.secs + TRANSITION, 0)
  const done = elapsedBefore + (c.phase === 'work' ? TRANSITION + c.t : c.t)
  const remaining = session.totalSecs - done
  const cueIdx = c.phase === 'work' ? Math.floor(c.t / 7) % m.cues.length : 0
  const rep = m.kind === 'reps' && st.reps ? Math.min(st.reps, Math.floor((c.phase === 'work' ? c.t : 0) / m.tempo) + 1) : 0
  const progress = c.phase === 'ready' ? c.t / TRANSITION : c.t / st.secs

  return (
    <main
      className={`screen player phase-${c.phase} ${c.paused ? 'paused' : ''}`}
      style={{ ['--c' as string]: meta.color }}
    >
      <header className="player-top">
        <button className="icon-btn" onClick={onExit} aria-label="End session">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="segments" aria-hidden>
          {steps.map((s, k) => (
            <span key={s.key + k} style={{ flexGrow: s.secs + TRANSITION }}>
              <i
                style={{
                  transform: `scaleX(${k < c.i ? 1 : k > c.i ? 0 : c.phase === 'ready' ? 0 : Math.min(1, c.t / s.secs)})`,
                }}
              />
            </span>
          ))}
        </div>
        <span className="remaining">{fmtClock(remaining)}</span>
      </header>

      <section className="stage" onClick={togglePause}>
        {m.kind === 'breath' && (
          <div
            className={`orb ${breath?.phase.kind ?? ''}`}
            style={{ transform: `translate(-50%, -50%) scale(${0.55 + (breath?.level ?? 0) * 0.45})` }}
          />
        )}
        <Figure
          anim={m.anim}
          t={figT}
          tempo={m.kind === 'breath' ? 2 : m.tempo}
          flip={st.side === 'left'}
          accent={meta.color}
          ghost={c.phase === 'ready'}
          className="stage-fig"
          title={m.name}
        />
        {c.phase === 'ready' && (
          <div className="ready">
            <span>Get ready</span>
            <b>{Math.max(1, Math.ceil(TRANSITION - c.t))}</b>
          </div>
        )}
        {c.paused && (
          <div className="paused-badge">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Paused
          </div>
        )}
      </section>

      <section className="info">
        <div className="info-head">
          <span className="chip" style={{ ['--c' as string]: meta.color }}>{meta.label}</span>
          {st.side && <span className="chip side">{st.side === 'right' ? 'Right side' : 'Left side'}</span>}
          {st.round && <span className="chip side">Round {st.round}</span>}
        </div>
        <h1 className="move-name">{m.name}</h1>
        <p className="cue" key={cueIdx + c.phase}>
          {breath ? `${PHASE_WORD[breath.phase.kind]} · ${Math.ceil(breath.remaining)}` : m.cues[cueIdx]}
        </p>

        <div className="meter">
          <Ring p={progress} />
          <div className="meter-val">
            {c.phase === 'ready' ? (
              <>
                <b>{stepLabel(st)}</b>
                <small>coming up</small>
              </>
            ) : m.kind === 'reps' ? (
              <>
                <b>{rep}</b>
                <small>of {st.reps}</small>
              </>
            ) : m.kind === 'breath' ? (
              <>
                <b>{(breath?.cycle ?? 0) + 1}</b>
                <small>of {Math.round(st.secs / breathCycleSecs(m))} breaths</small>
              </>
            ) : (
              <>
                <b>{fmtClock(workLeft)}</b>
                <small>hold</small>
              </>
            )}
          </div>
        </div>

        <div className="controls">
          <button className="icon-btn" onClick={back} aria-label="Previous">
            <svg viewBox="0 0 24 24"><path d="M18 6l-8 6 8 6zM6 6v12" /></svg>
          </button>
          <button className="play" onClick={togglePause} aria-label={c.paused ? 'Resume' : 'Pause'}>
            {c.paused ? (
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
            )}
          </button>
          <button className="icon-btn" onClick={() => goto(c.i + 1)} aria-label="Skip">
            <svg viewBox="0 0 24 24"><path d="M6 6l8 6-8 6zM18 6v12" /></svg>
          </button>
        </div>

        {next && (
          <div className="up-next">
            <small>Then</small>
            <span>
              {next.move.name}
              {next.side ? ` · ${next.side}` : ''}
            </span>
          </div>
        )}
      </section>
    </main>
  )
}

function Ring({ p }: { p: number }) {
  const r = 46
  const C = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r={r} className="ring-bg" />
      <circle
        cx="50"
        cy="50"
        r={r}
        className="ring-fg"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - Math.min(1, Math.max(0, p)))}
      />
    </svg>
  )
}
