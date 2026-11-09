import { expect, test } from "bun:test";
import { ITEMS } from "@tokenmaxxing/core/shop.ts";
import { avatarFor } from "../src/render3d/people/gear3d.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const bare = { style: 0, skin: 0, hair: 0, outfit: 0 };
const hatIndex = (name: string) => {
  const item = ITEMS.find((i) => i.slot === "hat" && i.name === name);
  if (!item) throw new Error(`Missing hat: ${name}`);
  return item.index;
};
const frameY = (name: string, style: "voxel" | "grown" = "voxel") => {
  const a = avatarFor({ ...bare, hat: hatIndex(name) }, undefined, style);
  const frame = a.head.getObjectByName("hat-gear");
  if (!frame) throw new Error(`Missing hat frame: ${name}`);
  return frame.position.y;
};

test("voxel brims and narrow crowns sit above the hair", () => {
  // The top of the voxel hair is 0.36 above the head origin. These are the brim/base heights
  // in the builders' frame, scaled by 0.63 when worn by a voxel avatar.
  for (const [name, base] of [
    ["Julehue", -0.015],
    ["Santa hat", -0.015],
    ["Prompt wizard hat", 0.12],
    ["Archmage hat", 0.12],
    ["Cowboy coder hat", 0.13],
    ["Heksehat", 0.1],
    ["Strå-hat", 0.1],
    ["Nytårshat", 0.1],
    ["Lucky lure hat", -0.012],
    ["Hourglass hat", 0.1],
    ["Smørrebrød hat", 0.2],
    ["Lego brick hat", 0.2],
    ["Gløgg mug hat", 0.2],
    ["Straw kasa", 0.14],
  ] as const) {
    expect(frameY(name) + base * 0.63, name).toBeGreaterThan(0.34);
  }
});

test("head-wrapping hats and smooth avatars keep their original fit", () => {
  expect(frameY("Viking helmet")).toBeCloseTo(0.1825);
  expect(frameY("Prompt wizard hat", "grown")).toBeCloseTo(frameY("Viking helmet", "grown"));
});

test("reported hats clear the full height of voxel hair", () => {
  for (const [name, base] of [
    ["Danish flag cap", 0.11],
    ["Cowboy coder hat", 0.13],
    ["Friday deploy stetson", 0.13],
    ["Borrowed-token tricorn", 0.1],
    ["Pirate tricorn", 0.1],
    ["Julehue", -0.015],
  ] as const) {
    expect(frameY(name) + base * 0.63, name).toBeGreaterThan(0.36);
  }
});
