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
| Keeping the connection handles between ticks | `c.conns` builds a handle per connection on every read (8% of the server's JavaScript time after this change). Holding them across calls depends on how long RivetKit keeps a handle valid, which its API does not say. (Kept in the third pass: on RivetKit 3.1.1 it could be tested.) |
| Writing a step straight to the raw state and asking for one save | Reading and writing the player through the proxy in `step` is about 6% of the server's JavaScript time. It would put two ways of writing state side by side in the hottest action. |

### Remaining recommendations

| Work | Why it remains separate | What it would buy |
| ---- | ----------------------- | ----------------- |
| Send `moves` at 5 Hz when the world is crowded | Messages, not CPU, are the limit, and the engine pays for each. Measured with `TICK_MS` at 200 (two pairs, 100 walking players): engine CPU 254% → 177%, server CPU 44.4% → 39.1%, messages per client 14.6 → 9.3 a second. But others' steps arrive up to 100 ms later, and your own steps come back up to 200 ms late: `reconcileSelf` would snap a runner back unless it learns which steps it already made. Needs a playtest on real hardware. | About a third fewer messages, so about half again as many players before the engine queues. |
| The engine's cost per message | The engine process uses 2.4 cores for 100 walking players and 13 or more at 200: five times this server's own CPU. It is RivetKit's, not ours. | Worth raising with RivetKit, with `load.ts` as the reproduction. |
| Fewer draws per person | `game.mjs --meshes` on Medium with 35 people in view: they are 154 of about 700 visible meshes. The eight who are animated are 64 limb batches; everyone else is one merged body; and every one of the 35 has a face drawn on its own, see-through, with its own texture. three.js allocates for every draw's uniforms: about a third of the frame loop's garbage before this pass, half of it after (2.5 of 5.1 MB/s). Faces in one atlas, drawn as one instanced mesh, is the first pass's "instanced billboards" recommendation with a number on it. | 34 fewer draws of about 540 with this crowd, and their share of the garbage. |

## Third pass: RivetKit 3, and the three recommendations above

From `10698f3` (release 1.19.0). The second pass ended on three recommendations; this one looked into each,
and moved the server from RivetKit 2.3.21 to 3.1.1. Server numbers are from `scripts/perf/load.ts` with
players walking, runs alternated between two checkouts (A B B A); client numbers from `scripts/perf/game.mjs`
on Medium with 40 walkers, on the same GPU-less machine as before.

### What happened to each recommendation

| Recommendation | Verdict | Evidence |
| -------------- | ------- | -------- |
| The engine's cost per message | **Gone with RivetKit 3.** | 100 players, two pairs: engine CPU 236% → 21%, an action's round trip 5.3 → 0.7 ms (p95 17 → 4), server CPU 43.9% → 37.6%, memory 541 → 380 MB, no errors. One run each further up: 200 players took 1,333% of engine CPU and a median round trip of 68 ms on RivetKit 2, 39% and 0.8 ms on 3. At 300 RivetKit 2 dropped connections; RivetKit 3 used 56% of a core, with no errors. |
| `moves` at 5 Hz when crowded | **Not built.** Its reason was the engine, and that is gone. | On RivetKit 3 at 300 players (two pairs, `TICK_MS` 200): server CPU 90.3% → 80.5%, messages per client 15.7 → 10.4 a second, round trips unchanged. That is about 40 more players before this process's core is full, and nothing at all below 300, for others' steps arriving up to 100 ms later. Building it also needs every tile of a run sent (a runner makes two steps in 200 ms, and the game draws a jump of two tiles as a teleport). Worth another look when 250 are online at once. |
| Faces in one atlas, one instanced draw | **Not built.** There is nothing there to win. | With every face hidden outright, the most any batching could save: the renderer's CPU per frame 7.1–8.6 ms with faces, 7.1–7.9 without; garbage 4.7–5.4 MB/s with, 4.8–5.2 without (two pairs, two observers each). About 25 fewer draws of 550. |

### Implemented

- **RivetKit 3.1.1.** One option was renamed (`envoy` → `node`); every transaction of ours has a name, which
  RivetKit 3 asks for. The engine's process helpers read `/proc`: the server image has neither `ps` nor
  `lsof`, so `stopEngine` had been doing nothing there.
- **The move from RivetKit 2's store** (`server/src/migrate/`). RivetKit 3 does not read it: on the volume as
  it is, the town would have come up empty. The first start copies every actor across and checks every table
  against what was sent. [ARCHITECTURE.md](ARCHITECTURE.md#serving) has how;
  [docs/development.md](docs/development.md#the-first-deploy-on-rivetkit-3) what to do before deploying.
- **The world keeps its joined connections itself** (`vars.tabs`). A send to one player's tabs asked RivetKit
  for every connection, a native call that builds a handle for each: a room change did it for each snapshot.
  The second pass left this alone because nothing said a kept handle stays valid. On 3.1.1 it does: a handle
  kept past its action still delivers, and one whose connection has gone takes a send and does nothing.

A bug turned up on the way and went in on its own (#178): the game took its own steps coming back from the
server as the server moving it, and with 300 ms to the server a runner was pulled back on 27 steps of 30.
Sending `moves` less often would have made it everyone's.

### Evidence

Two pairs each, median and range.

| 300 walking players, RivetKit 3 | Asking RivetKit for the connections | Kept in `vars.tabs` |
| ------------------------------- | ----------------------------------: | ------------------: |
| Tick p50 / p99, ms              |                         3.95 / 10.3 |           3.3 / 7.7 |
| Round trip p95, ms              |                    22 [21.7..22.3]  |    17 [16.9..17.0]  |
| Server CPU                      |                 93.9% [93.2..94.5]  | 90.5% [89.9..91.1]  |

The move, timed on this machine: a town of three players (6 actors, 217 rows) in 3 s; a store of 302 actors
and 996,000 rows (124 MB) in 97 s, into a new store of 295 MB. `server/test/migrate-v2.test.ts` moves a town
written by release 1.19.0 itself and asks it the same questions before and after, moves every awkward value
(integers past a double, reals, blobs, counters of deleted rows, tables without a rowid, a state of 300 KB),
and breaks a move halfway.

### Remaining recommendations

| Work | Why it remains separate | What it would buy |
| ---- | ----------------------- | ----------------- |
| Delete the migration | `server/src/migrate/`, the `rivetkit-v2` dependency (about 200 MB of the image) and the old store on the volume, once production has run on RivetKit 3 for a while. | A smaller image, and 20 s off the test suite. |

## Fourth pass: what RivetKit 3 deprecates, and what it adds

From `28e76c2`, in the same pull request as the third pass. Two rows of its table are settled here: the
actors no longer use anything RivetKit 3 deprecates, and "one send per room" was measured and not built.
Server numbers as before: `scripts/perf/load.ts`, 300 players walking, runs alternated between two checkouts.

### Implemented

- **The actors keep their own data** (`server/src/actors/kept.ts`). RivetKit 3 deprecates `c.state`,
  connection state and `run` as a plain function; `world`, `player`, `arcade` and `match` kept everything
  there, and four had a `run` loop. What an actor keeps is now a plain object in `c.vars`, written to its own
  SQLite as JSON rows, a row for each key and for each of the world's players, so a save writes what changed.
  Who a connection is sits in a map filled by `onConnect`; each loop starts in `onWake`.
  [ARCHITECTURE.md](ARCHITECTURE.md#actors) has how.
- **What an action changed is on disk before it answers**, in `player`, `arcade` and `match`: a browser
  session, a table, a move. RivetKit's state was written about a second later. The world still saves once a
  second, and when it stops.
- **The move from RivetKit 2 writes those rows itself**, so no actor wakes on RivetKit 3 to state it has
  to convert, and a value JSON can't hold stops the move while the old town is untouched.
- **`/metrics`**, for whoever holds `ADMIN_TOKEN`: RivetKit's Prometheus text, which on RivetKit 3 times
  every SQLite statement and transaction by actor.

### Evidence

Two pairs; every run of one side is below every run of the other.

| 300 walking players | RivetKit's state, behind its proxy | Kept in `c.vars`, saved as rows |
| ------------------- | ---------------------------------: | ------------------------------: |
| Server CPU          |                 85.6% [85.2..86.0] |              79.6% [79.3..79.8] |
| Tick p50 / p99, ms  |                          3.1 / 7.0 |                      2.75 / 5.8 |
| Round trip p95, ms  |                               15.8 |                            15.0 |
| Engine CPU          |                              51.8% |                           52.4% |

The world's save is in those numbers: once a second, a transaction of about 9 ms on RivetKit's SQLite
thread for 100 walkers (from `/metrics`), not on the world's own.

`server/test/restart.test.ts` kills the real server and its engine without warning and starts them again:
a session made the moment before, an open table and where someone stood a second and a half earlier are all
there, and so is a step taken the moment before a stop that was asked for. `kept.test.ts` covers the store
itself, and the move's tests the rows it writes.

### Tried and not kept

| Idea | What was measured | Why not |
| ---- | ----------------- | ------- |
| One broadcast per room: a room's `moves` under an event name of its own (`moves/town`), which RivetKit sends to whoever subscribed, in one call instead of one for each connection | Two pairs at 300: tick p50 2.8 → 2.2 ms, server CPU 81.7% → 80.9% [80.4..81.3 against 81.1..82.3] | The tick is shorter and the process no cheaper: the work is in sending to 300 sockets, wherever the loop over them runs. It would also let any connection subscribe to any room's name. |
| Forking an actor (new in RivetKit 3) as a restore point for `town` | On this server: 373 ms for a town of 150 players, 2.7 MB more on disk (it is copy-on-write), and the copy and the original stay apart | The copy is a second live `town`: it has the original's timers, anyone can reach it by its key, and what it does reaches the one `world`. A restore point wants the whole store, and forking a namespace is not in 3.1.1's engine yet (the request is refused). `proxy.ts` never forwarded forks; a test now says so. |
| RivetKit 3's SQLite profiling, to find a slow query | One load run, 100 walkers and 200 others: 9.5 s of SQLite in 14,800 operations, 73% of it in `player` | Nothing to fix. A player's first wake is the cost: its migrations run in a 9 ms transaction, and it is paid once per player per deploy. `town`'s statements are 1 to 2 ms each. It stays reachable at `/metrics`. |

### Remaining recommendations

| Work | Why it remains separate | What it would buy |
| ---- | ----------------- | ------- |
| Delete the migration | As in the third pass: once production has run on RivetKit 3 for a while. | A smaller image, and a minute and a half off the test suite's slowest file. |
| A restore point before each deploy | Forking the namespace copies every actor at one moment, copy-on-write. It needs an engine that has it, and somewhere to say which copy is live. | A way back from a bad migration of ours that doesn't cost a volume restore. |
| `moves` at 5 Hz when crowded | Unchanged from the third pass: about a tenth of the server's CPU at 300, for others' steps up to 100 ms later. | About 40 more players on this process's core. |
