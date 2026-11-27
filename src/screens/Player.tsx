import { lazy, Suspense, useCallback, useEffect, useReducer, useRef } from 'react'
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X, ArrowLeftRight, Repeat } from 'lucide-react'
import { breathCycleSecs, readyOf, Session } from '../engine/generator'
import { CAT_ICON } from '../ui/icons'
import { Figure } from '../figure/Figure'
import { BreathPhase, CAT_META } from '../data/moves'
import { chime, keepAwake, unlockAudio } from '../engine/cues'
import { workOf } from '../data/muscles'

const Figure3D = lazy(() => import('../figure/Figure3D'))
import { fmtClock, stepLabel } from './format'

interface Props {
  session: Session
  sound: boolean
  onSound: (v: boolean) => void
  view3d: boolean
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

export function Player({ session, sound, onSound, view3d, onExit, onDone }: Props) {
  const steps = session.steps
  const TRANSITION = readyOf(session.settings)
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
          for (const n of [3, 2, 1]) if (c.t >= TRANSITION - n) once(`rt${n}`, () => chime('tick'))
          if (c.t >= TRANSITION) {
            c.phase = 'work'
            c.t = 0
            chime('go')
          }
        } else {
          if (m.kind === 'breath' && m.pattern) {
            const b = breathAt(m.pattern, c.t)
            once(`b${b.cycle}-${b.index}`, () => chime('soft'))
          }
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
  }, [steps, goto, TRANSITION])

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
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const togglePause = () => {
    unlockAudio()
    clock.current.paused = !clock.current.paused
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
  const CatIcon = CAT_ICON[m.cat]
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
        <button className="icon-btn ghost" onClick={onExit} aria-label="End session">
          <X size={22} />
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
        <button className="icon-btn ghost" onClick={() => onSound(!sound)} aria-label={sound ? 'Mute chimes' : 'Unmute chimes'}>
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </header>

      <section className="stage" onClick={togglePause}>
        {m.kind === 'breath' && (
          <div
            className={`orb ${breath?.phase.kind ?? ''}`}
            style={{ transform: `translate(-50%, -50%) scale(${0.55 + (breath?.level ?? 0) * 0.45})` }}
          />
        )}
        {view3d ? (
          <Suspense fallback={null}>
            <Figure3D
              anim={m.anim}
              t={figT}
              tempo={m.kind === 'breath' ? 2 : m.tempo}
              flip={st.side === 'left'}
              accent={meta.color}
              work={workOf(m)}
              className="stage-fig stage-3d"
            />
          </Suspense>
        ) : (
          <Figure
            anim={m.anim}
            t={figT}
            tempo={m.kind === 'breath' ? 2 : m.tempo}
            flip={st.side === 'left'}
            accent={meta.color}
            ghost={c.phase === 'ready'}
            work={workOf(m)}
            className="stage-fig pulse"
            title={m.name}
          />
        )}
        {c.phase === 'ready' && (
          <div className="ready">
            <span>Get ready</span>
            <b>{Math.max(1, Math.ceil(TRANSITION - c.t))}</b>
          </div>
        )}
        {c.paused && (
          <div className="paused-badge">
            <span>
              <Play size={30} fill="currentColor" />
            </span>
            Paused · tap to resume
          </div>
        )}
      </section>

      <section className="info">
        <div className="info-head">
          <span className="chip">
            <CatIcon size={13} strokeWidth={2.4} /> {meta.label}
          </span>
          {st.side && (
            <span className="chip neutral">
              <ArrowLeftRight size={12} /> {st.side === 'right' ? 'Right side' : 'Left side'}
            </span>
          )}
          {st.round && (
            <span className="chip neutral">
              <Repeat size={12} /> Round {st.round}
            </span>
          )}
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
          <button className="ctrl" onClick={back} aria-label="Previous">
            <SkipBack size={22} fill="currentColor" />
          </button>
          <button className="play" onClick={togglePause} aria-label={c.paused ? 'Resume' : 'Pause'}>
            {c.paused ? <Play size={30} fill="currentColor" /> : <Pause size={30} fill="currentColor" />}
          </button>
          <button className="ctrl" onClick={() => goto(c.i + 1)} aria-label="Skip">
            <SkipForward size={22} fill="currentColor" />
          </button>
        </div>

        {next && (
          <div className="up-next" style={{ ['--c' as string]: CAT_META[next.move.cat].color }}>
            <span className="thumb">
              <Figure anim={next.move.anim} t={99} tempo={next.move.tempo} accent={CAT_META[next.move.cat].color} floor={false} flip={next.side === 'left'} />
            </span>
            <span className="up-next-text">
              <small>Up next</small>
              <strong>
                {next.move.name}
                {next.side ? ` · ${next.side}` : ''}
              </strong>
            </span>
            <span className="up-next-amt">{stepLabel(next)}</span>
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
