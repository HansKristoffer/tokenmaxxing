# Halloween theme (30-31 October)

Design only. Nothing here is implemented. Pointers marked (verify) are guesses at where something plugs in, not things I read.

## 0. What already exists (extend, do not duplicate)

| Piece | Where | Note |
|---|---|---|
| Jack-o'-lanterns on every doorstep + lawn patch, lit with the lamps | `core/src/halloween.ts` (`pumpkinsOut`, `pumpkinSpots`), `web/src/game/halloween.ts` (`candlesLit`, `drawPumpkins`, `lightPumpkins`), `web/src/art/halloween.ts`, `web/src/render3d/town/pumpkins3d.ts` (`Pumpkins`) | Window is `near("halloween", ms, 7, 1)` = 24 Oct to 1 Nov. Stays as the "build-up". |
| Jack-o'-lantern hat, sold 14 days before to 2 after | `core/src/costumes.ts` (`COSTUMES`, `COSTUME_BASE = 200`, `hat.200`) | Append only; ids are in bags. |
| Fall foliage peaks 27 Oct to 1 Nov, leaves falling = 1 on 1 Nov | `core/src/seasons.ts` keyframes, `web/src/render3d/town/leaves3d.ts` | Free orange/bare-branch spookiness. Do not touch. |
| Graveyard with real tombstones | `core/src/graveyard.ts`, `web/src/render3d/town/graveyard3d.ts`, `tombstoneModel` in `fx3d-town.ts:549`, `web/src/art/graveyard.ts` | A graveyard already exists on the lawn by the Tavern (`GRAVES`, `SIGN_AT`). Reuse it, do not build a second one. |
| Sky tint, night, stars, moon, fog, lit windows | `web/src/game/sky.ts` (`tint`, `drawLight`, `drawLights`, `drawNightSky`, `drawWeather`, `lightsNow`), `core/src/sky.ts` (`lightAt`, `moonPhase`, `Weather`, `fogOf`) | Weather comes from the server; a theme must layer on top, not replace. |
| 3D lights | `web/src/render3d/engine/stage3d.ts` (`hemi`, `sun`), `pipeline.ts:974` lerps hemi toward `HEMI_SKY/HEMI_GROUND` | The place to push a purple grade. |
| Pet accessories (prestige) | `web/src/render3d/pets/prestige-petwear3d.ts` (`Petwear3D`, `PETWEAR_AT`), `web/src/art/prestige-petwear.ts` | Template for a seasonal petwear group with `userData.at` and `userData.tick`. |
| Music | `core/src/themes.ts` (`THEMES`, `themeOf`, `THEME_STEPS = 64`), `web/src/game/music.ts` | `themeOf(room, at)` already takes a time, so it is the hook. |
| Other holiday modules to copy the shape of | `web/src/game/sankthans.ts`, `web/src/art/sankthans.ts`, `fastelavn.ts`, `december.ts`, `bonfire3d.ts` | Same "clock-only module + 2D art + 3D town class" split. |

Design rule: one new clock predicate, everything else reads it.

```ts
// core/src/halloween.ts (add)
/** The spooky nights: 30 and 31 October. */
export const spookyNow = (ms: number): boolean => near("halloween", ms, 1, 0);
/** 0..1 how deep into the spooky: ramps up from dusk on the 30th, full on the 31st, gone at midnight. */
export const spookDepth = (ms: number): number => ...
```

`near` uses the Copenhagen day (`worldWall`), so 31 Oct 23:59 is on and 1 Nov 00:00 is off. Hard cut at midnight is fine and thematically right (the pumpkins stay until 1 Nov). Add a `?spook=1` dev override next to the existing `?sky=` pin in `web/src/game/sky.ts` so it can be screenshotted any day.

## 1. Mood and palette

Mood: cosy-creepy, Tim Burton storybook, not horror. Warm pumpkin light against a cold violet night. Keep the town readable. Rule of thumb: the sky and fog go purple, the lights stay orange, the one accent is toxic green.

