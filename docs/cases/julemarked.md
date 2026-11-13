# Case 4: Julemarked (design brief)

Status: stage 1 (data, tests, this brief) is done; art (2D, then 3D) is the next step. No new shop: it is sold ONLY at the
Julemarked's Nissens bod (see "The market"), never at Natmarked: `CaseDef.shop` is `"julemarked"`, `casesOfShop` /
`NATMARKED_CASES` list what each place sells, and the server's `openCase` refuses it anywhere but the market room (and the
other cases there).
Code: `core/src/case-julemarked.ts` (30 wearables), `core/src/case-julemarked-furniture.ts` (6 pieces), the `julemarked`
entry in `core/src/cases.ts`. Tests: `core/test/case-julemarked.test.ts`, `server/test/town-cases.test.ts` ("a fourth case").

**Merge blocker for the art stage:** same as Ragnarok Eve's. The case is already in `CASES`, so once this lands on a deployed
server players can open it. Until the 2D and 3D art below exist, its pets draw as a duck in 3D, its wearables draw nothing, and a
placed piece has no sprite (`web/src/art/objects.ts` `FANCY` is built from `ALL_CASE_PIECES` with `fancyPiece(art)!`, so a
piece with no art would throw when drawn). Do not ship stage 1 alone to production; land it with the art, or gate the entry.

## The pitch

A Danish Christmas market on a cold December evening: wooden stalls strung with fairy lights, the smell of gløgg and burnt
almonds, paper hearts, candles in every window, and a nisse who has been watching the porridge since before you arrived. Hygge,
not Hollywood: this is the Danish Christmas (nisser, Lucia, julehjerter, the Yule goat, the julemand from Greenland), not an
Americanised Santa-and-reindeer one. Night Market is neon and lacquer, Nusantara is tropical, Ragnarok Eve is oak and iron;
this is wool, candlelight and red-and-white paper.

- Case name: **Julemarked case**. Id `julemarked`. Blurb: "Nisser, gløgg, paper hearts and candles from a Danish Christmas market."
- Key price 75 (a Christmas price; the others cost 100), odds 0.475 / 0.25 / 0.15 / 0.10 / 0.025, `rareWithin` 10, `dupeRerolls` 1 (`STANDARD_ODDS`, as every case).
  Pool = 30 wearables + 6 pieces = 36 items.

## Look-index ranges

| Range      | Owner                                    |
| ---------- | ---------------------------------------- |
| below 300  | shop, editions, costumes, loot           |
| 300 to 399 | Night Market (`CASE_BASE`)               |
| 400 to 499 | Nusantara                                |
| 500 to 599 | Ragnarok Eve (`RAGNAROK_BASE = 500`)     |
| 600 to 699 | pond treasures (`FISHING_BASE = 600`)    |
| 700 to 799 | prestige tracks (`PRESTIGE_BASE = 700`)  |
| 800 to 899 | Julemarked (`JULEMARKED_BASE = 800`)     |

**Why 800 and not 600:** 600 to 699 was already taken by the fishing loot (`core/src/fishing-loot.ts`) and 700 to 799 by the
prestige rewards, so the first free hundred is 800. Each slot counts from 800 (`slot.800`, `slot.801`, ...). Item id is
`<slot>.<index>`; furniture is `furn.<ch>`. `caseAt` searches `ALL_CASE_ITEMS`, so `parseLook` and `web/src/art/editions.ts`
already accept every index below; `ALL_CASE_PIECES` carries the furniture.

## Palette

Warm and woolly, with candlelight. Nisse red `#b8302c`, cream `#f4ecd8`, forest green `#2f5d3a`, candle gold `#f2c14e`, warm wood
`#a06a3c`, Dannebrog red `#c8102e` with white `#ffffff`, pebernød brown `#6b3f22`, frost blue `#bcd8e8`, wool grey `#8a8f98`. Ink
outline is `C.ink` as everywhere. Avoid Night Market's plum, crimson lacquer, neon pink and cyan; Nusantara's batik and tropical
colours; and Ragnarok's iron, ember orange, aurora green and violet (Nordlys is the one place green shows, and it stays pale and
soft). Keep the red warm and matte; reds in this case are felt, wool and paper, never glossy.

