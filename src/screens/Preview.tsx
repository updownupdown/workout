import { Block, Session, Step, swapMove } from '../engine/generator'
import { Figure } from '../figure/Figure'
import { CAT_META } from '../data/moves'
import { fmtDur, stepLabel } from './format'

interface Props {
  session: Session
  onChange: (s: Session) => void
  onShuffle: () => void
  onBack: () => void
  onStart: () => void
}

const BLOCK_LABEL: Record<Block, string> = {
  open: 'Arrive',
  warm: 'Warm up',
  main: 'Main set',
  cool: 'Cool down',
  close: 'Rest',
}

const FOCUS_LABEL = { balanced: 'Balanced', strength: 'Strength', flow: 'Flow', calm: 'Calm' }

/** Group steps into blocks, collapsing sided pairs into one row. */
function rows(steps: Step[]) {
  const out: { block: Block; round?: number; items: { step: Step; sided: boolean }[] }[] = []
  for (const st of steps) {
    let g = out[out.length - 1]
    if (!g || g.block !== st.block || g.round !== st.round) {
      g = { block: st.block, round: st.round, items: [] }
      out.push(g)
    }
    if (st.side === 'left') continue
    g.items.push({ step: st, sided: !!st.side })
  }
  return out
}

export function Preview({ session, onChange, onShuffle, onBack, onStart }: Props) {
  const groups = rows(session.steps)
  const moveCount = new Set(session.steps.map((s) => s.move.id)).size
  return (
    <main className="screen preview">
      <header className="bar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="bar-title">
          <strong>{FOCUS_LABEL[session.settings.focus]} session</strong>
          <small>
            {fmtDur(session.totalSecs)} · {moveCount} moves
          </small>
        </div>
        <button className="icon-btn" onClick={onShuffle} aria-label="Shuffle whole session">
          <svg viewBox="0 0 24 24"><path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3.5M13 9.5C14 8 15 7 17 7h3M17 4l3 3-3 3M17 14l3 3-3 3" /></svg>
        </button>
      </header>

      <div className="timeline">
        {groups.map((g, gi) => (
          <section key={gi} className="tl-group">
            <h3>
              {BLOCK_LABEL[g.block]}
              {g.round ? <span className="round">Round {g.round}</span> : null}
            </h3>
            {g.items.map(({ step, sided }) => {
              const c = CAT_META[step.move.cat]
              const firstRound = !g.round || g.round === 1
              return (
                <div key={step.key} className="tl-row" style={{ ['--c' as string]: c.color }}>
                  <div className="thumb">
                    <Figure anim={step.move.anim} t={99} tempo={step.move.tempo} accent={c.color} floor={false} />
                  </div>
                  <div className="tl-text">
                    <strong>{step.move.name}</strong>
                    <small>
                      <span className="dot" /> {c.label} · {stepLabel(step)}
                      {sided ? ' · each side' : ''}
                    </small>
                  </div>
                  {firstRound && step.move.cat !== 'rest' && (
                    <button
                      className="icon-btn small"
                      aria-label={`Swap ${step.move.name}`}
                      onClick={() => onChange(swapMove(session, step.move.id, step.block))}
                    >
                      <svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        ))}
      </div>

      <footer className="dock">
        <button className="cta" onClick={onStart}>
          <svg viewBox="0 0 24 24" className="play-ico"><path d="M8 5v14l11-7z" /></svg>
          Start · {fmtDur(session.totalSecs)}
        </button>
      </footer>
    </main>
  )
}