| Role | Hex |
|---|---|
| Night sky top | `#1b0f33` |
| Night sky horizon | `#5a2a6b` |
| Dusk band (sunset on the 30th) | `#c2410c` to `#7a2a6b` |
| Fog / ground mist | `#6b4a8c` (alpha 0.25 to 0.45) |
| Hemi sky / ground (3D) | `#9a7ad0` / `#3a2050` |
| Pumpkin orange (existing) | `#e8772a`, rib `#c25a1c`, candle `#ffc23a` |
| Candle glow rgb (existing) | `255,150,40` |
| Ghost white | `#eef2ff`, shade `#b9c0e6` |
| Slime/ecto green | `#7CFC5A`, dark `#3f8a2a` |
| Witch purple | `#4b2a78`, trim `#2a1646` |
| Bone | `#e9e2c8` |
| Cobweb | `#d8d4e8` at 0.7 alpha |
| Stone (existing tombstone) | `#aeaaa5` / `#8a8682` |
| Bat / silhouette black | `#14091f` |
| Candy accents | `#ff4fa3` pink, `#ffe14a` yellow, `#4fd1ff` blue, `#8a3b12` chocolate |

## 2. Town scenery changes

All gated by `spookyNow`, none needs the server. In the 2D town add a `drawSpooky(frame)` called from the same place `drawPumpkins` is called (`web/src/game/render.ts`, verify). In 3D add one `HalloweenTown` class in `web/src/render3d/town/halloween3d.ts` constructed beside `Pumpkins` in `room-town.ts` / `town3d.ts` (verify), with `update(now)` and `group.visible = spookyNow`.

### 2.1 Sky and light (highest impact, cheapest)

- 2D: in `tint(l, w)` (`sky.ts:76`), when `spookDepth > 0` lerp the returned tint toward `#5a2a6b` by `0.35 * spookDepth * max(darkness, 0.25)`. Keep a minimum so even the 31st at noon gets a faint violet cast. Also `drawNightSky`: moon forced to "full" and enlarged ~1.4x, tinted `#ffd9a0` (harvest moon). Stars stay. This is the single best-value change: a full moon plus violet grade reads as Halloween instantly.
- 3D: in the sun/hemi update, lerp `hemi.color` toward `#9a7ad0`, `hemi.groundColor` toward `#3a2050`, sun color toward `#ffb070` low-angle by `0.4 * spookDepth`. Do it where the sky drives the lights each frame (`stage3d.ts` / `pipeline.ts:974` area), never mutate the shared toon materials.
- Moon: `moonPhase` is real-world. Do NOT override the physics for other features, just override only in the drawing (a `fullMoon` flag at the draw site).

### 2.2 Fog

- Add a ground-mist layer. 2D: reuse the fog bands in `drawWeather` (`sky.ts:289`), treating `fog = max(fogOf(weather), 0.35 * spookDepth)` for tint `#6b4a8c` and only after dusk. 3D: a few big flat additive `plane`s (`m.plane(8, 3, mat)`) drifting at y 0.15, alpha 0.25, scrolled slowly with a tick. Keep it near the graveyard and pond, not the whole town, for perf.
- Real weather wins: if the server says storm/snow, mist is additive on top. Lightning on a Halloween storm already exists; keep.

### 2.3 Cobwebs

- Corners of shop/house fronts and the Tavern awning. 3D: `plane` triangles with a canvas web texture (`canvasTexture` from kit: radial lines + 3 sagging arcs in `#d8d4e8`), transparent, double sided, 0.5 x 0.5, at each building's roof corner. Anchor from the same door list `DOORS` in `core/src/halloween.ts` (door tile +-1, up 2). 2D: 7x7 sprite top corner of door tiles.
- Plus a spider (ball 0.05 black + 8 thin legs cheap as one `box`) on a thread that bobs: `cyl(0.005, 0.5)` thread, tick `y += sin(t)*0.08`.

### 2.4 Bats

- 6 to 10 bats circling the church/clocktower or tallest building (verify which landmark) at dusk and after. Flap by scaling wing boxes in a `ticks` callback (`kit.ts` `ticks`/`Tick`). Path: figure-eight, speed random per bat, radius 3 to 6 tiles, altitude 3 to 4. Spawn count scaled by `darkness`.
- Bats must be one instance each (they animate), so budget: 8 bats x ~4 meshes. Fine.
- 2D: `drawBats`, 5 sprites, wing frame by `floor(now/120)%2`, sin path, drawn in the sky layer above rooftops.

