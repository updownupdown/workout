import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Anim, compile, place, poseAt } from './anim'
import { L, Limb, Pt, Rig, solve } from './skeleton'
import type { Muscle } from '../data/moves'

/**
 * Experimental 3D renderer. It is driven by exactly the same pose data and
 * forward kinematics as the SVG figure: side-view moves are given depth by
 * spreading the left and right limbs apart, then drawn as lit capsules you
 * can orbit with a finger or the mouse.
 */
interface Props {
  anim: Anim
  t: number
  tempo: number
  flip?: boolean
  accent?: string
  work?: Muscle[]
  className?: string
}

type Key =
  | 'torso' | 'chest' | 'neck'
  | `${'l' | 'r'}${'upper' | 'fore' | 'hand' | 'thigh' | 'shin' | 'foot'}`

const SIDES = ['l', 'r'] as const
const PARTS = ['upper', 'fore', 'hand', 'thigh', 'shin', 'foot'] as const

const MUSCLE_PARTS: Record<Muscle, string[]> = {
  arms: ['upper', 'fore'],
  shoulders: ['upper'],
  chest: ['chest'],
  back: ['chest'],
  core: ['torso'],
  glutes: ['pelvis'],
  legs: ['thigh', 'shin'],
  calves: ['shin'],
}

interface Scene {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  root: THREE.Group
  limbs: Map<string, { cyl: THREE.Mesh; a: THREE.Mesh; b: THREE.Mesh }>
  head: THREE.Mesh
  pelvis: THREE.Mesh
  skin: THREE.MeshStandardMaterial
  near: THREE.MeshStandardMaterial
  far: THREE.MeshStandardMaterial
  glow: THREE.MeshStandardMaterial
  band: THREE.Line
  framedFor: Anim | null
}

const UP = new THREE.Vector3(0, 1, 0)

function setLimb(l: { cyl: THREE.Mesh; a: THREE.Mesh; b: THREE.Mesh }, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const d = new THREE.Vector3().subVectors(b, a)
  const len = Math.max(0.001, d.length())
  l.cyl.position.copy(a).addScaledVector(d, 0.5)
  l.cyl.quaternion.setFromUnitVectors(UP, d.normalize())
  l.cyl.scale.set(r, len, r)
  l.a.position.copy(a)
  l.b.position.copy(b)
  l.a.scale.setScalar(r)
  l.b.scale.setScalar(r)
}

