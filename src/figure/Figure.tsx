import { useEffect, useId, useRef, useState } from 'react'
import { Anim, BandPoint, compile, place, poseAt } from './anim'
import { L, Limb, Pose, Pt, Rig, solve } from './skeleton'
import type { Muscle } from '../data/moves'

interface Props {
  anim: Anim
  /** Seconds into the move. */
  t: number
  tempo: number
  flip?: boolean
  accent?: string
  ghost?: boolean
  floor?: boolean
  className?: string
  title?: string
  /** Muscles to light up with a soft glow in the accent colour. */
  work?: Muscle[]
}

const seg = (l: Limb, extra?: Partial<React.SVGProps<SVGLineElement>>) => (
  <line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} strokeWidth={l.w} {...extra} />
)

function Body({ rig, view, dumbbells }: { rig: Rig; view: 'side' | 'front'; dumbbells: boolean }) {
  const far = view === 'side' ? rig.l : null
  const near = view === 'side' ? rig.r : null
  const legs = (s: Rig['l']) => (
    <>
      {seg(s.thigh)}
      {seg(s.shin)}
      {seg(s.foot)}
    </>
  )
  const arms = (s: Rig['l']) => (
    <>
      {seg(s.upper)}
      {seg(s.fore)}
      {seg(s.hand)}
      {dumbbells && <Dumbbell l={s.hand} />}
    </>
  )
  const limbs = (s: Rig['l']) => (
    <>
      {legs(s)}
      {arms(s)}
    </>
  )
  const nose = {
    x: rig.head.x + Math.sin(((rig.headAngle + 90) * Math.PI) / 180) * L.headR * 0.95,
    y: rig.head.y - Math.cos(((rig.headAngle + 90) * Math.PI) / 180) * L.headR * 0.95,
  }
  return (
    <g strokeLinecap="round" fill="none">
      {far && <g className="fig-far">{limbs(far)}</g>}
      <g className="fig-core">
        {view === 'front' && (
          <g className="fig-near">
            {legs(rig.l)}
            {legs(rig.r)}
          </g>
        )}
        {seg(rig.torso)}
        {seg(rig.chest)}
        <circle cx={rig.pelvis.x} cy={rig.pelvis.y} r={12} className="fig-fill" />
        <line
          x1={rig.neck.x}
          y1={rig.neck.y}
          x2={rig.head.x}
          y2={rig.head.y}
          strokeWidth={8}
        />
        <circle cx={rig.head.x} cy={rig.head.y} r={L.headR} className="fig-fill" />
        {view === 'side' && <circle cx={nose.x} cy={nose.y} r={2.6} className="fig-fill" />}
      </g>
      {near && <g className="fig-near">{limbs(near)}</g>}
      {view === 'front' && (
        <g className="fig-near">
          {arms(rig.l)}
          {arms(rig.r)}
        </g>
      )}
    </g>
  )
}

function Dumbbell({ l }: { l: Limb }) {
  const dx = l.b.x - l.a.x
  const dy = l.b.y - l.a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const cx = (l.a.x + l.b.x) / 2
  const cy = (l.a.y + l.b.y) / 2
  const h = 9
  return (
    <g className="fig-prop">
      <line x1={cx - px * h} y1={cy - py * h} x2={cx + px * h} y2={cy + py * h} strokeWidth={3} />
      <line x1={cx - px * h} y1={cy - py * h} x2={cx - px * (h - 1)} y2={cy - py * (h - 1)} strokeWidth={9} />
      <line x1={cx + px * h} y1={cy + py * h} x2={cx + px * (h - 1)} y2={cy + py * (h - 1)} strokeWidth={9} />
    </g>
  )
}

const lerp = (a: Pt, b: Pt, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })

/** Soft halo behind the working muscles. */
function Glow({ rig, work }: { rig: Rig; work: Muscle[] }) {
  const w = new Set(work)
  const out: React.ReactNode[] = []
  const line = (l: Limb, k: string, extra = 10) => out.push(seg(l, { key: k, strokeWidth: l.w + extra }))
  const dot = (p: Pt, r: number, k: string) => out.push(<circle key={k} cx={p.x} cy={p.y} r={r} />)
  for (const [n, s] of [['l', rig.l], ['r', rig.r]] as const) {
    if (w.has('arms')) {
      line(s.upper, n + 'ua')
      line(s.fore, n + 'fa', 8)
    } else if (w.has('shoulders')) {
      line({ a: s.upper.a, b: lerp(s.upper.a, s.upper.b, 0.45), w: s.upper.w }, n + 'sh', 12)
    }
    if (w.has('legs')) {
      line(s.thigh, n + 'th')
      line(s.shin, n + 'sn', 8)
    } else if (w.has('calves')) line(s.shin, n + 'sn', 8)
  }
  if (w.has('chest') || w.has('back')) line(rig.chest, 'ch', 12)
  if (w.has('core')) line(rig.torso, 'co', 12)
  if (w.has('glutes')) dot(rig.pelvis, 19, 'gl')
  if (!out.length) return null
  return (
    <g className="fig-glow" strokeLinecap="round">
      {out}
    </g>
  )
}