### 2.5 Graveyard corner

The graveyard already exists. Dress it, do not rebuild:
- Add 4 to 6 decorative "unclaimed" tombstones around the real ones (cheap `tombstoneModel`-style variants, section 3.6) on spare tiles near `GRAVES`/`SIGN_AT`, flagged `noBlock`, so the corner looks populated even with zero real stones. Fixed list of tiles in the new module, placed only on `.` grass like `pumpkinSpots` does.
- Dead tree (3.8), a wrought-iron fence made of thin `box`es, ground mist (2.2), and two candle lanterns with the existing `drawGlow`.
- Ghost lives here by default (2.7).
- Sign: add a second joke label next to `signOf(stones)`: "Here lies: your free tier." Cosmetic, from `graveyard3d.ts#signs()`.

### 2.6 Lit windows

`drawLights` / `LitWindow` (`sky.ts:157`) already glows windows at night. Spooky tweak: on spooky nights tint 1 in 5 windows `#7CFC5A` (green) and 1 in 7 `#ff4fa3`... too much, keep it to orange plus green. Pick by a stable hash of the window index so they do not flicker. Also: a few windows "flicker out" (candle gutter) via `flicker(now, i)` from `glow.ts`. Lowest effort in the whole list since it is a color swap in an existing loop.

### 2.7 Ghosts

- Ambient: 2 to 3 translucent ghosts drifting on slow loops around the graveyard, pond and Tavern. 3D recipe in 3.2. Opacity pulses 0.5 to 0.8, bob via sin, vanish when the player is within 1.5 tiles (fade to 0) and reappear 3 s later. No collision: `userData.noBlock = true`, `nopick` except the clickable one (7.2).
- 2D: 12x14 white sprite with a wavy hem, two frames.

### 2.8 Candy and extra pumpkins

- Candy bowls on the Tavern bar and on shop counters (visual only): bowl = `cyl` + 6 tiny colored `ball`s.
- Candy corn / wrapped candy scattered on the ground by the pumpkin patch, merged static mesh (use `mergeStill` as `pumpkins3d.ts` does).
- Extend the lawn patch: on spooky nights add 3 more PATCH tiles and one giant pumpkin (s = 1.8, reuses `body()` in `pumpkins3d.ts`; export it).
- Streamers/bunting: reuse `buntingMeshes` (`bunting3d.ts`) with orange/purple/black flags instead of the usual colors. Zero new modelling.

## 3. New 3D models (Model kit recipes)

API reminder from `kit.ts`: `m.box(size, paint, at, r)`, `m.cyl(radius, h, paint, at, topRadius, seg)` (top radius makes cones), `m.ball(radius, paint, at, scale, seg)`, `m.plane(w, h, paint, at)`, `m.part(at, turn)` for sub-groups, `toon(hex)`, `glow(hex)` (unlit, ignores lights), `glass(hex, opacity)`, `canvasTexture`, `painted(tex)`, `ticks` for animation. Units are tiles (1 = one tile; a person is about 1.7 tall; tombstone is 0.78 high). Set `userData.noBlock = true` and `nopick = true` on scenery as `pumpkins3d.ts` does. Put them all in `web/src/render3d/town/halloween3d.ts` + `halloween3d-models.ts`; wearables go in `people/gear3dHead.ts` style files.

### 3.1 Bat (animated)
- Body: `ball(0.07, "#14091f", [0,0,0], [1,1.2,1])`. Head: `ball(0.05, ...)` at `[0,0.09,0.02]`. Ears: 2x `cyl(0.025, 0.06, black, ..., 0.0, 4)` (cone) at `[+-0.03, 0.15, 0.02]`.
- Eyes: 2x `glow("#ff3030")` `ball(0.012)` at `[+-0.02, 0.10, 0.06]`.
- Wings: 2 sub-`part([+-0.05, 0.02, 0])`, each: `box([0.22, 0.01, 0.12], black, [+-0.11, 0, 0])` + `box([0.1, 0.01, 0.09], black, [+-0.26, -0.01, 0.01])` (outer segment, tilt via rotation.z). Flap: tick sets `wing.rotation.z = +-sin(t*14 + phase) * 0.7`.
- Total ~8 meshes.

