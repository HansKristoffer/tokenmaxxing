# 3D performance work

The original audit reviewed `8d44e58`. This implementation started from `17f5ea3`, with fresh CPU measurements against that revision, then incorporated the windmill, holiday calendar and star-counter and Tavern keynote updates from main. Conflict resolution later incorporated main through `62b0bdd`, including seasons, weather and street-lamp dimming. The goal is to reduce steady rendering work and retained room data while preserving the models, palette and cutaways.

## Implemented

- **Room lifetime:** remove the global arrays retaining every batch; dispose batch subscriptions, generated materials and frozen layers through normal object cleanup; release pending batch probes and night-glow registrations. The pipeline keeps one fill scene, releases its active-scene handle, and unregisters its debug renderer when destroyed. World eviction uses the same cleanup path.
- **Cutaways:** reuse a verdict until the player, camera, mesh transforms or geometry change. Keep easing the ring every frame. Large meshes use bounded triangle ranges sharing the original buffers, rejecting rays before triangle intersection. Lowered walls and hidden scenery still change the verdict.
- **Frame cadence:** 60 fps by default, with the existing uncapped override. After ten seconds without input or player activity, quiet scenes run at 30 fps. Input, movement, portals, games and the dungeon keep active cadence. Hidden documents skip both simulation and drawing. Scheduling retains 60 fps on 144 Hz displays without bursts after a stall; idle frames do not trigger governor downgrades.
- **Pet buffers:** index four corners per exposed voxel face, retaining triangle winding, colors and corner AO. Identical surfaces share buffers by grid content, origin, seed and shading options. Reference counts release them when the final mesh leaves. No global cache of unused pet geometry remains.
- **Daytime lighting:** hide zero-intensity furniture and outdoor point lights. Outdoor lights rejoin the light list as their nighttime intensity rises; fixtures and painted pools remain visible.
- **Rendering defaults:** High retains voxel geometry, AO, shadows, haze and grade, with a default density cap of 1.5 and 12 AO samples instead of 16. The density override and Ultra remain available. Medium retains its cheaper pixel style; its description now says so. Its internal scale changes continuously rather than rounding multiple governor steps to the same target.
- **Preparation:** skip detection for explicit tier choices and yield between synthetic benchmark draws. Prepare the nearest unfinished shop, one pet sculpture per slice; bound texture-upload slices by three milliseconds. Entering a partially prepared shop finishes and reuses it. Slice animation callbacks belong to the prepared room, and cancellation or leaving 3D releases unused work.
- **Tools:** apply texture caps before constructing rooms; expose `--live` actors and `--block` variants alongside the existing frozen/smooth budgets. Report logical geometry bytes, active lights and construction time. The game recorder separates drawn FPS from rAF cadence, reports actual target dimensions and GPU identity, waits for preparation, accepts a warmup duration and optionally reads GPU timer queries with disjoint samples discarded.

## Evidence

`bun scripts/perf/occlusion.ts` runs the real cutaway probes on 40 deterministic positions per room, with batching, frozen actors and the renderer's scene tracking enabled. It discards a journey before measuring settled probes, and measures stationary probes separately. These are local CPU measurements, not predicted device FPS. Other workloads on this machine affect timings.

| Room    | Before moving median / p95, ms | After moving median / p95, ms | After stationary median / p95, ms |
| ------- | -----------------------------: | ----------------------------: | --------------------------------: |
| Town    |                    2.37 / 4.74 |                   2.09 / 2.92 |                       0.28 / 0.37 |
| Clothes |                   6.50 / 11.65 |                   1.50 / 2.88 |                       0.55 / 0.85 |
| Pets    |                  25.46 / 37.49 |                   1.79 / 2.46 |                       0.39 / 0.44 |
| Tavern  |                  10.71 / 21.00 |                   0.38 / 0.71 |                       0.08 / 0.11 |

The first probe builds acceleration bounds and remains more expensive than settled probes. This implementation does not meet the original under-two-millisecond target at every town position.

The eight-scene browser retention experiment previously retained eight room roots after normal disposal and forced collection. The updated experiment retains zero room roots and zero scenes while the pipeline is still alive, without manually clearing internal caches. This isolates the reported retention paths; it does not prove an entire long game session has no other retaining paths.

