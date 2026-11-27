import { useMemo, useState } from 'react'
import { ChevronLeft, EyeOff, Heart, Search, X } from 'lucide-react'
import { Category, CAT_META, Move, MOVES } from '../data/moves'
import { Figure } from '../figure/Figure'
import { Prefs } from '../engine/generator'
import { Pills } from '../ui/Pills'
import { MoveSheet } from '../ui/MoveSheet'

const ORDER: Category[] = ['breath', 'warmup', 'strength', 'core', 'pilates', 'yoga', 'stretch', 'rest']
type Filter = Category | 'all' | 'fav' | 'dumbbells' | 'band'

export function Library({ prefs, onPrefs, onBack }: { prefs: Prefs; onPrefs: (p: Prefs) => void; onBack: () => void }) {
  const [open, setOpen] = useState<Move | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return MOVES.filter((m) =>
      (filter === 'all' ||
        (filter === 'fav'
          ? prefs.fav.includes(m.id)
          : filter === 'dumbbells' || filter === 'band'
            ? m.equipment === filter
            : m.cat === filter)) &&
      (!needle || m.name.toLowerCase().includes(needle) || CAT_META[m.cat].label.toLowerCase().includes(needle)),
    )
  }, [filter, q, prefs.fav])

  return (
    <main className="screen library">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div className="topbar-title">Move library</div>
        <span className="icon-spacer" />
      </header>

      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${MOVES.length} moves`} />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </label>

      <Pills
        label="Filter moves"
        options={[
          { id: 'all' as Filter, label: `All ${MOVES.length}` },
          { id: 'fav' as Filter, label: 'Favourites', icon: Heart },
          ...ORDER.map((c) => ({ id: c as Filter, label: CAT_META[c].label, dot: CAT_META[c].color })),
          { id: 'dumbbells' as Filter, label: 'Dumbbells' },
          { id: 'band' as Filter, label: 'Elastic band' },
        ]}
        isOn={(f) => filter === f}
        onPick={setFilter}
      />

      {list.length === 0 ? (
        <p className="empty">{filter === 'fav' ? 'No favourites yet. Open a move and tap the heart.' : 'No moves match.'}</p>
      ) : (
        <div className="lib-grid">
          {list.map((m) => {
            const fav = prefs.fav.includes(m.id)
            const hidden = prefs.hidden.includes(m.id)
            return (
              <button
                key={m.id}
                className={`lib-card ${hidden ? 'is-hidden' : ''}`}
                onClick={() => setOpen(m)}
                style={{ ['--c' as string]: CAT_META[m.cat].color }}
              >
                <span className="lib-fig">
                  <Figure anim={m.anim} t={99} tempo={m.tempo} accent={CAT_META[m.cat].color} floor={false} />
                  {(fav || hidden) && (
                    <span className="lib-flag">{fav ? <Heart size={13} fill="currentColor" /> : <EyeOff size={13} />}</span>
                  )}
                </span>
                <strong>{m.name}</strong>
                <small>
                  <span className="dot" /> {CAT_META[m.cat].label}
                  {m.equipment === 'dumbbells' ? ' · dumbbells' : m.equipment === 'band' ? ' · band' : ''}
                </small>
              </button>
            )
          })}
        </div>
      )}

      {open && <MoveSheet move={open} prefs={prefs} onPrefs={onPrefs} onClose={() => setOpen(null)} />}
    </main>
  )
}