### 3.2 Ghost (translucent, animated)
- Material: `glass("#eef2ff", 0.6)` (transparent, no depth write). Do not use `toon` (it would be opaque).
- Body: `ball(0.28, mat, [0, 0.7, 0], [1, 1.25, 1])`; skirt: `cyl(0.28, 0.35, mat, [0, 0.35, 0], 0.30, 12)` with a wavy hem from 5 `ball(0.08, mat)` along the bottom edge at `y=0.08`.
- Arms: 2x `ball(0.07, mat, [+-0.3, 0.65, 0.08], [1, 0.6, 1])`.
- Face: eyes `ball(0.04, "#1b1f2a" via toon, [+-0.1, 0.78, 0.25], [1, 1.5, 0.5])`; mouth `ball(0.05, toon dark, [0, 0.62, 0.26], [1, 1.4, 0.5])` (an "oooh").
- Inner glow: a second slightly smaller `ball` with `glow("#cfd6ff")` at 0.3 alpha (needs an own `MeshBasicMaterial({transparent:true, opacity:0.3})` since `glow()` is opaque).
- Tick: `y = 0.2 + sin(t*1.2)*0.08`, `rotation.y = sin(t*0.5)*0.4`, opacity pulse.
- Variants for free: scale 0.6 = baby ghost; swap color `#9be8ff` = blue ghost.

### 3.3 Witch hat (world prop and wearable)
- Brim: `cyl(0.34, 0.03, "#2a1646", [0,0,0], 0.34, 20)`.
- Cone: `cyl(0.2, 0.4, "#4b2a78", [0, 0.2, 0], 0.07, 14)` and tip bend: `cyl(0.07, 0.18, "#4b2a78", [0.04, 0.5, 0], 0.01, 10)` rotated z -0.5.
- Band: `cyl(0.205, 0.06, "#e8772a", [0, 0.05, 0], 0.2, 14)`; buckle `box([0.07,0.07,0.02], "#ffd04a", [0,0.05,0.2])`.
- Standalone variant on a stick for the scarecrow (3.9).

### 3.4 Cauldron
- Pot: `ball(0.4, "#2b2b34", [0,0.38,0], [1, 0.85, 1])`; flat rim `cyl(0.34, 0.05, "#1d1d24", [0,0.62,0], 0.34, 16)`; legs 3x `cyl(0.05, 0.14, "#1d1d24", ..., 0.04)` at 120deg.
- Brew: `cyl(0.31, 0.01, glow("#7CFC5A"), [0, 0.6, 0])`; bubbles: 4 small `ball(0.04..0.07, glow("#b8ff9a"))` rising in a tick (y loops 0.6 to 0.95, scale 1 to 0, staggered phases).
- Fire under: reuse bonfire flame from `bonfire3d.ts` (verify what it exports) or 3 `cone` cyls orange/yellow that scale-flicker.
- Light: green `drawGlow` 2D equivalent; in 3D a `PointLight` is expensive, use a flat additive disc plane under it on the ground instead.
- Placement: in front of the Tavern door, opposite the patch.

### 3.5 Candy bucket
- Pail: `cyl(0.14, 0.2, "#e8772a", [0,0.1,0], 0.17, 12)` (wider at the top), rim `cyl(0.175, 0.025, "#c25a1c", [0,0.21,0], 0.175)`, handle: a TorusGeometry like `ring()` in `prestige-petwear3d.ts` (arc `Math.PI`, r 0.14, tube 0.01).
- Face on it: `box([0.05,0.05,0.01], "#14091f")` x2 eyes, 1 mouth box (same trick as `face()` in `pumpkins3d.ts`).
- Candy: 8 `ball(0.03, color)` at radius <0.12, colors from the candy palette, plus 2 wrapped sweets (ball + 2 tiny cones at the ends).
- Use as: world pickup for 7.1, held prop, and the shop icon.