The original High pet-shop audit counted roughly 91 MiB of unique geometry buffers. The updated content tool counts about 60 MiB with the same 351,876 triangles and 279 drawables. Buffer sizes include hidden sources and generated copies; they exclude cache keys, materials, driver overhead and the rest of the JS heap. The six new lifecycle, buffer, stationary-probe and default-cap regressions failed against the original source and pass with the changes.

Medium and High content budgets pass after incorporating main's fixed-noon sampling. The earlier seven-draw variability came from the street snail advancing with the live clock between batching samples. Pinning the measurement clock preserves deterministic sampling; the merged town records 318 draws on both tiers against the unchanged 320-draw limit. Seasonal budget tests also pass. The production game recorder completed both tiers without reported page errors. The tour now waits for the stage and fade to finish before sampling pixels. A settled High smoke journey through the Tavern, town and pet shop rendered all three scenes with no reported page errors. Chromium here uses **ANGLE SwiftShader**, and its short sample windows still include software shader/driver stalls despite warmup. Its FPS and GPU timings do not establish laptop, WebView or Android performance.

The full local run completed with 1,214 passes and 14 Rivet actor-response timeouts in unchanged server tests. A serial retry of those 14 cases passed 11, with three still failing in Rivet. After conflict resolution, the focused renderer/content, lighting, weather and seasonal run passed 106 tests, including the repeated live/frozen measurement regression. Typecheck, lint and the production build pass. These local timeouts are reported separately from the renderer results; CI remains the gate for the complete suite.

## Reproduce

```sh
bun run typecheck
bun run lint
bun test --timeout 60000 --parallel=2
bun run site:build
bun scripts/perf/counts.ts medium --check
bun scripts/perf/counts.ts high --check
bun scripts/perf/counts.ts high --live --block
bun scripts/perf/occlusion.ts
PLAYWRIGHT=/path/to/playwright/index.mjs bun scripts/perf/game.mjs --tiers medium,high --walkers 0 --warmup 8000 --ms 6000 --gpu --out /tmp/game-perf.json
```

The existing budgets count a whole room's smooth geometry with frozen actors, one pass, without camera culling or stage lighting. `--live` leaves actor geometry unmerged; it does not simulate a network crowd or a running raid. `--block` measures the voxel variant. Neither alternate mode is compared against the frozen/smooth budget. Each room measurement rebuilds the room so live/frozen modes remain independent. Build timings still benefit from process-wide kit and module caches. The runtime recorder's CPU throttle affects CPU execution, not GPU speed.

## Remaining recommendations

| Work                                                       | Why it remains separate                                                                                                                                                                                                                         | Acceptance before adopting it                                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screen-size pet LODs and greedy voxel merging              | Both can alter silhouettes, eyes, per-cell jitter and corner AO. This change preserves the exact sculptures and triangles.                                                                                                                      | Compare close, middle and distant views, shadows and animated transitions on target devices; record triangle and memory savings including retained LODs. |
| Stable nighttime point-light budget                        | Dropping useful lights changes indoor and nighttime art. Daytime zero-intensity slots are removed here.                                                                                                                                         | Measure nighttime GPU time and compare counters, entrances and fixtures before choosing the fixed set.                                                   |
| Atlas-backed instanced billboards and mannequin instancing | The pet keeper's name and animated bubble are only two of its shop's draws. Major remaining shop costs include hundreds of materials and articulated display parts; transparent sorting, text repaints and shelf picking need a dedicated pass. | Group live remaining draws by material and display type; preserve bubble timing, camera facing, transparency and picking.                                |
| Fully sliced room/stage construction and batching          | A time check between tasks cannot interrupt a whole town builder or one large batching call. Those still run synchronously; this PR limits the smaller slices and fixes ownership.                                                              | Split builders at useful boundaries and record cold/warm door long tasks, shader readiness and retained prefetched bytes.                                |
| Worker-based detection                                     | Yielding between samples cannot interrupt one slow draw/readback.                                                                                                                                                                               | Worker support and fallback in the macOS WebView and Android; no long main-thread benchmark task.                                                        |
| Startup import graph and company/crowd/live-raid budgets   | Room skin imports still join nominally lazy code into shared chunks; the headless sample town is not a representative large company fleet.                                                                                                      | Measure startup transfers and first room readiness; add representative content and settled live journeys before tightening budgets.                      |

Keep the current GPU power preference until dual-GPU measurements justify changing it. Validate the High density/AO defaults visually at native density, widest and closest zoom, and at night on an integrated-GPU laptop, Apple Silicon desktop WebView and a lower-end Android device. No real-device image-quality or battery-life claim is made by the software-rendered smoke run.

