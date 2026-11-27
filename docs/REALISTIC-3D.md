# Realistic 3D figure (prototype)

In the app: Settings → Figure → 3D, then pick Ava, Leo or the simple Mannequin. Playground with every move: `https://updownupdown.github.io/workout/realistic.html`.

## What it is

- A rigged, textured human (two characters) rendered with three.js, driven by the **same pose data** as the 2D mannequin. Every move in the app plays; there is no per-move 3D animation work.
- Source: `src/figure/real/` (`rig.ts` retargeting, `dqs.ts` dual-quaternion skinning, `scene.ts` stage and loading), `src/figure/FigureReal.tsx` for the player, `src/realistic/` for the playground page. Asset pipeline: `scripts/realistic/`.

## How the pose data drives the rig

Moves are planar (side view = sagittal plane, front view = frontal plane). The 2D forward kinematics already give each body segment's angle, so each bone just turns by the change in its segment angle relative to the app's `NEUTRAL` pose:

```
boneWorld = Rz(-(θ_pose − θ_neutral)) · boneWorld_neutral
```

No per-bone axis conventions and no twist singularities. Then, per keyframe with ≥2 declared floor contacts, the whole-body rotation is re-solved against the actual skinned mesh (the model's arms are ~6 cm shorter than the 2D mannequin's), and each frame is grounded on the lowest skinned vertex and pinned at the move's anchor. Cost: ~0.4 ms per frame on CPU.

## Costs

| | |
|---|---|
| Model download (per character) | ~0.6 MB: 0.18–0.2 MB geometry (glTF + meshopt) and ~0.4 MB WebP textures (1024² colour, normal, roughness for body and head) |
| Code | three.js core ~134 KB gzip (already shipped lazily for the 3D toggle) + ~26 KB gzip for loader, decoder and page |
| GPU | ~9k triangles, 3 draw calls, one 1024–2048² shadow map. Should hold 60 fps on any recent phone; the stats line on the page shows live fps |
| Offline | Not precached by the service worker; the prototype loads on demand |

## Licensing

Microsoft Rocketbox Avatar Library, MIT licence since Dec 2020 (commercial use allowed; keep the copyright notice). `public/realistic/LICENSE.txt` ships with the assets.

## Known limits / what "production" would add

- Skinning is dual-quaternion (GPU shader patch plus the same maths on the CPU for floor contacts), which removes the worst shoulder and hip pinching. Loose clothing (Leo's shorts) still flares in very deep hip flexion; corrective blend shapes would be the next step.
- Hands: the data only has wrist bend, so the forearm pronates as the wrist bends (palms flat for push-ups, down dog, planks); half the twist goes in the forearm, half at the wrist.
- Shoulders: collarbones lift slightly as arms go overhead; deep hip flexion tips the pelvis toward the thighs.
- Sided moves on the left side mirror the pose data (left and right swapped) rather than mirroring the mesh.
- Out-of-plane motion: data is 2D, so no twisting, rotation or crossing the midline. Some moves would need a third angle per joint.
- Hands are a fixed relaxed pose; no finger posing. Dumbbells and bands are not drawn yet.
- Muscle highlight would need a mask texture per muscle group.
- Rocketbox meshes are mid-poly (2010s game quality). A higher-end look means a custom character (e.g. MakeHuman/MPFB, CC0 output) at 2–4× the download.
