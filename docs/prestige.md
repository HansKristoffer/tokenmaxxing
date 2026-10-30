# Prestige

Past level 50 a player can choose to start another run: 50 levels of 1B tokens each, a coherent collection of
rewards, and a voluntary reset at the end. Five tracks to launch; more will follow with the same shape.
Catalogue: `core/src/prestige.ts`. Wearables sit at look indices 700+ (`PRESTIGE_BASE`), track n at `700 + n - 1`.

| Run level | Reward                                               |
| --------- | ---------------------------------------------------- |
| Enter     | Emblem and title (the tag)                           |
| 10        | Headwear                                             |
| 20        | Outfit                                               |
| 30        | Pet accessory                                        |
| 40        | Back item                                            |
| 50        | Aura and home trophy; eligible for the next prestige |

Coins: 10 a level, 100/200/300/400/750 at 10/20/30/40/50 (2,200 a run).

| #   | Track      | Colours             | Headwear            | Outfit               | Pet accessory        | Back             | Aura                 | Trophy                   |
| --- | ---------- | ------------------- | ------------------- | -------------------- | -------------------- | ---------------- | -------------------- | ------------------------ |
| I   | Ascendant  | violet, silver      | Ascendant visor     | Ascendant robes      | Silver pet circlet   | Runic cape       | Ascending sparks     | Ascendant obelisk        |
| II  | Cosmic     | cyan, midnight      | Starfield crown     | Nebula suit          | Starlight pet collar | Orbital backpack | Orbiting token sigil | Miniature orrery         |
| III | Voidwalker | obsidian, magenta   | Event-horizon visor | Voidwalker armour    | Eclipse pet crown    | Rift mantle      | Event-horizon ring   | Contained black hole     |
| IV  | Architect  | ivory, gold         | Architect's diadem  | Worldbuilder regalia | Clockwork pet halo   | Lattice wings    | Orbiting wireframe   | Holographic town         |
| V   | Prismatic  | pearl, every colour | Prismatic crown     | Prismatic regalia    | Prismatic pet crown  | Aurora wings     | Prismatic ascension  | Prismatic token monument |

Status: the catalogue, art, run state, claims, the prestige screen and the tag, pet accessory and trophy in the game are built (`feat/prestige-play`); collection log/badges and Prestige VI+ are still to come.