## Second pass: the world's tick and the frame loop

Started from `57bd40c`, on 2026-11-12. The first pass was the renderer; this one profiled the server under load and the game with a crowd, and changed what the profiles pointed at. Measured on a 64-core Linux server with no GPU (Chromium draws through SwiftShader) and other work running on it: the numbers compare two builds on that machine, run in alternation, and say nothing about a laptop's frame rate.

### Implemented

- **The world reads its state plainly.** RivetKit hands out `c.state` behind a write-through proxy, and `c.state`, `c.vars`, `c.conns` and `conn.id` are each a call into its native side. A tick asked all four again for every connection of every send, and every pass over the players wrapped each one in a proxy. The world now reads the raw state (`peek`; writes still go through `c.state`), looks the connections up once for everything a tick sends (`listeners`), and reads a caller without the proxy `conn.state` builds on each read (`callerOf`). When a player last did something moved from saved state to memory: it was a saved write on every step.
- **A room's `moves` are written once.** An event object is encoded again for every connection it is sent to. Clients now join with `join(MOVES_TEXT)` and get each tick's moves as one string per room (`writeMoves`), smaller than the object was. A tab from before the change joins without the argument and gets the object as before.
- **A room's chat is read from SQLite once.** Every snapshot (each door, each join) read the room's last 50 lines. A few hundred joins at once overflowed SQLite's queue, and those players got no room. The lines are kept in memory after the first read and `announce` adds to them.
- **Cutaways.** The probe's nine rays were cast at every see-through-capable mesh in the room. They all run within 0.4 units of one line, so meshes whose bounding sphere is not near that line are left out first; a handful remain. The per-mesh version check no longer builds a string per ray.
- **Frame loop.** `stage.ts` copied every avatar into an array and sorted the last 60 frame gaps on every animation frame, including the ones it then skipped. `entities.ts` built a list, a map of string keys and an array per avatar every frame. They reuse their lists now, and the meter's p95 is worked out twice a second.
- **Frame cadence, dozed off.** A busy scene kept 60 fps for as long as the page was visible. After three minutes without input (when the world marks you dozing) it runs at the quiet 30 fps whatever is going on in it, until the next input.
- **Tools.** `load.ts` reads CPU time from `/proc` on Linux (`ps` counts whole seconds there: steps of 3 points over a 30 s run) and writes its rows with `--json`. `occlusion.ts` prints what the probe decided at each stop. `game.mjs --meshes` says what the people are drawn as.

### Evidence

**The world under load**: `bun scripts/perf/load.ts --n 100 --secs 30` (100 players walking, 200 offline of whom 100 sync), `57bd40c` and this change in alternation, three pairs. Every pair went the same way for every row marked.

| 100 walking players       | Before (median, range) | After (median, range) | Change        |
| ------------------------- | ---------------------: | --------------------: | ------------- |
| Tick, median, ms          |          4.5 (4.2–4.7) |         1.7 (1.7–1.7) | −62%, 3 of 3  |
| Tick, p99, ms             |      13.4 (11.3–13.5) |         3.5 (3.4–3.9) | −72%, 3 of 3  |
| Server process CPU, %     |      49.1 (49.1–49.2) |      44.5 (43.8–45.0) | −9%, 3 of 3   |
| Step round trip, p95, ms  |      19.1 (18.5–19.7) |      17.6 (17.3–18.7) | −6%, 3 of 3   |
| Bytes per client, KB/s    |          3.3 (3.1–3.6) |         2.8 (2.8–3.2) | −9%, 3 of 3   |
| Server memory, MB         |          560 (547–567) |         525 (524–540) | −5%, 3 of 3   |
| Engine process CPU, %     |          240 (237–254) |         245 (240–271) | none          |
| Messages per client, /s   |                   14.2 |                  14.4 | none          |
| Errors                    |                      0 |                     0 |               |

One run each at 200 walking players, where the engine is past its message limit: the step round trip was 3.75 s median and 15 s p95 before, with 69 snapshots lost to SQLite's queue; after, 68 ms median and 1.55 s p95, with none lost (tick 6.1 → 2.6 ms median). A single run is an indication, not a measurement. At 300 both builds lose their connections to the engine during the join storm; the SQLite errors (170 before) are gone.

