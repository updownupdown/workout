import { Bell, Box, Check, ChevronRight, Download, EyeOff, Heart, LayoutGrid, PenLine, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Figure3DKind, Prefs, Settings } from '../engine/generator'
import { Sheet } from '../ui/Sheet'
import { Segmented } from '../ui/Choice'

interface Props {
  settings: Settings
  prefs: Prefs
  onSettings: (s: Settings) => void
  onPrefs: (p: Prefs) => void
  onLibrary: () => void
  onInstall: (() => void) | null
  onClose: () => void
}

const FIGURES: { id: Figure3DKind; label: string }[] = [
  { id: 'ava', label: 'Ava' },
  { id: 'leo', label: 'Leo' },
  { id: 'mannequin', label: 'Mannequin' },
]

const thumb = (id: Figure3DKind) => `${import.meta.env.BASE_URL}figures/${id}.webp`

/** Start downloading a realistic figure as soon as it is picked. */
function warm(id: Figure3DKind) {
  if (id === 'mannequin') return
  void import('../figure/real/scene').then((m) => m.preloadCharacter(id)).catch(() => {})
}

export function SettingsSheet({ settings, prefs, onSettings, onPrefs, onLibrary, onInstall, onClose }: Props) {
  const set = (p: Partial<Settings>) => onSettings({ ...settings, ...p })
  const figure = settings.figure3d ?? 'ava'

  return (
    <Sheet title="Settings" onClose={onClose} className="sheet-lg">
      <div className="settings-v2">
        <Section title="Figure">
          <Segmented
            label="Figure view"
            options={[
              { id: '2d', label: '2D', icon: PenLine },
              { id: '3d', label: '3D', icon: Box },
            ]}
            value={settings.view3d ? '3d' : '2d'}
            onPick={(v) => {
              set({ view3d: v === '3d' })
              if (v === '3d') warm(figure)
            }}
          />
          <div className={`figure-cards ${settings.view3d ? '' : 'dim'}`} role="radiogroup" aria-label="3D figure">
            {FIGURES.map((f) => {
              const on = figure === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`figure-card ${on ? 'on' : ''}`}
                  onClick={() => {
                    set({ figure3d: f.id, view3d: true })
                    warm(f.id)
                  }}
                >
                  <img src={thumb(f.id)} alt="" loading="lazy" width={240} height={320} />
                  <span className="figure-name">
                    {on && <Check size={15} strokeWidth={2.6} />}
                    {f.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Session">
          <Row icon={Bell} title="Chimes" sub="Count-in ticks and transitions">
            <button className={`switch-btn`} role="switch" aria-checked={settings.chimes} aria-label="Chimes" onClick={() => set({ chimes: !settings.chimes })}>
              <i className={`switch ${settings.chimes ? 'on' : ''}`} />
            </button>
          </Row>
          <div className="set-block">
            <span className="set-label">Get-ready time</span>
            <Segmented
              label="Get-ready time"
              options={[5, 7, 10].map((s) => ({ id: s, label: `${s} s` }))}
              value={settings.readySecs}
              onPick={(s) => set({ readySecs: s })}
            />
          </div>
        </Section>

        <Section title="Moves">
          <Row
            icon={Heart}
            title="Favourites"
            sub={prefs.fav.length ? `${prefs.fav.length} moves show up more often` : 'Heart moves in the library'}
          >
            {prefs.fav.length > 0 && (
              <button className="text-btn" onClick={() => onPrefs({ ...prefs, fav: [] })}>Clear</button>
            )}
          </Row>
          <Row icon={EyeOff} title="Hidden moves" sub={prefs.hidden.length ? `${prefs.hidden.length} never suggested` : 'None hidden'}>
            {prefs.hidden.length > 0 && (
              <button className="text-btn" onClick={() => onPrefs({ ...prefs, hidden: [] })}>Restore</button>
            )}
          </Row>
          <button className="set-row link" onClick={() => { onClose(); onLibrary() }}>
            <RowBody icon={LayoutGrid} title="Move library" sub="Browse, favourite or hide moves" />
            <ChevronRight size={18} className="muted" />
          </button>
        </Section>

        {onInstall && (
          <Section title="App">
            <button className="set-row link" onClick={onInstall}>
              <RowBody icon={Download} title="Install app" sub="Add Flow to this device" />
              <ChevronRight size={18} className="muted" />
            </button>
          </Section>
        )}
      </div>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="set-section">
      <h3>{title}</h3>
      <div className="set-card">{children}</div>
    </section>
  )
}

function RowBody({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <>
      <span className="row-icon">
        <Icon size={18} />
      </span>
      <span className="row-text">
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
    </>
  )
}

function Row({ icon, title, sub, children }: { icon: LucideIcon; title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="set-row">
      <RowBody icon={icon} title={title} sub={sub} />
      {children}
    </div>
  )
}