function bandPt(rig: Rig, p: BandPoint): Pt {
  switch (p) {
    case 'lHand': return rig.l.hand.a
    case 'rHand': return rig.r.hand.a
    case 'lFoot': return rig.l.foot.a
    case 'rFoot': return rig.r.foot.a
    case 'lToe': return lerp(rig.l.foot.a, rig.l.foot.b, 0.7)
    case 'rToe': return lerp(rig.r.foot.a, rig.r.foot.b, 0.7)
    case 'lKnee': return rig.l.thigh.b
    case 'rKnee': return rig.r.thigh.b
    default: return rig.r.foot.b
  }
}

/** Resistance band: a taut line between two points, or a loop just above the knees. */
function Band({ rig, band, view }: { rig: Rig; band: NonNullable<Anim['band']>; view: 'side' | 'front' }) {
  if (band === 'thighs') {
    const a = lerp(rig.l.thigh.a, rig.l.thigh.b, 0.72)
    const b = lerp(rig.r.thigh.a, rig.r.thigh.b, 0.72)
    if (view === 'front') {
      return (
        <g className="fig-band">
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        </g>
      )
    }
    // Side view: a short strap wrapped across the near thigh.
    const t = rig.r.thigh
    const dx = t.b.x - t.a.x
    const dy = t.b.y - t.a.y
    const len = Math.hypot(dx, dy) || 1
    const px = (-dy / len) * (t.w / 2 + 2)
    const py = (dx / len) * (t.w / 2 + 2)
    return (
      <g className="fig-band">
        <line x1={b.x - px} y1={b.y - py} x2={b.x + px} y2={b.y + py} />
      </g>
    )
  }
  return (
    <g className="fig-band">
      {band.map(([p, q], i) => {
        const a = bandPt(rig, p)
        const b = bandPt(rig, q)
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      })}
    </g>
  )
}

export function Figure({ anim, t, tempo, flip, accent = '#ff8a65', ghost, floor = true, className, title, work }: Props) {
  const c = compile(anim)
  const pose: Pose = poseAt(c, t, tempo)
  const rig = place(solve(pose, anim.view), anim.anchor)
  const ghostRig = ghost && anim.mode === 'hold' ? place(solve(c.poses[c.poses.length - 1], anim.view), anim.anchor) : null
  const { x0, x1, y0, y1 } = c.view
  const vb = flip ? `${-x1} ${y0} ${x1 - x0} ${y1 - y0}` : `${x0} ${y0} ${x1 - x0} ${y1 - y0}`
  const gid = useId().replace(/:/g, '')
  return (
    <svg
      className={`figure ${className ?? ''}`}
      viewBox={vb}
      role="img"
      aria-label={title}
      style={{ ['--accent' as string]: accent }}
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        <radialGradient id={`sh${gid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.45" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={flip ? 'scale(-1,1)' : undefined}>
        {floor && (
          <>
            <ellipse cx={(rig.pelvis.x + rig.mid.x) / 2} cy={2} rx={70} ry={6} fill={`url(#sh${gid})`} />
            <line className="fig-floor" x1={x0 - 400} x2={x1 + 400} y1={0.5} y2={0.5} />
          </>
        )}
        {work && work.length > 0 && <Glow rig={rig} work={work} />}
        {ghostRig && (
          <g className="fig-ghost">
            <Body rig={ghostRig} view={anim.view} dumbbells={false} />
          </g>
        )}
        <Body rig={rig} view={anim.view} dumbbells={anim.props === 'dumbbells'} />
        {anim.band && <Band rig={rig} band={anim.band} view={anim.view} />}
      </g>
    </svg>
  )
}

/** Self-animating figure for previews and the library. */
export function LiveFigure(props: Omit<Props, 't'> & { playing?: boolean }) {
  const { playing = true, ...rest } = props
  const [t, setT] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = (now: number) => {
      if (start.current == null) start.current = now
      const secs = (now - start.current) / 1000
      // Holds replay their entry every 8 s so the preview stays informative.
      setT(props.anim.mode === 'hold' ? secs % (props.tempo + 5) : secs)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, props.anim, props.tempo])
  return <Figure {...rest} t={playing ? t : props.anim.mode === 'hold' ? 999 : 0} />
}
