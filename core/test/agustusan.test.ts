import { describe, expect, test } from "bun:test";
import {
  AGUSTUSAN_NPC,
  anniversary,
  BUNTING_ROWS,
  blockedTiles,
  climb,
  flagSpots,
  flagsUp,
  GAPURA,
  KERUPUK,
  NPC_TILE,
  PANJAT,
  PANJAT_TOP,
  SACK,
  SQUARE_FLAGS,
  standing,
  TUMPENG,
} from "../src/agustusan.ts";
import { COSTUME_BASE, COSTUMES, onSale } from "../src/costumes.ts";
import { FESTIVE, FESTIVE_NPC, festiveAt, festiveNpcOf } from "../src/festive.ts";
import { MAPS } from "../src/maps.ts";
import { copenhagenToMs } from "../src/sky.ts";
import { FESTIVE_THEMES, festiveTheme, THEME_STEPS, themeOf } from "../src/themes.ts";
import { drumSteps, notes, voiceSteps } from "../src/tunes.ts";
import { route } from "../src/world.ts";

const town = MAPS.town;
const cph = (iso: string) => copenhagenToMs(iso)!;

describe("agustusan: the build-up", () => {
  test("it is on 10 to 17 August only, and off on the 9th and the 18th", () => {
    expect(festiveAt(cph("2026-08-09T23:59"))).toBeNull();
    expect(festiveAt(cph("2026-08-10T00:00"))?.id).toBe("agustusan");
    expect(festiveAt(cph("2026-08-17T23:59"))?.id).toBe("agustusan");
    expect(festiveAt(cph("2026-08-18T00:00"))).toBeNull();
  });

  test("the gate, the lomba and the tumpeng come out on their days", () => {
    expect(standing(-7)).toEqual({ flags: true, gapura: false, lomba: false, play: false, tumpeng: false });
    expect(standing(-5).gapura).toBe(true);
    expect(standing(-4).lomba).toBe(false);
    expect(standing(-3)).toMatchObject({ lomba: true, play: false, tumpeng: false });
    expect(standing(-2).play).toBe(true);
    expect(standing(-1).tumpeng).toBe(true);
    expect(standing(0)).toEqual({ flags: true, gapura: true, lomba: true, play: true, tumpeng: true });
  });

  test("more flags go up as the day nears, never fewer than the square's", () => {
    const total = flagSpots(town).length;
    expect(total).toBeGreaterThan(SQUARE_FLAGS.length);
    const at = (iso: string) => flagsUp(total, festiveAt(cph(iso))!.intensity);
    expect(at("2026-08-10T12:00")).toBeGreaterThanOrEqual(SQUARE_FLAGS.length);
    expect(at("2026-08-13T12:00")).toBeGreaterThan(at("2026-08-10T12:00"));
    expect(at("2026-08-17T12:00")).toBe(total);
    expect(flagsUp(total, 0.01)).toBe(SQUARE_FLAGS.length);
  });

  test("the nth anniversary is 1945 on", () => {
    expect(anniversary(cph("2026-08-17T12:00"))).toBe(81);
  });
});

