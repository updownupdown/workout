import { useEffect, useState } from 'react'
import { decodeSession, encodeSession, generate, Session, Settings } from './engine/generator'
import { THEME_BY_ID } from './engine/themes'
import { Home } from './screens/Home'
import { Preview } from './screens/Preview'
import { Player } from './screens/Player'
import { Done } from './screens/Done'
import { Library } from './screens/Library'
import { setChimes } from './engine/cues'
import { usePrefs, useSettings } from './store'
import { useRecents } from './recent'

type Screen = 'home' | 'preview' | 'play' | 'done' | 'library'

const FOCUS_LABEL = { balanced: 'Balanced', strength: 'Strength', flow: 'Flow', calm: 'Calm' }

export function sessionTitle(s: Settings) {
  const theme = s.theme ? THEME_BY_ID[s.theme]?.label : null
  return `${theme ?? FOCUS_LABEL[s.focus]} · ${s.minutes} min`
}

/** A session shared as a link: #s=<code>. */
function fromHash(settings: Settings, prefs: Parameters<typeof decodeSession>[2]) {
  const m = /^#s=(.+)$/.exec(location.hash)
  if (!m) return null
  history.replaceState(null, '', location.pathname + location.search)
  return decodeSession(m[1], settings, prefs)
}

export function App() {
  const [settings, setSettings] = useSettings()
  const [prefs, setPrefs] = usePrefs()
  const { recents, addRecent, clearRecents } = useRecents()
  const [session, setSession] = useState<Session | null>(() => fromHash(settings, prefs))
  const [screen, setScreen] = useState<Screen>(() => (session ? 'preview' : 'home'))

  useEffect(() => {
    setChimes(settings.chimes)
  }, [settings.chimes])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  // Android/desktop back button steps back through screens instead of leaving the app.
  useEffect(() => {
    if (screen !== 'home') history.pushState({ screen }, '')
    const onPop = () => setScreen((s) => (s === 'play' ? 'preview' : 'home'))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [screen])

  // A shared link opened while the app is already running.
  useEffect(() => {
    const onHash = () => {
      const s = fromHash(settings, prefs)
      if (s) {
        setSession(s)
        setScreen('preview')
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [settings, prefs])

  const build = (s: Settings = settings) => {
    setSettings(s)
    setSession(generate(s, prefs))
    setScreen('preview')
  }

  const openCode = (code: string) => {
    const s = decodeSession(code, settings, prefs)
    if (!s) return
    setSession(s)
    setScreen('preview')
  }

  const start = () => {
    if (!session) return
    addRecent({ code: encodeSession(session), label: sessionTitle(session.settings), secs: session.totalSecs })
    setScreen('play')
  }

  if (screen === 'preview' && session)
    return (
      <Preview
        session={session}
        prefs={prefs}
        title={sessionTitle(session.settings)}
        onPrefs={setPrefs}
        onChange={setSession}
        onShuffle={() => setSession(generate(session.settings, prefs))}
        onBack={() => setScreen('home')}
        onStart={start}
      />
    )
  if (screen === 'play' && session)
    return (
      <Player
        session={session}
        sound={settings.chimes}
        onSound={(v) => setSettings({ ...settings, chimes: v })}
        view3d={settings.view3d}
        onExit={() => setScreen('preview')}
        onDone={() => setScreen('done')}
      />
    )
  if (screen === 'done' && session)
    return (
      <Done
        session={session}
        title={sessionTitle(session.settings)}
        onAgain={() => setScreen('play')}
        onNew={() => build(session.settings)}
        onHome={() => setScreen('home')}
      />
    )
  if (screen === 'library')
    return <Library prefs={prefs} onPrefs={setPrefs} onBack={() => setScreen('home')} />
  return (
    <Home
      settings={settings}
      prefs={prefs}
      recents={recents}
      onSettings={setSettings}
      onPrefs={setPrefs}
      onBuild={() => build()}
      onOpenRecent={openCode}
      onClearRecents={clearRecents}
      onLibrary={() => setScreen('library')}
    />
  )
}
