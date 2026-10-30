import { describe, expect, test } from "bun:test";
import { COSTUME_BASE, COSTUMES, onSale } from "../src/costumes.ts";
import { FESTIVE_NPC, festiveAt } from "../src/festive.ts";
import { fireworksOn } from "../src/fireworks.ts";
import { PLAZA, townMap } from "../src/maps.ts";
import { CART_H, CART_SPOT, CART_W } from "../src/merchant.ts";
import {
  HOP_WINDOW_MS,
  hopsIntoYear,
  midnightOf,
  NYTAR_BLOCKS,
  NYTAR_NPC,
  nytarCaption,
  nytarShow,
  toMidnight,
} from "../src/nytar.ts";
import { isNytarProp } from "../src/nytar-props.ts";
import { itemById } from "../src/shop.ts";
import { copenhagenToMs } from "../src/sky.ts";
import { FESTIVE_THEMES, THEME_STEPS, themeOf } from "../src/themes.ts";
import { drumSteps, notes, voiceSteps } from "../src/tunes.ts";

const cph = (at: string) => copenhagenToMs(at)!;

describe("the clock", () => {
  test("midnight is the next 1 January, and the year it starts", () => {
    expect(midnightOf(cph("2026-12-30T08:00"))).toEqual({ at: cph("2027-01-01T00:00"), year: 2027 });
    expect(midnightOf(cph("2026-12-31T23:59"))).toEqual({ at: cph("2027-01-01T00:00"), year: 2027 });
    expect(midnightOf(cph("2027-01-01T00:30"))).toEqual({ at: cph("2027-01-01T00:00"), year: 2027 });
  });

  test("the sign tells the speech, the countdown and the greeting", () => {
    expect(nytarCaption(cph("2026-12-30T12:00"))).toBe("🎆 Nytårsaften i morgen");
    expect(nytarCaption(cph("2026-12-31T10:00"))).toBe("👑 Kongens nytårstale kl. 18");
    expect(nytarCaption(cph("2026-12-31T18:05"))).toBe("📺 Kongens nytårstale lige nu");
    expect(nytarCaption(cph("2026-12-31T20:10"))).toBe("⏳ 4 t til 2027");
    expect(nytarCaption(cph("2026-12-31T23:20"))).toBe("⏳ 40:00 til 2027");
    expect(nytarCaption(cph("2026-12-31T23:59") + 55_000)).toBe("🎆 5");
    expect(nytarCaption(cph("2027-01-01T00:00"))).toBe("🎆 Godt nytår 2027!");
    expect(nytarCaption(cph("2027-01-01T13:00"))).toBe("🎆 Godt nytår 2027!");
  });

  test("a hop within three seconds of the stroke counts", () => {
    const at = cph("2027-01-01T00:00");
    expect(toMidnight(at - 1000)).toBe(1000);
    expect(hopsIntoYear(at - HOP_WINDOW_MS)).toBe(true);
    expect(hopsIntoYear(at + HOP_WINDOW_MS)).toBe(true);
    expect(hopsIntoYear(at - HOP_WINDOW_MS - 1)).toBe(false);
    expect(hopsIntoYear(at + HOP_WINDOW_MS + 1)).toBe(false);
  });
});

describe("the evening's shows", () => {
  test("a small one every half hour from 19:00 to 23:30 on 31 December, none before", () => {
    expect(nytarShow(cph("2026-12-31T18:59"))).toBeNull();
    expect(nytarShow(cph("2026-12-30T21:00"))).toBeNull();
    const a = nytarShow(cph("2026-12-31T19:00") + 10_000)!;
    expect(a.at).toBe(cph("2026-12-31T19:00"));
    expect(fireworksOn(a, cph("2026-12-31T19:00") + 10_000)).toBe(true);
    const b = nytarShow(cph("2026-12-31T19:30") + 10_000)!;
    expect(b.at).toBe(cph("2026-12-31T19:30"));
    expect(b.seed).not.toBe(a.seed);
    // Between shows there is none, and the big one is asked for apart.
    expect(nytarShow(cph("2026-12-31T19:20"))).toBeNull();
    expect(nytarShow(cph("2026-12-31T19:20"), true)!.at).toBe(cph("2027-01-01T00:00"));
    expect(nytarShow(cph("2026-12-31T23:45"))).toBeNull();
    expect(nytarShow(cph("2027-01-01T00:02"), true)!.at).toBe(cph("2027-01-01T00:00"));
  });
});

