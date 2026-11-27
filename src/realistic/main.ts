import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { MOVE_BY_ID, CAT_META, MOVES, type Move } from '../data/moves'
import { Driver } from './rig'
import './realistic.css'

const BASE = import.meta.env.BASE_URL + 'realistic/'

const FEATURED = [
  'squat', 'push-up', 'glute-bridge', 'cat-cow', 'down-dog', 'warrior-2',
  'star-jacks', 'db-lunge', 'plank', 'mountain-climbers', 'cobra', 'child',
]

const CHARACTERS = {
  female: { label: 'Ava', hair: true },
  male: { label: 'Leo', hair: false },
} as const
type CharKey = keyof typeof CHARACTERS

// ---------------------------------------------------------------- DOM
const app = document.getElementById('app')!
app.innerHTML = `
  <div class="stage"><canvas></canvas><div class="loading">Loading figure…</div></div>
  <header class="top">
    <a class="back" href="./" aria-label="Back to Flow">‹ Flow</a>
    <div class="title">Realistic figure <span class="tag">Prototype</span></div>
    <div class="pills chars"></div>
  </header>
  <section class="panel">
    <div class="now"><span class="cat"></span><span class="name"></span></div>
    <div class="pills moves"></div>
    <div class="row">
      <select class="all" aria-label="All moves"></select>
      <button class="q" type="button"></button>
    </div>
    <div class="stats"></div>
  </section>`
const canvas = app.querySelector('canvas')!
const loadingEl = app.querySelector<HTMLDivElement>('.loading')!
const charsEl = app.querySelector<HTMLDivElement>('.chars')!
const movesEl = app.querySelector<HTMLDivElement>('.moves')!
const allEl = app.querySelector<HTMLSelectElement>('.all')!
const qBtn = app.querySelector<HTMLButtonElement>('.q')!
const statsEl = app.querySelector<HTMLDivElement>('.stats')!
const nowCat = app.querySelector<HTMLSpanElement>('.now .cat')!
const nowName = app.querySelector<HTMLSpanElement>('.now .name')!

// ---------------------------------------------------------------- renderer
const params = new URLSearchParams(location.search)
let quality: 'high' | 'lite' = params.get('q') === 'lite' ? 'lite' : 'high'

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const BG = new THREE.Color(0x0e1014)
scene.background = BG
scene.fog = new THREE.Fog(BG, 520, 1100)
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.55

const camera = new THREE.PerspectiveCamera(30, 1, 5, 3000)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.enablePan = false
controls.minDistance = 120
controls.maxDistance = 900
controls.maxPolarAngle = Math.PI / 2 - 0.03

// Lights: warm key with soft shadows, cool rim from behind, low fill.
const key = new THREE.DirectionalLight(0xfff1e2, 2.6)
key.position.set(220, 380, 300)
key.castShadow = true
key.shadow.bias = -0.0004
key.shadow.normalBias = 0.6
key.shadow.radius = 6
const sc = key.shadow.camera
sc.left = -200; sc.right = 200; sc.top = 220; sc.bottom = -120; sc.near = 50; sc.far = 1200
scene.add(key, key.target)
const rim = new THREE.DirectionalLight(0xa8c4ff, 2.2)
rim.position.set(-260, 260, -340)
scene.add(rim)
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x20242c, 0.35))

// Floor + exercise mat
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(900, 96),
  new THREE.MeshStandardMaterial({ color: 0x171a21, roughness: 0.95, metalness: 0 }),
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)
const MAT_H = 0.8
const mat = new THREE.Mesh(
  new RoundedBoxGeometry(190, MAT_H, 64, 2, 0.4),
  new THREE.MeshStandardMaterial({ color: 0x3b5a63, roughness: 0.85 }),
)
mat.position.y = MAT_H / 2
mat.receiveShadow = true
scene.add(mat)

// ---------------------------------------------------------------- model
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const texLoader = new THREE.TextureLoader()
const tex = (url: string, srgb = false) =>
  new Promise<THREE.Texture>((res, rej) =>
    texLoader.load(url, (t) => {
      t.flipY = true
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      res(t)
    }, undefined, rej),
  )

const cache = new Map<CharKey, Promise<Driver>>()
function loadCharacter(k: CharKey): Promise<Driver> {
  if (cache.has(k)) return cache.get(k)!
  const p = (async () => {
    const [g, bc, bn, br, hc, hn, hr, hair] = await Promise.all([
      gltf.loadAsync(`${BASE}${k}.glb`),
      tex(`${BASE}${k}_body_color.webp`, true),
      tex(`${BASE}${k}_body_normal.webp`),
      tex(`${BASE}${k}_body_rough.webp`),
      tex(`${BASE}${k}_head_color.webp`, true),
      tex(`${BASE}${k}_head_normal.webp`),
      tex(`${BASE}${k}_head_rough.webp`),
      CHARACTERS[k].hair ? tex(`${BASE}${k}_hair.webp`, true) : Promise.resolve(null),
    ])
    const skin = (map: THREE.Texture, normalMap: THREE.Texture, roughnessMap: THREE.Texture) =>
      new THREE.MeshPhysicalMaterial({
        map, normalMap, roughnessMap,
        normalScale: new THREE.Vector2(1, 1),
        roughness: 1,
        metalness: 0,
        sheen: 0.18,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(0xf2ddd2),
        specularIntensity: 0.55,
      })
    const body = skin(bc, bn, br)
    const head = skin(hc, hn, hr)
    const hairMat = hair
      ? new THREE.MeshStandardMaterial({ map: hair, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, alphaToCoverage: true })
      : null
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      const n = (m.material as THREE.Material).name
      if (n.endsWith('_head')) m.material = head
      else if (n.endsWith('_opacity') && hairMat) m.material = hairMat
      else m.material = body
    })
    const d = new Driver(g.scene)
    d.floorY = MAT_H
    return d
  })()
  cache.set(k, p)
  return p
}

