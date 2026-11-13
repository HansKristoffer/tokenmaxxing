import { expect, test } from "bun:test";
import { JULEMARKED_BASE, JULEMARKED_ITEMS } from "@tokenmaxxing/core/case-julemarked.ts";
import { CASES } from "@tokenmaxxing/core/cases.ts";
import { CASE_BOX_SIZE } from "../src/art/case-box.ts";
import { JULEMARKED_AURAS } from "../src/art/case-julemarked-aura.ts";
import { drawJulemarkedBox } from "../src/art/case-julemarked-box.ts";
import { PETS } from "../src/art/pet-base.ts";
import { Pen } from "../src/art/pixels.ts";

/** A pen that only records where it paints, so a sprite can be checked against its canvas without one. */
const recorder = (w: number, h: number) => {
  const bad: string[] = [];
  let painted = 0;
  const g = {
    fillStyle: "",
    fillRect(x: number, y: number, rw: number, rh: number) {
      if (rw <= 0 || rh <= 0) return;
      painted++;
      if (![x, y, rw, rh].every(Number.isInteger) || x < 0 || y < 0 || x + rw > w || y + rh > h)
        bad.push(`${x},${y} ${rw}x${rh}`);
    },
  };
  return { pen: new Pen(g as unknown as CanvasRenderingContext2D), bad, painted: () => painted };
};

const of = (slot: string) => JULEMARKED_ITEMS.filter((i) => i.slot === slot);

test("every Julemarked pet has two 12x10 frames in PETS at its look index, all in its palette", () => {
  expect(of("pet").length).toBe(6);
  for (const it of of("pet")) {
    expect(it.index).toBeGreaterThanOrEqual(JULEMARKED_BASE);
    const pet = PETS[it.index];
    expect(pet, it.name).toBeTruthy();
    expect(pet!.frames.length).toBe(2);
    for (const rows of pet!.frames) {
      expect(rows.length, it.name).toBe(10);
      for (const [y, r] of rows.entries()) {
        expect(r.length, `${it.name} row ${y}: "${r}"`).toBe(12);
        for (const c of r) if (c !== ".") expect(pet!.pal[c], `${it.name}: "${c}"`).toBeDefined();
      }
    }
    // The two frames differ, or the pet would not hop.
    expect(pet!.frames[0]).not.toEqual(pet!.frames[1]);
  }
});

test("every Julemarked aura draws something on every frame, inside its 28x28 canvas", () => {
  for (const it of of("aura")) {
    const draw = JULEMARKED_AURAS[it.index];
    expect(draw, it.name).toBeDefined();
    for (let f = 0; f < 8; f++) {
      const r = recorder(28, 28);
      draw!(r.pen, f);
      expect({ name: it.name, f, bad: r.bad }).toEqual({ name: it.name, f, bad: [] });
      expect(r.painted(), `${it.name} frame ${f}`).toBeGreaterThan(15);
    }
  }
  expect(Object.keys(JULEMARKED_AURAS).map(Number)).toEqual(of("aura").map((i) => i.index));
});

test("the Julemarked box and key stay on their canvases, and the open box animates", () => {
  expect(CASES.map((c) => c.id)).toContain("julemarked");
  const shot = (kind: "closed" | "open" | "key", frame: number) => {
    const { w, h } = CASE_BOX_SIZE[kind];
    const r = recorder(w, h);
    drawJulemarkedBox(r.pen, kind, frame);
    expect({ kind, frame, bad: r.bad }).toEqual({ kind, frame, bad: [] });
    expect(r.painted(), `${kind} ${frame}`).toBeGreaterThan(30);
    return r.painted();
  };
  shot("closed", 0);
  shot("key", 0);
  expect(shot("open", 0)).not.toBe(shot("open", 1));
});

test("the legendary Julemarked auras are rich: many layered pixels on every frame, and they move", () => {
  for (const it of of("aura")) {
    const draw = JULEMARKED_AURAS[it.index]!;
    const counts: number[] = [];
    for (let f = 0; f < 8; f++) {
      const r = recorder(28, 28);
      draw(r.pen, f);
      expect(r.painted(), `${it.name} frame ${f}`).toBeGreaterThan(150);
      counts.push(r.painted());
    }
    expect(new Set(counts).size, it.name).toBeGreaterThan(1);
  }
});
