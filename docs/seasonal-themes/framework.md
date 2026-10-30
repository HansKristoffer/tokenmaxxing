# Seasonal themes: shared framework (design only)

Status: proposal, 2026-10-30. No source changed. Covers Halloween (30-31 Oct) and Christmas (about 18-25 Dec,
building toward the 25th) on the pixel-2D and three.js-3D town.

## 0. What exists today (so we reuse it, not parallel it)

- `core/src/holidays.ts`: `HOLIDAYS` (halloween 10-31, christmas 12-24 "Juleaften"), `near(id, ms, before, after)`,
  `daysFrom`, `minutesFrom` (fractional, Copenhagen midnight anchored), `dateLabel`. All clock-driven via
  `worldWall` (Copenhagen), checks years y-1, y, y+1 so windows wrap New Year. No server state.
- Halloween is already a mini-theme: `core/src/halloween.ts` (`PUMPKINS = {before 7, after 1}`, `pumpkinSpots`),
  `web/src/game/halloween.ts` (`pumpkinsOutNow`, a once-a-minute cache keyed on `skyNow()`, `candlesLit`, 2D draw and
  glow), `web/src/render3d/town/pumpkins3d.ts` (built once in `room-town.ts:103`, `mergeStill`, `userData.nobatch`,
  visibility toggled in `update`). Costume: `core/src/costumes.ts` (`ON_SALE = {before 14, after 2}`, `onSale`). Server
  re-checks it at `server/src/town/coins.ts:415`; UI at `web/src/hud/Shop.tsx:133`, `render3d/shops/purchase.ts:88`,
  `render3d/shops/clothes-items.ts:224`.
- December is already partly there: `core/src/december.ts` (julekalender doors, julefrokost Fri/Sat, `decemberSnow` applied
  in `web/src/game/sky.ts` `weatherNow`), `web/src/game/december.ts`, `web/src/hud/Julekalender.tsx`, hat.12 Julehue
  (`core/src/headwear.ts`).
- Dev pin pattern to copy: seasons use `?season=` (`web/src/game/seasons.ts:26`, `urlPin`), server `SKY_SEASON`
  (`server/src/weather.ts:53` `pinnedSeason`, sent in the world snapshot as `seasonDay`, `core/src/world.ts:517`, `server/src/actors/world.ts:2684`,
  read from `hud.get().seasonDay`, `web/src/store.ts:150`). `?sky=` (`web/src/game/sky.ts:26`) already moves the whole
  clock (`skyNow()`), and every holiday check there goes through `skyNow()`, so `?sky=2026-12-22T14:00` already
  shows a Christmas-window date to any `near()` consumer.
- Bake keys: `lookKey(SeasonLook)` (`core/src/seasons.ts`) is what 2D sprites and the 3D town rebake on (changes every
  few days in autumn). `mergeStill` (`render3d/engine/merge3d.ts`) merges still parts once.
- Music: `THEMES` + `themeOf(room, at)` (`core/src/themes.ts`), 64-step loops; `web/src/game/music.ts` `sync()` runs
  every 1 s and restarts only when `theme.id` changes. Tavern floor overrides via `tavernSet(at)`.
- Settings: `web/src/settings/graphics.ts` `GraphicsSettings` / `Overrides` / `resolveSettings` (has `weather` density and
  `reduceMotion`). No existing "turn seasonal effects off" setting.

Naming clash: `core/src/themes.ts` is the music module. The new module must not be called `themes`.

## 1. Core module: `core/src/festive.ts`

One pure file, no web/server imports, built on `holidays.ts` only.