## The 30 wearables

Per-slot index is `800 + n`. "Draw" notes are for 2D pixel art and the 3D model alike.

| Slot    | Name                | Rarity    | Idx | Blurb                                                                                    | How to draw it                                                                                                                        |
| ------- | ------------------- | --------- | --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| hat     | Nissehue            | common    | 800 | Red, a bit too long, and flops over your eyes exactly when it matters.                   | Tall nisse red cone that slumps to one side with a cream fold at the brim; 3D a bent stack of shrinking cylinders.                    |
| hat     | Pomponhue           | common    | 801 | Knitted by someone who loves you, with a bobble the size of a plum.                      | Cream and red knitted beanie with a rib band and a large cream pompom; hint of stitch rows.                                           |
| hat     | Grankrans           | common    | 802 | A pine wreath with a red ribbon, worn as a crown. It sheds, regally.                     | Ring of forest green needles with a few gold dots and a red bow at one side; 3D a torus of small green cones.                         |
| hat     | Lucia-krone         | uncommon  | 803 | A crown of candles. Please walk slowly and avoid the tinsel.                             | Green leaf ring with three to five small white candles, each with a gold flame (1 px flicker). Cartoon flames, no real glow spill.    |
| held    | Gløgg mug           | common    | 800 | Hot, spiced and full of raisins. You will be chewing it for a week.                      | Cream mug with a red band, dark wine liquid, an almond and a raisin on top, two steam pixels.                                         |
| held    | Brændte mandler     | common    | 801 | A paper cone of burnt almonds, gone before you reach the next stall.                     | Cream cone with a red stripe, brown glazed almonds poking out the top, sugar sparkle.                                                 |
| held    | Æbleskiver          | common    | 802 | A plate of puffs with jam and powdered sugar. The sugar is on everything now.            | Round plate with five golden-brown spheres dusted white, a red jam dollop; held flat at hip height.                                   |
| held    | Pebernød tin        | common    | 803 | Tiny pepper nuts by the hundred. There is always one more.                               | Red round tin with a white lid, a hearts-and-stars band, a few pebernød brown nuts spilling.                                          |
| held    | Flæskestegssandwich | uncommon  | 804 | Paper-wrapped roast pork with crackling. The crackling is the whole point.               | Half-unwrapped bun in a cream paper sleeve, pink pork slices, a crisp amber crackling edge, a red-cabbage dot.                        |
| glasses | Kolde kinder        | common    | 800 | Two rosy stripes of cold cheek. The walk from the bus did that.                          | Two soft rose stripes across the cheek line under the eyes, no frame.                                                                 |
| glasses | Julelys-briller     | common    | 801 | Frames made of tiny fairy lights. They blink out of time with each other.                | Round frames drawn as a chain of 1 px bulbs in red, gold, green; 2 frames alternate which bulbs are lit.                              |
| glasses | Nissebriller        | uncommon  | 802 | Round gold specs and fluffy white brows. The nisse sees everything, and says nothing.    | Thin round candle gold lenses, two fluffy white tufts above them as brows.                                                            |
| outfit  | Islandsk sweater    | common    | 800 | A thick wool yoke in cream, red and green. It will outlive you.                          | Cream jumper, a red and green patterned yoke band across the shoulders (diamonds, not snowflakes), ribbed hem.                        |
| outfit  | Bagerforklæde       | common    | 801 | Dusted with flour, and with something that was definitely a cinnamon swirl.              | Cream apron over a red shirt, flour smudges, a cinnamon-brown stain, white neck loop and a rope tie.                                  |
| outfit  | Nissedragt          | uncommon  | 802 | Grey wool, a red cap and a quiet watch over the barn.                                    | Wool grey jacket and knee trousers, a nisse red collar and scarf, cream stripes at the cuffs, wooden clogs; pairs well with the hat.  |
| outfit  | Dannebrog-trøje     | uncommon  | 803 | A red sweater with the white cross, knitted for cold quays and cold football.            | Dannebrog red knit with a white offset Nordic cross on the chest (long arm to the right). Flat design, not a flag held up.            |
| outfit  | Julemandsdragt      | rare      | 804 | The Danish julemand: red suit, white beard, and a long walk up from Greenland.           | Nisse red coat with a cream fur trim, black belt with a gold buckle, white beard baked into the head, a boot. No reindeer, no sleigh. |
| outfit  | Lucia-tog           | epic      | 805 | A white gown, a red sash and a procession of candles, all singing in tune.               | Long white gown, a red sash from shoulder to hip, a small candle in each hand; flames get a 1 px flicker.                            |
| back    | Gavesæk             | uncommon  | 800 | A sack of gifts over one shoulder, and one of them is for you.                           | Round warm wood-brown sack tied with a red cord, a gift corner (green and red) peeking out; 3D a lumpy sack with a slight swing.      |
| back    | Julehjerte-vinger   | epic      | 801 | Woven paper hearts in red and white, folded into wings. Sturdy, and also very pretty.    | Two wings built from woven heart pockets (red and white weave), three hearts per wing. 2 frames flutter.                              |
| pet     | Rødkælk             | rare      | 800 | A robin on a snowy branch, puffed up to twice its size.                                  | Round brown bird with an orange-red breast and a thin white hint of snow on the back; hop frames. 12x10, two frames.                  |
| pet     | Marcipangris        | rare      | 801 | A marzipan pig with a red bow. Lucky, sweet, and gone by Twelfth Night.                  | Pale pink-beige pig with a matte marzipan sheen, three dark dots (eyes and snout) and a small red bow on the ear.                     |
| pet     | Nissekat            | rare      | 802 | The nisse's cat, in a little red cap. She is the one who is really in charge.            | Grey tabby cat, a tiny nisse red cap tilted between the ears, a curled tail; tail flick on frame 2.                                   |
| pet     | Julesvaneand        | rare      | 803 | A duck in a nissehue, because the town deserves one.                                     | The plain duck shape with a red nisse hat on its head and a cream rim; waddle frames. It is a joke, play it straight.                 |
| pet     | Julebuk             | epic      | 804 | The straw Yule goat. It guards the tree and has opinions about the decorations.          | Golden straw goat with bound red ribbon at the neck, short horns of straw and little tied hooves, a stiff stand-up beard.             |
| pet     | Lygtenisse          | epic      | 805 | A tiny nisse with a lantern. Follows you home so nobody trips on the ice.                | Tiny nisse in grey and red, white beard, a gold lantern swinging on frame 2 and casting a soft pool of light.                         |
| aura    | Julestjerne         | legendary | 800 | Warm paper stars drift round you, folded one point at a time.                            | Five to six woven four- and eight-point paper stars in red, white and gold orbiting in a slow ring at different heights.              |
| aura    | Adventskrans        | legendary | 801 | Four candles flicker in a ring. Each Sunday there is one more.                           | Four candles with gold flames circling the body at hip height on a thin green wreath ring; flames flicker out of phase.               |
| aura    | Snefnug             | legendary | 802 | A swirl of fresh snow that never quite reaches the ground.                               | Frost blue and white flakes spiralling down in a wide column; a mix of 1 px and plus-shaped flakes, drifting not blizzard-fast.      |
| aura    | Nordlys             | legendary | 803 | Ribbons of northern lights, dancing over the harbour of your shoulders.                  | Two or three soft vertical curtains in pale green with a hint of frost blue, rippling slowly behind and around. Calm, no neon.        |

