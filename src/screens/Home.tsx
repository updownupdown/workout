import { useEffect, useState } from 'react'
import { Bell, Box, ChevronRight, Download, EyeOff, Heart, Hourglass, LayoutGrid, RotateCcw, Settings2, Sparkles } from 'lucide-react'
import { FocusMode, Intensity, Prefs, Settings, Target } from '../engine/generator'
import { THEMES, THEME_BY_ID } from '../engine/themes'
import { Sheet } from '../ui/Sheet'
import { Logo } from '../ui/Logo'
import { Field, Pills } from '../ui/Pills'
import { ago, Recent } from '../recent'
import { fmtDur } from './format'

interface Props {
  settings: Settings
  prefs: Prefs
  recents: Recent[]
  onSettings: (s: Settings) => void
  onPrefs: (p: Prefs) => void
  onBuild: () => void
  onOpenRecent: (code: string) => void
  onClearRecents: () => void
  onLibrary: () => void
}

const MINUTES = [10, 15, 20, 30, 45]
const FOCI: { id: FocusMode; label: string }[] = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'strength', label: 'Strength' },
  { id: 'flow', label: 'Flow' },
  { id: 'calm', label: 'Calm' },
]
const TARGETS: { id: Target; label: string }[] = [
  { id: 'any', label: 'Whole body' },
  { id: 'upper', label: 'Upper body' },
  { id: 'lower', label: 'Lower body' },
  { id: 'core', label: 'Core' },
  { id: 'spine', label: 'Back' },
]
const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'steady', label: 'Steady' },
  { id: 'strong', label: 'Strong' },
]

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export function Home({ settings, prefs, recents, onSettings, onPrefs, onBuild, onOpenRecent, onClearRecents, onLibrary }: Props) {
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const set = (p: Partial<Settings>) => onSettings({ ...settings, ...p })

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstall(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const pickTheme = (id: string) => {
    if (id === '' || settings.theme === id) return set({ theme: null })
    set({ ...THEME_BY_ID[id].set, theme: id })
  }

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

      <div className="build">
        <Field label="Theme">
          <Pills
            label="Theme"
            options={[{ id: '', label: 'None' }, ...THEMES.map((t) => ({ id: t.id, label: t.label }))]}
            isOn={(id) => (settings.theme ?? '') === id}
            onPick={pickTheme}
          />
        </Field>

        <Field label="Duration">
          <Pills
            label="Duration"
            options={MINUTES.map((m) => ({ id: m, label: `${m} min` }))}
            isOn={(m) => settings.minutes === m}
            onPick={(m) => set({ minutes: m })}
          />
        </Field>

        <Field label="Focus">
          <Pills label="Focus" options={FOCI} isOn={(f) => settings.focus === f} onPick={(f) => set({ focus: f })} />
        </Field>

        <Field label="Target">
          <Pills
            label="Target"
            options={TARGETS}
            isOn={(t) => (settings.target ?? 'any') === t}
            onPick={(t) => set({ target: t })}
          />
        </Field>

        <Field label="Intensity">
          <Pills
            label="Intensity"
            options={INTENSITIES}
            isOn={(i) => settings.intensity === i}
            onPick={(i) => set({ intensity: i })}
          />
        </Field>

        <Field label="Equipment">
          <Pills
            label="Equipment"
            multi
            options={[
              { id: 'dumbbells', label: 'Dumbbells' },
              { id: 'band', label: 'Elastic band' },
            ]}
            isOn={(e) => settings[e as 'dumbbells' | 'band']}
            onPick={(e) => set({ [e]: !settings[e as 'dumbbells' | 'band'] })}
          />
        </Field>
      </div>

      {recents.length > 0 && (
        <section className="recents">
          <div className="field-label">
            <span>Recent</span>
            <button className="text-btn" onClick={onClearRecents}>Clear</button>
          </div>
          {recents.slice(0, 4).map((r) => (
            <button key={r.code} className="recent-row" onClick={() => onOpenRecent(r.code)}>
              <RotateCcw size={17} className="muted" />
              <span className="row-text">
                <strong>{r.label}</strong>
                <small>
                  {fmtDur(r.secs)} · {ago(r.at)}
                </small>
              </span>
              <ChevronRight size={18} className="muted" />
            </button>
          ))}
        </section>
      )}

      <div className="dock">
        <button className="cta" onClick={onBuild}>
          <Sparkles size={18} />
          Build my session
        </button>
      </div>

      {showSettings && (
        <Sheet title="Settings" onClose={() => setShowSettings(false)}>
          <div className="settings">
            <SettingRow icon={Bell} title="Chimes" sub="Count-in ticks and transitions" on={settings.chimes} onChange={(v) => set({ chimes: v })} />
            <div className="setting">
              <span className="row-icon">
                <Hourglass size={18} />
              </span>
              <span className="row-text">
                <strong>Get-ready time</strong>
                <small>Before each move</small>
              </span>
              <div className="pills tight">
                {[5, 7, 10].map((s) => (
                  <button key={s} className={`pill ${settings.readySecs === s ? 'on' : ''}`} onClick={() => set({ readySecs: s })}>
                    {s}s
                  </button>
                ))}
              </div>
            </div>
            <SettingRow
              icon={Box}
              title="3D figure (experimental)"
              sub="Drag to orbit the figure while you train"
              on={settings.view3d}
              onChange={(v) => set({ view3d: v })}
            />
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

function SettingRow({
  icon: Icon, title, sub, on, onChange,
}: { icon: typeof Bell; title: string; sub: string; on: boolean; onChange: (v: boolean) => void }) {
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