export default function Figure3D({ anim, t, tempo, flip, accent = '#ff8a65', work, className }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const ref = useRef<Scene | null>(null)

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 1, 5000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minPolarAngle = 0.2
    controls.maxPolarAngle = Math.PI / 2 - 0.02
    controls.autoRotate = false

    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1d24, 1.6))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(160, 320, 260)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    const sc = key.shadow.camera as THREE.OrthographicCamera
    sc.left = -260
    sc.right = 260
    sc.top = 260
    sc.bottom = -260
    scene.add(key)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(260, 64),
      new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 1 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(258, 260, 64),
      new THREE.MeshBasicMaterial({ color: 0x2c313c }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.2
    scene.add(ring)

    const root = new THREE.Group()
    scene.add(root)

    const skin = new THREE.MeshStandardMaterial({ color: 0xf3e6d8, roughness: 0.65 })
    const near = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
    const far = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.5 })

    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 18)
    const sphGeo = new THREE.SphereGeometry(1, 18, 12)
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat)
      m.castShadow = true
      root.add(m)
      return m
    }
    const limbs = new Map<string, { cyl: THREE.Mesh; a: THREE.Mesh; b: THREE.Mesh }>()
    const keys: Key[] = ['torso', 'chest', 'neck', ...SIDES.flatMap((s) => PARTS.map((p) => `${s}${p}` as Key))]
    for (const k of keys) {
      const mat = k === 'torso' || k === 'chest' || k === 'neck' ? skin : near
      limbs.set(k, { cyl: mk(cylGeo, mat), a: mk(sphGeo, mat), b: mk(sphGeo, mat) })
    }
    const head = mk(sphGeo, skin)
    const pelvis = mk(sphGeo, skin)
    const band = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe8f26a }))
    root.add(band)

    ref.current = { renderer, scene, camera, controls, root, limbs, head, pelvis, skin, near, far, glow, band, framedFor: null }

    const resize = () => {
      const w = el.clientWidth || 300
      const h = el.clientHeight || 300
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    let raf = 0
    const loop = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
      ref.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const s = ref.current
    if (!s) return
    const c = compile(anim)
    const rig: Rig = place(solve(poseAt(c, t, tempo), anim.view), anim.anchor)
    const side = anim.view === 'side'
    // 2D (x right, y down) → 3D (x right, y up). Side view spreads left/right limbs in depth.
    const v = (p: Pt, z = 0) => new THREE.Vector3(p.x, -p.y, z)
    const zOf = (s: 'l' | 'r', leg: boolean) => (side ? (s === 'r' ? 1 : -1) * (leg ? L.hipW : L.shoulderW) : 0)

    const col = new THREE.Color(accent)
    s.near.color.copy(col)
    s.far.color.copy(col).lerp(new THREE.Color(0x343844), side ? 0.45 : 0)
    s.glow.color.copy(col)
    s.glow.emissive.copy(col)
    s.glow.emissiveIntensity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(performance.now() / 380))

    const lit = new Set((work ?? []).flatMap((m) => MUSCLE_PARTS[m]))
    const put = (k: string, l: Limb, za: number, zb: number, base: THREE.Material, part: string) => {
      const m = s.limbs.get(k)!
      setLimb(m, v(l.a, za), v(l.b, zb), l.w / 2)
      const mat = lit.has(part) ? s.glow : base
      m.cyl.material = mat
      m.a.material = mat
      m.b.material = mat
    }
    put('torso', rig.torso, 0, 0, s.skin, 'torso')
    put('chest', rig.chest, 0, 0, s.skin, 'chest')
    put('neck', { a: rig.neck, b: rig.head, w: 8 }, 0, 0, s.skin, 'neck')
    for (const sd of SIDES) {
      const limbs = rig[sd]
      const base = side && sd === 'l' ? s.far : s.near
      for (const p of PARTS) {
        const leg = p === 'thigh' || p === 'shin' || p === 'foot'
        const z = zOf(sd, leg)
        put(`${sd}${p}`, limbs[p], z, z, base, p)
      }
    }
    s.head.position.copy(v(rig.head))
    s.head.scale.setScalar(L.headR)
    s.pelvis.position.copy(v(rig.pelvis))
    s.pelvis.scale.setScalar(13)
    s.pelvis.material = lit.has('pelvis') ? s.glow : s.skin

    // Band
    const pts: THREE.Vector3[] = []
    if (anim.band === 'thighs') {
      const k = 0.72
      const at = (l: Limb, z: number) => v({ x: l.a.x + (l.b.x - l.a.x) * k, y: l.a.y + (l.b.y - l.a.y) * k }, z)
      pts.push(at(rig.l.thigh, zOf('l', true)), at(rig.r.thigh, zOf('r', true)))
    } else if (anim.band) {
      const P = (n: string) => {
        const sd = n[0] as 'l' | 'r'
        const limbs = rig[sd]
        if (n.endsWith('Hand')) return v(limbs.hand.a, zOf(sd, false))
        if (n.endsWith('Knee')) return v(limbs.thigh.b, zOf(sd, true))
        return v(limbs.foot.a, zOf(sd, true))
      }
      for (const [a, b] of anim.band) pts.push(P(a), P(b))
    }
    s.band.geometry.setFromPoints(pts)
    s.band.visible = pts.length > 0

    s.root.scale.x = flip ? -1 : 1

    // Frame the camera once per move.
    if (s.framedFor !== anim) {
      s.framedFor = anim
      const { x0, x1, y0, y1 } = c.view
      const cx = (x0 + x1) / 2
      const cy = -(y0 + y1) / 2
      const size = Math.max(x1 - x0, y1 - y0)
      const dist = size * 2.1
      const az = side ? 0.55 : 0.35
      s.controls.target.set(flip ? -cx : cx, cy, 0)
      s.camera.position.set((flip ? -cx : cx) + Math.sin(az) * dist, cy + size * 0.35, Math.cos(az) * dist)
      s.controls.update()
    }
  })

  return <div ref={host} className={`figure3d ${className ?? ''}`} />
}