### 3.6 Tombstone variants (for the graveyard corner)
Copy `tombstoneModel` (`fx3d-town.ts:549`), sharing the base and changing the top:
- Round-top (existing).
- Cross: `box([0.12, 0.7, 0.1], stone)` + `box([0.4, 0.12, 0.1], stone, [0, 0.5, 0])`, tilted rotation.z 0.12.
- Slab: `box([0.7, 0.45, 0.1], "#8a8682")` leaning rotation.x -0.2.
- Broken: round-top with the top missing and a `box` shard on the ground.
- Texts for the painted face: "BRB", "404", "v1.0", "TODO", "git blame", "RIP npm". These jokes fit the game's voice.

### 3.7 Spooky tree / dead tree
- Trunk: `cyl(0.14, 1.6, "#2a1b24", [0, 0.8, 0], 0.07, 7)` with a lean (rotation.z 0.08).
- Branches: 5 to 6 `cyl(0.05, 0.7, same, pos, 0.015, 5)`, each rotated outward 40 to 70 degrees, 2 sub-twigs each.
- No canopy. Optional one crow: `ball(0.07, black)` + `box` beak.
- Cheap trick: do not build a new tree, take the existing bare-branch look from `core/src/seasons.ts` (`leaf = 0`, which is what the bare winter tree uses) and force `leaf = 0.1, turn = 1` for the 2 or 3 trees nearest the graveyard on spooky nights. Needs the tree builders to accept a per-tree override (verify in `town3d-props.ts`). If that is hard, ship the model above.
- Hang a ghost/paper lanterns from a branch: `ball` with `glow("#ffb347")`.

### 3.8 Extras (only if time)
- Scarecrow: post `box([0.06,1.2,0.06])`, arms `box([0.8,0.06,0.06])`, burlap torso `box([0.3,0.4,0.15], "#b08850")`, head `ball(0.14, "#c9a36a")`, witch hat (3.3), grin via 3 boxes.
- Iron fence: segments of `box([0.03, 0.5, 0.03])` every 0.12 with a top rail and spear tips (cone cyls). Merge with `mergeStill`.
- Skeleton hand out of the ground: 5 thin `cyl`s fanned up + palm `ball`, bone color; pop-up animation on proximity.
- Hanging paper bats on shop windows: `plane` with canvas bat texture (cheapest decor of all).
- Candles on the graveyard: `cyl(0.03, 0.12, bone)` + `glow` flame ball + `drawGlow` 2D.
- Black cat on a shop roof/awning: ball body, ball head, 2 cone ears, tail torus, 2 green `glow` eyes. The pets code has a cat (`pets3d-quad.ts`); the town cat in `animals3d.ts` (verify) could simply get the witch hat.

## 4. 2D sprite equivalents

Format: `bake(w, h, (p) => p.grid(rows, palette))` from `web/src/art/pixels.ts`, palette `C` from `palette.ts`, wrapped in `cached(...)` exactly like `pumpkinSprite`. New file `web/src/art/halloween.ts` (append) or `halloween2.ts`. Sizes in px at the town TILE scale.

| Sprite | Size | Notes |
|---|---|---|
| Bat | 9x5, 2 frames | wings up/down; `o` black, `r` red eyes. |
| Ghost | 12x14, 2 frames | `#eef2ff` body, `#b9c0e6` shade rows, hem alternates between the frames; draw at globalAlpha 0.75. |
| Witch hat | 12x10 | purple cone, orange band, drawn also as the hat overlay on characters (see 5.1). |
| Cauldron | 14x12 | 3-frame bubble (`G` green) animation; glow via `drawGlow(...,"124,252,90")`. |
| Tombstones | 10x12 x3 | round / cross / slab. |
| Dead tree | 18x26 | dark trunk, 4 branches; swap the existing bare tree sprite if one exists in `tiles.ts`/`objects.ts` (verify). |
| Candy bucket | 8x8 | and a 4x4 candy in 3 colors. |
| Cobweb | 8x8 corner, 2 mirrored | `#d8d4e8` at alpha. |
| Spider on thread | 5x6 | thread length drawn as a line. |

Lighting: ghost, cauldron, candles call `drawGlow` from `web/src/game/glow.ts` inside a `lightHalloween(g, strength, now)` mirroring `lightPumpkins` (called from `drawLight`; find the call site of `lightPumpkins`, verify).

