import { useEffect, useState } from 'react'
import {
  Bell, Clock, Download, Dumbbell, EyeOff, Gauge, Heart, LayoutGrid, Mic, Settings2, Sparkles, Sunrise, Coffee,
  Flame, Hourglass, ChevronRight,
} from 'lucide-react'
import { FocusMode, Intensity, Prefs, Settings, Target } from '../engine/generator'
import { LiveFigure } from '../figure/Figure'
import { CAT_META, MOVE_BY_ID } from '../data/moves'
import { CAT_ICON, FOCUS_MODE_ICON, TARGET_ICON } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { Logo } from '../ui/Logo'

interface Props {
  settings: Settings
  prefs: Prefs
  onSettings: (s: Settings) => void
  onPrefs: (p: Prefs) => void
  onBuild: (s?: Settings) => void
  onLibrary: () => void
}

const FOCI: { id: FocusMode; label: string; hint: string; color: string }[] = [
  { id: 'balanced', label: 'Balanced', hint: 'A bit of everything', color: '#ff9a6b' },
  { id: 'strength', label: 'Strength', hint: 'Two rounds, more sweat', color: '#ff7a59' },
  { id: 'flow', label: 'Flow', hint: 'Yoga and pilates', color: '#b69cff' },
  { id: 'calm', label: 'Calm', hint: 'Stretch and breathe', color: '#5fd8c0' },
]
const MINUTES = [10, 20, 30, 45]
const INTENSITIES: { id: Intensity; label: string; bars: number }[] = [
  { id: 'gentle', label: 'Gentle', bars: 1 },
  { id: 'steady', label: 'Steady', bars: 2 },
  { id: 'strong', label: 'Strong', bars: 3 },
]
const TARGETS: { id: Target; label: string }[] = [
  { id: 'any', label: 'Whole body' },
  { id: 'upper', label: 'Upper' },
  { id: 'lower', label: 'Lower' },
  { id: 'core', label: 'Core' },
  { id: 'spine', label: 'Back' },
]

const HERO = ['sun-reach', 'squat', 'down-dog', 'warrior-2', 'push-up', 'cat-cow', 'hundred', 'tree', 'bird-dog', 'boat', 'teaser', 'inchworm']

