import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Anim } from './anim'
import { RealScene, type Character } from './real/scene'

/**
 * Realistic 3D person (see figure/real/), driven by the same pose data as the
 * 2D mannequin. Falls back to `fallback` until the model has loaded, or for
 * good if WebGL is unavailable.
 */
interface Props {
  anim: Anim
  t: number
  tempo: number
  flip?: boolean
  character: Character
  className?: string
  fallback?: ReactNode
}

export default function FigureReal({ anim, t, tempo, flip, character, className, fallback }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<RealScene | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    let s: RealScene
    try {
      s = new RealScene(host.current!)
    } catch {
      setState('failed')
      return
    }
    s.onReady = () => setState('ready')
    scene.current = s
    return () => {
      s.dispose()
      scene.current = null
    }
  }, [])

  useEffect(() => {
    const s = scene.current
    if (!s) return
    setState((v) => (v === 'failed' ? v : 'loading'))
    s.setCharacter(character).catch(() => setState('failed'))
  }, [character])

  useLayoutEffect(() => {
    const s = scene.current
    if (!s) return
    s.setMove(anim, tempo, flip)
    s.setTime(t)
  })

  return (
    <>
      {state !== 'ready' && fallback}
      <div
        ref={host}
        className={`figure-real ${className ?? ''}`}
        style={{ visibility: state === 'ready' ? 'visible' : 'hidden' }}
      />
    </>
  )
}
