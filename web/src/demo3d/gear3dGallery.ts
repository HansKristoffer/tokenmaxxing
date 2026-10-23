/**
 * The gear gallery: every hat, face piece, held item, back item, outfit, merch piece and the legendary aura
 * on a stand-in character, in rows you can look over (like the catalogue stage), plus the overhead chips.
 * `buildGearGallery(category)` returns a group to put in a scene and the labels to float over it.
 */
import { RARITIES, RARITY_COLOR, rarityOf } from "@tokenmaxxing/core/rarity.ts";
import { ITEMS, type Item } from "@tokenmaxxing/core/shop.ts";
import * as THREE from "three";
import type { Avatar } from "./avatar.ts";
import { Pet } from "./avatar.ts";
import { avatarFor, LEGENDARY_LEVEL, type Look2D, merchFor, nameTag, outfitName, petCrown, tagLift, wornBy } from "./gear3d.ts";
import { checker, painted, tint, toon } from "./kit.ts";

export const GEAR_CATEGORIES = ["Hats", "Face", "Held", "Back", "Outfits", "Merch & aura", "Tags"] as const;
export type GearCategory = (typeof GEAR_CATEGORIES)[number];

export interface GalleryLabel {
  /** Text, or a ready-made element (the chip stack). */
  content: string | HTMLElement;
  at: THREE.Vector3;
  cls?: string;
  /** Hangs under its cell instead of over the head. */
  below?: boolean;
}
export interface Gallery {
  group: THREE.Group;
  labels: GalleryLabel[];
  /** World units from top to bottom a view needs, and where it should look. */
  view: number;
  target: THREE.Vector3;
  /** Columns across. */
  cols: number;
  /** Where each cell stands in the world (for looking at one). */
  cells: THREE.Vector3[];
  /** Everyone in the gallery (to change their pose). */
  avatars: Avatar[];
  update(dt: number, t: number): void;
}

const BASES: Look2D[] = [
  { style: 0, skin: 0, hair: 1, outfit: 1 },
  { style: 2, skin: 1, hair: 5, outfit: 2 },
  { style: 3, skin: 2, hair: 4, outfit: 4 },
  { style: 0, skin: 3, hair: 3, outfit: 6 },
  { style: 2, skin: 0, hair: 0, outfit: 5 },
  { style: 3, skin: 1, hair: 2, outfit: 0 },
];
const base = (i: number): Look2D => BASES[i % BASES.length]!;

const itemsIn = (slot: Item["slot"]) =>
  ITEMS.filter((i) => i.slot === slot).sort((a, b) => a.index - b.index);

const COLS = 6;
const CELL = 1.35;
const ROW = 2.3;

