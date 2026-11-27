import { useState } from 'react'
import { ArrowLeftRight, ChevronLeft, Clock, Layers, Moon, Play, RefreshCw, Repeat, Shuffle, Sunrise, Timer, Wind, Zap, Flower } from 'lucide-react'
import { Block, Prefs, readyOf, Session, Step, swapMove } from '../engine/generator'
import { Figure } from '../figure/Figure'
import { CAT_META, Move } from '../data/moves'
import { fmtDur, stepLabel } from './format'
import { MoveSheet } from '../ui/MoveSheet'
import { FOCUS_MODE_ICON } from '../ui/icons'

interface Props {
  session: Session
  prefs: Prefs
  onPrefs: (p: Prefs) => void
  onChange: (s: Session) => void
  onShuffle: () => void
  onBack: () => void
  onStart: () => void
}

const BLOCK: Record<Block, { label: string; icon: typeof Wind }> = {
  open: { label: 'Arrive', icon: Wind },
  warm: { label: 'Warm up', icon: Sunrise },
  main: { label: 'Main set', icon: Zap },
  cool: { label: 'Cool down', icon: Flower },
  close: { label: 'Rest', icon: Moon },
}

const FOCUS_LABEL = { balanced: 'Balanced', strength: 'Strength', flow: 'Flow', calm: 'Calm' }
const INTENSITY_LABEL = { gentle: 'Gentle', steady: 'Steady', strong: 'Strong' }

/** Group steps into blocks, collapsing sided pairs into one row. */
function groupSteps(steps: Step[], ready: number) {
  const out: { block: Block; round?: number; secs: number; items: { step: Step; sided: boolean }[] }[] = []
  for (const st of steps) {
    let g = out[out.length - 1]
    if (!g || g.block !== st.block || g.round !== st.round) {
      g = { block: st.block, round: st.round, secs: 0, items: [] }
      out.push(g)
    }
    g.secs += st.secs + ready
    if (st.side === 'left') continue
    g.items.push({ step: st, sided: !!st.side })
  }
  return out
}

export function Preview({ session, prefs, onPrefs, onChange, onShuffle, onBack, onStart }: Props) {
  const [open, setOpen] = useState<{ move: Move; block: Block; swappable: boolean } | null>(null)
  const groups = groupSteps(session.steps, readyOf(session.settings))
  const moveCount = new Set(session.steps.map((s) => s.move.id)).size
  const FocusIcon = FOCUS_MODE_ICON[session.settings.focus]
  const swap = (id: string, block: Block) => onChange(swapMove(session, id, block))

  return (
    <main className="screen preview">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div className="topbar-title">Your session</div>
        <button className="icon-btn" onClick={onShuffle} aria-label="Shuffle whole session">
          <Shuffle size={19} />
        </button>
      </header>

      <section className="stats">
        <div className="stat">
          <Clock size={17} />
          <b>{fmtDur(session.totalSecs)}</b>
          <small>total</small>
        </div>
        <div className="stat">
          <Layers size={17} />
          <b>{moveCount}</b>
          <small>moves</small>
        </div>
        <div className="stat">
          <FocusIcon size={17} />
          <b>{FOCUS_LABEL[session.settings.focus]}</b>
          <small>{INTENSITY_LABEL[session.settings.intensity]}</small>
        </div>
      </section>

      <div className="timeline">
        {groups.map((g, gi) => {
          const B = BLOCK[g.block]
          const firstRound = !g.round || g.round === 1
          return (
            <section key={gi} className={`tl-group ${firstRound ? '' : 'repeat'}`}>
              <h3>
                <span className="tl-icon">
                  <B.icon size={14} />
                </span>
                {B.label}
                {g.round ? <span className="round">Round {g.round}</span> : null}
                <span className="tl-time">{fmtDur(g.secs)}</span>
              </h3>
              {!firstRound ? (
                <div className="tl-repeat">
                  <Repeat size={16} /> Repeat round 1 · {g.items.length} moves
                </div>
              ) : (
                g.items.map(({ step, sided }) => {
                  const c = CAT_META[step.move.cat]
                  const swappable = step.move.cat !== 'rest'
                  return (
                    <div key={step.key} className="tl-row" style={{ ['--c' as string]: c.color }}>
                      <button className="tl-main" onClick={() => setOpen({ move: step.move, block: step.block, swappable })}>
                        <span className="thumb">
                          <Figure anim={step.move.anim} t={99} tempo={step.move.tempo} accent={c.color} floor={false} />
                        </span>
                        <span className="tl-text">
                          <strong>
                            {step.move.name}
                            {prefs.fav.includes(step.move.id) && <span className="fav-dot" aria-label="favourite" />}
                          </strong>
                          <small>
                            {step.move.kind === 'reps' ? <Repeat size={13} /> : <Timer size={13} />}
                            {stepLabel(step)}
                            {sided && (
                              <span className="side-badge">
                                <ArrowLeftRight size={11} /> each side
                              </span>
                            )}
                          </small>
                        </span>
                      </button>
                      {swappable && (
                        <button className="icon-btn ghost small" aria-label={`Swap ${step.move.name}`} onClick={() => swap(step.move.id, step.block)}>
                          <RefreshCw size={17} />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </section>
          )
        })}
      </div>

      <div className="dock">
        <button className="cta" onClick={onStart}>
          <Play size={18} fill="currentColor" />
          Start session
          <span className="cta-meta">{fmtDur(session.totalSecs)}</span>
        </button>
      </div>

      {open && (
        <MoveSheet
          move={open.move}
          prefs={prefs}
          onPrefs={onPrefs}
          onClose={() => setOpen(null)}
          onSwap={
            open.swappable
              ? () => {
                  swap(open.move.id, open.block)
                  setOpen(null)
                }
              : undefined
          }
        />
      )}
    </main>
  )
}
