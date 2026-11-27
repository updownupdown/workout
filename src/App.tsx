import { useEffect, useState } from 'react'
import { generate, Session, Settings } from './engine/generator'
import { Home } from './screens/Home'
import { Preview } from './screens/Preview'
import { Player } from './screens/Player'
import { Done } from './screens/Done'
import { Library } from './screens/Library'
import { setChimes, setVoice } from './engine/cues'
import { usePrefs, useSettings } from './store'

type Screen = 'home' | 'preview' | 'play' | 'done' | 'library'

export function App() {
  const [settings, setSettings] = useSettings()
  const [prefs, setPrefs] = usePrefs()
  const [session, setSession] = useState<Session | null>(null)
  const [screen, setScreen] = useState<Screen>('home')

  useEffect(() => {
    setVoice(settings.voice)
    setChimes(settings.chimes)
  }, [settings.voice, settings.chimes])

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

  const build = (s: Settings = settings) => {
    setSettings(s)
    setSession(generate(s, prefs))
    setScreen('preview')
  }

  if (screen === 'preview' && session)
    return (
      <Preview
        session={session}
        prefs={prefs}
        onPrefs={setPrefs}
        onChange={setSession}
        onShuffle={() => setSession(generate(session.settings, prefs))}
        onBack={() => setScreen('home')}
        onStart={() => setScreen('play')}
      />
    )
  if (screen === 'play' && session)
    return (
      <Player
        session={session}
        voice={settings.voice}
        onVoice={(v) => setSettings({ ...settings, voice: v })}
        onExit={() => setScreen('preview')}
        onDone={() => setScreen('done')}
      />
    )
  if (screen === 'done' && session)
    return <Done session={session} onAgain={() => setScreen('play')} onNew={() => build(session.settings)} onHome={() => setScreen('home')} />
  if (screen === 'library')
    return <Library prefs={prefs} onPrefs={setPrefs} onBack={() => setScreen('home')} />
  return (
    <Home
      settings={settings}
      prefs={prefs}
      onSettings={setSettings}
      onPrefs={setPrefs}
      onBuild={build}
      onLibrary={() => setScreen('library')}
    />
  )
}
