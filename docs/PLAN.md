# Flow: plan and visual approach

A phone-first, installable PWA that builds a random follow-along session (yoga, strength, pilates, core, stretching, breathwork) so you never have to think about what comes next. No accounts, no health metrics, nothing leaves the device.

## 1. Product shape

**Core loop:** pick time + focus, tap **Build**, glance at the list (swap anything you dislike), tap **Start**, follow the figure and the voice.

| Screen | Purpose |
| --- | --- |
| Home | Time (10/20/30/45), focus (Balanced, Strength, Flow, Calm), intensity (Gentle/Steady/Strong), dumbbells toggle, voice toggle, quick starts. An animated figure rotates through moves so the app feels alive. |
| Preview | Session as a timeline grouped into Arrive → Warm up → Main set → Cool down → Rest. Per-row swap, whole-session shuffle, one big Start button. |
| Player | Full-screen stage with the animated figure, move name, rotating form cue, rep counter or countdown ring, pause/skip/back, "Then: …" peek, story-style progress bar for the whole session. Landscape/desktop switches to a two-column layout. |
| Done | Short wrap-up (time, moves, categories). Repeat or build a new one. |
| Library | Every move with an animated preview and cues. |

**Hands-free by design:** each step starts with a 7-second "get ready" window where the figure demonstrates how to enter the pose (with a faint ghost of the target pose), the voice announces it, and three ticks count you in. Holds announce "halfway"; reps announce "last one". Screen stays awake (Wake Lock). Tapping the stage pauses; the session pauses automatically if you leave the app. Space / ← / → / Esc work on desktop.

## 2. The session generator

Seeded random (mulberry32), so a session can be reproduced from a number.

1. **Recipe per focus** decides the time split and category weights. E.g. Balanced: 1 breath opener, 15% warm-up, main set weighted strength 3 / yoga 2.5 / core 2 / pilates 1.5, 15% cool-down, closing rest. Strength runs the main set as **two rounds**. Calm opens with two breath exercises and leans on stretches.
2. **Fill by time budget.** Each move costs (work time + 7 s transition) × sides. Weighted picks fill each block without repeats. Intensity scales reps/holds (×0.75 / ×1 / ×1.3) and nudges toward easier or harder moves. Dumbbell moves only appear when the toggle is on (and are favoured when it is).
3. **"Gravity ordering".** Within each block, moves are sorted by body position: standing → kneeling → all fours → prone → seated → supine, shuffled within a position and avoiding the same focus area twice in a row. You go down to the floor once and stay there, instead of bouncing up and down.
4. **Sided moves** expand into right then left, with "Switch sides" between them; the figure mirrors for the left side.
5. **Swap** replaces a move with another from the same family, preferring the same body position so the flow stays smooth.

## 3. Visuals: the big decision

### Options considered

| Approach | Look | Asset sourcing & licensing | Size / perf | Authoring a new move | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A. Data-driven 2D mannequin (SVG, forward kinematics)** | Clean, calm, "illustrated app" feel. Side or front view. | None needed: poses are a dozen joint angles we write ourselves. Zero licensing risk. | ~0 KB of assets, the whole app is 84 KB gzipped. Smooth on any phone. | Minutes: type 2–4 keyframes, check the contact sheet. | **Chosen for v1** |
| B. 3D rigged human (three.js + glTF) | Most realistic, can orbit the camera. | Mixamo animations are free to use but you may not redistribute the raw files, and a PWA serving .glb files is effectively redistribution. CC0 rigs (e.g. Quaternius) exist but yoga/pilates clips basically don't; we'd have to animate in Blender or capture with video-to-mocap tools. | three.js ~150 KB + 1–3 MB per model + clips. Heavier on battery; fine on modern phones. | Hours per move (Blender keyframing or mocap cleanup). | Great v2 upgrade, not the starting point |
| C. Lottie / Rive illustrations | Beautiful, illustrated. | Every move needs a commissioned or bought animation; stock packs rarely cover 40+ consistent moves, styles clash. | 20–100 KB per move. | Designer-only. | Too much asset work for a personal app |
| D. Video / GIF of a real person | Most literal. | Filming ourselves or licensing stock. | MBs per move, offline caching hurts. | Film and edit. | Breaks the "no thinking, consistent style" goal |
| E. AI-generated pose images | Varied. | Licensing murky, consistency poor, no motion. | Medium. | Prompting roulette. | No |

### Why the mannequin wins now, and how it grows into 3D

The key insight is to treat **poses as data**, not as pictures. Each move is a few keyframes of joint angles (torso, spine bend, head, shoulders, elbows, wrists, hips, knees, ankles). The engine:

- runs forward kinematics to place limbs,
- **auto-grounds** the figure on the floor every frame (whatever is lowest touches the floor),
- pins an **anchor joint** (feet for squats, hands for climbers, knees for kneeling) so the body doesn't slide,
- **auto-frames** the camera from all keyframes,
- tweens with easing, loops one cycle per rep at the move's tempo, or flows into a hold and then "breathes",
- draws far-side limbs in a muted tone and near-side limbs in the category colour for depth, and can show a ghost of the target pose.

Because the angles are anatomical (hip flexion, shoulder flexion…), the **same pose data can later drive a 3D rig**: map each angle to a bone rotation on a CC0 glTF mannequin and render with three.js, keeping the 2D renderer as the low-power fallback. No pose authoring is thrown away.

### Creative extras on the roadmap

- **Breath orb**: already in. A glowing orb expands and contracts with the breath pattern (box, 4-7-8, coherent, physiological sigh) while the seated figure's shoulders rise and fall.
- **Muscle glow**: tint the working limbs per move (e.g. glutes on bridges).
- **Camera turns**: for moves that read better from another angle, cross-fade between side and front view mid-hold.
- **Tempo cues on the body**: a small pulse on the moving joint at the top of each rep.
- **3D upgrade** (v2): orbitable mannequin driven by the same data, lazy-loaded only on capable devices.
- **Pose authoring tool**: a dev page with sliders per joint that exports keyframes (the `?poses` contact sheet already exists for checking).

## 4. Tech

- Vite + React + TypeScript, `vite-plugin-pwa` (auto-updating service worker, full offline precache, installable manifest, maskable icons).
- Web Speech API for voice, Web Audio for chimes, Wake Lock API to keep the screen on. All fail-soft.
- Settings in `localStorage`. No backend.
- GitHub Actions builds on every push to `main` and deploys to GitHub Pages.

### Code map

- `src/figure/skeleton.ts`: pose model, forward kinematics, grounding.
- `src/figure/anim.ts`: keyframes, tempo, auto-framing.
- `src/figure/Figure.tsx`: SVG renderer.
- `src/data/moves.ts`: the move library (45 moves) with cues, timing and keyframes.
- `src/engine/generator.ts`: recipes, budget fill, gravity ordering, swaps.
- `src/engine/cues.ts`: voice, chimes, wake lock.
- `src/screens/*`: Home, Preview, Player, Done, Library, PoseSheet (dev).

## 5. Next steps

1. Pose polish pass on a real phone (a few poses like butterfly and knees-to-chest read weakly).
2. More moves: lunges with dumbbells, goblet squat, pigeon, happy baby, supine twist, side-lying leg lifts, swimming, teaser.
3. Session "vibes": a theme per session (hips, back care, core burner) layered on top of focus.
4. Optional background music bed and a "voice style" choice (calm vs. coach).
5. Optional, local-only "favourites" and "never show me this move" (no health data).
6. 3D renderer experiment behind a toggle.
