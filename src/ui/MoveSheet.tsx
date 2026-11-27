import { EyeOff, Heart, RefreshCw } from 'lucide-react'
import { CAT_META, Move } from '../data/moves'
import { LiveFigure } from '../figure/Figure'
import { Prefs } from '../engine/generator'
import { toggleIn } from '../store'
import { CAT_ICON } from './icons'
import { MUSCLE_LABEL, workOf } from '../data/muscles'
import { Sheet } from './Sheet'

const POSITION_LABEL = {
  standing: 'Standing',
  kneeling: 'Kneeling',
  quadruped: 'All fours',
  prone: 'Face down',
  supine: 'On your back',
  seated: 'Seated',
}

function amount(m: Move) {
  if (m.kind === 'reps') return `${m.reps} reps`
  if (m.kind === 'breath') return `${m.cycles} breaths`
  return `${m.secs} s hold`
}

interface Props {
  move: Move
  prefs: Prefs
  onPrefs: (p: Prefs) => void
  onClose: () => void
  onSwap?: () => void
}

export function MoveSheet({ move, prefs, onPrefs, onClose, onSwap }: Props) {
  const meta = CAT_META[move.cat]
  const Icon = CAT_ICON[move.cat]
  const fav = prefs.fav.includes(move.id)
  const hidden = prefs.hidden.includes(move.id)
  return (
    <Sheet onClose={onClose}>
      <div className="move-sheet" style={{ ['--c' as string]: meta.color }}>
        <div className="move-stage">
          <LiveFigure anim={move.anim} tempo={move.kind === 'breath' ? 4 : move.tempo} accent={meta.color} ghost work={workOf(move)} className="pulse" />
        </div>
        <div className="move-title">
          <span className="chip">
            <Icon size={14} strokeWidth={2.2} /> {meta.label}
          </span>
          <h2>{move.name}</h2>
          <p className="muted">
            {[amount(move), move.sided ? 'each side' : null, POSITION_LABEL[move.position], move.equipment === 'dumbbells' ? 'Dumbbells' : move.equipment === 'band' ? 'Elastic band' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="tag-row">
            {workOf(move).map((w) => (
              <span key={w} className="tag">{MUSCLE_LABEL[w]}</span>
            ))}
          </div>
        </div>
        <ol className="cue-list">
          {move.cues.map((c, i) => (
            <li key={c}>
              <span>{i + 1}</span>
              {c}
            </li>
          ))}
        </ol>
        <div className="sheet-actions">
          <button
            className={`pill-btn ${fav ? 'active' : ''}`}
            aria-pressed={fav}
            onClick={() => onPrefs({ ...prefs, fav: toggleIn(prefs.fav, move.id, !fav), hidden: toggleIn(prefs.hidden, move.id, false) })}
          >
            <Heart size={18} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'Favourite' : 'Favourite'}
          </button>
          <button
            className={`pill-btn ${hidden ? 'active warn' : ''}`}
            aria-pressed={hidden}
            onClick={() => onPrefs({ ...prefs, hidden: toggleIn(prefs.hidden, move.id, !hidden), fav: toggleIn(prefs.fav, move.id, false) })}
          >
            <EyeOff size={18} /> {hidden ? 'Hidden' : 'Never suggest'}
          </button>
          {onSwap && (
            <button className="pill-btn" onClick={onSwap}>
              <RefreshCw size={18} /> Swap
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
