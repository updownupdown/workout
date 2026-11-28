# Realistic 3D figure

The player always shows a 3D person; Settings → Figure picks Ava or Leo (the 2D mannequin is still used for small thumbnails, and as a fallback while the model loads or if WebGL is unavailable). Playground with every move: `https://updownupdown.github.io/workout/realistic.html`.

## What it is

- A rigged, textured human (two characters) rendered with three.js, driven by the **same pose data** as the 2D mannequin. Every move in the app plays; there is no per-move 3D animation work.
- Source: `src/figure/real/` (`rig.ts` retargeting, `dqs.ts` dual-quaternion skinning, `scene.ts` stage and loading), `src/figure/FigureReal.tsx` for the player, `src/realistic/` for the playground page. Asset pipeline: `scripts/realistic/`.

## How the pose data drives the rig

Moves are planar (side view = sagittal plane, front view = frontal plane). The 2D forward kinematics already give each body segment's angle, so each bone just turns by the change in its segment angle relative to the app's `NEUTRAL` pose:

```
boneWorld = Rz(-(θ_pose − θ_neutral)) · boneWorld_neutral
```

No per-bone axis conventions and no twist singularities. Then, per keyframe with ≥2 declared floor contacts, the whole-body rotation is re-solved against the actual skinned mesh (the model's arms are ~6 cm shorter than the 2D mannequin's), and each frame is grounded on the lowest skinned vertex and pinned at the move's anchor. Cost: ~0.4 ms per frame on CPU.

## Making poses physically plausible

The 2D keyframes are only a starting point. Three layers turn them into poses a real body could hold:

1. **3D extras in the pose data** (`Pose` in `figure/skeleton.ts`): `lShX/rShX`, `lHipX/rHipX` (limb out of the move's plane), `lShTw/rShTw`, `lHipTw/rHipTw` (twist), `twist` and `headTw` (upper body / head turn), `tilt` (whole-body lean out of plane) and `bendX` (trunk bend out of plane).
2. **Hand corrections** in `src/data/poses3d.ts` for things the 2D drawing faked: cross-legged sitting, butterfly, hugs and crossed arms in front view, hands behind the head or on the hips, the top of an upright row, arms resting on the floor when lying down, child's pose and pigeon. It can also add floor contacts (`touch`) and targets (`reach`: a hand, or with `from` any bone, kept a set distance from a bone, e.g. hands on knees, soles together).

   The limb values for the harder shapes (cross-legged, butterfly, hug, upright row, hands on hips) were fitted numerically to elbow/wrist or knee/ankle target positions on both bodies rather than guessed.

   In front view the rig also turns a bent leg out at the hip so the kneecap faces away from the shin and the foot follows the knee (warrior II, goddess, tree). A knee only hinges one way, so a knee bent in the frontal plane with the toes still facing the camera is not possible.
3. **Settle on the real mesh** (`figure/real/physics.ts`). For every keyframe a coordinate-descent optimiser minimises
   - floating floor contacts (declared parts must touch the floor),
   - balance: the centre of mass (Winter segment masses over the skinned vertices) must sit at least 2.5 cm inside the support polygon of the parts touching the floor,
   - clipping: capsules fitted to each body segment must not overlap (beyond 2 cm of soft tissue),
   - joint limits,
   - and the distance from the authored angles, so the move keeps its shape.

   Search directions include coupled moves that keep the feet flat (lean from the ankles, hips back, squat), the same move on both legs at once, and a sideways weight shift over one foot. Limb twists are free parameters too.

   Each keyframe is solved from two starts: as authored, and with the whole body's orientation held first so the limbs adapt before the body may roll. Rolling the whole body is cheap and otherwise wins too early (in hook-lying it lifted the hips off the floor instead of moving the feet). The better of the two is kept.

   Results are baked per body into `src/data/settled3d.ts`:

   ```
   npx vite --port 5173 &
   node scripts/realistic/bake-poses.cjs            # every move, both bodies (~40 min each)
   node scripts/realistic/bake-poses.cjs squat,plank # just these
   ```

   The file is rewritten after every move, so an interrupted run keeps its progress. To bake both bodies in parallel, give each run its own part file and merge (see the header of the script).

   The script prints the energy before and after, the balance margin, clip and float counts per keyframe.

## Costs

| | |
|---|---|
| Model download (per character) | ~0.6 MB: 0.18–0.2 MB geometry (glTF + meshopt) and ~0.4 MB WebP textures (1024² colour, normal, roughness for body and head) |
| Code | three.js core ~134 KB gzip (already shipped lazily for the 3D toggle) + ~26 KB gzip for loader, decoder and page |
| GPU | ~9k triangles, 3 draw calls, one 1024–2048² shadow map. Should hold 60 fps on any recent phone; the stats line on the page shows live fps |
| Offline | Not precached; cached by the service worker (CacheFirst) the first time a figure loads, then works offline |

## Licensing

Microsoft Rocketbox Avatar Library, MIT licence since Dec 2020 (commercial use allowed; keep the copyright notice). `public/realistic/LICENSE.txt` ships with the assets.

## Known limits / what "production" would add

- Skinning is dual-quaternion (GPU shader patch plus the same maths on the CPU for floor contacts), which removes the worst shoulder and hip pinching. Loose clothing (Leo's shorts) still flares in very deep hip flexion; corrective blend shapes would be the next step.
- Hands: the data only has wrist bend, so the forearm pronates as the wrist bends (palms flat for push-ups, down dog, planks); half the twist goes in the forearm, half at the wrist.
- Shoulders: collarbones lift slightly as arms go overhead; deep hip flexion tips the pelvis toward the thighs.
- Sided moves on the left side mirror the pose data (left and right swapped) rather than mirroring the mesh.
- Out-of-plane motion is limited to the extras above; feet can't turn out independently of the leg (e.g. the front foot in warrior II).
- Balance is checked at keyframes, not in between; fast moves (jumps, marching) are judged on their keyframes only.
- Hands are a fixed relaxed pose; no finger posing. Dumbbells and bands are not drawn yet.
- Muscle highlight would need a mask texture per muscle group.
- Rocketbox meshes are mid-poly (2010s game quality). A higher-end look means a custom character (e.g. MakeHuman/MPFB, CC0 output) at 2–4× the download.