```ts
import { type HolidayId, HOLIDAYS, daysFrom, minutesFrom, near } from "./holidays.ts";

export type FestiveId = "halloween" | "christmas";

export interface FestiveDef {
  id: FestiveId;
  holiday: HolidayId;        // anchor, from HOLIDAYS (no second date table)
  before: number;            // whole days before the anchor the window opens
  after: number;             // whole days after it the window stays
  /** minutes-from-anchor -> 0..1 build-up; clamped, monotonic until `peak`. */
  ramp: (minutesFromAnchor: number) => number;
}

export const FESTIVE: Record<FestiveId, FestiveDef> = {
  // 30 Oct (-1) and 31 Oct (0). Ramp: 0.5 at open, 1 from 31 Oct 16:00.
  halloween: { id: "halloween", holiday: "halloween", before: 1, after: 0, ramp: rampBetween(-1440, 16 * 60, 0.5, 1) },
  // 18 Dec (-6) .. 25 Dec (+1). Ramp: 0.15 on the 18th rising to 1 at 24 Dec 18:00; 1 on the 25th.
  christmas: { id: "christmas", holiday: "christmas", before: 6, after: 1, ramp: rampBetween(-6 * 1440, 18 * 60, 0.15, 1) },
};

export interface Festive {
  id: FestiveId;
  /** 0..1 build-up (see ramp). Never 0 while active, so `intensity > 0` == active. */
  intensity: number;
  /** Days from the anchor (negative before): for "N sleeps to Christmas" copy. */
  days: number;
}

/** The active theme at `ms`, or null. Overlaps resolve by FESTIVE key order (none overlap today). */
export function festiveAt(ms: number): Festive | null;

/** Dev pin text -> a resolved override. `christmas`, `christmas@12-22`, `halloween@10-31T21:00`, `off`. */
export type FestivePin = { id: FestiveId; ms: number } | "off" | null;
export function parseFestivePin(text: string, nowMs: number): FestivePin;

/** Pin (if any) over the clock. The one function every consumer calls via the web/server wrappers. */
export function festiveWith(pin: FestivePin, ms: number): Festive | null;

/** Coarse bucket for bake keys: `halloween.2` (intensity rounded to quarters) or "". Changes <= 4 times per window. */
export const festiveKey = (f: Festive | null): string => (f ? `${f.id}.${Math.round(f.intensity * 4)}` : "");
```

Rules:
- Windows are whole Copenhagen days via `near(def.holiday, ms, def.before, def.after)`; `days = daysFrom`, intensity from
  `minutesFrom(def.holiday, ms)` so the build-up is continuous inside a day (a smooth ramp, not a step per midnight).
- Year wrap and timezone come free from `near`/`worldWall`; no new date math. `parseFestivePin` builds `ms` with
  `copenhagenToMs` (`core/src/sky.ts:453`) in the current year when the pin has `MM-DD` only (noon default; day-of-time
  keeps ticking like `?sky=`).
- Fold the old constants in: `PUMPKINS` stays exported but is set to the Halloween prop window (7/1, deliberately wider
  than the 30-31 Oct *theme*: pumpkins on doorsteps for a week is existing behaviour; do not shrink it). The *theme*
  (tint, music, HUD) is the 30-31 Oct window. Costume `ON_SALE` (14/2) is untouched.

### Dev and ops overrides (all three feed `parseFestivePin`)
| Where | Form | Notes |
|---|---|---|
| URL | `?theme=christmas&day=12-22` (also `?theme=halloween`, `?theme=off`) | `day=` optional, `MM-DD`, `MM-DDTHH:MM`; pins only the theme clock, not the sky. |
| URL | `?sky=2026-12-22T14:00` | Already works: themes follow `skyNow()`. Use for sun and theme together. |
| Server | `THEME_PIN=christmas@12-22` env | Read next to `SKY_SEASON` in `server/src/weather.ts`, sent in the snapshot as `festivePin?: string`, `core/src/world.ts` beside `seasonDay`, `store.ts` field `festivePin`. |
Precedence: URL pin > server pin > clock. The player's off setting beats the clock and the server pin, but not an
explicit URL pin (so QA still works with the setting off; the "setting off" test uses no URL pin).
Pins are visual only: shop enforcement (`server/src/town/coins.ts:415`) stays on the real clock (document this; to test
shop stock use a unit test or run the server with a faked clock).

### Web wrapper: `web/src/game/festive.ts`
Mirror `web/src/game/halloween.ts`: `festiveNow(): Festive | null` cached per minute (key on `skyNow()` minute, pin, and
setting), `festiveKeyNow()`, `intensityNow()`. Reads the URL once (`new URLSearchParams(location.search)`, like
`seasons.ts:26`), `hud.get().festivePin`, and the setting (section 3). Exposes `window.__tm.festive` in `web/src/game/qa.ts`
for the QA script. Every consumer below calls this, never `near()` directly.

## 2. Hooks (exact files)

### 2.1 Sky, fog, ambient tint
- 2D: `web/src/game/sky.ts` `tint(l, w)` (multiply fill) and `drawLight`. Add a third mix step after the night mix:
  `c = mix(c, FESTIVE_TINT[id], intensity * k)` where Halloween = purple-orange (dusk-weighted, `k` scales with
  `l.darkness`), Christmas = warm candle at dusk, cool blue-white at night. Cost: one extra colour mix per 2 s light
  recompute (`currentLight`), no extra fill.
