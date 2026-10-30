# Christmas (Jul) seasonal theme: design

Status: design only. Nothing here is implemented. Names follow the repo's conventions (`halloween.ts` is the template).

## 0. What exists, and what this adds

Already in the game, so we extend rather than duplicate:

| Existing | Where | Consequence for this theme |
|---|---|---|
| Snow over the whole town all December, whatever the weather | `core/src/december.ts` `decemberSnow`, wired in `web/src/game/sky.ts` | Do NOT add snow. The theme adds *snow on roofs/props* only if `snow.ts`'s cover doesn't already do it (it does for baked sprites; 3D roofs: verify). |
| Julekalender: 24 doors, 1-24 Dec, server-claimed once per user per day (gifts: coins, Hygge moustache, Danish flag cap, Cykelhjelm, Julehue) | `core/src/december.ts` `DOORS`, `server/src/town/julekalender.ts` | The advent-calendar *reward* already exists and is server-backed. Our build-up is the *visual* sibling and links to it (section 7). |
| Julefrokost in the Tavern, Fri/Sat evenings up to the 23rd | `december.ts` `julefrokostOn` | Reuse for tavern decor; no new logic. |
| J-dag / Nissebryg truck, first Friday of November | `core/src/jdag.ts`, `web/src/game/jdag.ts`, `web/src/art/jdag.ts`, `web/src/render3d/town/truck3d.ts` | Its palette (RED `#b3262e`, GREEN `#2f6b3a`, CREAM `#fbf7ef`, bulbs `#ff5a5a #f5d14a #5fd38a #6fb4ff`) and the fairy-light-on-the-roof idea are the house style. Reuse the exact constants. |
| Julehue (`hat.12`, "Nisse-issue"), sold in the Clothes shop, door 24 gift | `core/src/headwear.ts`, `web/src/art/headwear.ts:112`, `web/src/render3d/people/gear3dHead.ts:631` | The nisse hat is DONE. Only a Santa hat is new. |
| Holiday costumes on sale 14 days before to 2 after, `COSTUME_BASE = 200` | `core/src/costumes.ts` | Add Christmas costumes here; they auto-appear 10 Dec to 26 Dec. |
| `HOLIDAYS.christmas` = Juleaften, 24 Dec | `core/src/holidays.ts` | The anchor for `near`/`daysFrom`. |
| Pumpkins as scenery on door-adjacent grass, from the clock and map | `core/src/halloween.ts`, `web/src/game/halloween.ts`, `web/src/render3d/town/pumpkins3d.ts` | Copy this pattern one-for-one (core spots function + 2D draw + 3D class, all gated by one `...Out(ms)`). |
| New Year fireworks at midnight 31 Dec | `core/src/newyear.ts` | Out of scope; the theme ends the 26th so the two do not overlap. |

## 1. Window, mood, palette

### Window (exact)

