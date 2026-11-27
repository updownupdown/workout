import { useEffect, useState } from 'react'

export interface Recent {
  code: string
  label: string
  secs: number
  at: number
}

const KEY = 'flow.recent.v1'

function read(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Recent[]
  } catch {
    return []
  }
}

/** Locally remembered sessions, newest first (no health data, just the plan). */
export function useRecents() {
  const [list, setList] = useState<Recent[]>(read)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list))
    } catch {
      /* ignore */
    }
  }, [list])
  const add = (r: Omit<Recent, 'at'>) =>
    setList((l) => [{ ...r, at: Date.now() }, ...l.filter((x) => x.code !== r.code)].slice(0, 6))
  const clear = () => setList([])
  return { recents: list, addRecent: add, clearRecents: clear }
}

export function shareUrl(code: string) {
  return `${location.origin}${import.meta.env.BASE_URL}#s=${encodeURIComponent(code)}`
}

export async function shareSession(code: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = shareUrl(code)
  try {
    if (navigator.share) {
      await navigator.share({ title, url })
      return 'shared'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function ago(at: number) {
  const d = Math.floor((Date.now() - at) / 86400000)
  if (d <= 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
