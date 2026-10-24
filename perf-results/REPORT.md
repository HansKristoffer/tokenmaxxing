# 3D performance report

Harness: `bun scripts/perf-harness.mjs` on the demo (`web/demo3d.html`, port 4652), headless Chromium on Metal, 1280x720, fixed
seed and camera, 4 s per run after a 2.5 s warm-up, one machine. Draw calls and triangles are what one frame submits (shadow
passes included) and do not depend on the machine; times and GPU/heap numbers are for comparing runs on this machine only.
Raw runs: `baseline.json` (the original, before any performance work), `pass1.json` (the first pass: batching, cheaper boxes,
light cache, tick scoping), `after.json` (now), `crowd.json`, `soft-pass1.json` / `soft-now.json` (software GL).

Styles: `hd` and `pixel` are the classic look, `voxel0/1/2` the Voxel look at quality 0/1/2 (what Medium/High/Ultra were before
tiers), `medium`, `high`, `ultra` the graphics tiers as the game applies them (`applyGraphics`, the demo's `?tier=`).

## Original → first pass → now

Each cell reads `original → first pass → now (change from the original)`. The last column of a row is frame time p50/p95 of the
original and of now.

| room | style | draws | tris K | GPU MB | cpu p50 ms | frame p50/p95 ms |
|---|---|---|---|---|---|---|
| town | hd | 11236 → 977 → 778 (-93%) | 2040 → 708 → 452 (-78%) | 222 → 133 → 133 (-40%) | 16.5 → 3.9 → 2.2 (-87%) | 20.3/25.6 → 2.8/8.5 |
| town | pixel | 11240 → 1052 → 779 (-93%) | 2043 → 718 → 453 (-78%) | 207 → 114 → 114 (-45%) | 15.9 → 4.2 → 2.1 (-87%) | 20.5/28.6 → 2.6/6.6 |
| town | voxel0 | 5749 → 777 → 515 (-91%) | 547 → 363 → 189 (-65%) | 114 → 114 → 115 (+1%) | 9.3 → 2.9 → 1.6 (-83%) | 12.8/18.7 → 2/5.5 |
| town | voxel1 | 5747 → 751 → 530 (-91%) | 549 → 360 → 191 (-65%) | 118 → 120 → 121 (+3%) | 9.4 → 2.7 → 1.6 (-83%) | 13.3/16.9 → 2/7.6 |
| town | voxel2 | 5759 → 802 → 532 (-91%) | 549 → 366 → 191 (-65%) | 253 → 258 → 260 (+3%) | 9.9 → 3.2 → 1.9 (-81%) | 14.8/18.6 → 2.4/8.2 |
| inn | hd | 4653 → 814 → 590 (-87%) | 596 → 191 → 136 (-77%) | 210 → 83 → 90 (-57%) | 6.5 → 2.3 → 1.5 (-77%) | 7.5/14.6 → 1.7/5.4 |
| inn | pixel | 4652 → 812 → 592 (-87%) | 596 → 191 → 137 (-77%) | 196 → 64 → 72 (-63%) | 6.3 → 2.2 → 1.5 (-76%) | 7.4/14.4 → 1.7/2.5 |
| inn | voxel0 | 2400 → 675 → 401 (-83%) | 158 → 120 → 71 (-55%) | 84 → 69 → 76 (-10%) | 3.8 → 1.8 → 1.2 (-68%) | 4/8.6 → 1.4/4.5 |
| inn | voxel1 | 2403 → 646 → 390 (-84%) | 158 → 117 → 69 (-56%) | 88 → 75 → 82 (-7%) | 3.9 → 1.8 → 1.4 (-64%) | 4.1/10.1 → 1.6/2.7 |
| inn | voxel2 | 2413 → 654 → 400 (-83%) | 159 → 117 → 72 (-55%) | 228 → 213 → 221 (-3%) | 4.1 → 2.2 → 1.5 (-63%) | 4.6/13.4 → 1.7/6.9 |
| basement | hd | 5931 → 1024 → 903 (-85%) | 949 → 207 → 171 (-82%) | 208 → 339 → 85 (-59%) | 7.6 → 2.5 → 2.3 (-70%) | 8.9/17.7 → 2.6/7.6 |
| basement | pixel | 5931 → 1022 → 1054 (-82%) | 949 → 207 → 173 (-82%) | 193 → 255 → 66 (-66%) | 7.6 → 2.7 → 2 (-74%) | 9.1/16.9 → 2.2/6.7 |
| basement | voxel0 | 2994 → 682 → 580 (-81%) | 221 → 133 → 99 (-55%) | 83 → 260 → 72 (-13%) | 5.1 → 2.1 → 1.8 (-65%) | 6.7/13.9 → 2.2/8.7 |
| basement | voxel1 | 3001 → 682 → 740 (-75%) | 221 → 133 → 102 (-54%) | 86 → 266 → 78 (-9%) | 4.8 → 2.1 → 1.8 (-62%) | 8/16.2 → 2.1/7.8 |
| basement | voxel2 | 2995 → 670 → 609 (-80%) | 221 → 133 → 99 (-55%) | 227 → 470 → 217 (-4%) | 5.1 → 2.4 → 2.4 (-53%) | 7/15.5 → 2.8/10.6 |
| shop-clothes | hd | 8916 → 2348 → 813 (-91%) | 822 → 429 → 386 (-53%) | 201 → 102 → 119 (-41%) | 13.4 → 6.2 → 2.6 (-81%) | 19.8/25 → 3.3/10.3 |
| shop-clothes | pixel | 6674 → 2346 → 849 (-87%) | 603 → 429 → 386 (-36%) | 171 → 83 → 100 (-42%) | 20.4 → 6.6 → 2.7 (-87%) | 150.8/150.8 → 2.9/7.7 |
| shop-clothes | voxel0 | 4537 → 1625 → 578 (-87%) | 302 → 271 → 237 (-22%) | 97 → 88 → 104 (+7%) | 8.3 → 4.7 → 2.1 (-75%) | 11/16.5 → 2.6/9 |
| shop-clothes | voxel1 | 4542 → 1638 → 557 (-88%) | 302 → 274 → 235 (-22%) | 99 → 94 → 111 (+12%) | 8.6 → 5.2 → 2.1 (-76%) | 13.7/17.9 → 2.3/9.2 |
| shop-clothes | voxel2 | 1536 → 1631 → 500 (-67%) | 328 → 271 → 237 (-28%) | 216 → 232 → 250 (+16%) | 4.7 → 5.5 → 2.1 (-55%) | 10.8/17.6 → 2.5/10.3 |
| dungeon | hd | 3174 → 1354 → 985 (-69%) | 1145 → 305 → 242 (-79%) | 225 → 85 → 93 (-59%) | 5.1 → 3.1 → 2 (-61%) | 7.8/15.6 → 2.2/8.1 |
| dungeon | pixel | 2136 → 1362 → 975 (-54%) | 772 → 307 → 241 (-69%) | 174 → 66 → 75 (-57%) | 9.1 → 3.1 → 1.9 (-79%) | 176.4/176.4 → 2/3.3 |
| dungeon | voxel0 | 1604 → 915 → 650 (-59%) | 300 → 209 → 148 (-51%) | 91 → 72 → 80 (-12%) | 2.9 → 2.4 → 1.5 (-48%) | 3.2/9.4 → 1.7/6.7 |
| dungeon | voxel1 | 1599 → 921 → 645 (-60%) | 300 → 210 → 146 (-51%) | 95 → 78 → 87 (-8%) | 3 → 2.4 → 1.7 (-43%) | 3.3/7.8 → 1.9/6.4 |
| dungeon | voxel2 | 1607 → 913 → 653 (-59%) | 300 → 208 → 147 (-51%) | 235 → 216 → 226 (-4%) | 3.5 → 2.6 → 1.8 (-49%) | 3.9/10.9 → 2/7.4 |

Reading it: draw calls are down 54-93% from the original and mostly 10-65% from the first pass (the basement's animated crowd is the exception); the town went 11,236 → 977 → 781 in the
classic look and 5,759 → 802 → 529 in the Voxel look, the clothes shop 8,916 → 2,348 → 813. Triangles drop again (the baked shadow
map stops redrawing every static caster each frame). CPU time per frame is down 43-87%. The Voxel rows' GPU MB is the shadow map
and the multisampled target, which the tiers now size (below).

## The tiers, every room

| room | tier | draws | tris K | GPU MB | cpu p50 / p95 ms | frame p50 / p95 ms |
|---|---|---|---|---|---|---|
| town | medium | 293 | 151 | 36 | 1.2 / 2.1 | 1.5 / 2.6 |
| town | high | 426 | 167 | 122 | 1.7 / 2.8 | 2.1 / 6.3 |
| town | ultra | 552 | 193 | 292 | 2 / 2.9 | 2.6 / 10.1 |
| inn | medium | 209 | 41 | 23 | 1 / 2.3 | 1.1 / 2.5 |
| inn | high | 299 | 57 | 83 | 1.3 / 2.3 | 1.5 / 2.7 |
| inn | ultra | 393 | 69 | 253 | 1.8 / 2.6 | 2 / 6.5 |
| upstairs | medium | 156 | 28 | 20 | 0.8 / 2.5 | 1 / 2.7 |
| upstairs | high | 237 | 46 | 78 | 1.2 / 2.5 | 1.4 / 3.1 |
| upstairs | ultra | 289 | 59 | 248 | 1.5 / 2.4 | 1.7 / 4.2 |
| basement | medium | 264 | 50 | 22 | 1.1 / 2.6 | 1.4 / 2.8 |
| basement | high | 581 | 84 | 79 | 1.7 / 4.7 | 2.1 / 9.7 |
| basement | ultra | 982 | 106 | 249 | 2 / 5.8 | 2.5 / 11.6 |
| shop-furniture | medium | 254 | 46 | 32 | 1.1 / 2.6 | 1.3 / 3 |
| shop-furniture | high | 307 | 81 | 96 | 1.5 / 2.7 | 1.8 / 6.2 |
| shop-furniture | ultra | 342 | 91 | 266 | 2.2 / 3.7 | 2.5 / 9.5 |
| shop-clothes | medium | 402 | 131 | 52 | 1.6 / 2.5 | 1.8 / 5.7 |
| shop-clothes | high | 424 | 186 | 111 | 1.9 / 2.9 | 2.1 / 7 |
| shop-clothes | ultra | 636 | 234 | 281 | 2.6 / 3.5 | 3 / 9.7 |
| dungeon | medium | 187 | 80 | 28 | 0.9 / 2.6 | 1.1 / 2.8 |
| dungeon | high | 500 | 124 | 87 | 1.7 / 2.8 | 1.9 / 3.4 |
| dungeon | ultra | 653 | 146 | 257 | 2 / 2.9 | 2.3 / 8.7 |
| hq | medium | 107 | 30 | 21 | 0.6 / 2.5 | 0.7 / 2.7 |
| hq | high | 168 | 48 | 80 | 0.9 / 2.6 | 1.1 / 2.9 |
| hq | ultra | 204 | 60 | 250 | 1.3 / 2.4 | 1.6 / 3 |
| office | medium | 135 | 24 | 19 | 0.8 / 2.5 | 0.9 / 2.7 |
| office | high | 180 | 35 | 76 | 1 / 2.5 | 1.1 / 2.7 |
| office | ultra | 226 | 43 | 247 | 1.3 / 2.5 | 1.5 / 3.1 |

Medium is the light one (classic look at 0.75 scale, silhouette lines, a blob under each person, no AO, plain boxes, 1024 px
surfaces): 107-402 draw calls and 24-131 K triangles per frame in every room, under 1.6 ms of CPU, 19-52 MB of GPU memory.

## Worst case: the town with 40 people and 13 pets

`EXTRA='&crowd=40' bun scripts/perf-harness.mjs --rooms town --styles medium,high,ultra --check`. Every person wanders; past the
tier's `crowd` (8 / 16 / 32 nearest the middle) the rest are drawn frozen.

| town, 40 people + 13 pets | draws | tris K | GPU MB | heap MB | cpu p50 / p95 ms | frame p50 / p95 / p99 ms |
|---|---|---|---|---|---|---|
| voxel1 | 1561 | 367 | 138 | 455 | 4.8 / 6.4 | 6.3 / 10.7 / 18.1 |
| medium | 705 | 237 | 50 | 417 | 2.8 / 3.7 | 3.4 / 7.3 / 9.2 |
| high | 1135 | 281 | 138 | 444 | 3.9 / 5.5 | 4.7 / 9.5 / 13.6 |
| ultra | 1766 | 362 | 307 | 444 | 5.5 / 6.8 | 7.2 / 12.7 / 20.6 |

`FRAME_BUDGETS` and `CROWD_FRAME_BUDGETS` (`web/src/render3d/perf/budgets.ts`) are set just above these and `--check` fails above them.

## A weak machine: software GL

`--gl swiftshader --viewport 960x540`, CPU rasterisation, so fill rate and shader cost dominate the way they do on an old integrated
GPU. `fps` is frames over the 8 s window.

| room | style | first pass: fps, draws | now: fps, draws | |
|---|---|---|---|---|
| town | hd | 6.75, 941 | 9.25, 796 | x1.4 |
| town | voxel1 | 8, 712 | 9.75, 589 | x1.2 |
| town | medium | (no Medium tier yet) | 27.63, 303 |  |
| basement | hd | 12.13, 1026 | 13.75, 958 | x1.1 |
| basement | voxel1 | 11.88, 700 | 15.38, 579 | x1.3 |
| basement | medium | (no Medium tier yet) | 60.63, 260 |  |
| shop-clothes | hd | 9, 2471 | 10.5, 1015 | x1.2 |
| shop-clothes | voxel1 | 9.75, 1641 | 13.25, 657 | x1.4 |
| shop-clothes | medium | (no Medium tier yet) | 38.63, 391 |  |

The Voxel look is bound by shading every pixel of the scene pass (lit toon with shadow lookups: over 90% of a 100-150 ms
frame here), and that did not change, so High gains 1.1-1.4x. Medium, which draws at 0.75 scale in 4 px blocks without shadows, runs 3-5x
faster than the first pass's best (27-60 fps where everything else is 9-15 fps).

## What each item did (measured)

| # | item | measured | kept |
|---|---|---|---|
| 1 | AO in its own half-size pass, bilateral upsample in the composite, one full-size post pass | AO fragment work is a quarter (640x360 for 1280x720), the pass costs 2 ms of ~135 on software GL; the GPU effect is below this machine's timer noise, the picture matches (against the first pass, `perf-diff` averages 2-4 of 255 per pixel and 0.4-1.7% of pixels differ visibly, most of that people standing elsewhere) | yes |
| 2 | Static shadow map drawn once, small live map for people/walls, blob discs on Medium | town triangles per frame 367 K → 170 K, draws 797 → 566 on Ultra; static map redraws ~once per 2-3 s in the town (`last.staticBakes`), 6 in the first 10 s in the basement, then none | yes |
| 3 | InstancedMesh for repeated props | not done. Static batching already folds every repeated prop into one draw per cell and material, so instancing would turn those into one draw per prototype (more draws, same triangles); `BAKE_CELL` 8/16/32 moves the town between 565, 537 and 545 draws, so repeated props are not what is left. What is left is people, pets and animated things | no |
| 4 | See-through meshes batched (one batch per opacity and cell, placed at its centre so blending order holds) | town 547 → 512 draws, Tavern 581 → 367 together with freezing | yes |
| 5 | Freezing idle people/pets, crowd budget, off-screen skip | shop-pets 937 → 286, shop-clothes 886 → 431, inn 581 → 367 static draws; the town with 40 people on the q=2 look 1,717 → 1,441 draws as the crowd budget and far-person freezing went in, 1,135 on High; people's animation is skipped outside the frustum | yes |
| 6 | Lazy rooms, chunked build, LRU with eviction, idle preload of a room's doors | per-room code split: dungeon 63 KB, Tavern 33 KB, basement 18 KB, company house 10 KB (minified) fetched on demand; first frame needs the town only. Smaller than hoped: the shop storefronts share a module with their interiors, so shops stay with the town, and three.js (0.42 MB) dominates. `world.load` builds tile rooms in 6 ms slices | yes |
| 7 | Basement | see below: a measurement artifact, plus pass 1 bugs found on the way | fixed |
| 8 | Textures | small nearest-filtered pictures atlased (shop-barber 320 → 261 draws, furniture 238 → 213); smooth surfaces capped per tier (town ground 1888 px → 1024 on Medium: 14 MB → 4 MB); evicted rooms free their maps | yes |
| 9 | Allocation | town 47 MB/s → 26 MB/s of garbage: see-through double-sided materials no longer flip `needsUpdate` twice a frame (8 MB/s of program lookups), `#rrggbb` colours looked up (4 MB/s), constants not re-parsed each frame, no iterator in the tick loop; the rest (15 MB/s) is three.js boxing uniforms per draw call, proportional to draws. Sleeping batch sources are no longer walked by `updateMatrixWorld`: 24% of the town's JS time in a 40-person profile. DOM labels are written at a third of the rate when the camera is still, and only when they moved a pixel | yes |
| 10 | Budgets | per tier (`medium`, `high`; Ultra is High) and per frame, enforced by the test and `--check` | yes |

## The Basement regression

The first pass's report showed the basement's GPU memory up 63-214% (and the pixel, voxel0 and voxel2 draws not falling like the
other rooms'). Findings:

- **GPU memory was never real.** The probe (`scripts/perf/probe.js`) estimated a texture's mipmap chain by multiplying its size by 1.34 on
  every `generateMipmap` call, so a texture re-generated every frame (the basement's screens and marquees are canvas textures that
  tick) grew without bound: 60 MB at 2 s, 250 MB at 6 s, 2 GB at 10 s while `renderer.info` said 54 textures the whole time. The probe now
  computes the chain from level 0. Same run now: basement hd 85 MB, voxel0 72, voxel1 78, voxel2 217 against the original's
  208 / 83 / 86 / 227 (the town's is 133 / 115 / 121 / 260). The live texture count after 50 room switches is flat
  (`perf-leak.mjs`).
- **Draw calls**: the basement runs the most animated people of any room (typing at the PCs, dancing, the barkeep), and animated
  people cannot be merged. The first pass could not see that, because its limb batches did not follow their person (below). Typing is
  now frozen like standing, the crowd budget freezes the farthest ones, and the shadow pass draws only people and the walls. 5,931 →
  1,024 → 903 on hd, 2,995 → 670 → 609 on voxel2. The run-to-run spread in the basement (580-740 on the voxel rows) is the
  scripted crowd's poses at the moment of the run.

## Bugs in the first pass, found and fixed on the way

- Batches of things that move were pinned in world space: an avatar's limb batches and a lowering wall's batch had
  `matrixWorldAutoUpdate = false` set on the batch meshes, so they stayed where the avatar stood when it was baked (the stray black
  cubes and dark heads in the first pass's screenshots). Batches of moving roots now ride along.
- The budget test measured tile-drawn stand-ins, not the real rooms: the hand-built skins were only registered by a module the test
  never imported, so the shops "cost" 40 draw calls and 2,000 triangles (really 213-431 and 68-130 K). The test now builds the
  real skins (a stub browser, `render3d/perf/stubs.ts`) and counts people and pets the way the player sees them (frozen).
- Gear that animates (capes, auras) was batched into its limb in the pose it had at warm-up while standing; the batching now samples
  a walk and a stand through the avatar and leaves the parts that move alone.
- `perf-audit.mjs` compared world matrices of sleeping sources, which say nothing, and crashed when a room batched more layers while
  it waited; it now compares each piece to its layer's root.

## What is not done

- InstancedMesh (item 3): measured above, it would add draws, not remove them.
- Shop interiors are not a separate chunk from the town: `town3d.ts` imports the shop specs for the storefronts, and the spec modules
  hold exterior and interior together. Splitting them is a mechanical change in `shops/*.ts`.
- Moving people (walking, dancing, in the crowd's near half) are still ~10 draw calls each, twice with the live shadow map; merging a
  limb-animated person needs skinning (one mesh, bones), which the toon batching does not do.
- The 120 small smooth (linear-filtered, mipmapped) textures of the clothes shop are not atlased: bleeding between tiles would need
  padded gutters and a mip chain per tile.
- The software-GL numbers say the Voxel look at full resolution is fill bound; a weak GPU should land on Medium or a lower
  `renderScale` (the governor does that), not on a cheaper High.