const QUICK: { label: string; sub: string; icon: typeof Sunrise; color: string; s: Partial<Settings> }[] = [
  { label: 'Wake-up flow', sub: '10 min', icon: Sunrise, color: '#ffc766', s: { minutes: 10, focus: 'flow', intensity: 'gentle', target: 'any' } },
  { label: 'Desk reset', sub: '10 min', icon: Coffee, color: '#5fd8c0', s: { minutes: 10, focus: 'calm', intensity: 'gentle', target: 'spine' } },
  { label: 'Core burner', sub: '20 min', icon: Flame, color: '#ffb057', s: { minutes: 20, focus: 'strength', intensity: 'steady', target: 'core' } },
  { label: 'Full strength', sub: '30 min', icon: Dumbbell, color: '#ff7a59', s: { minutes: 30, focus: 'strength', intensity: 'strong', target: 'any' } },
]

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Home({ settings, prefs, onSettings, onPrefs, onBuild, onLibrary }: Props) {
  const [hero, setHero] = useState(() => Math.floor(Math.random() * HERO.length))
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const set = (p: Partial<Settings>) => onSettings({ ...settings, ...p })

  useEffect(() => {
    const id = setInterval(() => setHero((h) => (h + 1) % HERO.length), 7000)
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
  const HeroIcon = CAT_ICON[move.cat]

  return (
    <main className="screen home">
      <header className="topbar">
        <Logo />
        <div className="topbar-actions">
          <button className="icon-btn" onClick={onLibrary} aria-label="Move library">
            <LayoutGrid size={20} />
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            <Settings2 size={20} />
          </button>
        </div>
      </header>

      <section className="greet">
        <p className="eyebrow">{greeting()}</p>
        <h1>What feels good today?</h1>
      </section>

      <section className="hero" style={{ ['--c' as string]: CAT_META[move.cat].color }}>
        <div className="hero-stage" key={move.id}>
          <LiveFigure anim={move.anim} tempo={move.tempo} accent={CAT_META[move.cat].color} />
        </div>
        <div className="hero-caption" key={move.id + 'c'}>
          <span className="chip">
            <HeroIcon size={13} strokeWidth={2.4} />
            {CAT_META[move.cat].label}
          </span>
          <span className="hero-name">{move.name}</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-label">
          <Clock size={15} /> Duration
        </div>
        <div className="seg" role="radiogroup" aria-label="Duration">
          {MINUTES.map((m) => (
            <button key={m} role="radio" aria-checked={settings.minutes === m} className={settings.minutes === m ? 'on' : ''} onClick={() => set({ minutes: m })}>
              {m}
              <small>min</small>
            </button>
          ))}
        </div>

        <div className="panel-label">
          <Sparkles size={15} /> Focus
        </div>
        <div className="focus-grid" role="radiogroup" aria-label="Focus">
          {FOCI.map((f) => {
            const Icon = FOCUS_MODE_ICON[f.id]
            const on = settings.focus === f.id
            return (
              <button
                key={f.id}
                role="radio"
                aria-checked={on}
                className={`focus ${on ? 'on' : ''}`}
                style={{ ['--c' as string]: f.color }}
                onClick={() => set({ focus: f.id })}
              >
                <span className="focus-icon">
                  <Icon size={19} strokeWidth={2} />
                </span>
                <strong>{f.label}</strong>
                <small>{f.hint}</small>
              </button>
            )
          })}
        </div>

        <div className="panel-label">
          <TargetIcon /> Target
        </div>
        <div className="chips-scroll" role="radiogroup" aria-label="Target area">
          {TARGETS.map((t) => {
            const Icon = TARGET_ICON[t.id]
            const on = (settings.target ?? 'any') === t.id
            return (
              <button key={t.id} role="radio" aria-checked={on} className={`select-chip ${on ? 'on' : ''}`} onClick={() => set({ target: t.id })}>
                <Icon size={15} /> {t.label}
              </button>
            )
          })}
        </div>

        <div className="panel-label">
          <Gauge size={15} /> Intensity
        </div>
        <div className="seg" role="radiogroup" aria-label="Intensity">
          {INTENSITIES.map((i) => (
            <button key={i.id} role="radio" aria-checked={settings.intensity === i.id} className={settings.intensity === i.id ? 'on' : ''} onClick={() => set({ intensity: i.id })}>
              <span className="bars" aria-hidden>
                {[1, 2, 3].map((b) => (
                  <i key={b} className={b <= i.bars ? 'lit' : ''} />
                ))}
              </span>
              {i.label}
            </button>
          ))}
        </div>

        <button className="row-toggle" role="switch" aria-checked={settings.dumbbells} onClick={() => set({ dumbbells: !settings.dumbbells })}>
          <span className="row-icon">
            <Dumbbell size={18} />
          </span>
          <span className="row-text">
            <strong>Dumbbells</strong>
            <small>{settings.dumbbells ? 'Weighted moves included' : 'Bodyweight only'}</small>
          </span>
          <i className={`switch ${settings.dumbbells ? 'on' : ''}`} />
        </button>
      </section>

      <section>
        <h2 className="section-title">Quick start</h2>
        <div className="quick">
          {QUICK.map((q) => (
            <button
              key={q.label}
              className="quick-card"
              style={{ ['--c' as string]: q.color }}
              onClick={() => onBuild({ ...settings, ...q.s })}
            >
              <span className="quick-icon">
                <q.icon size={20} />
              </span>
              <strong>{q.label}</strong>
              <small>{q.sub}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="dock">
        <button className="cta" onClick={() => onBuild()}>
          <Sparkles size={19} />
          Build my session
          <span className="cta-meta">{settings.minutes} min</span>
        </button>
      </div>

      {showSettings && (
        <Sheet title="Settings" onClose={() => setShowSettings(false)}>
          <div className="settings">
            <SettingRow icon={Mic} title="Voice guidance" sub="Announces moves, sides and breath" on={settings.voice} onChange={(v) => set({ voice: v })} />
            <SettingRow icon={Bell} title="Chimes" sub="Count-in ticks and transitions" on={settings.chimes} onChange={(v) => set({ chimes: v })} />
            <div className="setting">
              <span className="row-icon">
                <Hourglass size={18} />
              </span>
              <span className="row-text">
                <strong>Get-ready time</strong>
                <small>Before each move</small>
              </span>
              <div className="seg mini">
                {[5, 7, 10].map((s) => (
                  <button key={s} className={settings.readySecs === s ? 'on' : ''} onClick={() => set({ readySecs: s })}>
                    {s}s
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <span className="row-icon">
                <Heart size={18} />
              </span>
              <span className="row-text">
                <strong>Favourites</strong>
                <small>{prefs.fav.length ? `${prefs.fav.length} moves show up more often` : 'Heart moves in the library'}</small>
              </span>
              {prefs.fav.length > 0 && (
                <button className="text-btn" onClick={() => onPrefs({ ...prefs, fav: [] })}>Clear</button>
              )}
            </div>
            <div className="setting">
              <span className="row-icon">
                <EyeOff size={18} />
              </span>
              <span className="row-text">
                <strong>Hidden moves</strong>
                <small>{prefs.hidden.length ? `${prefs.hidden.length} never suggested` : 'None hidden'}</small>
              </span>
              {prefs.hidden.length > 0 && (
                <button className="text-btn" onClick={() => onPrefs({ ...prefs, hidden: [] })}>Restore</button>
              )}
            </div>
            <button className="setting link" onClick={() => { setShowSettings(false); onLibrary() }}>
              <span className="row-icon">
                <LayoutGrid size={18} />
              </span>
              <span className="row-text">
                <strong>Move library</strong>
                <small>Browse, favourite or hide moves</small>
              </span>
              <ChevronRight size={18} className="muted" />
            </button>
            {install && (
              <button
                className="setting link"
                onClick={async () => {
                  await install.prompt()
                  setInstall(null)
                }}
              >
                <span className="row-icon">
                  <Download size={18} />
                </span>
                <span className="row-text">
                  <strong>Install app</strong>
                  <small>Add Flow to this device</small>
                </span>
                <ChevronRight size={18} className="muted" />
              </button>
            )}
          </div>
        </Sheet>
      )}
    </main>
  )
}

function TargetIcon() {
  const Icon = TARGET_ICON.core
  return <Icon size={15} />
}

function SettingRow({
  icon: Icon, title, sub, on, onChange,
}: { icon: typeof Mic; title: string; sub: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="setting" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="row-icon">
        <Icon size={18} />
      </span>
      <span className="row-text">
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
      <i className={`switch ${on ? 'on' : ''}`} />
    </button>
  )
}