- Fog: `fogOf(weather)` in `core/src/sky.ts:337` stays pure. Add `festiveFog(f): number` (0..0.4) in `festive.ts` and take
  `max(fogOf(w), festiveFog(f))` in 2D `sky.ts` and in the 3D fog consumer. Halloween: ground mist at night, intensity-scaled.
  Christmas: none, snow already does the job.
- Christmas snow: `decemberSnow` already forces snow all December; no change. Optionally scale density with intensity
  in `weatherNow` (`sky.ts:~35`), which already caches per minute.
- 3D: sky and light colours live in `web/src/render3d/town/fx3d.ts` (`clockDark()` at :387, `horizon()` via
  `stage3d.ts:187`). Apply the same tint/fog function to the sky gradient, hemisphere/ambient light and haze colour
  (`lightPipeline` in `engine/stage3d.ts`). Share the colour table from a new `web/src/game/festive-palette.ts` so 2D and 3D
  agree (as `halloween.ts` is shared by both renderers today).
- Window lights: `drawLights` (2D) and the 3D window emissive: Christmas swaps lit-window colour to warm gold, Halloween
  to orange; just a constant lookup keyed by id.

### 2.2 Scenery props
Pattern = Pumpkins: a core file for placement (pure, map-driven, tests), a 2D draw file, a 3D class. Never alter the
baked ground or tree sprites for props.
- Halloween extras (post-slice): `core/src/halloween.ts` add `cobwebSpots`, `ghostSpots`; 2D `web/src/art/halloween.ts`,
  `web/src/game/halloween.ts` (`drawPumpkins` called at `web/src/game/render.ts:393`, glow at `:519`); 3D new
  `render3d/town/graveyard3d.ts` style classes registered next to `new Pumpkins` in `render3d/town/room-town.ts:103`.
- Christmas: new `core/src/christmas.ts` (`treeSpot`, `lightStrings(map)`, wreath on `DOORS` like halloween), `web/src/game/christmas.ts`,
  `web/src/art/christmas.ts`, `web/src/render3d/town/christmas3d.ts`. Town-square tree grows by intensity (3 sprite stages,
  chosen by `Math.floor(intensity*3)`), gifts pile appears at 24 Dec. Tree lights twinkle via `flicker` from `game/glow.ts`.
- Lifecycle for 3D: build lazily the first frame `festiveNow()?.id === mine` (not in the constructor), `mergeStill`, set
  `group.userData.nobatch = true`, keep a `live` mesh for the lights material, toggle `visible`, and dispose the group
  (`engine/dispose.ts`) when the window closes while the page stays open. Halloween's existing eager-build is fine
  (tiny) but should move to the same lazy helper to avoid every player in the other 363 days paying for it.
- All props: `userData.nopick`, `noBlock` (as pumpkins3d) so nothing collides.

### 2.3 Music swap
- `core/src/themes.ts`: add `ThemeId` entries `"town-spooky"` and `"town-jingle"` (same 64-step shape; `themes.test.ts` already
  checks shape and length). Change signature to `themeOf(room, at, festive?: FestiveId | null)`; for `room === "town"` return the
  variant; Tavern (`inn`) keeps `tavernSet(at)` priority, then a variant of the tavern jig for Christmas only. Halloween:
  town only (minor-key remix of `town` motif, slower, bpm ~100). Christmas: gate on `intensity >= 0.4` so early window
  stays familiar; at 1.0 add the sleigh-bell drum track.
- `web/src/game/music.ts:sync()`: pass `festiveNow()?.id` into `themeOf`. It already restarts only on `theme.id` change, so the
  1 s watcher costs nothing new. Respect the setting (festive off => `null`).
- Do not use copyrighted carols; write original motifs in the `tunes.ts` note format.

### 2.4 HUD accents
- Root attribute: set `document.documentElement.dataset.festive = id` from a small effect in `web/src/main.tsx` (or the top
  HUD component) driven by `festiveNow()`; `store.ts` gets `festive: FestiveId | null` refreshed on the same 1 min cadence. CSS
  variables (`--accent`, panel border, toast icon) switch under `[data-festive="halloween"]` in the HUD stylesheet.
- One toast per theme per day on first load in the window: "Happy Halloween" / "N sleeps to Christmas" (`days`), flagged in
  `web/src/storage.ts` (`festive-seen:<id>:<yyyy-mm-dd>`). Copy uses `dateLabel`.
- `web/src/hud/Julekalender.tsx` already exists; add the tree-icon intensity ring only if cheap. Nothing else needed for MVP.