export function buildGearGallery(category: GearCategory): Gallery {
  const group = new THREE.Group();
  const labels: GalleryLabel[] = [];
  const avatars: Avatar[] = [];
  const spin: Avatar[] = [];
  const extras: ((dt: number, t: number) => void)[] = [];

  /** The cells, `COLS` wide, centred on the origin and turned to face the camera (45°). */
  const slots: { x: number; z: number }[] = [];
  let count = 0;
  let cols = COLS;
  const place = (n: number) => {
    count = n;
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      slots.push({ x: (c - (cols - 1) / 2) * CELL, z: (r - (rows - 1) / 2) * CELL * ROW });
    }
  };

  const add = (look: Look2D, i: number, name: string, extra: { level?: number; rarityKey?: string } = {}, content?: string | HTMLElement) => {
    const a = avatarFor(look, { level: extra.level });
    a.root.position.set(slots[i]!.x, 0, slots[i]!.z);
    a.root.rotation.y = 0;
    group.add(a.root);
    avatars.push(a);
    spin.push(a);
    const w = wornBy(look);
    labels.push({
      content: content ?? name,
      at: content ? new THREE.Vector3(slots[i]!.x, tagLift(extra.level, "stand") - 0.02, slots[i]!.z) : new THREE.Vector3(slots[i]!.x, -0.04, slots[i]!.z + 0.25),
      below: !content,
      cls: `tag item gear-rarity-${w.rarity}`,
    });
    return a;
  };

  const rarityColours: (string | undefined)[] = [];

  switch (category) {
    case "Hats":
    case "Face":
    case "Held":
    case "Back": {
      const slot = { Hats: "hat", Face: "glasses", Held: "held", Back: "back" }[category] as "hat" | "glasses" | "held" | "back";
      const list = itemsIn(slot);
      place(list.length);
      list.forEach((it, i) => {
        add({ ...base(i), [slot]: it.index }, i, `${it.name}`);
        rarityColours[i] = RARITY_COLOR[rarityOf(it)];
      });
      break;
    }
    case "Outfits": {
      const list = Array.from({ length: 29 }, (_, i) => i);
      place(list.length);
      list.forEach((o, i) => {
        add({ ...base(i + 1), outfit: o }, i, `${o} · ${outfitName(o)}`);
        const it = ITEMS.find((x) => x.slot === "outfit" && x.index === o);
        rarityColours[i] = it ? RARITY_COLOR[rarityOf(it)] : undefined;
      });
      break;
    }
    case "Merch & aura": {
      cols = 5;
      const looks: { look: Look2D; name: string; level?: number }[] = [
        { look: { ...base(0), outfit: 25, hat: 0, glasses: 0 }, name: "Lv50: golden regalia + aura", level: LEGENDARY_LEVEL },
        { look: { ...base(1), outfit: 25, glasses: 20 }, name: "Lv50 + Nebula visor", level: LEGENDARY_LEVEL },
        { look: { ...base(2), outfit: 20, hat: 24, back: 4 }, name: "Lv50 + wings + GPU crown", level: LEGENDARY_LEVEL },
        { look: { ...base(3), hat: 24 }, name: "Lv49 (no aura)", level: 49 },
        { look: { ...base(4), outfit: 20, glasses: 20 }, name: "Nebula visor", level: 40 },
        { look: { ...base(0), merch: 1, merchWorn: 1 }, name: "Company tee" },
        { look: { ...base(1), merch: 2, merchWorn: 2 }, name: "Company hoodie" },
        { look: { ...base(2), merch: 3, merchWorn: 4 }, name: "Company cap" },
        { look: { ...base(3), merch: 4, merchWorn: 8 }, name: "Company mug" },
        { look: { ...base(4), merch: 5, merchWorn: 15 }, name: "Tee + hoodie + cap + mug" },
      ];
      place(looks.length + 2);
      looks.forEach((l, i) => {
        add(l.look, i, l.name, { level: l.level });
      });
      for (const [k, kind] of (["cat", "dog"] as const).entries()) {
        const pet = new Pet(kind, k ? "#c9853a" : "#e8a65a");
        pet.root.position.set(slots[looks.length + k]!.x, 0, slots[looks.length + k]!.z);
        const crown = petCrown();
        crown.position.set(0, kind === "cat" ? 0.37 : 0.4, 0.13);
        pet.root.add(crown);
        group.add(pet.root);
        extras.push((_dt, t) => pet.update(t));
        labels.push({ content: "Lv50 pet crown", at: new THREE.Vector3(slots[looks.length + k]!.x, 0.55, slots[looks.length + k]!.z), cls: "tag item" });
      }
      void merchFor;
      break;
    }
    case "Tags": {
      cols = 4;
      const specs = [
        { look: { ...base(0), hat: 1 } as Look2D, name: "noah", level: 3, extra: {} },
        { look: { ...base(1), hat: 8, glasses: 7 } as Look2D, name: "sofie", level: 12, extra: { company: { name: "Acme AI", color: "#3a6fb8" }, badges: [{ emoji: "🔥", frame: "bronze" as const, title: "Streak" }] } },
        { look: { ...base(2), hat: 24, back: 3 } as Look2D, name: "maja", level: 27, extra: { company: { name: "Nordlys", color: "#5b3fbf" }, badges: [{ emoji: "🧠", frame: "silver" as const }, { emoji: "🏆", frame: "gold" as const }], trophies: [{ emoji: "🌙", title: "Midnight Oil" }] } },
        { look: { ...base(3), hat: 20, back: 4, glasses: 20 } as Look2D, name: "lin", level: 38, extra: { badges: [{ emoji: "🐋", frame: "diamond" as const }, { emoji: "⚔️", frame: "gold" as const }, { emoji: "🍺", frame: "bronze" as const }], trophies: [{ title: "Dead Beef", emoji: "🥩" }, { title: "Millionaire", emoji: "💰" }] } },
        { look: { ...base(4), outfit: 25, glasses: 20, hat: 24 } as Look2D, name: "ada", level: LEGENDARY_LEVEL, extra: { company: { name: "Golden Legends", color: "#b98a1f" }, badges: [{ emoji: "🏆", frame: "diamond" as const }, { emoji: "🐙", frame: "gold" as const }], trophies: [{ title: "Billionaire", emoji: "💎" }] } },
        { look: { ...base(5), hat: 6 } as Look2D, name: "oskar (offline)", level: 8, extra: { online: false } },
      ];
      place(specs.length);
      specs.forEach((s, i) => {
        const w = wornBy(s.look);
        const el = nameTag({ name: s.name, level: s.level, rarity: w.rarity, ...s.extra });
        add(s.look, i, s.name, { level: s.level }, el);
        const l = labels.at(-1)!;
        l.cls = undefined;
      });
      void RARITIES;
      break;
    }
  }

  // The stand: a floor under the cells, turned to the camera.
  const rows = Math.ceil(count / cols);
  const fw = cols * CELL + 0.6;
  const fd = rows * CELL * ROW + 0.6;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(fw, 0.3, fd),
    [toon(tint("#dccdb0", -0.4)), toon(tint("#dccdb0", -0.4)), painted(withRepeat(checker("#e8dcc4", "#dccdb0", 2), fw / 2, fd / 2)), toon("#000"), toon(tint("#dccdb0", -0.4)), toon(tint("#dccdb0", -0.4))],
  );
  floor.position.y = -0.15;
  floor.receiveShadow = true;
  group.add(floor);
  // Rarity pads: a thin strip in each item's colour under its feet.
  slots.forEach((s, i) => {
    const c = rarityColours[i];
    if (!c) return;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 20), toon(c));
    pad.position.set(s.x, 0.01, s.z);
    pad.receiveShadow = true;
    group.add(pad);
  });

  // Turn the whole table to face the camera, as the catalogue does.
  const root = new THREE.Group();
  root.rotation.y = Math.PI / 4;
  root.add(group);
  const lift = new THREE.Vector3();
  const view = Math.max(fw, fd) * 0.95 + 2;
  return {
    group: root,
    labels: labels.map((l) => ({ ...l, at: l.at.clone() })),
    view,
    target: lift.set(0, 0.55, 0),
    cells: slots.map((s) => new THREE.Vector3(s.x, 0, s.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)),
    avatars,
    cols,
    update(dt, t) {
      for (const a of avatars) a.update(dt, t);
      for (const e of extras) e(dt, t);
    },
  };
}

function withRepeat(t: THREE.CanvasTexture, x: number, y: number): THREE.CanvasTexture {
  t.repeat.set(x, y);
  return t;
}
