import { useEffect, useState } from 'react'
import { DEFAULT_PREFS, DEFAULT_SETTINGS, Prefs, Settings } from './engine/generator'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...fallback, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return fallback
}

function usePersisted<T>(key: string, fallback: T) {
  const [v, setV] = useState<T>(() => load(key, fallback))
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  }, [key, v])
  return [v, setV] as const
}

export const useSettings = () => usePersisted<Settings>('flow.settings.v1', DEFAULT_SETTINGS)
export const usePrefs = () => usePersisted<Prefs>('flow.prefs.v1', DEFAULT_PREFS)

export function toggleIn(list: string[], id: string, on: boolean) {
  const s = new Set(list)
  if (on) s.add(id)
  else s.delete(id)
  return [...s]
}
