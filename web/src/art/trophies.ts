import { TROPHIES } from "@tokenmaxxing/core/trophies.ts";
import { C } from "./palette.ts";
import { bake, cached, type Palette } from "./pixels.ts";

/** A trophy is 7×8: the thing itself, mostly on a little plinth (`k`, `K` its top edge). */
export const TROPHY_W = 7;
export const TROPHY_H = 8;

const GOLD = { a: C.flowerYellow, b: "#c98e22", w: "#fff4b8" };
const SILVER = { a: "#d5dbe4", b: C.metalLight, w: C.white };
const PLINTH = { k: C.wallTop, K: C.wallTopLight };

/** Each trophy's grid and colours. Everything stands on the shelf's bottom row. */
const ART: Record<string, { rows: string[]; pal: Palette }> = {
  million: {
    rows: ["aaaaaaa", "a.waa.b", ".awaab.", "..aab..", "...b...", "..aab..", ".KKKKK.", ".kkkkk."],
    pal: { ...SILVER, ...PLINTH },
  },
  billion: {
    rows: ["a..a..a", "aa.a.aa", "awaaaab", "arabgab", "bbbbbbb", ".......", ".KKKKK.", ".kkkkk."],
    pal: { ...GOLD, r: C.flowerRed, g: "#3ddc84", ...PLINTH },
  },
  streak: {
    rows: ["...a...", "..aa...", "..aab..", ".aabba.", ".abccb.", ".abccb.", "..bbb..", ".kkkkk."],
    pal: { a: C.flowerRed, b: "#f28a3c", c: C.flowerYellow, k: C.wallTop },
  },
  "3am": {
    rows: ["..aaa..", ".aa..w.", "aa.....", "aa..w..", ".aa....", "..aaa..", ".KKKKK.", ".kkkkk."],
    pal: { a: C.lamp, w: C.white, K: "#52609b", k: "#2f3a6b" },
  },
  friday: {
    rows: ["....r..", "...wy..", "..ss...", ".sssss.", "ssswsss", "sswssss", ".sssss.", "..sss.."],
    pal: { s: "#3c4454", w: C.metalLight, r: C.flowerRed, y: C.flowerYellow },
  },
  newyear: {
    rows: ["a..w..c", ".a.w.c.", "..www..", "www.www", "..www..", ".c.w.a.", "c..w..a", "......."],
    pal: { a: C.flowerYellow, c: "#f28bb2", w: C.white },
  },
  holiday: {
    rows: ["...y...", "...g...", "..ggg..", "..grg..", ".gyggg.", "ggggrgg", "...t...", ".KKKKK."],
    pal: { y: C.flowerYellow, g: C.leaf, r: C.flowerRed, t: C.trunk, K: C.rug },
  },
  zeros: {
    rows: [".......", "aaa.aaa", "a.a.a.a", "a.a.a.a", "a.a.a.a", "aaa.aaa", ".KKKKK.", ".kkkkk."],
    pal: { a: "#3ddc84", K: "#1f2a24", k: "#11181a" },
  },
  deadbeef: {
    rows: ["a.....a", "aa...aa", ".bbbbb.", ".bkbkb.", ".bbbbb.", "..bkb..", ".KKKKK.", ".kkkkk."],
    pal: { a: C.pathDark, b: C.pillow, ...PLINTH, k: C.ink },
  },
  c0ffee: {
    rows: [".w.w...", "..w.w..", "aaaaa..", "abbbaaa", "abbba.a", "abbbaaa", ".aaa...", "kkkkkk."],
    pal: { a: C.white, b: C.trunkDark, w: C.stoneLight, k: C.woodDark },
  },
  earlybird: {
    rows: [".......", "..aa...", ".aaka..", ".aaaao.", "baaaa..", ".aaaa..", "..o.o..", ".kkkkk."],
    pal: { a: C.flowerYellow, b: "#c98e22", k: C.leafDark, o: "#f28a3c" },
  },
  midnight: {
    rows: ["...y...", "...o...", "..www..", "..wwv..", "..wwv..", "..wwv..", ".KKKKK.", ".kkkkk."],
    pal: { y: C.lamp, o: "#f28a3c", w: C.pillow, v: C.wallDark, ...PLINTH },
  },
  allday: {
    rows: [".aaaaa.", "awwkwwa", "awwkwwa", "awwkkwa", "awwwwwa", ".aaaaa.", "..KKK..", ".kkkkk."],
    pal: { a: C.fabric, w: C.white, k: C.ink, K: C.fabricDark },
  },
  weekend: {
    rows: ["..rrr..", ".rwrwr.", "rwrwrwr", "...t...", "...t...", "...t...", "sssssss", ".SSSSS."],
    pal: { r: C.flowerRed, w: C.white, t: C.metal, s: C.path, S: C.pathDark },
  },
  palindate: {
    rows: [".k...k.", "rrrrrrr", "wwwwwww", "wkw.wkw", "ww.k.ww", "wkw.wkw", "wwwwwww", ".kkkkk."],
    pal: { r: C.rug, w: C.white, k: C.ink },
  },
  palintotal: {
    rows: ["aaaaaaa", ".bsssb.", "..bsb..", "...s...", "..b.b..", ".bsssb.", "aaaaaaa", ".kkkkk."],
    pal: { a: "#9b6fd6", b: C.stoneLight, s: C.path, k: "#5b3fbf" },
  },
  round: {
    rows: [".......", ".aaaaa.", "awayaca", "ay...aa", "aacawya", ".bbbbb.", "..KKK..", ".kkkkk."],
    pal: { a: "#f28bb2", b: C.woodLight, w: C.white, y: C.flowerYellow, c: C.water, ...PLINTH },
  },
  jackpot: {
    rows: ["rrrrrr.", "....rr.", "...rr..", "...rr..", "..rr...", "..rr...", ".KKKKK.", ".kkkkk."],
    pal: { r: C.flowerRed, ...GOLD, K: GOLD.a, k: GOLD.b },
  },
  leet: {
    rows: ["kkkkkkk", "k.....k", "kg....k", "k.g...k", "kg.gg.k", "kkkkkkk", "..kkk..", ".kkkkk."],
    pal: { k: "#2c3142", g: "#3ddc84", ".": "#1b1f2b" },
  },
  piday: {
    rows: [".......", "...w...", ".aaaaa.", "abababa", "rrrrrrr", ".bbbbb.", "..KKK..", ".kkkkk."],
    pal: { a: C.pathLight, b: C.woodLight, r: C.rug, w: C.white, ...PLINTH },
  },
  storm: {
    rows: [".www...", "wwwwww.", "vwwwwwv", ".vvvv..", "..yy...", ".yy....", "..yy...", "...y..."],
    pal: { w: C.stoneLight, v: C.stone, y: C.flowerYellow },
  },
};

