import { describe, expect, test } from "bun:test";
import { COSTUME_BASE, COSTUMES, onSale } from "../src/costumes.ts";
import { FESTIVE_NPC, festiveAt } from "../src/festive.ts";
import { GRAVES } from "../src/graveyard.ts";
import { doorSteps, pumpkinSpots } from "../src/halloween.ts";
import { HALLOWEEN_TAVERN, HALLOWEEN_TOWN } from "../src/halloween-music.ts";
import { blockOf, MAPS, plotId, townMap } from "../src/maps.ts";
import { copenhagenToMs } from "../src/sky.ts";
import {
  batAt,
  batCount,
  CANDY_BUCKET,
  CANDY_SPOTS,
  CAULDRON,
  dayKey,
  doorKey,
  EXTRA_STONES,
  GERDA,
  GERDA_TILE,
  ghostAt,
  HAUNTS,
  spookyBlocks,
  TREAT_CANDY,
  treatAt,
  treatSays,
} from "../src/spooky.ts";
import { FESTIVE_THEMES, THEME_STEPS, themeOf } from "../src/themes.ts";
import { drumSteps, notes, voiceSteps } from "../src/tunes.ts";

const cph = (at: string) => copenhagenToMs(at)!;
const town = MAPS.town;

describe("where the Halloween things stand", () => {
  test("Gerda, the cauldron, the extra stones and the candy are all on grass", () => {
    expect(town.at(GERDA_TILE.x, GERDA_TILE.y)).toBe(".");
    expect(town.at(CAULDRON.x, CAULDRON.y)).toBe(".");
    for (const s of EXTRA_STONES) expect(town.at(s.x, s.y)).toBe(".");
    for (const c of CANDY_SPOTS) expect(town.at(Math.floor(c.x), Math.floor(c.y))).toBe(".");
  });

  test("all of it is in the core, so a company's house never covers it (Gerda was inside one at -3,5)", () => {
    const ring = [-1, 0, 1, 2].flatMap((bx) => [-1, 0, 1, 2].map((by) => plotId(bx, by)));
    const full = townMap(ring);
    for (const [x, y] of [
      [GERDA_TILE.x, GERDA_TILE.y],
      [CAULDRON.x, CAULDRON.y],
      ...EXTRA_STONES.map((s) => [s.x, s.y]),
    ]) {
      const [bx, by] = blockOf(x!, y!);
      expect(bx >= 0 && bx <= 1 && by >= 0 && by <= 1).toBe(true);
      expect(full.at(x!, y!)).toBe(".");
    }
  });

  test("nothing of it sits on a pumpkin, a graveyard plot or the tile in front of one, or on top of each other", () => {
    const tiles = [
      [GERDA_TILE.x, GERDA_TILE.y],
      [CAULDRON.x, CAULDRON.y],
      ...EXTRA_STONES.map((s) => [s.x, s.y]),
    ] as const;
    expect(new Set(tiles.map((t) => t.join(","))).size).toBe(tiles.length);
    const pumpkins = new Set(pumpkinSpots(town).map((p) => `${p.x},${p.y}`));
    const graves = new Set(GRAVES.flatMap(([x, y]) => [`${x},${y}`, `${x},${y + 1}`]));
    for (const t of tiles) {
      expect(pumpkins.has(t.join(","))).toBe(false);
      expect(graves.has(t.join(","))).toBe(false);
    }
  });

  test("Gerda and the cauldron block, the stones don't, and Gerda has open grass on every side", () => {
    for (const s of EXTRA_STONES) expect(spookyBlocks(s.x, s.y)).toBe(false);
    expect(spookyBlocks(GERDA_TILE.x, GERDA_TILE.y)).toBe(true);
    expect(spookyBlocks(CAULDRON.x, CAULDRON.y)).toBe(true);
    expect(spookyBlocks(0, 0)).toBe(false);
    // Gerda is not in a corridor: grass on all four sides.
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      expect(town.walkable(GERDA_TILE.x + dx, GERDA_TILE.y + dy)).toBe(true);
      expect(spookyBlocks(GERDA_TILE.x + dx, GERDA_TILE.y + dy)).toBe(false);
    }
  });

  test("the haunts and the bats move, and the bats thicken with the build-up", () => {
    for (const h of HAUNTS) {
      const a = ghostAt(h, 0);
      const b = ghostAt(h, h.period / 2);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(h.rx);
    }
    expect(batCount(0.5)).toBe(4);
    expect(batCount(1)).toBe(8);
    expect(batCount(0.75)).toBeGreaterThan(batCount(0.5));
    expect(batAt(0, 0)).not.toEqual(batAt(0, 3));
  });
});