Auras: 2D frame is 28x28 with the 16x16 character at (6,6), 8 frames, `CA_MS` 170 (as `case-aura.ts`). Pets: 12x10 facing
right, two hop frames. Rarity counts: 11 common, 6 uncommon, 5 rare, 4 epic, 4 legendary (tested).

## The 6 furniture pieces

| Char | Art id            | Name                 | Rarity   | Placement | w   | Blurb                                                                                                    | How to draw it                                                                                                                      |
| ---- | ----------------- | -------------------- | -------- | --------- | --- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Ъ    | jul-heart-garland | Julehjerte-guirlande | common   | wall      | 2   | A garland of woven paper hearts, each one a little crooked on purpose.                                   | A line of red and white woven hearts hanging in a gentle swag from two pins; 2 frames sway.                                         |
| Є    | jul-kalenderlys   | Kalenderlys          | common   | floor     | 1   | A candle marked with the days of December. Today is further down than you think.                        | Tall cream candle in a small holder with day marks 1 to 24 along its side (a few numerals only), a gold flame (2 frames).            |
| Ђ    | jul-pebernod-bowl | Pebernødskål         | common   | floor     | 1   | A bowl of pepper nuts, topped up every time you look away.                                               | Red-banded cream bowl heaped with pebernød brown nuts, a few on the table beside it.                                                |
| Ћ    | jul-advent        | Adventsstage         | uncommon | floor     | 1   | Four candles on a stand. Light one more each Sunday, and wait.                                           | A small green wreath on a wooden stand, four candles (three lit, one waiting), a red ribbon. Flames flicker in 2 frames.            |
| Џ    | jul-kravlenisse   | Kravlenisse          | uncommon | floor     | 1   | A tiny paper nisse peering over the edge of the furniture. He is keeping an eye on the porridge.         | The signature piece: a small cut-paper nisse in a red hat, only head and hands visible over a ledge, eyes blinking on frame 2.      |
| Љ    | jul-tree          | Juletræ              | rare     | floor     | 3   | A Danish tree with woven hearts, paper flags and real candles. The whole family dances round it.         | A tall spruce, woven red-and-white hearts, a string of small Danish paper flags, candle flames (2 frames) and a gold star on top.   |

