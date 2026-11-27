import { useState } from 'react'
import { Category, CAT_META, Move, MOVES } from '../data/moves'
import { Figure, LiveFigure } from '../figure/Figure'

const ORDER: Category[] = ['breath', 'warmup', 'strength', 'core', 'pilates', 'yoga', 'stretch', 'rest']

export function Library({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<Move | null>(null)
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const list = MOVES.filter((m) => filter === 'all' || m.cat === filter)
  return (
    <main className="screen library">
      <header className="bar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="bar-title">
          <strong>Move library</strong>
          <small>{MOVES.length} moves</small>
        </div>
        <span style={{ width: 44 }} />
      </header>
      <div className="filters">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        {ORDER.map((c) => (
          <button
            key={c}
            className={filter === c ? 'on' : ''}
            style={{ ['--c' as string]: CAT_META[c].color }}
            onClick={() => setFilter(c)}
          >
            {CAT_META[c].label}
          </button>
        ))}
      </div>
      <div className="lib-grid">
        {list.map((m) => (
          <button key={m.id} className="lib-card" onClick={() => setOpen(m)} style={{ ['--c' as string]: CAT_META[m.cat].color }}>
            <div className="lib-fig">
              <Figure anim={m.anim} t={99} tempo={m.tempo} accent={CAT_META[m.cat].color} floor={false} />
            </div>
            <strong>{m.name}</strong>
            <small>
              {CAT_META[m.cat].label}
              {m.equipment ? ' · dumbbells' : ''}
            </small>
          </button>
        ))}
      </div>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ ['--c' as string]: CAT_META[open.cat].color }}>
            <div className="sheet-fig">
              <LiveFigure anim={open.anim} tempo={open.kind === 'breath' ? 4 : open.tempo} accent={CAT_META[open.cat].color} ghost />
            </div>
            <span className="chip" style={{ ['--c' as string]: CAT_META[open.cat].color }}>{CAT_META[open.cat].label}</span>
            <h2>{open.name}</h2>
            <ul className="cues">
              {open.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <button className="ghost-btn" onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>
      )}
    </main>
  )
}
