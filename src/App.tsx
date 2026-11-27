import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, generate, Session, Settings } from './engine/generator'
import { Home } from './screens/Home'
import { Preview } from './screens/Preview'
import { Player } from './screens/Player'
import { Done } from './screens/Done'
import { Library } from './screens/Library'
import { setVoice } from './engine/cues'

type Screen = 'home' | 'preview' | 'play' | 'done' | 'library'

const KEY = 'flow.settings.v1'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS
}

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [session, setSession] = useState<Session | null>(null)
  const [screen, setScreen] = useState<Screen>('home')

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
    setVoice(settings.voice)
  }, [settings])

  // Android/desktop back button: step back through screens instead of leaving the app.
  useEffect(() => {
    if (screen !== 'home') history.pushState({ screen }, '')
    const onPop = () => setScreen((s) => (s === 'play' ? 'preview' : 'home'))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [screen])

  const build = (s: Settings = settings) => {
    setSettings(s)
    setSession(generate(s))
    setScreen('preview')
  }

  switch (screen) {
    case 'preview':
      return session ? (
        <Preview
          session={session}
          onChange={setSession}
          onShuffle={() => setSession(generate(settings))}
          onBack={() => setScreen('home')}
          onStart={() => setScreen('play')}
        />
      ) : null
    case 'play':
      return session ? (
        <Player session={session} onExit={() => setScreen('preview')} onDone={() => setScreen('done')} />
      ) : null
    case 'done':
      return session ? (
        <Done
          session={session}
          onAgain={() => setScreen('play')}
          onNew={() => build()}
          onHome={() => setScreen('home')}
        />
      ) : null
    case 'library':
      return <Library onBack={() => setScreen('home')} />
    default:
      return (
        <Home
          settings={settings}
          onSettings={setSettings}
          onBuild={build}
          onLibrary={() => setScreen('library')}
        />
      )
  }
}
