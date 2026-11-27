import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Anim } from '../anim'
import { Driver } from './rig'
import { useDQS } from './dqs'

/**
 * A lit, shadowed stage with a realistic rigged person on an exercise mat,
 * driven by the app's pose data. Used by the player (via FigureReal) and by
 * the standalone /realistic.html playground.
 */

export type Character = 'ava' | 'leo'
export const CHARACTERS: Record<Character, { label: string; file: string; hair: boolean }> = {
  ava: { label: 'Ava', file: 'female', hair: true },
  leo: { label: 'Leo', file: 'male', hair: false },
}

const BASE = import.meta.env.BASE_URL + 'realistic/'
const MAT_H = 0.8

interface Assets {
  gltf: GLTF
  body: THREE.Material
  head: THREE.Material
  hair: THREE.Material | null
  hairMap: THREE.Texture | null
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const texLoader = new THREE.TextureLoader()
const tex = (url: string, srgb = false) =>
  new Promise<THREE.Texture>((res, rej) =>
    texLoader.load(
      url,
      (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
        t.anisotropy = 4
        res(t)
      },
      undefined,
      rej,
    ),
  )

const assetCache = new Map<Character, Promise<Assets>>()
function loadAssets(c: Character): Promise<Assets> {
  const hit = assetCache.get(c)
  if (hit) return hit
  const { file, hair } = CHARACTERS[c]
  const p = (async () => {
    const [gltf, bc, bn, br, hc, hn, hr, hairMap] = await Promise.all([
      loader.loadAsync(`${BASE}${file}.glb`),
      tex(`${BASE}${file}_body_color.webp`, true),
      tex(`${BASE}${file}_body_normal.webp`),
      tex(`${BASE}${file}_body_rough.webp`),
      tex(`${BASE}${file}_head_color.webp`, true),
      tex(`${BASE}${file}_head_normal.webp`),
      tex(`${BASE}${file}_head_rough.webp`),
      hair ? tex(`${BASE}${file}_hair.webp`, true) : Promise.resolve(null),
    ])
    const skin = (map: THREE.Texture, normalMap: THREE.Texture, roughnessMap: THREE.Texture) =>
      useDQS(
        new THREE.MeshPhysicalMaterial({
          map, normalMap, roughnessMap,
          roughness: 1,
          metalness: 0,
          sheen: 0.18,
          sheenRoughness: 0.7,
          sheenColor: new THREE.Color(0xf2ddd2),
          specularIntensity: 0.55,
        }),
      )
    return {
      gltf,
      body: skin(bc, bn, br),
      head: skin(hc, hn, hr),
      hairMap,
      hair: hairMap
        ? useDQS(new THREE.MeshStandardMaterial({ map: hairMap, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, alphaToCoverage: true }))
        : null,
    }
  })()
  p.catch(() => assetCache.delete(c))
  assetCache.set(c, p)
  return p
}

function makeDriver(a: Assets): Driver {
  const model = cloneSkinned(a.gltf.scene)
  const depth = useDQS(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }))
  const hairDepth = a.hairMap
    ? useDQS(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: a.hairMap, alphaTest: 0.45 }))
    : depth
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    const n = (m.material as THREE.Material).name
    if (n.endsWith('_head')) m.material = a.head
    else if (n.endsWith('_opacity') && a.hair) {
      m.material = a.hair
      m.customDepthMaterial = hairDepth
      return
    } else m.material = a.body
    m.customDepthMaterial = depth
  })
  const d = new Driver(model)
  d.floorY = MAT_H
  return d
}

/** Warm the download for a character (e.g. when it is picked in Settings). */
export const preloadCharacter = (c: Character) => loadAssets(c).then(() => undefined)

export interface RealSceneOptions {
  quality?: 'high' | 'lite'
  /** Run the move on the scene's own clock instead of setTime(). */
  autoTime?: boolean
}

export class RealScene {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(30, 1, 5, 3000)
  readonly controls: OrbitControls
  private key: THREE.DirectionalLight
  private mat: THREE.Mesh
  driver: Driver | null = null
  private character: Character | null = null
  private anim: Anim | null = null
  private tempo = 3
  private flip = false
  private t = 0
  private t0 = performance.now()
  private framed: string | null = null
  private raf = 0
  private ro: ResizeObserver
  private disposed = false
  private quality: 'high' | 'lite'
  private autoTime: boolean
  readonly stats = { fps: 0, worst: 0, poseMs: 0, tris: 0 }
  onReady?: () => void

