import { useEffect, useState } from 'react'
import { FocusMode, Intensity, Settings } from '../engine/generator'
import { LiveFigure } from '../figure/Figure'
import { CAT_META, MOVE_BY_ID } from '../data/moves'

interface Props {
  settings: Settings
  onSettings: (s: Settings) => void
  onBuild: (s?: Settings) => void
  onLibrary: () => void
}

const FOCI: { id: FocusMode; label: string; hint: string }[] = [
  { id: 'balanced', label: 'Balanced', hint: 'A bit of everything' },
  { id: 'strength', label: 'Strength', hint: 'Two rounds, more sweat' },
  { id: 'flow', label: 'Flow', hint: 'Yoga and pilates' },
  { id: 'calm', label: 'Calm', hint: 'Stretch and breathe' },
]
const MINUTES = [10, 20, 30, 45]
const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'steady', label: 'Steady' },
  { id: 'strong', label: 'Strong' },
]

const HERO = ['sun-reach', 'squat', 'down-dog', 'warrior-2', 'push-up', 'cat-cow', 'hundred', 'tree', 'bird-dog', 'boat']

const QUICK: { label: string; sub: string; s: Partial<Settings> }[] = [
  { label: 'Wake-up', sub: '10 min · flow', s: { minutes: 10, focus: 'flow', intensity: 'gentle' } },
  { label: 'Desk reset', sub: '10 min · calm', s: { minutes: 10, focus: 'calm', intensity: 'gentle' } },
  { label: 'Get strong', sub: '30 min · strength', s: { minutes: 30, focus: 'strength', intensity: 'strong' } },
]

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late one' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Home({ settings, onSettings, onBuild, onLibrary }: Props) {
  const [hero, setHero] = useState(0)
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null)
  const set = (p: Partial<Settings>) => onSettings({ ...settings, ...p })

  useEffect(() => {
    const id = setInterval(() => setHero((h) => (h + 1) % HERO.length), 6000)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstall(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => {
      clearInterval(id)
      window.removeEventListener('beforeinstallprompt', onPrompt)
    }
  }, [])

  const move = MOVE_BY_ID[HERO[hero]]

  return (
    <main className="screen home">
      <header className="home-head">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1>Ready to move?</h1>
        </div>
        <button className="icon-btn" onClick={onLibrary} aria-label="Move library">
          <svg viewBox="0 0 24 24"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z" /></svg>
        </button>
      </header>

      <section className="hero card">
        <div className="hero-stage" key={move.id}>
          <LiveFigure anim={move.anim} tempo={move.tempo} accent={CAT_META[move.cat].color} />
        </div>
        <div className="hero-caption">
          <span className="chip" style={{ ['--c' as string]: CAT_META[move.cat].color }}>{CAT_META[move.cat].label}</span>
          <span>{move.name}</span>
        </div>
      </section>

      <section className="card builder">
        <h2>Build a session</h2>
        <label className="field-label">Time</label>
        <div className="seg">
          {MINUTES.map((m) => (
            <button key={m} className={settings.minutes === m ? 'on' : ''} onClick={() => set({ minutes: m })}>
              {m}<small>min</small>
            </button>
          ))}
        </div>

        <label className="field-label">Focus</label>
        <div className="focus-grid">
          {FOCI.map((f) => (
            <button key={f.id} className={`focus ${settings.focus === f.id ? 'on' : ''}`} onClick={() => set({ focus: f.id })}>
              <strong>{f.label}</strong>
              <small>{f.hint}</small>
            </button>
          ))}
        </div>

        <label className="field-label">Intensity</label>
        <div className="seg">
          {INTENSITIES.map((i) => (
            <button key={i.id} className={settings.intensity === i.id ? 'on' : ''} onClick={() => set({ intensity: i.id })}>
              {i.label}
            </button>
          ))}
        </div>

        <div className="toggles">
          <Toggle label="I have dumbbells" on={settings.dumbbells} onChange={(v) => set({ dumbbells: v })} />
          <Toggle label="Voice guidance" on={settings.voice} onChange={(v) => set({ voice: v })} />
        </div>

        <button className="cta" onClick={() => onBuild()}>
          Build my session
        </button>
      </section>

      <section>
        <h2 className="section-title">Quick start</h2>
        <div className="quick">
          {QUICK.map((q) => (
            <button key={q.label} className="card quick-card" onClick={() => onBuild({ ...settings, ...q.s })}>
              <strong>{q.label}</strong>
              <small>{q.sub}</small>
            </button>
          ))}
        </div>
      </section>

      {install && (
        <button
          className="ghost-btn"
          onClick={async () => {
            await install.prompt()
            setInstall(null)
          }}
        >
          Install Flow on this device
        </button>
      )}
      <p className="fineprint">No accounts, no tracking. Everything stays on this device.</p>
    </main>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <i />
    </button>
  )
}