### 2.5 Shop stock
- Mechanism already exists: `Item.holiday` + `onSale` + `ON_SALE`. Christmas adds items; no new mechanism.
- `core/src/costumes.ts`: append (never reorder; ids are in bags) `costume(2, ...)` Christmas items on `holiday: "christmas"`
  (e.g. "Nisse beard" glasses slot needs a `slot` generalisation; or hat-only: "Reindeer antlers", "Santa hat"; Julehue stays
  as the free calendar item). `COSTUME_BASE`/index grows; `costumeAt` unchanged.
- Art: 2D `web/src/art/editions.ts` (keyed by id), 3D `HAT_BUILDERS` in `gear3dHead.ts`.
- Optional per-costume window: add `window?: {before:number; after:number}` to `Costume`, defaulting to `ON_SALE`, used by
  `onSale`. Christmas wants before 21 / after 3 so it spans December gift-buying. Server and client share `onSale`, so
  enforcement follows automatically (`coins.ts:415`).
- Shop banner: `web/src/hud/Shop.tsx:133` area shows "Seasonal: until <dateLabel(holiday, now, after)>" using `festiveNow()`.

### 2.6 Cosmetics wearing the theme
Earned/free items stay in `costumes.ts` (`earned:`) or `december.ts` DOORS. People/pets rendering is untouched except the
hat registry; players keep costumes all year (existing behaviour).

## 3. Performance and the disable setting

Rules:
1. The theme is a *layer*, never a bake input, except through one coarse key. 2D sprite/ground bakes and the 3D town bake on
   `lookKey`. If any baked art must change (snow-dusted trees, orange-lit house roofs), append `festiveKey(f)` to the key used
   by `seasonLookNow().key` (`web/src/game/seasons.ts:35`). Quarter buckets bound it to <= 4 rebakes per window, and
   `""` outside windows keeps the cache hot all year. Prefer overlays (props, lights) so even that is rarely needed.
2. Tint, fog, accent colours: constants and one mix per 2 s (2D) or per frame uniforms (3D); no allocations (reuse `RGB` tuples).
3. 3D: lazy build, `mergeStill` for static parts (a string of lights = one merged mesh + one `live` emissive material),
   `userData.nobatch` for calendar-toggled groups, no per-light `THREE.PointLight` (use emissive and the existing night
   pipeline bloom/haze instead). Cap particle effects by `GraphicsSettings.weather` density and `reduceMotion`.
4. Tier policy: Low (2D) and Medium get props + tint + music but no animated twinkle/mist particles; High/Ultra get all.
5. Cache `festiveNow()` per minute, like `pumpkinsOutNow`; never call `near()` per frame.

Setting: add `seasonal: boolean` (default true) to `GraphicsSettings` and `Overrides` in `web/src/settings/graphics.ts`
(`resolveSettings`: `overrides.seasonal ?? true`; Overrides already derives from the interface so it persists with the
others). Surface it in the graphics settings panel beside the weather density control (grep the panel that edits `weather`).
Scope = visual and audio theme (tint, fog, props, seasonal music, HUD accent, toast). It does *not* hide shop stock or
costumes (those are commerce, driven by the calendar). Also force off when `reduceMotion` for the animated parts only.
`festiveNow()` returns null when off (unless URL pin), so every hook gets the disable for free.

## 4. Test plan

Unit (core), `core/test/festive.test.ts`, style of `core/test/holidays.test.ts` (`cph = copenhagenToMs`):
- Windows: Halloween on 30 Oct 00:00 CPH, 31 Oct 23:59 true; 29 Oct 23:59 and 1 Nov 00:00 false. Christmas 18 Dec 00:00 true,
  17 Dec 23:59 false, 25 Dec 23:59 true, 26 Dec 00:00 false.
- Timezone: `Date.UTC(2026,9,30,23,30)` = 31 Oct CPH => active, `days === 0`; `Date.UTC(2026,11,17,23,30)` = 18 Dec CPH => on;
  `Date.UTC(2026,11,25,23,30)` = 26 Dec CPH => off. DST edges: 2026-10-25 (clocks back) and 2027-03-28 do not change the
  answer for any window; a 23h/25h day still counts as one day.
- Year wrap: the window found from y-1 and y+1 (`festiveAt(cph("2027-12-20T12:00"))` on; `2027-01-03` off); a synthetic def with
  `before` crossing New Year (via `near("newYear", ...)`) still works; leap year (2028) unaffected.
- Intensity: monotonic non-decreasing through each window, in (0,1], equals 1 at/after the peak, continuous across midnight
  (difference between 23:59 and 00:00 small), and `festiveKey` takes <= 5 distinct values per window.