## 5. Cosmetics

### 5.1 Costume hats (`core/src/costumes.ts`)
Append, never reorder. `ON_SALE` (14 days before, 2 after) already covers 30-31 Oct, so no sale-window code is needed. Prices follow the existing 350 for the jack-o'-lantern:

```ts
costume(2, "Witch hat",      300, "halloween", "Pointy, purple, slightly haunted."),
costume(3, "Ghost sheet",    300, "halloween", "Two holes. Zero regrets."),
costume(4, "Bat ears",       250, "halloween", "Tiny wings on the sides of your head."),
costume(5, "Skull mask",     350, "halloween", "A face that has seen too many deploys."),
// earned, never sold, like the kattekonge crown:
{ ...costume(6, "Trick-or-Treat crown", 0, "halloween", "Knocked on every door. Sugar king."), tradeable: false, rarity: "legendary", earned: "Collect candy at every door (7.1)" },
```
Hooks: 2D art in `web/src/art/editions.ts` keyed by id (`hat.202` etc.); 3D in `HAT_BUILDERS` by name in `gear3dHead.ts`. Recipes: witch hat = 3.3; ghost sheet = `ball(0.3, white, scale [1,1.1,1])` over the head with two black eye holes and a skirt cone `cyl(0.3,0.3,white,..,0.42)`; bat ears = 2 thin cones on a headband; skull = `ball` bone + 2 black eye boxes + teeth row. The earned crown needs a server grant; defer it unless 7.1 gets state (otherwise make it a normal purchasable).

### 5.2 Pet accessories
Seasonal, not prestige; keep apart from `PRESTIGE`/`PETWEAR`, but copy the `Petwear3D` contract: a `Model` group with `userData: { at: "top" | "neck", tick }`, scaled by the rig's `neckR`.
- Mini witch hat (top): 3.3 at 0.45 scale.
- Bat wings (neck... better "back", only if the rig supports it; otherwise skip): 3.1 wings at 0.8 scale, flap tick.
- Pumpkin collar (neck): ring of 5 tiny orange `ball`s around the neck (`ring()` helper style).
- Ghost sheet (top): 3.2 body scaled to 0.5, translucent.
How a pet gets it: simplest serverless way is automatic: on spooky nights every pet wears the mini witch hat client-side by default for every viewer (clock only), with no inventory. Only if you want it to be an owned item does it need a shop entry (then it needs an `Item` slot that pets support; I did not find a pet accessory slot in `core/src/shop.ts`, verify before promising it).

### 5.3 Name tags
There is a prestige tag (`prestigeTag(rank)` in `core/src/prestige.ts:150`). Do the same for the season, from the clock, visible to everyone:
- On spooky days prefix every player's floating name with a tiny 🎃 or 🦇 chosen by a stable hash of the player id (half and half). No state, no cost. Find the place name labels are composed (verify, near `Sign`/`label` kind in `rooms.ts`).
- Optional owned tag "Boo!" stays out of scope.

## 6. Music

Add a theme `halloween` in `core/src/themes.ts`: extend `ThemeId`, add to `THEMES` (64 steps each voice: 8 bars of 8 tokens, 4 bars A and 4 bars B), and in `themeOf` return it for `room === "town"` when `spookyNow(at)`:

