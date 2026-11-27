import { Figure } from '../figure/Figure'
import { CAT_META, MOVES } from '../data/moves'

/** Dev-only contact sheet of every keyframe: open with ?poses */
export function PoseSheet() {
  return (
    <div className="pose-sheet">
      {MOVES.map((m) => (
        <div key={m.id} className="pose-row">
          <div className="pose-name">{m.name}</div>
          {m.anim.frames.map((_, i) => (
            <Figure
              key={i}
              anim={{ ...m.anim, frames: [m.anim.frames[i]], mode: 'hold', breathe: false }}
              t={0}
              tempo={1}
              accent={CAT_META[m.cat].color}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