The changes were measured one at a time on the way. Plain reads, one lookup and `lastInput` in memory: tick 4.3 → 2.7 ms, three of three pairs. Moves written once on top of that: 2.7 → 1.6 ms, three of three, with server CPU unchanged (44.5 → 44.5).

**The cutaway probe**: `bun scripts/perf/occlusion.ts`, three runs of each build in alternation; the decision at each of 40 stops per room is the same in both.

| Room    | Moving median before, ms | Moving median after, ms |
| ------- | -----------------------: | ----------------------: |
| Town    |         1.32, 1.20, 1.55 |        0.68, 0.59, 0.58 |
| Clothes |         1.36, 1.29, 1.29 |        0.57, 0.56, 0.56 |
| Pets    |         1.29, 1.28, 1.25 |        0.61, 0.63, 0.63 |
| Tavern  |         0.30, 0.30, 0.30 |        0.15, 0.15, 0.15 |

A probe that finds nothing changed costs what it did (0.06 to 0.43 ms): that is the walk over the room and the comparison.

**The game with a crowd**: `bun scripts/perf/game.mjs --tiers medium,medium,high --walkers 40 --warmup 6000 --ms 10000 --alloc`, the production build of each, run before, after, after, before; two Medium observers per run, so four readings a side. No page errors in any run.

| Medium, town, 44 people            |                 Before |                  After |
| ---------------------------------- | ---------------------: | ---------------------: |
| Garbage, MB/s                      | 8.66, 8.92, 8.70, 8.96 | 5.54, 5.06, 5.89, 5.16 |
| Renderer CPU a frame, median, ms   |    8.3, 8.9, 8.4, 10.0 |     8.3, 7.6, 7.9, 8.0 |
| Renderer CPU a frame, p95, ms      | 15.0, 15.8, 15.3, 17.8 | 14.1, 12.8, 13.3, 15.1 |

The frame loop makes about 40% less garbage in every reading (on High, at about 15 software-rendered frames a run: 2.27 and 2.72 MB/s before, 1.56 and 1.79 after). Its CPU time is lower in most readings, but the two sides overlap: taken as not worse, no more. The dozed-off cadence is not in these numbers: the recorder sends input every two seconds. `web/test/cadence.test.ts` holds it to 30 frames a second.

### Tried and not kept

| Idea | What happened |
| ---- | ------------- |
| `moves` as JSON text | Tick 2.7 → 1.7 ms, but bytes per client went from 3.7 to 5.3 KB/s (+43%) and server CPU did not move. The compact text replaced it. |
| Keeping the connection handles between ticks | `c.conns` builds a handle per connection on every read (8% of the server's JavaScript time after this change). Holding them across calls depends on how long RivetKit keeps a handle valid, which its API does not say. |
| Writing a step straight to the raw state and asking for one save | Reading and writing the player through the proxy in `step` is about 6% of the server's JavaScript time. It would put two ways of writing state side by side in the hottest action. |

### Remaining recommendations

| Work | Why it remains separate | What it would buy |
| ---- | ----------------------- | ----------------- |
| Send `moves` at 5 Hz when the world is crowded | Messages, not CPU, are the limit, and the engine pays for each. Measured with `TICK_MS` at 200 (two pairs, 100 walking players): engine CPU 254% → 177%, server CPU 44.4% → 39.1%, messages per client 14.6 → 9.3 a second. But others' steps arrive up to 100 ms later, and your own steps come back up to 200 ms late: `reconcileSelf` would snap a runner back unless it learns which steps it already made. Needs a playtest on real hardware. | About a third fewer messages, so about half again as many players before the engine queues. |
| The engine's cost per message | The engine process uses 2.4 cores for 100 walking players and 13 or more at 200: five times this server's own CPU. It is RivetKit's, not ours. | Worth raising with RivetKit, with `load.ts` as the reproduction. |
| Fewer draws per person | `game.mjs --meshes` on Medium with 35 people in view: they are 154 of about 700 visible meshes. The eight who are animated are 64 limb batches; everyone else is one merged body; and every one of the 35 has a face drawn on its own, see-through, with its own texture. three.js allocates for every draw's uniforms: about a third of the frame loop's garbage before this pass, half of it after (2.5 of 5.1 MB/s). Faces in one atlas, drawn as one instanced mesh, is the first pass's "instanced billboards" recommendation with a number on it. | 34 fewer draws of about 540 with this crowd, and their share of the garbage. |
