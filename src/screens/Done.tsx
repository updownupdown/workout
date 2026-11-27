import { Clock, Home as HomeIcon, Layers, RotateCcw, Sparkles } from 'lucide-react'
import { Session } from '../engine/generator'
import { LiveFigure } from '../figure/Figure'
import { CAT_META, MOVE_BY_ID } from '../data/moves'
import { CAT_ICON } from '../ui/icons'
import { fmtDur } from './format'

interface Props {
  session: Session
  onAgain: () => void
  onNew: () => void
  onHome: () => void
}

export function Done({ session, onAgain, onNew, onHome }: Props) {
  const ids = [...new Set(session.steps.map((s) => s.move.id))]
  const cats = [...new Set(session.steps.map((s) => s.move.cat))]
  const rest = MOVE_BY_ID['savasana']
  return (
    <main className="screen done">
      <div className="done-stage">
        <LiveFigure anim={rest.anim} tempo={rest.tempo} accent={CAT_META.rest.color} />
      </div>
      <div className="done-copy">
        <p className="eyebrow">Session complete</p>
        <h1>That's a wrap.</h1>
        <p className="muted">Take a moment before you get up.</p>
      </div>
      <section className="stats">
        <div className="stat">
          <Clock size={17} />
          <b>{fmtDur(session.totalSecs)}</b>
          <small>moving</small>
        </div>
        <div className="stat">
          <Layers size={17} />
          <b>{ids.length}</b>
          <small>moves</small>
        </div>
      </section>
      <div className="cat-row">
        {cats.map((c) => {
          const Icon = CAT_ICON[c]
          return (
            <span key={c} className="chip" style={{ ['--c' as string]: CAT_META[c].color }}>
              <Icon size={13} strokeWidth={2.4} /> {CAT_META[c].label}
            </span>
          )
        })}
      </div>
      <div className="done-actions">
        <button className="cta" onClick={onNew}>
          <Sparkles size={19} /> New session
        </button>
        <div className="btn-pair">
          <button className="ghost-btn" onClick={onAgain}>
            <RotateCcw size={17} /> Repeat
          </button>
          <button className="ghost-btn" onClick={onHome}>
            <HomeIcon size={17} /> Home
          </button>
        </div>
      </div>
    </main>
  )
}