// ---------------------------------------------------------------- state
let driver: Driver | null = null
let charKey: CharKey = (params.get('c') as CharKey) in CHARACTERS ? (params.get('c') as CharKey) : 'female'
let move: Move = MOVE_BY_ID[params.get('m') ?? ''] ?? MOVE_BY_ID.squat
let t0 = performance.now()

function frame(m: Move) {
  if (!driver) return
  const box = driver.bounds(m.anim, m.tempo)
  const c = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const side = m.anim.view === 'side'
  mat.position.x = side ? c.x : 0
  const aspect = camera.aspect
  const vfov = (camera.fov * Math.PI) / 180
  const needH = size.y * 1.15 + 24
  const needW = Math.max(size.x, size.z) * 1.1 + 24
  const dist = Math.max(needH / 2 / Math.tan(vfov / 2), needW / 2 / Math.tan(vfov / 2) / aspect) + Math.max(size.x, size.z) * 0.15
  const az = side ? 0.62 : 0.42
  const target = new THREE.Vector3(c.x, c.y, 0)
  controls.target.copy(target)
  camera.position.set(target.x + Math.sin(az) * dist, target.y + dist * 0.2, Math.cos(az) * dist)
  controls.update()
  key.target.position.copy(target)
}

function setMove(m: Move) {
  move = m
  t0 = performance.now()
  const meta = CAT_META[m.cat]
  nowCat.textContent = meta.label
  nowCat.style.color = meta.color
  nowName.textContent = m.name
  for (const b of movesEl.querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === m.id)
  allEl.value = m.id
  frame(m)
  syncUrl()
}

async function setChar(k: CharKey) {
  charKey = k
  for (const b of charsEl.querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === k)
  loadingEl.hidden = false
  const d = await loadCharacter(k)
  if (charKey !== k) return
  if (driver) scene.remove(driver.root)
  driver = d
  scene.add(d.root)
  loadingEl.hidden = true
  setMove(move)
  if (!firstLoad) firstLoad = performance.now()
}

function syncUrl() {
  const u = new URL(location.href)
  u.searchParams.set('m', move.id)
  u.searchParams.set('c', charKey)
  if (quality === 'lite') u.searchParams.set('q', 'lite')
  else u.searchParams.delete('q')
  history.replaceState(null, '', u)
}

function applyQuality() {
  const lite = quality === 'lite'
  renderer.setPixelRatio(Math.min(lite ? 1 : 2, window.devicePixelRatio))
  key.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048)
  key.shadow.map?.dispose()
  key.shadow.map = null
  qBtn.textContent = lite ? 'Quality: battery' : 'Quality: high'
  resize()
  syncUrl()
}

// ---------------------------------------------------------------- UI
for (const k of Object.keys(CHARACTERS) as CharKey[]) {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = CHARACTERS[k].label
  b.dataset.id = k
  b.onclick = () => setChar(k)
  charsEl.append(b)
}
for (const id of FEATURED) {
  const m = MOVE_BY_ID[id]
  if (!m) continue
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = m.name
  b.dataset.id = id
  b.onclick = () => setMove(m)
  movesEl.append(b)
}
allEl.innerHTML =
  '<option value="" disabled>All moves…</option>' +
  [...MOVES].sort((a, b) => a.name.localeCompare(b.name)).map((m) => `<option value="${m.id}">${m.name}</option>`).join('')
allEl.onchange = () => setMove(MOVE_BY_ID[allEl.value])
qBtn.onclick = () => {
  quality = quality === 'high' ? 'lite' : 'high'
  applyQuality()
}

function resize() {
  const r = canvas.parentElement!.getBoundingClientRect()
  renderer.setSize(r.width, r.height, false)
  camera.aspect = r.width / r.height
  camera.updateProjectionMatrix()
}
new ResizeObserver(() => {
  resize()
  if (driver) frame(move)
}).observe(canvas.parentElement!)

// ---------------------------------------------------------------- stats
const started = performance.now()
let firstLoad = 0
let frames = 0
let fpsT = performance.now()
let fps = 0
let worst = 0
let last = performance.now()
let rigMs = 0
function updateStats() {
  const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  let bytes = 0
  for (const r of res) if (r.name.includes('/realistic/')) bytes += r.transferSize || r.encodedBodySize || r.decodedBodySize || 0
  const tris = renderer.info.render.triangles
  const ms = firstLoad ? ((firstLoad - started) / 1000).toFixed(1) + ' s' : '…'
  statsEl.textContent = `${fps} fps (slowest ${worst.toFixed(0)} ms) · pose ${rigMs.toFixed(1)} ms/frame · ${(tris / 1000).toFixed(1)}k tris · ${(bytes / 1048576).toFixed(2)} MB model · ready in ${ms}`
}

// ---------------------------------------------------------------- loop
function loop(now: number) {
  requestAnimationFrame(loop)
  const dt = now - last
  last = now
  frames++
  worst = Math.max(worst, dt)
  if (now - fpsT > 1000) {
    fps = Math.round((frames * 1000) / (now - fpsT))
    frames = 0
    fpsT = now
    updateStats()
    worst = 0
  }
  if (driver) {
    const a = performance.now()
    driver.update(move.anim, (now - t0) / 1000, move.tempo)
    rigMs = rigMs * 0.95 + (performance.now() - a) * 0.05
  }
  controls.update()
  renderer.render(scene, camera)
}

applyQuality()
setChar(charKey)
requestAnimationFrame(loop)