**18 December 00:00 to 25 December 23:59, Copenhagen clock.** That is `near("christmas", ms, 6, 1)` (6 days before Juleaften, plus the 25th as "Juledag"). Eight days, so eight build-up stages. Rationale: Danes celebrate on the evening of the 24th, and the 25th/26th are the family days, so the town stays dressed through the 25th and is bare on the 26th. (The julekalender runs 1-24 Dec and the shop's costumes from 10 Dec: both are wider and unaffected.)

```ts
// core/src/christmas.ts (new)
export const CHRISTMAS = { before: 6, after: 1 } as const;
export const christmasOn = (ms: number): boolean => near("christmas", ms, CHRISTMAS.before, CHRISTMAS.after);
/** 0..7: which day of the build-up it is (18 Dec = 0, 25 Dec = 7); null outside the window. */
export function stage(ms: number): number | null {
  return christmasOn(ms) ? daysFrom("christmas", ms) + CHRISTMAS.before : null;
}
/** 0..1 within the whole window, for continuous things (tree glow density). */
export const buildUp = (ms: number): number => ... // (stage + dayFraction) / 7.5, using minutesFrom("christmas", ms)
export const EVE = (ms) => daysFrom("christmas", ms) === 0; // 24th: peak
```

Dev override already exists: `?sky=2026-12-24T17:00` (see `web/src/game/december.ts` header). Every feature below reads `skyNow()`, never `Date.now()`, so it is testable the same way.

### Mood

Danish *hygge* Christmas, not Coca-Cola Santa. Dark blue afternoons (sunset ~15:30 in Aarhus: the existing night tint does the work), warm candle-yellow windows, real wax candles and paper hearts, red-and-white, pine green. The joke register matches the repo: nisse who "wants his risalamande", a tree that gains ornaments as the team ships. Warm points of light against cold blue-white snow is the whole look: **every addition should be either a warm light or a red/white/green object**.

### Palette

| Role | Hex | Notes |
|---|---|---|
| Julerød (red) | `#b3262e` | = `RED` in jdag art; shadow `#8c1d24` |
| Pine | `#2f6b3a` | = `GREEN`; light `#3f8a4c`, dark `#1f4a29` |
| Cream / snow-white | `#fbf7ef` | = `CREAM`; cold snow `#f4f8ff` (matches `snow.ts` grass) |
| Candle gold | `#ffd45a` | window/flame glow; bloom `255,214,110` for `drawGlow` |
| Warm bulb white | `#ffe9b0` | fairy-light base |
| Bulb set | `#ff5a5a #f5d14a #5fd38a #6fb4ff` | reuse `BULBS` from `art/jdag.ts` (export it) |
| Ornament gold / silver | `#e8c44a` / `#c9d3dc` | tree baubles |
| Kraft / gift brown | `#b98a5a` | tags, nisse sack |
| Nisse grey | `#8d949c` | the traditional grey nisse coat (distinct from Santa red) |
| Night sky tint | no change | keep the engine's tint; lights read better on it |

## 2. Town scenery

All scenery follows the pumpkin pattern: a pure `...Spots(map)` in core (tiles, from the map), a 2D draw in `web/src/game/christmas.ts`, a 3D class in `web/src/render3d/town/christmas3d.ts`, all gated by `christmasOn(skyNow())`, scenery that **blocks nothing** (except the tree trunk tile). Lights switch on with the street lamps (`candlesLit` in `game/halloween.ts` is the reference for "after dark").

### 2.1 The Christmas tree (centrepiece, day-by-day ornaments)

- **Where:** the square. CORE rows (`core/src/maps.ts`, `CORE`) have the fountain `FF` at x=10-11,y=3-4, benches `B` at x=7 and 12, statue `♛` at (6,5). Plant the tree at **tile (10, 6)**, directly south of the fountain, on the plaza axis between the two lamps (clear in the map). It blocks one tile (the trunk). A 2D tile char is not needed: `blocksTree(x,y)` like `blocksTruck` in `game/jdag.ts`, registered where `blocksTruck` is.
- **Ornament schedule** (`treeStage(ms)` = `stage(ms)` + 1, i.e. 1..8 sets):
  - Stage 0 (18th): bare tree, one star-less top, no lights. "Someone delivered a tree."
  - Each day adds one *set* in a fixed, seeded order (hash of index, like `pumpkins` `big`): day 1 string lights lower third; day 2 red baubles; day 3 gold baubles; day 4 lights upper half; day 5 julehjerter (red/white woven hearts); day 6 flag garland (Danish *flagranke*, red-white paper flags); day 7 silver tinsel and the star; day 8 / the 24th evening: **all candle-lights lit + star glows**.
  - Hourly refinement: within a day, ornament count of that day's set fills in `ceil(frac * n)` so it grows through the day (use `minutesFrom`), so a returning player *sees it change*. Cheap: a `n = stage*K + floor(frac*K)` ornament index list, first `n` of a seeded shuffle visible.
- **The 24th at 18:00 (Danish "juleaften" dinner time):** a one-shot flourish: tree lights pulse once, star flares, a short chime (existing audio `playChime`-style helper; find via `grep playChime web/src/game`). Purely local, triggered when `minutesFrom("christmas") crosses 18*60`.
- 3D recipe in section 3.1; 2D in section 4.

### 2.2 String lights on buildings

- **Which:** every roofline and the eave of each house: the Tavern `I`, companies `D`, the four shops (`SHOP_DOOR_CHAR`, `shoprooms.ts`). Same door list as `halloween.ts` (`DOORS = ["I","D",...Object.values(SHOP_DOOR_CHAR)]`): reuse it by exporting it.
- **Build-up:** the lit fraction of the string grows with the stage: `lit = clamp((stage+1)/8)`; bulbs are on in a *deterministic order* along the string from the door outwards, so by the 24th the strings are complete. Bulbs not yet lit are plain dark wire/dim bulbs (still visible so the structure reads).
- **3D:** reuse the bunting machinery: `web/src/render3d/town/bunting3d.ts` already makes `Bunting {a,b,sag}` strings as two merged meshes. Write `lightStrings(strings)` beside it: cord (same) + one `THREE.InstancedMesh` of tiny spheres (r 0.05, 5 segments) with per-instance colour from `BULBS`. Lit/unlit = instance colour brightness toggled when the lamps come on or the stage changes (only on change, not per frame). Twinkle: scale one of every 4 bulbs by `0.8 + 0.2*sin(t*3+i)` in an existing `ticks` entry (`kit.ts` `Tick`).
- **2D:** `lightRoof(g, house, lit, now)` draws a row of 1px bulbs along the roof and `drawGlow(...,7,"255,190,140", strength*0.5*flicker(now,i))` exactly as `lightTruck` does for the truck.

### 2.3 Wreaths on doors

- One wreath on each door above (same door list; for the Tavern also a larger one). Green torus with 3 red berries and a red bow.
- Day-by-day: wreaths all appear on day 0 (they are the "it has begun" signal); the bow gets a gold ribbon tail on the 24th.
- 3D: section 3.3, merged into the door group in `town3d-houses.ts` (where the lintel/sign is built; keep it one merged mesh via `mergeStill`).

### 2.4 Snow on roofs

- Winter snow already whitens baked 2D sprites (`web/src/game/snow.ts`, `GROUND` map) and December forces it. So 2D roofs get it for free. **Check** `town3d-houses.ts`: if 3D roofs don't have a snow cap, add one (a white chamfered box slightly larger than the roof ridge, `snowAmount` fades it). That is a December fix, not Christmas-only; flag it, but don't gate it on the window.
- Christmas-only addition: a thicker "icing" cap in the window (`+0.06` height) and a few icicles (tiny inverted cones, `#e6f2ff`, 3-5 under each eave). Skip on the cheap rung (see ranking).

### 2.5 Candles in windows

- Danish classic: a single (electric, but drawn as a flame) candle in each window facing the street. In the window: yellow rectangle 2x4 px + 3px flame; 3D: a `glow("#ffd45a")` ball r=0.04 on a cream cylinder 0.02x0.18 on the sill.
- Count grows by stage: window k of N is lit if `hash(window)%8 <= stage`. By the 24th every window has one. Flicker via `flicker(now,i)` (`game/glow.ts`).
- Wiring: houses already light windows at night for the sky tint (grep `windowsLit` or the night-window code in `town3d-houses.ts`); piggyback on its window list rather than finding windows again.

### 2.6 Danish touches (cheap, characterful)

| Touch | What | Where |
|---|---|---|
| **Julehjerter** | Woven paper hearts, red/white, hung from the tree and in a garland over the Tavern door. Texture: 6x6 checker of `#b3262e/#fbf7ef`, a heart-shaped plane + handle loop. | `art/christmas.ts`, `christmas3d.ts` |
| **Nisse** | Small grey nisse (section 3.4) sits by one door per house: *grey*, red cap, with a bowl of risalamande. A bowl reading "Risalamande" is the reward joke. | scenery spots like pumpkins |
| **Risalamande** | At the Tavern the julefrokost dish list already has it. Add: the tap serves a *mandel* joke on the 24th ("someone found the almond: marzipan pig"), reusing `julefrokostDish`'s style: extend `julefrokostOn` to include the 24th at 18:00+ via a sibling `julaftenDinner(ms)` rather than editing the Friday/Saturday rule. | `december.ts` |
| **Flagranke** | Red-white paper-flag garland on the tree (day 6). | tree |
| **Adventskrans** | A wreath with 4 candles on the Tavern bar. Lit count = Sundays since 1 Dec (1-4). Pure clock; no state. | Tavern decor |
| **Æbleskiver / gløgg stall** | One stall in the square 18-24th, selling nothing, E for a line of dialogue; steam particles reuse the coffee stand's. Cheap flavour. | optional |
| **Julemærke** | The Christmas seal (Julemærket) as an inventory trinket: not now. | skip |

## 3. New 3D models (Model-kit recipes)

API from `web/src/render3d/kit/kit.ts`: `m.box([w,h,d], paint, [x,y,z], r)`, `m.cyl(radius, h, paint, at, topRadius, seg)` (a taper if `top` differs), `m.ball(r, paint, at, scale, seg)`, `m.plane(w,h,paint,at)`, `m.part(at, turn)` for sub-groups. `paint` is a hex string (toon) or a material (`glow(hex)` for unlit/emissive, `glass(...)`). Units: 1 world unit = 1 tile (TILE=16 px). Origin on the ground, +y up, facing +z unless noted. Same pattern as `truckModel()`: a function returning a `Model`, built once, `mergeStill(model)` at 50,0,50 and moved back; each material one colour so it batches. All pieces `userData.nopick` except the tree (E interact).

### 3.1 `treeModel(stage)` (the tree, 1 tile, ~2.4 tall)

Geometry (built once; ornament *sets* are separate merged groups toggled by `visible`):

- Pot/trunk: `cyl(0.14, 0.3, "#6b4a2a", [0,0.15,0], 0.12, 8)`; tub `cyl(0.3, 0.22, "#b3262e", [0,0.11,0], 0.26, 10)`; white snow disc `cyl(0.27, 0.02, "#f4f8ff", [0,0.23,0])`.
- Foliage, 5 stacked tapered cones (each `cyl(rBottom, h, color, at, rTop)` with `seg=10`):
  1. `cyl(0.62, 0.55, "#2f6b3a", [0,0.62,0], 0.34, 10)`
  2. `cyl(0.52, 0.5, "#2f6b3a", [0,1.02,0], 0.28, 10)`
  3. `cyl(0.42, 0.46, "#3f8a4c", [0,1.38,0], 0.22, 10)`
  4. `cyl(0.32, 0.42, "#2f6b3a", [0,1.7,0], 0.14, 10)`
  5. `cyl(0.2, 0.36, "#3f8a4c", [0,2.0,0], 0.02, 10)`
  - Snow flecks (optional): 6 `ball(0.06, "#f4f8ff", ..., [1,0.5,1], 6)` on branch tips.
- Star: `ball(0.09, glow("#ffd45a"), [0,2.28,0], [1,1,0.35], 5)` (flat, 5 seg reads as a star at this size) plus two crossed `box([0.22,0.04,0.04], glow("#ffd45a"))` rotated 45 degrees.
- Ornament sets (each a `Model` child, toggled on `stage`):
  - Baubles: 12 per colour set, `ball(0.05, color, p, [1,1,1], 6)` at positions on cone surfaces (`r = coneRadius(y)*0.92`, angle `i*2.4`, golden angle, gives an even spread). Colours: red `#b3262e`, gold `#e8c44a`, silver `#c9d3dc`.
  - Lights: 22 `ball(0.04, glow(c), p, [1,1,1], 5)`, spiral from y=0.5 to y=2.0 (`a = y*9`, `r = coneRadius(y)+0.02`). One material per colour (4 colours from `BULBS`) so they merge into 4 meshes; "off" bulbs use `toon("#3b3a40")` instead of `glow`.
  - Julehjerter: 8 `plane(0.1,0.1, heartTexture)` double-sided, hanging on the front half, small `box([0.01,0.06,0.01], cream)` string.
  - Flagranke: a `Bunting` string (reuse `buntingMeshes`) wrapped as 3 sagging arcs at heights 0.8/1.2/1.6, with two-colour pennants.
  - Tinsel: 3 thin torus (`THREE.TorusGeometry(r,0.015,4,16)`, rotated flat) in silver at y 0.8, 1.3, 1.7.
- Cost: ~120 meshes before merging, ~10 draw calls after. Lights flicker through the shared `ticks` list only for the 4 light-colour meshes (scale the *material*, not the instances: change `emissive`/colour brightness).

### 3.2 `lightStringModel(points)` (string lights)

- Input: a polyline in world space (roof edge). Cord: same as bunting (`TubeGeometry`, or two-tri ribbon, r=0.008, `#1b1a1f`).
- Bulbs: `InstancedMesh(new THREE.SphereGeometry(0.05,5,4), glow("#ffffff"), n)`, spacing 0.32 along the cord, hanging 0.06 below, per-instance `setColorAt` cycling `BULBS`. Unlit bulbs use brightness `*0.25`. Update on stage/lamps change only.
- Alternative for the truck-style rooflines: copy the `truckModel` loop `m.ball(0.045, bulbs[i%4], [x, y, z], [1,1,1], 6)` (non-instanced; fine for the dozen houses).

### 3.3 `wreathModel()` (door wreath, 0.5 across)

- Ring: `THREE.TorusGeometry(0.2, 0.06, 6, 16)` mesh with `toon("#2f6b3a")`; rotation.x = 0 so the ring faces +z. A second slightly smaller/offset torus `(0.2, 0.045)` in `#3f8a4c` rotated 12 degrees about z for depth.
- Berries: 5 `ball(0.028, "#b3262e", ..., [1,1,1], 5)` around the ring at radius 0.2, z=+0.05.
- Bow: two `box([0.12,0.07,0.03], "#b3262e")` angled +/-30 degrees, centre `ball(0.03, "#b3262e")`, two tails `box([0.04,0.16,0.02], "#b3262e")` angled +/-12 degrees below.
- On the 24th add a `glow("#ffd45a")` tiny ball in the centre (a ribbon bell).

### 3.4 `nisseModel()` (the nisse, ~0.5 tall, tile scenery or NPC)

The traditional farm nisse: grey coat, red pointed cap, big white beard, no visible face except a nose.

- Boots: two `box([0.08,0.07,0.1], "#2b2433", [+/-0.06,0.035,0.01])`.
- Body: `cyl(0.15, 0.26, "#8d949c", [0,0.2,0], 0.1, 8)`. Belt `cyl(0.155,0.03,"#2b2433",[0,0.12,0])`.
- Head hidden by beard: beard `cyl(0.13, 0.3, "#fbf7ef", [0,0.34,0.04], 0.04, 8)` squashed `scale z 0.8`; nose `ball(0.035, "#f2c29b", [0,0.45,0.13])`.
- Cap: `cyl(0.14, 0.26, "#b3262e", [0,0.6,-0.02], 0.01, 8)` (a cone), brim `cyl(0.15,0.03,"#b3262e",[0,0.47,-0.01])`, tip droops: small `ball(0.03, "#fbf7ef")` pom, tilted 0.4 rad (`.rotation.z`). Height: the cap covers where eyes would be, which is the joke.
- Arms: two `box([0.05,0.14,0.05], "#8d949c", [+/-0.14,0.2,0.02])`, mittens `ball(0.04,"#2b2433")`.
- Prop (variant): bowl `cyl(0.07,0.04,"#fbf7ef",[0.12,0.04,0.14],0.05)` of rice pudding with a cherry `ball(0.02,"#b3262e")`. The nisse "waits for risalamande".
- Idle: tiny sway `rotation.z = sin(t*1.5)*0.03` via `ticks`. For an actual walking nisse, reuse the people rig (`render3d/people/*`) with a `nisse` outfit preset rather than this static model (see section 5).

### 3.5 `giftStackModel()` (under the tree, 3 boxes)

- Box A: `box([0.3,0.22,0.26], "#b3262e", [0,0.11,0])`; ribbon `box([0.31,0.225,0.05], "#fbf7ef")` and `box([0.05,0.225,0.27], "#fbf7ef")`; bow `ball(0.04,"#fbf7ef",[0,0.24,0],[1.4,0.7,1])`.
- Box B: `box([0.22,0.18,0.22], "#2f6b3a", [0.22,0.09,0.08])`, gold ribbon `#e8c44a`.
- Box C (on A): `box([0.16,0.14,0.16], "#6fb4ff", [-0.02,0.29,0])`, silver ribbon.
- Grows by stage: day 0 empty, +1 gift/day up to 8 (placed on a ring around the trunk at radius 0.55, seeded sizes/colours). This mirrors the tree's ornaments: **the gifts pile up** until the 24th.

### 3.6 `sleighModel()` (a parked sleigh with the Nissebryg-truck style; optional)

- Runners: two `box([1.3,0.04,0.05], "#8c1d24", [0,0.05,+/-0.28])` with an upturned front `box([0.15,0.04,0.05])` rotated -35 degrees at x=+0.7.
- Body: `box([1.0,0.3,0.55], "#b3262e", [0,0.27,0])` + a rounded back `ball(0.3, "#b3262e", [-0.5,0.4,0], [0.5,1,1.0])`; gold trim `box([1.02,0.04,0.57], "#e8c44a", [0,0.43,0])`.
- Sack: `ball(0.28, "#b98a5a", [-0.25,0.55,0], [1.2,1,0.9])` with a rope `cyl(0.06,0.04,"#fbf7ef",[-0.25,0.8,0])`.
- Where: it can park beside the J-dag truck lane (row y=9, x ~12), or on the Tavern roof on the 24th (the "gone up the chimney" joke). The reindeer: omit (needs 4 quadrupeds), or one existing `quad` pet model in antlers (see section 5).

### 3.7 `snowmanModel()` (square lawn / pond edge)

- Base `ball(0.28,"#f4f8ff",[0,0.24,0],[1,0.9,1],12)`, middle `ball(0.2,...,[0,0.62,0])`, head `ball(0.14,...,[0,0.92,0])`.
- Face: eyes `ball(0.015,"#2b2433")` x2, carrot `cyl(0.018,0.12,"#e8772a",[0,0.92,0.14],0.002,5)` rotated to point +z, three coal buttons.
- Scarf: `cyl(0.15,0.05,"#b3262e",[0,0.8,0])` + tail `box([0.05,0.18,0.02],"#b3262e",[0.1,0.7,0.12])`. Hat `cyl(0.12,0.14,"#2b2433",[0,1.08,0])` with brim `cyl(0.18,0.02,...)`. Stick arms: `box([0.22,0.015,0.015],"#6b4a2a")` x2 angled.
- Clock-driven placement: 3 snowmen at fixed lawn tiles, the number visible = `1 + floor(stage/3)`: they appear as the snow "piles up". Reuse the lawn patch coordinates used by pumpkins (`PATCH`: [3,10],[5,10],[4,11]) for the first one, a safe grass.
- A melted version for the 26th: not needed, window ends.

### 3.8 `candyCaneLampModel()` (lamp post dressing)

The town's lamps are tile `L` (CORE row 1/8 corners and elsewhere; the 3D lamp lives in `town3d-props.ts`; find with `grep -n "lamp" web/src/render3d/town/town3d-props.ts`). Dress rather than replace:

- Spiral stripe: wrap the post with `n=8` short `cyl(postR+0.01, 0.12, i%2 ? "#b3262e" : "#fbf7ef", [0, 0.1+i*0.2, 0])` rings (alternating) to make a candy-cane pole: 8 discs, one merged mesh.
- Hook/top: a torus arc `THREE.TorusGeometry(0.1, 0.03, 6, 10, Math.PI)` in red at the top, rotated to curve over.
- Bow at the base: the wreath's bow.
- A small green garland: `Bunting` drooping between two adjacent lamps (reuse the cords with green).
- Light colour of the lamp bulb goes from white-yellow to warm `#ffe9b0`: change the lamp `glow`, one material swap.

## 4. 2D sprite equivalents

All via `web/src/art/pixels.ts` `bake(w,h,(p)=>{...})` + `once(...)`, `p.rect/px/disc`, `C.ink` outline, like `truckSprite` in `art/jdag.ts`. New file `web/src/art/christmas.ts`. Colours from section 1 (export the shared `BULBS`).

| Sprite | Size px | Notes |
|---|---|---|
| `treeSprite(set)` | 32w x 48h (2 tiles wide x 3 tall; anchored bottom, `items.push({y: bottom-1})` like `drawTruck`) | 5 triangular green tiers (2-colour: `#2f6b3a` / `#3f8a4c`), ink outline, red tub at the base. Bake **one base** plus overlays per set: `ornamentSprite(set)` as separate small bakes (bauble dots, light dots at fixed pixel coords by `hash`) drawn in order with `n` shown, so you do not bake 8 full trees. Star: 5x5 yellow pixel star on top. Light dots drawn in `lightTree` with glow, as `lightTruck`. |
| `wreathSprite` | 8x8 | green ring (disc r=3, hole r=1), 2 red px berries, red bow at the bottom. Drawn at each door at `doorPx + (w/2-4, -?)`. |
| `lightsRoof(len)` | len x 3 | a 1px ink wire with bulbs every 3 px, colours cycle `BULBS` (the truck's exact loop: `for x=2; x<w; x+=3`). Lit bulbs get `drawGlow`. |
| `candleWindow` | 4x6 | 2x3 cream candle, 1x2 yellow flame, over the window sprite; glow radius 5 `"255,214,110"`. |
| `nisseSprite` | 8x12 | grey body (`#8d949c`), cream beard, red cap with droop, 1 px nose. Bowl variant 4x3. |
| `giftSprite(i)` | 8x7 | coloured box + cross ribbon, 4 colour variants; stack by `i`. |
| `snowmanSprite` | 10x16 | three discs (r 5,4,3) in `#f4f8ff` with `#dbe6f3` shade, red scarf, orange carrot pixel, hat. |
| `candyCaneLamp` | overlay 4x20 | alternating red/white 2px bands on the lamp pole, a hook of 3 px. Draw over the lamp sprite. |
| `julehjerte` | 6x6 | red/white 2x2 woven checker in a heart outline; also the Tavern garland. |
| `sleighSprite` | 32x14 | red body, gold runner, brown sack bump. |
| Santa-hat icons | 16x16 | see section 5. |

2D Snow: `snow.ts` `GROUND`/sprite twin pass turns palette colours white automatically; the new sprites should avoid pure palette greens that the twin would whiten (it matches *palette* keys only, so custom hex like `#2f6b3a` is safe).

## 5. Cosmetics

### Costume hats (`core/src/costumes.ts` `COSTUMES`, append only, never reorder)

```ts
costume(2, "Santa hat", 300, "christmas", "Red, white pompom, and a flat refusal to ship on the 24th."),
costume(3, "Reindeer antlers", 350, "christmas", "Rudolph-class latency, red nose included."),
costume(4, "Gløgg mug hat", 380, "christmas", "Warm. Spiced. Does not spill, mostly."),  // optional
```

- The nisse hat already exists as **Julehue** (`hat.12`, 300 coins, uncommon). Do *not* add a second. Instead: a **Nisse beard** as a face piece (`glasses` slot, via `PACK_FACES` in `core/src/headwear.ts`; grey-white beard + red nose, 3D in `gear3dHead.ts`) so Julehue + beard = full nisse. Name "Nissens skæg", rarity uncommon, 220 coins.
- `holiday` field: add `"christmas"` is already a valid `HolidayId`. They sell 10 Dec to 26 Dec automatically (`ON_SALE 14/2`). If we want the *shop* window to match the theme, set a per-costume window; not needed.
- 2D art: `web/src/art/editions.ts` keyed by id `hat.202`, `hat.203` (look at how `hat.200` Jack-o'-lantern is registered there). 16x16: Santa hat = red cone leaning with a white band and pom (copy Julehue's pixels from `art/headwear.ts:112`, make it fuller, straight pom, white brim).
- 3D art: `HAT_BUILDERS` by name in `web/src/render3d/people/gear3dHead.ts` (`Julehue` is at line 631, reuse its cone helper). Santa hat: `cyl(0.115,0.13,"#b3262e",[0,0.0,0],0.06,10)` cone tilted back + brim `cyl(0.125,0.035,"#fbf7ef")` + pom `ball(0.035,"#fbf7ef")` at the tip. Antlers: two `cyl(0.01,0.14,"#8a5a32")` stems with 2 prongs each, red nose is a `glasses`-slot or just a `ball` on the face (skip nose if complex).

### Pet accessories

Pet gear lives in `PETWEAR` (`web/src/render3d/data/pets.ts:158`) with the prestige accessories in `render3d/pets/prestige-petwear3d.ts` (a `Model` with `userData.at: "top"|"neck"` and `tick(t)`). Add three seasonal items using the same shape:

1. **Pet Santa hat** (`at: "top"`): the hat above, scaled by `neckR`.
2. **Jingle-bell collar** (`at: "neck"`): red ring torus (as `ring()` in that file), 3 gold `ball(0.012*s, "#e8c44a")` bells; `tick`: small swing of bells `sin(t*8)`. Jingles when the pet walks if audio hook exists (skip).
3. **Mini scarf** (`at: "neck"`): striped red/white ring, two tails.
Add to the shop catalogue with the `holiday: "christmas"` field the same way costumes do (pets items are in `core/src/shop.ts`/pets.ts; check how `petwear` is listed, since it's prestige-earned there rather than sold: a seasonal sold-pet-accessory slot may need a small extension: **medium effort**). 2D twin: tiny 6x4 px overlay in `art/pets.ts` anchored on the pet's head.

### Name tags

There is no "name tag" slot beyond the prestige tag (emblem + title: `prestigeTag` in `core/src/prestige.ts`). Don't invent a slot. Cheapest equivalents:

- **A seasonal badge** in `core/src/badges.ts` ("Jul i Aarhus": opened N julekalender doors: tiers 8/16/24). Derivable from the `julekalender` rows (`server/src/town/julekalender.ts` already stores them), no new table, but it touches the badge facts pipeline, so **medium**.
- **A name flourish for the window only**: render a tiny holly-leaf glyph or tiny red-white candy bar next to every player's name label *during the window* (pure render, all players, free). Where the name label is drawn: `web/src/game/labels.ts`. **Low effort**, and gives the "whole town is in it" feel.

## 6. Music

A seasonal town theme that replaces `town` ("Morning Commit") during the window. Plug in `core/src/themes.ts`:

```ts
export type ThemeId = ... | "christmas";   // add
// themeOf(): room === "town" && christmasOn(at) ? THEMES.find(t => t.id === "christmas")! : ...
```
`themeOf(room, at)` already takes `at`, so the window check is one line, and the Tavern keeps its own live set. Interior rooms (office, HQ) can keep their normal music. Format per `tunes.ts`: 8 tokens per bar, 8 bars = 64 steps (`THEME_STEPS`), `.` rest, `_` hold; drums `k s h`. Jingly, major, playful: G major, 132 BPM, square lead, with `h` on the off-beats for sleigh-bells.

```ts
{
  id: "christmas",
  name: "Sleighbell Standup",
  emoji: "🎄",
  bpm: 132,
  wave: "square",
  lead: "g5 _ b5 d6 g6 _ d6 b5 | a5 _ c6 e6 a6 _ e6 c6 | b5 _ d6 g6 f#6 _ d6 b5 | g5 _ _ _ d6 _ . . | e6 _ d6 c6 b5 _ g5 a5 | b5 _ a5 g5 f#5 _ a5 c6 | b5 d6 g6 d6 b5 a5 g5 f#5 | g5 _ _ _ g5 _ . .",
  bass: "g3 . d4 . g3 . d4 . | c3 . g3 . c3 . g3 . | g3 . d4 . d3 . a3 . | g3 . d4 . g3 . . . | c3 . g3 . g3 . d4 . | d3 . a3 . d3 . a3 . | g3 . d4 . d3 . a3 . | g3 . d4 . g3 . . .",
  drums: "k.hhs.hh | k.hhs.hh | k.hhs.hh | k.hhs.hs | k.hhs.hh | k.hhs.hh | k.hhs.hh | k.hhs.ks",
},
```

- Original melody (a hint of the sleigh-ride "up the arpeggio, then fall" shape; it is not a copy of a known tune, so no rights issue).
- Variation for the 24th evening (peak): a second, slower theme `"christmas-eve"`, triangle wave, 76 BPM (the "Lockfile Lullaby" mood), so the night is quiet. Sketch:
  - lead `d5 _ g5 _ b5 _ _ . | a5 _ g5 _ f#5 _ _ . | g5 _ b5 _ d6 _ c6 _ | b5 _ _ _ g5 _ _ _ | e5 _ a5 _ c6 _ _ . | b5 _ a5 _ g5 _ _ . | a5 _ b5 _ c6 _ a5 _ | g5 _ _ _ _ _ _ _`
  - bass `g2 _ _ _ d3 _ _ _ | d3 _ _ _ a2 _ _ _ | g2 _ _ _ b2 _ _ _ | g2 _ _ _ d3 _ _ _ | a2 _ _ _ e3 _ _ _ | g2 _ _ _ d3 _ _ _ | d3 _ _ _ a2 _ _ _ | g2 _ _ _ g2 _ _ _`
  - drums `k....... | h...h... | k....... | h...h... | k....... | h...h... | k....... | h...h...`
  - switch on from `minutesFrom("christmas") >= 18*60` to the 25th 02:00 (`themeOf` has the `at`).
- Sleigh-bell SFX layer (optional): `web/src/game/music.ts` already plays hats as noise; for a bell shimmer add a 3-note high `triangle` arpeggio `g6 b6 d7` once per 4 bars. Low effort, high charm.

## 7. Interactivity

Principle: keep it **serverless** where it is flavour, reuse the **existing julekalender** where it is a reward. Do not add new coin sources (the economy tuning in `core/src/shop.ts` is fresh).

| Idea | Serverless? | How |
|---|---|---|
| **Advent-calendar daily reward** | Already built | `DOORS` + `server/src/town/julekalender.ts`. This theme just *links to it*: the tree's day-N ornament set is the same N as today's door; the UI of the calendar can show "door 21" on the tree. **No server work.** Possible small change: make doors 18-24 gifts more Christmassy (e.g. door 18 = Santa hat once added), but `DOORS` is ordered/never-reorder; only append/replace unissued years' doors cautiously. Prefer **leaving DOORS alone** and putting the Santa hat in the shop. |
| **Gift under the tree** | Serverless (flavour) | E on the gift stack: a deterministic line chosen by `hash(userName, year, giftIndex)`: "A card from the Tokenhavn Bryggeri", "A rubber duck, again", etc. No reward, no state. Gifts are visible to all, like the tree. |
| **Gift under the tree: real** | Needs minimal state | One claim per user per year of a small prize on the 24th (a "Juleaften gift" row). Cheapest: reuse the `julekalender` table with door key `YYYY-12-25` (door 25 never exists in `DOORS`, the table only keys by date text: `doorDay`). Add `DOORS[24]` = special (say, a tree-themed pet accessory). **Small server delta**: allow `doorOn` to return 25 on the 25th only (guard in `calendar`/`claim`). Recommended if we want a payoff. |
| **Snowballs** | Serverless, local | Press a key/click near players or pets to throw a snowball: client-only projectile with a splat particle; the thrower sees it, others don't. For a "shared" feel, broadcast an existing emote-type message (the game already syncs emotes/dances, `core/src/dances.ts`) so it appears for people nearby; that touches `protocol.ts` so it is **medium**. First version: purely local, hits NPC/pets/statue with a splat, throws at your own pet to make it hop. |
| **Tree lighting** | Serverless | Lights come on at dusk with the lamps (`candlesLit`). On the 24th at 18:00 a synced one-shot (see 2.1). Everyone sees it at the same instant because it is clock-derived. |
| **Nisse offering** | Serverless | E on the nisse's bowl: a line of dialogue; if the player has "Julehue" (`hat.12`) in their look, the nisse bows. `look.hat === 12` is visible in `hud`/look state. Purely cosmetic. |
| **Sleigh flyover** | Serverless | At 18:30 on the 24th (clock), a sleigh sprite crosses the sky over the town in 10 s along `y = f(t)`, like the fireworks (`core/src/fireworks.ts`, `newyear.ts` give the clock-show pattern). Everyone sees it simultaneously. |
| **Julefrokost on the 24th** | Serverless | Extend the clock rule (see 2.6). |

Server state summary: **the theme itself needs none.** The only suggested server delta is the optional Juleaften gift (door 25), via the existing table. All other features read `skyNow()`.

## 8. Wiring checklist (new files, existing hooks)

- `core/src/christmas.ts` (new): `christmasOn`, `stage`, `buildUp`, tree/gift/window counts, `treeSpot`, `giftSpots(map)`, `nisseSpots(map)` (copy `pumpkinSpots`), `ornamentCount(ms)`.
- `core/src/themes.ts`: `christmas` (and `christmas-eve`) themes + `themeOf` branch.
- `core/src/costumes.ts`: Santa hat, antlers. `core/src/headwear.ts` `PACK_FACES`: Nisse beard.
- `web/src/art/christmas.ts` (new): sprites in section 4; `web/src/art/editions.ts`: costume hats.
- `web/src/game/christmas.ts` (new): `drawChristmas(f)` (items pushed with `y` sort like `drawTruck`), `lightChristmas(g, strength, now)` for the night pass beside `lightTruck`, `blocksTree(x,y)` beside `blocksTruck`, `treeInteract`. `web/src/game/halloween.ts` is the template, `web/src/game/jdag.ts` the one for lights.
- `web/src/render3d/town/christmas3d.ts` (new): `Christmas3d` class with `group`, `update()`, like `Pumpkins`/`Truck3d`; built once per town, `userData.nobatch` where it changes; instantiated where `Truck3d` and `Pumpkins` are (see `town3d.ts` grep `Truck3d`).
- `web/src/render3d/town/bunting3d.ts`: add `lightStrings`.
- `web/src/render3d/people/gear3dHead.ts`: hats. `web/src/render3d/pets/`: new `christmas-petwear3d.ts` modelled on `prestige-petwear3d.ts`.
- `web/src/game/labels.ts`: name flourish.
- Tests: a `core` test like halloween's for `stage`/`christmasOn` boundaries (17 Dec 23:59 off, 18 Dec 00:00 on, 25 Dec 23:59 on, 26 Dec 00:00 off, in winter time CET) and to prove `themeOf` swaps. Notice `worldWall` handles DST; December has none.

## 9. Effort ranking (best value first)

Effort: S = a few hours, M = a day, L = several days.

| # | Item | Effort | Value | Notes |
|---|---|---|---|---|
| 1 | `core/src/christmas.ts` + window + `stage` | S | required | everything hangs on it |
| 2 | Santa hat + antlers costumes (2D + 3D) | S | high | sells for 16 days, money-sink, reuses Julehue |
| 3 | Door wreaths + window candles (night glow) | S | high | cheapest "town feels different" win; copy pumpkins |
| 4 | Christmas theme music + `themeOf` | S | high | 10 lines + two note strings, instantly noticeable |
| 5 | **The tree with day-by-day ornaments** | M | highest | the signature; do 2D and 3D together |
| 6 | String lights on roofs (growing) | M | high | bunting + truck code is the head start |
| 7 | Gift stack growing under tree + flavour line | S | med | 3D box primitives only |
| 8 | Candy-cane lamp posts | S | med | overlay on existing lamp |
| 9 | Nisse scenery (3D + 2D) | M | med | Danish charm; one model + sprite |
| 10 | Snowmen on the lawn | S | med | primitives only |
| 11 | 24th 18:00 tree flourish + Christmas Eve theme | S | med | pure clock |
| 12 | Name flourish (holly glyph) | S | med | whole-town feel |
| 13 | Pet accessories (hat, bell collar, scarf) | M | med | needs a seasonal-sold petwear slot |
| 14 | Roof snow caps/icicles (3D) | M | low-med | December fix may already be partly there |
| 15 | Juleaften gift (door 25) | M | med | only server change; do only if we want a payoff |
| 16 | Sleigh flyover | M | med | pure clock, but a new sky sprite pass |
| 17 | Snowballs (local) | M | med | needs input handling and particles |
| 18 | Snowballs (synced) | L | low | protocol change, skip first round |
| 19 | Seasonal badge ("Jul i Aarhus") | M | low | badge facts pipeline |

**Recommended first slice** (about 2 days): 1, 2, 3, 4, 5, 6, 7, 8. That is a town that visibly builds up through the week, sells two hats, plays its own tune, and needs no server change. Slice two: 9-12, 13. Slice three (optional): 15-17.

## 10. Open questions and risks

- 3D roof snow: confirm whether `town3d-houses.ts` already shows snow on roofs under December snow before adding a cap.
- Door list for lights/wreaths is shared with `halloween.ts`; export it rather than copying (and check that company houses with long names or that moved/removed still resolve via `map.find`).
- The ornaments order is "seeded shuffle"; keep the seed constant forever (not the year) so the tree grows the same way every year and every client agrees.
- Perf: lights on ~10 houses + tree is ~50 bulbs per house; use `InstancedMesh` or the merged-per-colour trick used by the truck. `mergeStill` + `userData.nobatch` as `Truck3d` does; the tree changes only on the hour so rebuild its visibility, not geometry.
- Any `Math.random` for twinkle breaks sync: use `hash(i)` (see `art/pixels.ts`) and `now`.
- Nisse vs Santa: Danish *julemand* = Santa; *nisse* = the grey/red house goblin. Keep the nisse grey in scenery; the red-capped "Julehue" is the player-worn version (existing).