`Ъ Є Ђ Ћ Џ Љ` (U+042A, U+0404, U+0402, U+040B, U+040F, U+0409) are Cyrillic and none has a decomposed form or a Latin lookalike
(avoid Ё, Й, Ї, which decompose under NFD). The uniqueness test (`case-julemarked.test.ts`) checks no map, legend, catalog
or other case's piece uses any of the six. The wreath piece is named "Adventsstage" (not "Adventskrans") because the shop
requires every item name to be unique and the aura is called Adventskrans.

## The market

The case is also sold at a seasonal Christmas market in town, the **Julemarked**. It is not a shop (no `ShopId`, no entry in
`SHOP_ROOM`); Natmarked stays the case shop for the other cases and `CASE_SHOP_ID` is unchanged; this case is sold only here. Code: `core/src/julemarked.ts` (tiles,
plan, stalls), `julemarkedOn` in `core/src/december.ts`, the gate's `portal()` branch in `core/src/world.ts`. Art: 2D in
`web/src/art/julemarked.ts`, 3D in `web/src/render3d/town/julemarked-parts.ts` (the gate and the shared strings of lights and
bunting) and `web/src/render3d/rooms/julemarked3d.ts` (the courtyard). QA: `bun scripts/qa/julemarked.mjs both`.

- **The gate.** A permanent, reserved 10x9 block next to the square, at block (1, -1) (north of the square, beside Torvehallen's
  side of the town): a lawn, a 7x3 gate and the path down to the road. Two red-brick gate huts under snow roofs with a red
  stripe, a timber beam with the JULEMARKED sign, a wreath, red-and-white bunting and fairy lights, and a lit glimpse of the
  market through a three-tile opening (the portal tiles `Ȣ`; the rest of the gate is `Ǻ`). Companies never build there
  (`frontier` leaves it out and `shopBlocks` keeps shops off it); a company that already held the block keeps it and the
  gate takes the free block nearest the square (`julemarkedBlock`).
- **Open dates.** The gate is open from J-dag (first Friday of November) through 26 December, Copenhagen time
  (`julemarkedOn(ms)`, built on `holidays.ts` `near`/`daysFrom`). Outside that the gate stays where it is but `portal()` answers
  with a notice ("The Julemarked gate is shut. The market is open from J-dag to 26 December.") and nobody goes in. Anyone
  inside when it closes can still walk out; the exit is not date-gated. There is no env bypass.