describe("the watchman and the things he stands among", () => {
  test("is the theme's NPC, with a few lines of the day", () => {
    expect(FESTIVE_NPC.nytar).toBe(NYTAR_NPC);
    expect(NYTAR_NPC.lines.length).toBeGreaterThanOrEqual(6);
    expect(NYTAR_NPC.lines.length).toBeLessThanOrEqual(12);
    expect(NYTAR_NPC.lines.some((l) => /Space/.test(l))).toBe(true);
  });

  test("everything stands on plaza paving inside its edge, each on its own tile", () => {
    const map = townMap([]);
    const seen = new Set<string>();
    for (const { x, y } of NYTAR_BLOCKS) {
      expect(map.at(x, y)).toBe(":");
      expect(x).toBeGreaterThan(PLAZA.left);
      expect(x).toBeLessThan(PLAZA.right);
      expect(y).toBeGreaterThan(PLAZA.top);
      expect(y).toBeLessThan(PLAZA.bottom);
      seen.add(`${x},${y}`);
    }
    expect(seen.size).toBe(NYTAR_BLOCKS.length);
    expect([NYTAR_NPC.x, NYTAR_NPC.y]).toEqual([11, 6]);
  });

  test("blocking them leaves the square in one piece and the NPC reachable", () => {
    const map = townMap([]);
    const blocked = new Set(NYTAR_BLOCKS.map((b) => `${b.x},${b.y}`));
    // The merchant's cart, when it is in town, parks under them.
    for (let x = CART_SPOT.x; x < CART_SPOT.x + CART_W; x++)
      for (let y = CART_SPOT.y; y < CART_SPOT.y + CART_H; y++) blocked.add(`${x},${y}`);
    const seen = new Set<string>(["9,5"]);
    const queue: [number, number][] = [[9, 5]];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
    for (const [x, y] of queue)
      for (const [dx, dy] of dirs) {
        const k = `${x + dx},${y + dy}`;
        if (seen.has(k) || blocked.has(k) || !map.walkable(x + dx, y + dy)) continue;
        seen.add(k);
        queue.push([x + dx, y + dy]);
      }
    for (const [x, y] of [
      [2, 1],
      [18, 1],
      [2, 8],
      [18, 8],
      [19, 5],
      [20, 9],
    ] as const)
      expect(seen.has(`${x},${y}`)).toBe(true);
    // A free tile below each of them to stand on and talk (or press E), and row 5 stays one open street.
    for (const t of NYTAR_BLOCKS) expect(seen.has(`${t.x},${t.y + 1}`)).toBe(true);
    for (let x = 6; x <= 19; x++) expect(seen.has(`${x},5`)).toBe(true);
  });
});

describe("the server's rule", () => {
  test("the props block their tiles on the real clock, and only in the window", () => {
    for (const b of NYTAR_BLOCKS) {
      expect(isNytarProp(b.x, b.y, cph("2026-12-31T21:00"))).toBe(true);
      expect(isNytarProp(b.x, b.y, cph("2027-01-01T23:59"))).toBe(true);
      expect(isNytarProp(b.x, b.y, cph("2027-01-02T00:00"))).toBe(false);
      expect(isNytarProp(b.x, b.y, cph("2026-06-01T12:00"))).toBe(false);
    }
    expect(isNytarProp(9, 5, cph("2026-12-31T21:00"))).toBe(false);
  });
});

describe("the music", () => {
  test("two whole-loop tracks, in the town and the Tavern, only while the theme is on", () => {
    const rooms = FESTIVE_THEMES.nytar!;
    for (const [room, t] of Object.entries(rooms)) {
      expect(String(t.id)).toBe(`festive-nytar-${room}`);
      expect(voiceSteps(t.lead)).toBe(THEME_STEPS);
      expect(voiceSteps(t.bass)).toBe(THEME_STEPS);
      expect(drumSteps(t.drums)).toBe(THEME_STEPS);
      expect(notes(t.lead).length).toBeGreaterThan(30);
    }
    expect(themeOf("town", "nytar").id).toBe("festive-nytar-town");
    expect(themeOf("inn", "nytar").id).toBe("festive-nytar-tavern");
    expect(themeOf("town", null).id).toBe("town");
    expect(themeOf("dungeon", "nytar").id).toBe("raid");
  });
});

describe("the party hats", () => {
  const hats = COSTUMES.filter((c) => c.holiday === "newYear");

  test("three, in the reserved range, sold round New Year's", () => {
    expect(hats.map((h) => h.index)).toEqual([55, 56, 57].map((n) => COSTUME_BASE + n));
    for (const h of hats) {
      expect(itemById(h.id)).toBe(h);
      expect(h.slot).toBe("hat");
      expect(onSale(h, cph("2026-12-16T23:59"))).toBe(false);
      expect(onSale(h, cph("2026-12-17T00:00"))).toBe(true);
      expect(onSale(h, cph("2027-01-02T23:59"))).toBe(true);
      expect(onSale(h, cph("2027-01-03T00:00"))).toBe(false);
    }
    expect(new Set(COSTUMES.map((c) => c.index)).size).toBe(COSTUMES.length);
  });

  test("the theme is on for its three days", () => {
    expect(festiveAt(cph("2026-12-29T23:59"))).toBeNull();
    expect(festiveAt(cph("2026-12-30T00:00"))?.id).toBe("nytar");
    expect(festiveAt(cph("2027-01-01T23:59"))?.id).toBe("nytar");
    expect(festiveAt(cph("2027-01-02T00:00"))).toBeNull();
  });
});
