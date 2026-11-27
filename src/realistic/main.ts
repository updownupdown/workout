import { MOVE_BY_ID, CAT_META, MOVES, type Move } from '../data/moves'
import { CHARACTERS, RealScene, type Character } from '../figure/real/scene'
import './realistic.css'


const FEATURED = [
  'squat', 'push-up', 'glute-bridge', 'cat-cow', 'down-dog', 'warrior-2',
  'star-jacks', 'db-lunge', 'plank', 'mountain-climbers', 'cobra', 'child',
]

type CharKey = Character

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
      <button class="side" type="button"></button>
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
const sideBtn = app.querySelector<HTMLButtonElement>('.side')!
const statsEl = app.querySelector<HTMLDivElement>('.stats')!
const nowCat = app.querySelector<HTMLSpanElement>('.now .cat')!
const nowName = app.querySelector<HTMLSpanElement>('.now .name')!

// ---------------------------------------------------------------- scene
const params = new URLSearchParams(location.search)
let quality: 'high' | 'lite' = params.get('q') === 'lite' ? 'lite' : 'high'
const stage = canvas.parentElement!
canvas.remove()
const real = new RealScene(stage, { quality, autoTime: true })
const started = performance.now()
let firstLoad = 0
real.onReady = () => {
  loadingEl.hidden = true
  if (!firstLoad) firstLoad = performance.now()
}

let charKey: CharKey = (params.get('c') as CharKey) in CHARACTERS ? (params.get('c') as CharKey) : 'ava'
let move: Move = MOVE_BY_ID[params.get('m') ?? ''] ?? MOVE_BY_ID.squat
let flip = params.get('side') === 'left'

function setMove(m: Move) {
  move = m
  const meta = CAT_META[m.cat]
  nowCat.textContent = meta.label
  nowCat.style.color = meta.color
  nowName.textContent = m.name
  for (const b of movesEl.querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === m.id)
  allEl.value = m.id
  real.setMove(m.anim, m.tempo, flip)
  syncUrl()
}

function setChar(k: CharKey) {
  charKey = k
  for (const b of charsEl.querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === k)
  loadingEl.hidden = false
  real.setCharacter(k)
  syncUrl()
}

function syncUrl() {
  const u = new URL(location.href)
  u.searchParams.set('m', move.id)
  u.searchParams.set('c', charKey)
  if (quality === 'lite') u.searchParams.set('q', 'lite')
  else u.searchParams.delete('q')
  if (flip) u.searchParams.set('side', 'left')
  else u.searchParams.delete('side')
  history.replaceState(null, '', u)
}

function applyQuality() {
  real.setQuality(quality)
  qBtn.textContent = quality === 'lite' ? 'Quality: battery' : 'Quality: high'
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

sideBtn.onclick = () => {
  flip = !flip
  sideBtn.textContent = flip ? 'Side: left' : 'Side: right'
  setMove(move)
}
sideBtn.textContent = flip ? 'Side: left' : 'Side: right'

setInterval(() => {
  const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  let bytes = 0
  for (const r of res) if (r.name.includes('/realistic/')) bytes += r.transferSize || r.encodedBodySize || r.decodedBodySize || 0
  const st = real.stats
  const ms = firstLoad ? ((firstLoad - started) / 1000).toFixed(1) + ' s' : '…'
  statsEl.textContent = `${st.fps} fps · pose ${st.poseMs.toFixed(1)} ms/frame · ${(st.tris / 1000).toFixed(1)}k tris · ${(bytes / 1048576).toFixed(2)} MB model · ready in ${ms}`
}, 1000)

applyQuality()
setChar(charKey)
setMove(move)
;(window as unknown as { __real: RealScene }).__real = real