- **The courtyard.** A separate room, `julemarked` (a `MapId` and a `RoomId`, in `FIXED_ROOMS`), 24x16, walled and outdoors: it
  gets the sky, the weather and the snow like the town (2D `outdoors`, 3D `outdoors: true`). Paving like the square's, a low
  snow-capped brick wall all round, one exit `x` in the bottom wall that leads back out through the gate, lamp posts, strings of
  fairy lights and red-and-white bunting, and a Christmas tree (2x2 tiles, `Ȝ`) in the middle.
- **Four stalls**, 5x3 tiles each, snow-white roofs with red stripes, each with its own tile character and a name board:
  - **Nissens bod** (`Ǥ`, top left): the case stall. E on it opens the existing case panel (`caseShop`) on the Julemarked
    case (`shelf` = its index in `CASES`). The server's `inCaseShop` accepts the room `julemarked` as well as Natmarked, so a case
    opened here is charged and rolled exactly as in the hall. Gift crates and a nisse on the counter.
  - **Julegodter** (`Ǫ`, top right): warm things to hold, for coins (tab "In hand").
  - **Julepynt** (`Ȃ`, bottom left): furniture for your own office, for coins (tab "Furniture").
  - **Den varme bod** (`Ʃ`, bottom right): a hat, two outfits and two pets, for coins (tabs Hats, Clothes, Pets).
- **The three other stalls sell for coins** (see "The coin stalls" below): E on one opens the existing Shop page on that stall's
  goods only. No `ShopId`: `Item.stall` marks a stall's goods, `stallOfItem` (`core/src/julemarked-shop.ts`) says which, and
  the server's `buy` accepts them only while the buyer is in the room `julemarked` (`inShop(..., "julemarked")`; elsewhere
  `not_in_shop`). The season gate is the gate's: the room is only reachable J-dag to 26 December.
- **Rules.** No Santa, sleigh or reindeer (see the rules above): wool, brick, paper hearts and candlelight. Reds are matte.
  The tile characters are unique across the repo (`Ǻ Ȣ Ǥ Ǫ Ȃ Ʃ Ȝ`); the case-piece characters are the Cyrillic ones listed above.

## The coin stalls

Data: `core/src/julemarked-shop.ts` (names, blurbs, prices, chars; `STALL_TABS`, `STALL_HELLO`, `stallOfItem`, `stallAt`).
Tests: `core/test/julemarked-shop.test.ts`, `server/test/world-shops.test.ts` ("coin stalls"). Look indices count from
`STALL_BASE = 900` (the case's 800 to 899 stay its own); `parseLook` accepts them through `stallAt`. Every item is
coin-priced, tradeable, not in any case (`case`/`loot`/`earned` unset), and unique by id and name across `ITEMS` (the
brief asked for "Julestjerne" for the wall star, but the aura has that name, so the star is **Adventsstjerne**; the art id is
still `jst-star`). Julepynt's five pieces are appended to `HOME_PIECES` (`SHOP_HOME_PIECES` is Møbelhuset's own list) with
`stall: "pynt"`, so every home-piece table (office, maps legend, 2D `objects`, 3D `room-furnished`) already includes them;
the Shop page lists a stall's goods only on its own page and never in Møbelhuset, Thread & Token or the pet shop.

### Julegodter (`Ǫ`): things to hold

| Slot | Id       | Idx | Name               | Price | Blurb                                                                                   |
| ---- | -------- | --- | ------------------ | ----- | --------------------------------------------------------------------------------------- |
| held | held.900 | 900 | Varm kakao         | 15    | Hot, thick and topped with cream. Your hands will not give it back.                     |
| held | held.901 | 901 | Klejner            | 20    | Twisted fried dough, dusted with sugar. Technically a knot, spiritually a hug.          |
| held | held.902 | 902 | Risengrød med smør | 25    | Rice porridge with a pat of butter. The almond is in someone else's bowl, probably.     |
| held | held.903 | 903 | Marcipanbrød       | 30    | A loaf of marzipan under dark chocolate. Slice it thin; you will not.                   |
| held | held.904 | 904 | Sukkerstang        | 15    | Red and white and sticky to the elbow. Lasts until the next stall.                      |