- Pins: `parseFestivePin` accepts `christmas`, `christmas@12-22`, `halloween@10-31T21:00`, `off`; rejects `foo`, `12-32`, empty
  (null); `02-29` handled; `festiveWith(pin, ms)` precedence; `off` beats the clock.
- Music: `themeOf("town", at, "halloween")` returns the variant; `inn` with `tavernSet` active wins; every theme still `THEME_STEPS`.
- Shop: `onSale` for the new Christmas costumes at window edges and the per-costume window; `costumeAt` ids stable (snapshot the
  existing two ids so nobody reorders).
- Placement: `christmas.ts` spots are all on grass and never on paths (as `core/test/halloween.test.ts`).
Web (`web/test/festive.test.ts`): cache behaviour across minute change; setting off => null; URL pin overrides off setting;
`resolveSettings` default `seasonal: true`.

QA script `scripts/qa/festive.mjs`, cloned from `scripts/qa/seasons.mjs` (same `openGame`, `signUp`, `ready`, `room`, `portals`,
`through`, `walkTile`, `OUT=` dir default `/tmp/festive`):
- Cases: `halloween@2026-10-30T19:00`, `halloween@2026-10-31T21:00`, `christmas@2026-12-18T15:00`, `christmas@2026-12-22T17:00`,
  `christmas@2026-12-24T18:00`, plus controls `2026-11-15T21:00` (no theme) and the same Halloween case with `off`.
- URL: `?sky=<iso>&weather=clear&theme=<id>` (and `&theme=off`). Stand at the square (town centre), wait 4 s, screenshot
  `${out}/${tier}-${case}.png`; run tiers `low` and `high` (arg, as seasons.mjs).
- Assert before shooting: `await page.evaluate(() => window.__tm.festive?.id ?? null)` equals the expected id and `page.errors`
  is empty; the control cases must be null. Fail the script on mismatch so it works as a smoke test, not only as pictures.
- Attach screenshots to the PR on the images-only branch (project convention), never in the PR branch.
Manual check list: toggle the setting live; open Shop on 31 Oct; leave the tab open across midnight 1 Nov (props vanish
without reload); check Low tier 2D and High tier 3D.

## 5. Rollout

Today is 2026-10-30; Halloween is tomorrow, and pumpkins plus the Jack-o'-lantern costume are already live (7/1 and 14/2 windows).

Phase 0 (ship today, minimal Halloween slice, constants only, no new art, no new music):
1. `core/src/festive.ts` with both defs (Christmas defined but unused), `festiveAt`, pin parser, `core/test/festive.test.ts`.
2. `web/src/game/festive.ts` wrapper + `?theme=` / `THEME_PIN` plumbing (server env, snapshot field, store).
3. Sky tint + night fog in `web/src/game/sky.ts` and `render3d/town/fx3d.ts` (purple-orange dusk, ground mist), keyed to intensity.
4. `seasonal` setting in `settings/graphics.ts` + panel toggle.
5. HUD toast "Happy Halloween" + `data-festive` accent.
6. `scripts/qa/festive.mjs` run once for low and high.
Skip anything that rebakes; skip music. Merge before the 31st, stays correct at 1 Nov with no cleanup because the window ends itself.

Phase 1 (Nov): Halloween v2 for next year, or skip: refactor `halloween.ts` to the lazy-build helper; spooky town theme; cobwebs
and ghosts. Cheap to defer: it only matters again in October 2027.

Phase 2 (before 18 Dec): Christmas core. `core/src/christmas.ts` placement, town tree stages, door wreaths, lights
strings (2D + 3D), warm window colours, Christmas tint, HUD accent, intensity-scaled tree.

Phase 3 (before 18 Dec, parallel): Christmas costumes in `costumes.ts`, art in `editions.ts` and `gear3dHead.ts`, shop banner,
per-costume window, shop tests. Server deploys first (item ids must exist before clients show them).

Phase 4 (polish, before 24 Dec): jingle town and tavern music, sleigh-bell drums, 24 Dec evening peak (gifts pile,
brighter lights), "N sleeps" toast copy, QA pass at all intensities.

Phase 5: retrospective; if a third theme appears (Easter, J-dag 6 Nov), it is one `FestiveDef` plus hook tables.

Risks: (a) a pinned theme never changes server shop enforcement, so shop QA needs a faked server clock; (b) festive music must not interrupt Tavern
jukebox ducking (`duckMusic` runs first, unchanged); (c) bake key growth if someone adds `festiveKey` to heavy sprites,
review rule: overlays first; (d) `festiveNow()` in render hot paths must stay cached.