  constructor(private host: HTMLElement, opts: RealSceneOptions = {}) {
    this.quality = opts.quality ?? 'high'
    this.autoTime = !!opts.autoTime
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }))
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.NeutralToneMapping
    r.toneMappingExposure = 1.05
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    r.setClearColor(0x000000, 0)
    r.domElement.style.display = 'block'
    r.domElement.style.width = '100%'
    r.domElement.style.height = '100%'
    r.domElement.style.touchAction = 'none'
    host.appendChild(r.domElement)

    const pmrem = new THREE.PMREMGenerator(r)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.55
    pmrem.dispose()

    const c = (this.controls = new OrbitControls(this.camera, r.domElement))
    c.enableDamping = true
    c.enablePan = false
    c.minDistance = 120
    c.maxDistance = 900
    c.maxPolarAngle = Math.PI / 2 - 0.03

    // Warm key with soft shadows, cool rim from behind, low fill.
    const key = (this.key = new THREE.DirectionalLight(0xfff1e2, 2.6))
    key.position.set(220, 380, 300)
    key.castShadow = true
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.6
    key.shadow.radius = 6
    Object.assign(key.shadow.camera, { left: -200, right: 200, top: 220, bottom: -120, near: 50, far: 1200 })
    this.scene.add(key, key.target)
    const rim = new THREE.DirectionalLight(0xa8c4ff, 2.2)
    rim.position.set(-260, 260, -340)
    this.scene.add(rim, new THREE.HemisphereLight(0xcfd8ff, 0x20242c, 0.35))

    // Transparent floor that only catches shadows, so the page background shows through.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.32 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
    this.mat = new THREE.Mesh(
      new RoundedBoxGeometry(190, MAT_H, 64, 2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x3b5a63, roughness: 0.85 }),
    )
    this.mat.position.y = MAT_H / 2
    this.mat.receiveShadow = true
    this.scene.add(this.mat)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.setQuality(this.quality)
    this.raf = requestAnimationFrame(this.loop)
  }

  async setCharacter(c: Character) {
    this.character = c
    const a = await loadAssets(c)
    if (this.disposed || this.character !== c) return
    if (this.driver) this.scene.remove(this.driver.root)
    this.driver = makeDriver(a)
    this.scene.add(this.driver.root)
    this.framed = null
    this.onReady?.()
  }

  setMove(anim: Anim, tempo: number, flip = false) {
    if (anim !== this.anim || flip !== this.flip) this.t0 = performance.now()
    this.anim = anim
    this.tempo = tempo
    this.flip = flip
  }

  setTime(t: number) {
    this.t = t
  }

  setQuality(q: 'high' | 'lite') {
    this.quality = q
    const lite = q === 'lite'
    this.renderer.setPixelRatio(Math.min(lite ? 1 : 2, window.devicePixelRatio))
    this.key.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048)
    this.key.shadow.map?.dispose()
    this.key.shadow.map = null
    this.resize()
  }

  private resize() {
    const w = this.host.clientWidth || 300
    const h = this.host.clientHeight || 300
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.framed = null
  }

  /** Fit the camera to the whole movement, from a three-quarter view. */
  private frame() {
    const d = this.driver!
    const anim = this.anim!
    const box = d.bounds(anim, this.tempo, this.flip)
    const c = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const side = anim.view === 'side'
    this.mat.position.x = c.x
    const vfov = (this.camera.fov * Math.PI) / 180
    const needH = size.y * 1.15 + 24
    const needW = Math.max(size.x, size.z) * 1.1 + 24
    const dist =
      Math.max(needH / 2 / Math.tan(vfov / 2), needW / 2 / Math.tan(vfov / 2) / this.camera.aspect) +
      Math.max(size.x, size.z) * 0.15
    const az = side ? 0.62 : 0.42
    const target = new THREE.Vector3(c.x, c.y, 0)
    this.controls.target.copy(target)
    this.camera.position.set(target.x + Math.sin(az) * dist, target.y + dist * 0.2, Math.cos(az) * dist)
    this.controls.update()
    this.key.target.position.copy(target)
  }

  private frames = 0
  private fpsT = performance.now()
  private last = performance.now()
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = now - this.last
    this.last = now
    this.frames++
    this.stats.worst = Math.max(this.stats.worst, dt)
    if (now - this.fpsT > 1000) {
      this.stats.fps = Math.round((this.frames * 1000) / (now - this.fpsT))
      this.frames = 0
      this.fpsT = now
      this.stats.worst = 0
    }
    if (this.driver && this.anim) {
      const key = `${this.character}|${this.flip}`
      if (this.framed !== key || this.framedAnim !== this.anim) {
        this.frame()
        this.framed = key
        this.framedAnim = this.anim
      }
      const a = performance.now()
      const t = this.autoTime ? (now - this.t0) / 1000 : this.t
      this.driver.update(this.anim, t, this.tempo, this.flip)
      this.stats.poseMs = this.stats.poseMs * 0.95 + (performance.now() - a) * 0.05
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.stats.tris = this.renderer.info.render.triangles
  }
  private framedAnim: Anim | null = null

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