describe("agustusan: placement", () => {
  const walkable = (x: number, y: number) => town.kind(x, y).walk === true;
  const plaza = (x: number, y: number) => town.at(x, y) === ":";
  const props = [GAPURA.left, GAPURA.right, PANJAT, KERUPUK, TUMPENG, SACK.start, SACK.finish, NPC_TILE];

  test("every prop and the NPC stand on a plain plaza tile, none on another", () => {
    for (const s of props) {
      expect(plaza(s.x, s.y)).toBe(true);
      expect(walkable(s.x, s.y)).toBe(true);
    }
    const keys = props.map((s) => `${s.x},${s.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("the sack lane is clear plaza from its start to the finish tile", () => {
    for (let x = SACK.laneX0; x <= SACK.laneX1; x++) expect(plaza(x, SACK.y)).toBe(true);
    expect(SACK.finish.x as number).toBe(SACK.laneX1 + 1);
    expect(SACK.start.x as number).toBe(SACK.laneX0 - 1);
  });

  test("the square and the street flags are on plain walkable ground, once each, never on a prop", () => {
    const spots = flagSpots(town);
    const keys = spots.map((s) => `${s.x},${s.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of spots) {
      expect([".", ":"]).toContain(town.at(s.x, s.y));
      expect(walkable(s.x, s.y)).toBe(true);
      expect(props.some((p) => p.x === s.x && p.y === s.y)).toBe(false);
    }
  });

  test("the bunting runs between poles or gate posts", () => {
    const ends = new Set([
      ...SQUARE_FLAGS.map((s) => `${s.x},${s.y}`),
      `${GAPURA.left.x},${GAPURA.left.y}`,
      `${GAPURA.right.x},${GAPURA.right.y}`,
    ]);
    for (const [a, b] of BUNTING_ROWS) {
      expect(ends.has(`${a.x},${a.y}`)).toBe(true);
      expect(ends.has(`${b.x},${b.y}`)).toBe(true);
    }
  });

  test("the gate keeps the way between its posts open, and the props block only their own tiles", () => {
    const blocked = blockedTiles(0);
    for (let x = GAPURA.left.x + 1; x < GAPURA.right.x; x++)
      expect(blocked.some((s) => s.x === x && s.y === GAPURA.left.y)).toBe(false);
    expect(blockedTiles(-7)).toEqual([]);
  });
});

describe("agustusan: walking round the props", () => {
  test("a click-walk goes round a prop instead of into it, and the prop's own tile is still a goal", () => {
    const from: [number, number] = [PANJAT.x - 1, PANJAT.y];
    const to: [number, number] = [PANJAT.x + 1, PANJAT.y];
    const straight = route(town, from, to)!;
    expect(straight).toEqual(["right", "right"]);
    const avoid = (x: number, y: number) => x === PANJAT.x && y === PANJAT.y;
    const round = route(town, from, to, avoid)!;
    expect(round.length).toBeGreaterThan(straight.length);
    let [x, y] = from;
    for (const d of round) {
      x += { left: -1, right: 1, up: 0, down: 0 }[d];
      y += { left: 0, right: 0, up: -1, down: 1 }[d];
      expect(avoid(x, y)).toBe(false);
    }
    expect([x, y]).toEqual(to);
    expect(route(town, from, [PANJAT.x, PANJAT.y], avoid)).toEqual(["right"]);
  });
});

describe("agustusan: the NPC", () => {
  test("Pak Budi is registered, named, on his tile, with a good run of lines", () => {
    expect(FESTIVE_NPC.agustusan).toBe(AGUSTUSAN_NPC);
    expect(festiveNpcOf({ id: "agustusan", intensity: 1, days: 0 })?.name).toContain("Budi");
    expect(AGUSTUSAN_NPC).toMatchObject({ x: NPC_TILE.x, y: NPC_TILE.y });
    expect(AGUSTUSAN_NPC.lines.length).toBeGreaterThanOrEqual(6);
    expect(AGUSTUSAN_NPC.lines.length).toBeLessThanOrEqual(12);
    const all = AGUSTUSAN_NPC.lines.join(" ").toLowerCase();
    for (const word of ["sukarno", "hatta", "1945", "panjat pinang", "kerupuk", "karung", "tumpeng"])
      expect(all).toContain(word);
  });
});

describe("agustusan: the lomba rules", () => {
  test("a try climbs a step on a good grip, slips one on a bad, within the pole", () => {
    expect(climb(3, 0.1)).toBe(4);
    expect(climb(3, 0.9)).toBe(2);
    expect(climb(0, 0.9)).toBe(0);
    expect(climb(PANJAT_TOP, 0.1)).toBe(PANJAT_TOP);
  });
});

describe("agustusan: the music", () => {
  test("both tracks are registered, whole loops, and parse", () => {
    for (const room of ["town", "tavern"] as const) {
      const t = FESTIVE_THEMES.agustusan?.[room];
      expect(t).toBeDefined();
      expect(t!.id).toBe(`festive-agustusan-${room}`);
      expect(voiceSteps(t!.lead)).toBe(THEME_STEPS);
      expect(voiceSteps(t!.bass)).toBe(THEME_STEPS);
      expect(drumSteps(t!.drums)).toBe(THEME_STEPS);
      expect(() => notes(t!.lead)).not.toThrow();
      expect(() => notes(t!.bass)).not.toThrow();
    }
  });

  test("the town plays it while the theme is on, the Tavern too, and nothing else is touched", () => {
    expect(themeOf("town", "agustusan").id).toBe("festive-agustusan-town");
    expect(themeOf("inn", "agustusan").id).toBe("festive-agustusan-tavern");
    expect(themeOf("town", null).id).toBe("town");
    expect(themeOf("dungeon", "agustusan").id).toBe("raid");
    expect(festiveTheme("agustusan", "town")).not.toBeNull();
  });
});

describe("agustusan: the hats", () => {
  const mine = COSTUMES.filter((c) => c.holiday === "agustusan");

  test("two hats in the reserved range 70 to 79, ids unique across the catalogue", () => {
    expect(mine.map((c) => c.id)).toEqual([`hat.${COSTUME_BASE + 70}`, `hat.${COSTUME_BASE + 71}`]);
    for (const c of mine) expect(c.index - COSTUME_BASE).toBeGreaterThanOrEqual(70);
    for (const c of mine) expect(c.index - COSTUME_BASE).toBeLessThanOrEqual(79);
    expect(new Set(COSTUMES.map((c) => c.id)).size).toBe(COSTUMES.length);
    expect(new Set(COSTUMES.map((c) => c.index)).size).toBe(COSTUMES.length);
  });

  test("they are sold round the 17th and not in the winter", () => {
    for (const c of mine) {
      expect(onSale(c, cph("2026-08-12T12:00"))).toBe(true);
      expect(onSale(c, cph("2026-08-19T12:00"))).toBe(true);
      expect(onSale(c, cph("2026-12-01T12:00"))).toBe(false);
    }
  });

  test("the window the theme uses is whole days before the 17th", () => {
    expect(FESTIVE.agustusan).toMatchObject({ holiday: "agustusan", before: 7, after: 0 });
  });
});