/** One trophy's sprite; an unearned one is its dim outline, so the gaps on the shelf have a shape. */
export const trophySprite = cached(
  (id: string, earned: boolean) => `${id}${+earned}`,
  (id: string, earned: boolean) =>
    bake(TROPHY_W, TROPHY_H, (p) => {
      const art = ART[id];
      if (!art) return;
      const pal = earned
        ? art.pal
        : Object.fromEntries(Object.keys(art.pal).map((k) => [k, "rgba(20, 16, 28, 0.32)"]));
      p.grid(art.rows, pal);
    }),
);

/** The shelf: 4 tiles wide, three glass-fronted shelves of 7. */
export const SHELF_W = 64;
export const SHELF_H = 32;
const PER_SHELF = 7;
/** Where trophy `i` stands, in the shelf's pixels. */
export const slotOf = (i: number) => ({
  x: 4 + (i % PER_SHELF) * (TROPHY_W + 1),
  y: 2 + Math.floor(i / PER_SHELF) * 9,
});

/** The shelf with these trophies on it (by id, any order); the rest show as outlines. */
export const trophyShelf = cached(
  (earned: ReadonlySet<string>) => [...earned].sort().join(),
  (earned: ReadonlySet<string>) =>
    bake(SHELF_W, SHELF_H, (p) => {
      p.rect(0, 0, SHELF_W, SHELF_H, C.ink);
      p.rect(1, 1, SHELF_W - 2, SHELF_H - 2, C.woodDark);
      p.rect(3, 2, SHELF_W - 6, 27, "#5e3d28");
      for (let s = 0; s < 3; s++) p.rect(1, 10 + s * 9, SHELF_W - 2, 1, C.woodLight);
      p.rect(1, 29, SHELF_W - 2, 2, C.wood);
      p.rect(1, 1, SHELF_W - 2, 1, C.woodLight);
      TROPHIES.forEach((t, i) => {
        const { x, y } = slotOf(i);
        p.g.drawImage(trophySprite(t.id, earned.has(t.id)), x, y);
      });
      // Glass: a couple of glints across the front.
      p.g.fillStyle = "rgba(255, 255, 255, 0.18)";
      for (const gx of [9, 40])
        for (let i = 0; i < 26; i++) p.g.fillRect(gx + Math.floor(i / 2), 27 - i, 2, 1);
    }),
);