### Julepynt (`Ȃ`): furniture for your own office

| Char | Item id | Art id        | Name           | Price | Placement | w | Text (E)                                                                                       |
| ---- | ------- | ------------- | -------------- | ----- | --------- | - | ---------------------------------------------------------------------------------------------- |
| Ѫ    | furn.Ѫ  | jst-star      | Adventsstjerne | 60    | wall      | 1 | A paper star in the window, lit from inside. It is always on, and nobody remembers switching it on. |
| Ѧ    | furn.Ѧ  | jst-kalender  | Julekalender   | 90    | wall      | 1 | Twenty-four little doors. Someone has already opened tomorrow's. It was you.                   |
| Ѱ    | furn.Ѱ  | jst-nissedoer | Nissedør       | 70    | wall      | 1 | A very small door at the foot of the wall. Leave porridge, and do not ask what for.            |
| Ѯ    | furn.Ѯ  | jst-bordtree  | Bordjuletræ    | 120   | floor     | 1 | A tabletop tree with a string of lights and four paper hearts. Hygge, at desk height.          |
| Ѭ    | furn.Ѭ  | jst-gaver     | Gavestabel     | 80    | floor     | 1 | A neat stack of wrapped gifts. All of them are for you, and one is socks.                      |

`Ѫ Ѧ Ѱ Ѯ Ѭ` (archaic Cyrillic, U+046A, U+0466, U+0470, U+046E, U+046C) are unused anywhere else, with no decomposed form and no
Latin lookalike. The Nissedør is a wall piece drawn as a tiny door at the wall's foot (it must read at one tile wide, 16 px tall
like the other wall pieces).

### Den varme bod (`Ʃ`): hat, outfits, pets

| Slot   | Id         | Idx | Name          | Price | Blurb                                                                                 |
| ------ | ---------- | --- | ------------- | ----- | ------------------------------------------------------------------------------------- |
| hat    | hat.900    | 900 | Øreværmere    | 40    | Wool earmuffs that make every compliment sound far away.                              |
| outfit | outfit.900 | 900 | Strikket sæt  | 70    | A knitted jumper with matching mittens, made by someone with too much time and love.  |
| outfit | outfit.901 | 901 | Uldfrakke     | 100   | A long wool coat. It has outlived two winters and a bad haircut.                      |
| pet    | pet.900    | 900 | Gråspurv      | 90    | A fluffed-up sparrow that has decided your shoulder is the warm one.                  |
| pet    | pet.901    | 901 | Snehare       | 120   | A white hare in a white drift. You find it by the nose, not the eyes.                 |

Art stage for the stalls: hygge and wool, the same palette and rules as the case. Rarity is not set (the shop falls back to
the price: all are common).

### Art checklist for the coin stalls (nothing drawn yet)

Until these exist the five `web/test` checks that enumerate home pieces fail (`furniture-home.test.ts` "every personal-office
piece has its art", `item-parity.test.ts` "every piece has a 2D sprite and a 3D asset", "a piece's footprint, name and price...",
"facing and placement agree", "a sofa-like personal piece seats in 3D as it does in 2D"), and the wearables and pets draw
nothing (pets as a duck in 3D). Already wired for you: `web/src/art/editions.ts` `artOf` resolves hat and glasses ids through
`stallAt`; the Shop page (`web/src/hud/Shop.tsx`, `store.ts` panel `{ kind: "shop", stall, tab }`, `game/input.ts` E on a stall
tile). Do NOT add the Julepynt pieces to Møbelhuset's 3D shop rows (`render3d/shops/data/furniture.ts` `HOME_ROWS`).

2D (`web/src/art`)