```ts
if (room === "town" && spookyNow(at)) return THEMES.find((t) => t.id === "halloween")!;
```
Key: A harmonic minor (Am, F, E, Dm; the G# gives the creepy leading tone). Slow lurch at 100 bpm, triangle lead for a hollow, music-box feel. Interior rooms keep their own music; the town is where the mood lives. Add `"halloween"` handling to any code that exhaustively switches on `ThemeId` (compile will tell).

```ts
{
  id: "halloween",
  name: "Trick or Treat.exe",
  emoji: "🎃",
  bpm: 100,
  wave: "triangle",
  // A: the haunted-music-box figure, up the minor triad and down. B: answer phrase, climbing to the G# and resolving.
  lead: "a4 _ c5 _ e5 _ c5 . | a4 _ c5 _ e5 _ g#5 . | f5 _ e5 _ c5 _ a4 . | b4 _ d5 _ e5 _ g#5 _ | a5 _ g#5 a5 e5 _ c5 . | d5 _ f5 _ a5 _ f5 . | e5 _ g#5 _ b5 _ g#5 e5 | a5 _ _ _ e5 _ . .",
  bass: "a2 . e3 . a2 . e3 . | a2 . e3 . a2 . c3 . | f2 . c3 . f2 . c3 . | e2 . b2 . e2 . g#2 . | a2 . e3 . a2 . e3 . | d3 . a2 . d3 . a2 . | e2 . b2 . e2 . g#2 . | a2 . e3 . a2 _ . .",
  drums: "k...h... | k...h..h | k...h... | k..hs..h | k...h.h. | k..hs.h. | k...h.hh | k.h.s.hs",
},
```
Checks to run: each voice is exactly 64 tokens (`voiceSteps`), drums 64 chars (`drumSteps`), every token matches `noteHz` (`g#5`, `g#2` are valid per the regex). There is likely a test over `THEMES` for those invariants (verify under `core/test`).

Optional second piece: a 32-step jukebox tune "Graveyard Shift" in `tunes.ts` (`TUNES`, STEPS = 32), e.g. bpm 84, `wave: "sawtooth"`, with a lower register on the same progression. Do this last; it is not seasonal.

Optional SFX for the interactions (7): a bat squeak (short square blip 1500 to 2200 Hz), a doorbell "ding-dong" (e5, c5), a ghost "woo" (triangle glide a4 to d4). Whatever `web/src/game/` uses for one-shots (verify).

## 7. Small interactive ideas

### 7.1 Trick-or-treat at doors (serverless core)
- Every door that already has a pumpkin (`pumpkinSpots`, `DOORS`) is knockable on spooky days with E / click (reuse the existing door-interact prompt, verify).
- Outcome is a pure function: `treatAt(doorId, worldDay, playerId) -> "candy" | "bigcandy" | "trick" | "nobody"` using a hash, so it is deterministic and needs no state. Weights ~55% candy, 15% big candy, 20% harmless trick (spider drops from the awning, a ghost "BOO" pop, the player gets briefly a pumpkin head for 20 s client-side), 10% nobody home.
- "Once per door per day" lives in `localStorage` (`halloween:{worldDay}:{doorId}`). A cheater can reset it, and all it does is give them cosmetic candy. That is acceptable.
- Reward is cosmetic: a candy count shown in a small HUD chip and a floating "+1 candy" with the candy sprite. Bucket (3.5) is the HUD icon.
- Doors the player is not allowed to enter anyway (shops) still work because it is only the doorstep.

### 7.2 Ghost to click
- One special ghost spawns at a spot decided by `hash(worldDay, hourBlock)` among ~6 graveyard/pond/lawn positions; moves every 2 hours (clock only). Clicking it (or E near) pops a one-liner chosen from a list, and gives candy (client-side count, once per ghost-position per day via localStorage). Lines in the game's voice: "I was a PR that never got merged.", "Boo! Your lockfile has changed.", "Have you tried turning it off and on again? I did. Once.".
- Same position for everyone at the same time, so people can say "the ghost is at the pond". That social bit is free with the clock.

### 7.3 Once-per-day candy reward
- Cosmetic version (ship): described above, client-only.
- Coin version: needs minimal server state. One column on the player: `last_candy_day` (world day number, via `worldDayNumber` from `holidays.ts`) and one idempotent endpoint `POST /halloween/claim` that checks `spookyNow(Date.now())`, compares day, grants N coins, writes the day. Server derives everything from its own clock, client sends nothing but "claim". Also doubles as the unlock for the earned Trick-or-Treat crown (5.1) if you want it ("claimed on both days": store the two days, or a 2-bit mask). Because the window is 2 days, I would NOT build this unless coins are the point; the economy is deterministic and cheap to abuse via a second client if done client-side.
- A bowl-of-candy item in the Tavern: click to eat one, character plays the existing emote/dance (`people/dances.ts`) for 2 s. Zero state.

### 7.4 Others, ranked by whimsy per effort
- Pumpkins "watch you": the face boxes' glow pulses brighter when the player is within 3 tiles (`pumpkins3d.ts#update` already gets `now`; add the player distance). Cheap.
- Cauldron stir: click to stir, bubbles burst, green puff, random wisecrack.
- Tavern bartender line swap to Halloween variants (`core/src/barkeep.ts`, verify the line table).
- Lightning flash + distant howl at random on the 31st at night (the storm effect already exists in `drawWeather`).
- Photo mode: a spooky filter while `?spook=1` for screenshots. Dev only.

## 8. Effort ranking (ship in this order)

Effort: S = under 1 hour, M = a few hours, L = most of a day. Impact is how much it reads as "Halloween" at a glance.

| # | Item | Effort | Impact | Files |
|---|---|---|---|---|
| 1 | `spookyNow`/`spookDepth` + dev override | S | enabler | `core/src/halloween.ts`, `web/src/game/sky.ts` |
| 2 | Violet 2D tint + 3D hemi/sun grade + big orange full moon | S | very high | `sky.ts` `tint`, `drawNightSky`, `stage3d.ts`/`pipeline.ts` |
| 3 | Halloween music in the town | S | high | `core/src/themes.ts` (draft in section 6) |
| 4 | Name-tag emoji + pets in witch hats by clock | S | high (social) | name label site, pet render |
| 5 | Green/orange lit-window variants | S | medium | `drawLights` |
| 6 | Halloween bunting colors + candy bowls | S | medium | `bunting3d.ts` |
| 7 | Bats circling (2D + 3D) | M | high | new `halloween3d.ts`, 3.1 |
| 8 | Ground mist (graveyard, pond) | M | high | `drawWeather`, 3D planes |
| 9 | New costume hats (witch, ghost, bat ears, skull) | M | high (it makes money) | `costumes.ts`, `editions.ts`, `gear3dHead.ts` |
| 10 | Ghosts (ambient, then the clickable one) | M | high | 3.2, 7.2 |
| 11 | Trick-or-treat at doors + HUD candy chip | M | very high (interactive) | 7.1, 3.5 |
| 12 | Graveyard dressing (extra stones, fence, dead tree, candles) | M | medium | 3.6, 3.7 |
| 13 | Cobwebs + spider | M | medium | 2.3 |
| 14 | Cauldron | M | medium | 3.4 |
| 15 | Pet accessories as owned items | L | medium | needs pet slot (verify) |
| 16 | Server-granted coins / earned crown | L | low | 7.3, only if wanted |
| 17 | Scarecrow, skeleton hand, black cat, jukebox tune | L | low | 3.8 |

Realistic plan for a 2-day window: today do rows 1 to 6 (about half a day total, nearly all palette edits plus one theme entry), which already transforms the town. Then 7, 8, 11 (the most delightful), and 9 only if the Clothes shop change can ship before the 31st evening, since the costume sells for 2 days after anyway. Everything past row 12 should wait for next year; put the ones that are not date-bound behind the `?spook=1` pin so they can be built early and enabled by the clock.

## 9. Risks and notes

- Keep every effect behind `spookyNow` and visible-false when off, as `Pumpkins.update` does (`group.visible = ...`), and set `userData.nobatch = true` on groups that appear/disappear with the calendar (the room batching otherwise bakes them in; see `pumpkins3d.ts`).
- Timezone: `near` is Copenhagen days. Players elsewhere see Halloween start at Copenhagen midnight. That is the existing contract for the other holidays; keep it.
- Performance: no new real-time lights; use additive discs and `glow` materials. Animated objects are per-instance meshes: cap bats at 10 and ghosts at 3. Static bits (cobwebs, candy, fence) go through `mergeStill`.
- Time-of-day: the 30th at midday is not dark. Violet grading must be dark-weighted (`max(darkness, 0.25)`) so it is moody but not muddy. Check by `?sky=2026-10-30T12:00`, `...T18:30` and `2026-10-31T21:00`.
- Accessibility: keep the ghost opacity above 0.5 on the lit side and do not rely on color alone for the clickable ghost (give it a bobbing "!" or sparkle).
- Leaf/foliage: the autumn look is already peaking, so do not add falling-leaf work. Bats and mist are what is missing.
