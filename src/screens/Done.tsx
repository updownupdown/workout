import { Session } from '../engine/generator'
import { LiveFigure } from '../figure/Figure'
import { CAT_META, MOVE_BY_ID } from '../data/moves'
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
      <div className="done-fig">
        <LiveFigure anim={rest.anim} tempo={rest.tempo} accent={CAT_META.rest.color} />
      </div>
      <h1>That's a wrap.</h1>
      <p className="lede">
        {fmtDur(session.totalSecs)} · {ids.length} moves
      </p>
      <div className="cat-row">
        {cats.map((c) => (
          <span key={c} className="chip" style={{ ['--c' as string]: CAT_META[c].color }}>
            {CAT_META[c].label}
          </span>
        ))}
      </div>
      <div className="done-actions">
        <button className="cta" onClick={onNew}>New session</button>
        <button className="ghost-btn" onClick={onAgain}>Repeat this one</button>
        <button className="link-btn" onClick={onHome}>Home</button>
      </div>
    </main>
  )
}
