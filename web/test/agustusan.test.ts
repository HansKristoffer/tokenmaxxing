import { expect, test } from "bun:test";
import {
  GAPURA,
  KERUPUK,
  KERUPUK_BITES,
  PANJAT,
  PANJAT_TOP,
  SACK,
  TUMPENG,
} from "@tokenmaxxing/core/agustusan.ts";
import { COSTUMES } from "@tokenmaxxing/core/costumes.ts";
import { FESTIVE_NPC } from "@tokenmaxxing/core/festive.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// A real (map-backed) localStorage: the headless stub forgets, and the medals are kept in it.
const kept = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
    removeItem: (k: string) => void kept.delete(k),
  },
});
// Some of the 3D modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, {
  origin: "http://localhost",
  search: "?theme=agustusan&day=08-17T12:00",
});

const { agustusanInteract, agustusanNow, blocksAgustusan, climberHeight, kerupukBites, medalsWon } =
  await import("../src/game/agustusan.ts");
const { hud } = await import("../src/store.ts");
const { world } = await import("../src/game/world.ts");
const { Agustusan3d } = await import("../src/render3d/town/agustusan3d.ts");
const { NPC_SPRITES } = await import("../src/art/festive-npc.ts");
const { NPC_MODELS } = await import("../src/render3d/town/festive-npc3d.ts");
const { itemFrame } = await import("../src/art/characters.ts");
const { COVERS_HAIR, HAT_BUILDERS } = await import("../src/render3d/people/gear3dHead.ts");
const { festiveNpcAt, blocksFestiveNpc } = await import("../src/game/festive-npc.ts");

const map = world.map;
const toWorld = (tx: number, ty: number): [number, number] => [tx - map.x0 + 1.5, ty - map.y0 + 1.5];

test("on the 17th everything stands: flags, the gate, the lomba, the tumpeng", () => {
  const a = agustusanNow()!;
  expect(a.days).toBe(0);
  expect(a.stand).toEqual({ flags: true, gapura: true, lomba: true, play: true, tumpeng: true });
  expect(a.up).toBe(a.flags.length);
});

test("the props and Pak Budi block their tiles, nothing else on the square", () => {
  for (const s of [GAPURA.left, GAPURA.right, PANJAT, KERUPUK, SACK.start, TUMPENG])
    expect(blocksAgustusan(s.x, s.y), `${s.x},${s.y}`).toBe(true);
  const n = FESTIVE_NPC.agustusan!;
  expect(festiveNpcAt(n.x, n.y)).toBe(true);
  expect(blocksFestiveNpc(n.x, n.y)).toBe(true);
  expect(blocksAgustusan(9, 5)).toBe(false);
  expect(blocksAgustusan(GAPURA.left.x + 1, GAPURA.left.y)).toBe(false);
});

test("pak budi has a sprite and a model, and a peci hat the shop sells", () => {
  expect(NPC_SPRITES.agustusan).toBeDefined();
  expect(NPC_MODELS.agustusan).toBeDefined();
  const hats = COSTUMES.filter((c) => c.holiday === "agustusan");
  expect(hats.length).toBe(2);
  for (const c of hats) {
    expect(itemFrame(c), c.name).not.toBeNull();
    expect(HAT_BUILDERS[c.name], c.name).toBeDefined();
    expect(COVERS_HAIR.has(c.name), c.name).toBe(true);
  }
});

test("a slip takes you down a step, never below the ground", () => {
  const random = Math.random;
  Math.random = () => 0.99;
  try {
    agustusanInteract(PANJAT.x, PANJAT.y);
    expect(hud.get().dialog).toContain("Slip");
    expect(climberHeight(performance.now())).toBe(0);
  } finally {
    Math.random = random;
  }
});

test("E on the pole climbs; a run of good grips reaches the top, wins the medal once, and the pole is reset", () => {
  const random = Math.random;
  Math.random = () => 0.1;
  try {
    for (let i = 0; i < PANJAT_TOP - 1; i++) {
      expect(agustusanInteract(PANJAT.x, PANJAT.y)).toBe(true);
      expect(hud.get().dialog).toContain("Up you go");
    }
    expect(medalsWon()).not.toContain("panjat");
    agustusanInteract(PANJAT.x, PANJAT.y);
    expect(hud.get().dialog).toContain("Medali Panjat pinang");
    expect(medalsWon()).toContain("panjat");
    expect(climberHeight(performance.now() + 5000)).toBe(0);
  } finally {
    Math.random = random;
  }
});

test("bites at the kerupuk count up and win the medal at the sixth", () => {
  for (let i = 1; i < KERUPUK_BITES; i++) {
    agustusanInteract(KERUPUK.x, KERUPUK.y);
    expect(hud.get().dialog).toContain(`Bite ${i} of ${KERUPUK_BITES}`);
  }
  expect(kerupukBites(performance.now())).toBe(KERUPUK_BITES - 1);
  agustusanInteract(KERUPUK.x, KERUPUK.y);
  expect(medalsWon()).toContain("kerupuk");
});

test("E on the start flag says the race is on; elsewhere on the square is not a prop", () => {
  expect(agustusanInteract(SACK.start.x, SACK.start.y)).toBe(true);
  expect(hud.get().dialog).toContain("Siap");
  expect(agustusanInteract(9, 5)).toBe(false);
});

test("the 3D scenery is a handful of meshes however many flags, builds on the first frame and goes with the theme", () => {
  const scene = new Agustusan3d(toWorld);
  // Nothing is built in the constructor.
  expect(scene.group.children.length).toBe(0);
  scene.update(0);
  expect(scene.group.visible).toBe(true);
  let meshes = 0;
  scene.group.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) meshes++;
  });
  expect(meshes).toBeGreaterThan(5);
  expect(meshes).toBeLessThan(120);
  scene.dispose();
  expect(scene.group.children.length).toBe(0);
});
