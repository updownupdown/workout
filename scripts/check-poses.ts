// Floor-contact report for every keyframe in the move library.
// Usage: npx tsx scripts/check-poses.ts [moveId]
import { MOVES } from '../src/data/moves'
import { compile, place } from '../src/figure/anim'
import { ContactName, contactOf, solve } from '../src/figure/skeleton'

const ALL: ContactName[] = ['head', 'back', 'mid', 'pelvis', 'lElbow', 'rElbow', 'lHand', 'rHand', 'lKnee', 'rKnee', 'lHeel', 'rHeel', 'lToe', 'rToe']
const only = process.argv[2]
let problems = 0
for (const m of MOVES) {
  if (only && only !== 'all' && m.id !== only) continue
  const c = compile(m.anim)
  c.poses.forEach((pose, i) => {
    const rig = place(solve(pose, m.anim.view), m.anim.anchor)
    const gap = (n: ContactName) => { const k = contactOf(rig, n); return -(k.p.y + k.r) }
    const touching = ALL.filter((n) => gap(n) < 2.5)
    const declared = m.anim.contacts?.[i] ?? []
    const floating = declared.filter((n) => gap(n) >= 3).map((n) => `${n}+${gap(n).toFixed(0)}`)
    const flag = floating.length ? '  ✗ FLOAT ' + floating.join(' ') : ''
    if (flag) problems++
    if (only !== 'all' && !flag && only !== m.id) return
    console.log(`${m.id.padEnd(22)} f${i} rot=${pose.rot.toFixed(0).padStart(4)} touching: ${touching.join(',')}${flag}`)
  })
}
console.log(problems ? `${problems} keyframes with floating contacts` : 'all declared contacts touch the floor')
