import { expect, test } from "bun:test";
import { angleDelta } from "../src/render3d/motion.ts";
import { CameraRig, fitView } from "../src/render3d/rig.ts";

const room = { minX: 0, maxX: 24, minZ: 0, maxZ: 14, height: 2.6 };
const rig = () => new CameraRig({ getItem: () => null });

test("a bigger room needs a bigger picture, a wider screen needs less", () => {
  const small = { ...room, maxX: 8, maxZ: 8 };
  expect(fitView(room, 1.6)).toBeGreaterThan(fitView(small, 1.6));
  expect(fitView(room, 2.4)).toBeLessThanOrEqual(fitView(room, 1.2));
});

test("zooming stops at the whole room and at a close-up", () => {
  const r = rig();
  r.setAspect(1.6);
  r.frame({ view: 9, bounds: room });
  for (let i = 0; i < 20; i++) r.zoom(-1);
  const out = r.targetView();
  expect(out).toBeLessThanOrEqual(fitView(room, 1.6) + 1e-6);
  expect(out).toBeGreaterThanOrEqual(9);
  for (let i = 0; i < 40; i++) r.zoom(1);
  expect(r.targetView()).toBeGreaterThanOrEqual(3.4);
  expect(r.targetView()).toBeLessThan(out);
  r.zoom(0);
  expect(r.targetView()).toBeCloseTo(9);
});

test("a room smaller than the picture is shown whole", () => {
  const r = rig();
  r.setAspect(1.6);
  const tiny = { minX: 0, maxX: 5, minZ: 0, maxZ: 5, height: 2.6 };
  r.frame({ view: 12, bounds: tiny });
  expect(r.targetView()).toBeLessThan(12);
  // However far the player is from the middle, the picture stays where it is: on the room.
  r.update(16, 2.5, 2.5, true);
  const home = r.focus.clone();
  r.update(16, 40, -30, true);
  expect(r.focus.distanceTo(home)).toBeLessThan(1e-6);
});

test("the camera follows the player inside a big room and stops at its edges", () => {
  const r = rig();
  r.setAspect(1.6);
  const big = { minX: 0, maxX: 60, minZ: 0, maxZ: 60, height: 3 };
  r.frame({ view: 9, bounds: big });
  r.update(16, 30, 30, true);
  expect(r.focus.x).toBeCloseTo(30, 0);
  expect(r.focus.y).toBeCloseTo(30, 0);
  r.update(16, -100, 30, true);
  // Pushed far out of the room: held where the picture still lies on it (the room's own diamond on screen).
  expect(Math.hypot(r.focus.x - 30, r.focus.y - 30)).toBeLessThan(70);
});

test("quarter turns wrap and the azimuth takes the short way", () => {
  const r = rig();
  r.setAspect(1.6);
  r.frame({ view: 9, bounds: room });
  r.update(16, 12, 7, true);
  const start = r.azimuth;
  r.rotate(1);
  r.rotate(1);
  r.rotate(1);
  r.rotate(1);
  expect(r.quarter).toBe(0);
  r.rotate(-1);
  expect(r.quarter).toBe(3);
  for (let i = 0; i < 80; i++) r.update(16, 12, 7);
  // One step the other way is a quarter turn, not three.
  expect(Math.abs(angleDelta(start, r.azimuth))).toBeCloseTo(Math.PI / 2, 2);
});

test("panning moves the view and settles back", () => {
  const r = rig();
  r.setAspect(1.6);
  r.frame({ view: 9, bounds: { minX: 0, maxX: 80, minZ: 0, maxZ: 80, height: 3 } });
  r.update(16, 40, 40, true);
  const before = r.focus.clone();
  r.panBy(100, 0, 800);
  expect(r.panned()).toBe(true);
  r.update(16, 40, 40, true);
  expect(r.focus.distanceTo(before)).toBeGreaterThan(0.5);
  for (let i = 0; i < 200; i++) r.easePan(16);
  expect(r.panned()).toBe(false);
});

test("the saved zoom is read back", () => {
  const r = new CameraRig({ getItem: () => "2" });
  expect(r.level).toBe(2);
  expect(new CameraRig({ getItem: () => "nonsense" }).level).toBe(0);
});