| File | Add |
| ---- | --- |
| `case.ts` or a new `julemarked-stall-wear.ts`, merged where `editions.ts` reads `HATS` | hat `"hat.900"` Øreværmere (`HATS` is keyed by item id; 16 wide `down`/`side`/`pal` like the pack's hats) |
| `wardrobe.ts` (`OUTFITS`, `HELD`; merge as the case tables are, ~line 667) | outfit indices `900` Strikket sæt and `901` Uldfrakke (six `marks` views each, like `OUTFITS`); held indices `900` to `904` (Varm kakao, Klejner, Risengrød med smør, Marcipanbrød, Sukkerstang) |
| `pet-base.ts` (`PETS[900]`, `PETS[901]`) | Gråspurv and Snehare, 12x10 facing right, two hop frames (`julemarked-stall-pets.ts`, then `PETS[STALL_BASE + n] = pet`) |
| `furniture-home.ts` (`HOME_FURNITURE`, exported to `furniture-fancy.ts` `fancyPiece`) | ids `jst-star` (wall, w1, 16 px tall), `jst-kalender` (wall, w1, 16 px), `jst-nissedoer` (wall, w1, a tiny door at the wall's foot, 16 px), `jst-bordtree` (floor, w1), `jst-gaver` (floor, w1) |
| `objects.ts` | nothing: `FANCY` and the wall offset are built from `HOME_PIECES`, which now includes the five |
| `tiles.ts` | nothing: wall pieces are picked from `HOME_PIECES` by `p.wall` |

3D (`web/src/render3d`)

| File | Add |
| ---- | --- |
| `people/gear3d.ts` + `people/gear3dHead.ts` | hat `"Øreværmere"` (keyed by item NAME); held builders keyed by NAME: `"Varm kakao"`, `"Klejner"`, `"Risengrød med smør"`, `"Marcipanbrød"`, `"Sukkerstang"` (`gear3d.ts` builds from `ITEMS`, so `itemAt` already finds all of them) |
| `data/gear.ts` (`EXTRA_OUTFITS`) | outfit palette `[main, shade, trousers]` for indices `900` and `901`; outfit builders by index if the Julemarked body file uses them (`OUTFIT_BUILDERS[900]`, `[901]`) |
| `data/pets.ts` | a range entry `{ base: 900, species: ["graaspurv", "snehare"] }` in `CASE_PET_RANGES`, the `Species` and `PET_NAME` entries (`Gråspurv`, `Snehare`) and pet builders in `pets/pets3d.ts` (unknown species are a duck) |
| `furniture/` (a new `jst3d.ts`, spread into `furniture3d.ts`'s assets) | `jst-star`, `jst-kalender`, `jst-nissedoer`, `jst-bordtree`, `jst-gaver`, each w1; add `jst-star`, `jst-kalender`, `jst-nissedoer` to `WALL_ASSET_IDS` (they build on y = 0 facing +z and hang) |
| `icons.ts`, `rooms/room-furnished.ts` | nothing: both bind from `HOME_PIECES` |
| `rooms/julemarked3d.ts` (stall props) | optional: goods on the stall counters match the wares |

## Rules for the art agents

- **Hygge, not Americanised Santa.** The julemand suit is trimmed and plain; no reindeer, sleigh, candy canes, stockings or
  "Ho ho ho". Nisser are small farm spirits, not elves: grey wool, red cap, white beard, porridge.
- **Dannebrog** (red with an offset white cross, long arm to the fly) appears only on the sweater and as small tree flags,
  drawn as a clean, respectful design. No flags waved by a character.
- **Candles:** cartoon flames only, no fire hazards and no wax-drip gore; on Lucia items the candles sit in a ring.
- **Lucia** is a Scandinavian festival of light; treat it as a gentle, warm ceremony (white gown, red sash, candles), not a costume gag.
- **Alcohol:** gløgg is shown as a warm spiced drink in a mug with raisins and almonds; nothing that reads as a bottle or a bar.
- Palette discipline: no neon, no gloss, no saturated green outside the Nordlys aura.

## Box and key (2D `caseBoxSprite`, 3D `buildCaseBox`/`buildCaseKey`)

- Box: a wooden market-stall gift crate. Warm wood planks in `#a06a3c`, a red-and-white striped awning lid, a green
  spruce sprig and a red ribbon, a small woven heart on the front, a snow dusting along the lid edge. 24x28 canvas like the
  others so `CASE_BOX_SIZE` stays valid.
- Open frame: lid up, warm candle-gold light spilling out; frame 0 a puff of flour-fine snow, frame 1 a few drifting paper stars.
- Key: a gold coin on a red-and-white twisted cord with a tiny woven heart stamp. 16x24.

## Opening animation (HUD, `CaseOpening.tsx`)

- The strip uses a cream background with a faint red-and-white heart pattern.
- The pointer is a tiny nisse that tips his cap on each tick.
- Rare and better get a soft bell chime (a synthesized bell triad through the existing `tone`/`audio` in `jukebox.ts`).
- Legendary adds slowly falling snow over the strip and a candle-gold glow over the winning tile.

## Art checklist: what the art stages hook into

Nothing was stubbed in stage 1; tables for look indices 800 to 899 and the `jul-*` art ids are simply absent, so the case is
incomplete until they are added. The numbering for the art tables is the look index (`JULEMARKED_BASE + n`) unless noted.

### 2D (`web/src/art`)

| File                              | What to add                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `case.ts`                         | hats `"hat.800"`..`"hat.803"` and glasses `"glasses.800"`..`"glasses.802"` keyed by item id (see how Ragnarok and the pond merge in)       |
| `editions.ts` (`artOf`)           | spread the Julemarked tables into the `CASE_HATS`/`CASE_GLASSES` lookup                                                                    |
| `case-julemarked-body.ts` (new)   | outfits 800..805 (six `marks` views each), held 800..804, backs 800..801                                                                   |
| `wardrobe.ts` (~line 667)         | merge those outfit, held and back tables, as for Ragnarok                                                                                  |
| `case-julemarked-pets.ts` (new)   | pets 800..805 (12x10, two frames) and `pet-base.ts`: `PETS[JULEMARKED_BASE + i] = pet`                                                     |
| `case-julemarked-aura.ts` (new)   | auras 800..803 (28x28, 8 frames) and the `case-aura.ts` `DRAWS` merge                                                                      |
| `case-box.ts`                     | a Julemarked chest and key variant (and the `CaseShop.tsx`/`CaseOpening.tsx` callers)                                                      |
| `furniture-home.ts`, `furniture-fancy.ts` | a `JULEMARKED_FURNITURE` list with the six `jul-*` ids and `fancyPiece(id)` searching it (`objects.ts` `FANCY` needs it non-null)  |

### 3D (`web/src/render3d`)

| File                                    | What to add                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `case-box3d.ts`                         | the stall crate and gold coin key                                                                                                                   |
| `pets/*`, `data/pets.ts`                | a Julemarked pet base (800) and species list (`speciesAt`, `Species`, `PET_NAME`); unknown species fall back to a duck                             |
| `people/gear3dJulemarkedBody.ts` (new)  | outfits at `JULEMARKED_BASE + n`, held and back builders keyed by item NAME; import it from `people/gear3d.ts`                                     |
| `people/gear3dAura.ts`                  | `"Julestjerne"`, `"Adventskrans"`, `"Snefnug"`, `"Nordlys"` keyed by NAME                                                                           |
| `people/gear3dHead.ts`                  | hats `"Nissehue"`, `"Pomponhue"`, `"Grankrans"`, `"Lucia-krone"`; glasses `"Kolde kinder"`, `"Julelys-briller"`, `"Nissebriller"`                  |
| `data/gear.ts`                          | outfit palette `[main, shade, trousers]` keyed by index 800..805                                                                                    |
| `furniture/jul3d.ts` (new)              | `JUL_ASSETS` for the six `jul-*` ids; spread into `furniture3d.ts`; add `"jul-heart-garland"` to `WALL_ASSET_IDS`                                   |
| `icons.ts`, `rooms/room-furnished.ts`   | already wired through `ALL_CASE_PIECES`; nothing once the assets exist                                                                              |

### HUD

`web/src/hud/CaseOpening.tsx` and `CaseShop.tsx` read `CASES` and `def.items`; the per-case strip colours, pointer and sounds
above are extras.