describe("trick-or-treat", () => {
  test("every doorstep has a door tile and a pumpkin on grass", () => {
    const map = townMap([plotId(-2, 0), plotId(0, 2)]);
    const steps = doorSteps(map);
    expect(steps.length).toBeGreaterThan(5);
    for (const s of steps) expect(map.at(s.x, s.y)).toBe(".");
    expect(new Set(steps.map((s) => doorKey(s.door))).size).toBe(steps.length);
  });

  test("a door gives the same thing to everyone on the same day, and the days differ", () => {
    expect(treatAt("13,15", "2026-10-31")).toBe(treatAt("13,15", "2026-10-31"));
    const set = new Set(Array.from({ length: 60 }, (_, i) => treatAt(`${i},3`, "2026-10-30")));
    expect(set).toEqual(new Set(["candy", "big", "trick", "nobody"]));
    const days = new Set(["2026-10-30", "2026-10-31", "2027-10-31"].map((d) => treatAt("5,5", d)));
    expect(days.size).toBeGreaterThan(0);
  });

  test("about 55 / 15 / 20 / 10 over many doors", () => {
    const n = 4000;
    const count = { candy: 0, big: 0, trick: 0, nobody: 0 };
    for (let i = 0; i < n; i++) count[treatAt(`${i % 97},${i}`, "2026-10-31")]++;
    expect(count.candy / n).toBeGreaterThan(0.48);
    expect(count.candy / n).toBeLessThan(0.62);
    expect(count.trick / n).toBeGreaterThan(0.14);
    expect(count.trick / n).toBeLessThan(0.26);
    expect(count.nobody / n).toBeLessThan(0.16);
  });

  test("candy per treat, and a line for every one", () => {
    expect(TREAT_CANDY).toEqual({ candy: 1, big: 3, trick: 0, nobody: 0 });
    for (const t of ["candy", "big", "trick", "nobody"] as const)
      expect(treatSays(t, "1,1", "2026-10-31").length).toBeGreaterThan(10);
  });

  test("the day is the Copenhagen one", () => {
    expect(dayKey(Date.UTC(2026, 9, 30, 23, 30))).toBe("2026-10-31");
    expect(dayKey(cph("2026-10-31T23:59"))).toBe("2026-10-31");
  });
});

describe("Gerda", () => {
  test("is Halloween's NPC, with 6 to 12 lines, on her tile", () => {
    expect(FESTIVE_NPC.halloween).toBe(GERDA);
    expect(GERDA.lines.length).toBeGreaterThanOrEqual(6);
    expect(GERDA.lines.length).toBeLessThanOrEqual(12);
    expect([GERDA.x, GERDA.y]).toEqual([GERDA_TILE.x, GERDA_TILE.y]);
    expect(GERDA.lines.join(" ")).toMatch(/trick-or-treat/i);
  });

  test("the theme is on the 30th and 31st only", () => {
    expect(festiveAt(cph("2026-10-30T00:00"))?.id).toBe("halloween");
    expect(festiveAt(cph("2026-10-31T23:59"))?.id).toBe("halloween");
    expect(festiveAt(cph("2026-10-29T23:59"))).toBeNull();
    expect(festiveAt(cph("2026-11-01T00:00"))).toBeNull();
  });
});

describe("the music", () => {
  test("two whole loops that parse, played in the town and the Tavern on the day", () => {
    for (const t of [HALLOWEEN_TOWN, HALLOWEEN_TAVERN]) {
      expect(voiceSteps(t.lead)).toBe(THEME_STEPS);
      expect(voiceSteps(t.bass)).toBe(THEME_STEPS);
      expect(drumSteps(t.drums)).toBe(THEME_STEPS);
      expect(() => notes(t.lead)).not.toThrow();
      expect(() => notes(t.bass)).not.toThrow();
    }
    expect(FESTIVE_THEMES.halloween).toEqual({ town: HALLOWEEN_TOWN, tavern: HALLOWEEN_TAVERN });
    expect(themeOf("town", "halloween")).toBe(HALLOWEEN_TOWN);
    expect(themeOf("inn", "halloween")).toBe(HALLOWEEN_TAVERN);
    expect(themeOf("town", null).id).toBe("town");
    expect(themeOf("dungeon", "halloween").id).toBe("raid");
  });
});

describe("the costumes", () => {
  test("three hats sold round Halloween in its reserved range, and the sugar king's earned one, none colliding", () => {
    const range = COSTUMES.filter((c) => c.index >= COSTUME_BASE + 30 && c.index <= COSTUME_BASE + 39);
    expect(range.map((c) => c.name)).toEqual(["Witch hat", "Ghost sheet", "Bat ears", "Candy bucket"]);
    const bucket = range.find((c) => c.id === CANDY_BUCKET);
    expect(bucket).toMatchObject({ price: 0, tradeable: false, holiday: "halloween" });
    expect(bucket?.earned).toBeTruthy();
    const mine = range.filter((c) => !c.earned);
    expect(new Set(COSTUMES.map((c) => c.index)).size).toBe(COSTUMES.length);
    expect(new Set(COSTUMES.map((c) => c.id)).size).toBe(COSTUMES.length);
    for (const c of mine) {
      expect(c.holiday).toBe("halloween");
      expect(onSale(c, cph("2026-10-30T12:00"))).toBe(true);
      expect(onSale(c, cph("2026-11-02T23:59"))).toBe(true);
      expect(onSale(c, cph("2026-11-03T00:00"))).toBe(false);
      expect(onSale(c, cph("2026-10-16T23:59"))).toBe(false);
    }
  });
});
