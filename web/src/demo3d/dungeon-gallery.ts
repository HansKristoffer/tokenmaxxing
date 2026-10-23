/**
 * The dungeon gallery: a "Dungeon" stage for the demo. Seven sections side by side on stone slabs, each
 * focused from a toolbar: the live raid Arena (boss on its dais, war desks, minions firing, torches,
 * a fight you can drive), the Bosses and minion, the Loot by rarity, the numbered Editions, the 26
 * Trophies and their shelf, the 24 Badges as medals, and the room Props (gates, doors, terminal).
 */
import * as THREE from "three";
import { Avatar, randomLook } from "./avatar.ts";
import {
  BADGE_DEFS,
  DUNGEON_BOSSES,
  EDITION_LIST,
  LOOT_TABLE,
  RARITY_INFO,
  TROPHY_DEFS,
} from "./data/dungeon.ts";
import {
  BossActor,
  DUNGEON_ASSETS,
  STONE,
  type Terminal,
  trophyShelf,
} from "./dungeon3d.ts";
import type { Asset } from "./furniture.ts";
import { checker, Model, painted, seeded, ticks, toon } from "./kit.ts";

export interface GalleryLabel {
  text: string;
  cls: string;
  at: () => THREE.Vector3;
}

interface Section {
  name: string;
  /** Section centre in the gallery group, and how many world units to show. */
  at: THREE.Vector3;
  view: number;
}

const ROT = Math.PI / 4;
const assetOf = new Map(DUNGEON_ASSETS.map((a) => [a.id, a]));
const asset = (id: string): Asset => {
  const a = assetOf.get(id);
  if (!a) throw new Error(`no dungeon asset ${id}`);
  return a;
};

export function buildDungeonGallery() {
  const group = new THREE.Group();
  group.rotation.y = ROT;
  const labels: GalleryLabel[] = [];
  const sections: Section[] = [];
  const updates: ((dt: number, t: number) => void)[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const world = (v: THREE.Vector3) => v.clone().applyAxisAngle(up, ROT);

  /** A stone slab centred on `at`, `w`×`d`. */
  const slab = (at: THREE.Vector3, w: number, d: number) => {
    const tex = checker(STONE.floor, STONE.floorLight, 2);
    tex.repeat.set(w / 2, d / 2);
    const side = toon(STONE.floorDark);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), [side, side, painted(tex), side, side, side]);
    floor.position.set(at.x, -0.15, at.z);
    floor.receiveShadow = true;
    group.add(floor);
  };

  const tag = (text: string, at: () => THREE.Vector3, cls = "tag item") => labels.push({ text, cls, at });

  /** Lays assets on a grid of `cols`; returns the slab size. */
  function grid(origin: THREE.Vector3, ids: readonly string[], cols: number, cw: number, cd: number, names?: (a: Asset) => string) {
    const rows = Math.ceil(ids.length / cols);
    ids.forEach((id, i) => {
      const a = asset(id);
      const m = a.build();
      const x = origin.x + ((i % cols) - (cols - 1) / 2) * cw;
      const z = origin.z + (Math.floor(i / cols) - (rows - 1) / 2) * cd;
      m.position.set(x, 0, z);
      group.add(m);
      const top = new THREE.Box3().setFromObject(m).max.y;
      tag(names ? names(a) : a.name, () => new THREE.Vector3(x, top + 0.25, z).applyAxisAngle(up, ROT).add(group.position));
    });
    return { w: cols * cw + 3, d: rows * cd + 3 };
  }

  // ——— Arena ———
  const arena = new THREE.Vector3(0, 0, 0);
  slab(arena, 28, 16);
  sections.push({ name: "Arena", at: new THREE.Vector3(0, 0.8, 0.5), view: 17 });
  {
    // Back wall.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(28, 3.4, 0.4), toon(STONE.wall));
    wall.position.set(0, 1.7, -7.2);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(28, 0.15, 0.5), toon(STONE.wallTop));
    cap.position.set(0, 3.45, -7.2);
    group.add(cap);
    const place = (id: string, x: number, z: number, turn = 0, y = 0) => {
      const m = asset(id).build();
      m.position.set(x, y, z);
      m.rotation.y = turn;
      group.add(m);
      return m;
    };
    for (const x of [-11, -6.5, 6.5, 11]) place("tile:j", x, -7.0);
    for (const [i, x] of [-4.6, -3.4, -2.2, 2.2, 3.4, 4.6].entries()) {
      const p = place("dungeon:plaque", x, -7.0);
      p.visible = i < 4 || i === 5;
    }
    const term = place("tile:M", 8.6, -7.0) as Terminal;
    place("tile:G", -9.5, -6.7);
    place("tile:D", 9.5, 5.2, Math.PI);
    place("dungeon:exit", 12.4, -6.9);
    tag("Gate in", () => world(new THREE.Vector3(-9.5, 2.4, -6.7)));
    tag("Wall terminal", () => world(new THREE.Vector3(8.6, 1.9, -7)));

    // The dais and the live boss.
    place("tile:Z", 0, -4.5);
    const boss = new BossActor("rate-limit", { maxHp: 2e9, hp: 1.7e9 });
    boss.root.position.set(0, 0.28, -4.5);
    group.add(boss.root);

    // War desks in arcs round the boss, seated raiders and minions.
    const rnd = seeded(7);
    const shooters: THREE.Vector3[] = [];
    const sitters: Avatar[] = [];
    const desks: { x: number; z: number; yaw: number }[] = [];
    for (const r of [3.9, 5.7, 7.5]) {
      const limit = (58 * Math.PI) / 180;
      const n = Math.floor((limit * 2 * r) / 1.45);
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? 0 : -limit + (i / (n - 1)) * limit * 2;
        const x = Math.sin(a) * r;
        const z = -4.5 + Math.cos(a) * r;
        if (z > 5.5) continue;
        desks.push({ x, z, yaw: a });
      }
    }
    desks.forEach((d, i) => {
      const open = rnd() < 0.7;
      const dm = place(open ? "tile:l.open" : "tile:l", d.x, d.z, d.yaw);
      dm.position.y = 0;
      const away = new THREE.Vector3(Math.sin(d.yaw), 0, Math.cos(d.yaw));
      const cx = d.x + away.x * 0.9;
      const cz = d.z + away.z * 0.9;
      place("tile:r", cx, cz, d.yaw);
      if (open) {
        const av = new Avatar(randomLook(seeded(i * 11 + 3)));
        av.pose = "type";
        av.root.position.set(cx, 0.35 - 0.02, cz);
        av.root.rotation.y = d.yaw + Math.PI;
        group.add(av.root);
        sitters.push(av);
        shooters.push(new THREE.Vector3(d.x, 0.95, d.z));
        // A robot minion beside the desk.
        if (rnd() < 0.55) {
          const side = new THREE.Vector3(Math.cos(d.yaw), 0, -Math.sin(d.yaw)).multiplyScalar(0.85);
          const mm = place("minion", d.x + side.x, d.z + side.z, d.yaw + Math.PI);
          mm.position.y = 0;
          shooters.push(new THREE.Vector3(d.x + side.x, 0.6, d.z + side.z));
        }
      }
    });

    // Magic missiles: they only show the burn; the real damage is a hit.
    const missiles = Array.from({ length: 14 }, () => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: "#8fe3ff" }));
      m.visible = false;
      group.add(m);
      return { m, from: new THREE.Vector3(), t0: 0, busy: false };
    });
    const target = new THREE.Vector3(0, 1.3, -4.5);
    let nextShot = 0;
    updates.push((_dt, t) => {
      if (t > nextShot && shooters.length && !boss.fallen) {
        nextShot = t + 0.09;
        const free = missiles.find((s) => !s.busy);
        if (free) {
          free.busy = true;
          free.t0 = t;
          free.from.copy(shooters[Math.floor(Math.random() * shooters.length)]!);
        }
      }
      for (const s of missiles) {
        if (!s.busy) continue;
        const k = (t - s.t0) / 0.7;
        if (k >= 1) {
          s.busy = false;
          s.m.visible = false;
          continue;
        }
        s.m.visible = true;
        s.m.position.lerpVectors(s.from, target, k);
        s.m.position.y += Math.sin(k * Math.PI) * 1.3;
      }
      for (const av of sitters) av.update(_dt, t);
    });

    // The fight: auto or by hand.
    let auto = true;
    let nextHit = 2;
    let respawnAt = 0;
    const next = () => {
      const i = (DUNGEON_BOSSES.findIndex((b) => b.id === boss.bossId) + 1) % DUNGEON_BOSSES.length;
      const b = DUNGEON_BOSSES[i]!;
      boss.spawn(b.id, boss.rung + 1, boss.maxHp * 1.5);
      respawnAt = 0;
    };
    const hit = (frac: number) => {
      boss.hit(boss.maxHp * frac);
      if (boss.hp <= 0) {
        boss.kill();
        respawnAt = performance.now() / 1000 + 3.4;
      }
      term.set(boss.fallen ? null : boss.share);
    };
    updates.push((_dt, t) => {
      term.set(boss.fallen ? null : boss.share);
      if (respawnAt && t > respawnAt) {
        next();
        term.set(boss.share);
      }
      if (auto && !boss.fallen && t > nextHit) {
        nextHit = t + 0.9 + Math.random() * 1.2;
        hit(0.03 + Math.random() * 0.06);
      }
    });

    // Toolbar.
    const bar = document.createElement("div");
    bar.id = "dungeon-bar";
    bar.style.cssText =
      "position:fixed;left:12px;bottom:12px;display:flex;flex-wrap:wrap;gap:6px;max-width:80vw;z-index:20;font:13px system-ui,sans-serif";
    bar.hidden = true;
    document.body.append(bar);
    const btn = (text: string, fn: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.onclick = fn;
      bar.append(b);
      return b;
    };
    const fightButtons: HTMLButtonElement[] = [];
    for (const s of sections) void s;
    const makeFight = () => {
      fightButtons.push(
        btn("⚔️ Hit", () => hit(0.05)),
        btn("💥 PR special", () => hit(0.15)),
        btn("☠️ Kill", () => {
          boss.hit(0);
          boss.hp = 0;
          hit(0);
        }),
        btn("⏭ Next rung", next),
        btn("🤖 Auto-fight: on", function (this: HTMLButtonElement) {
          auto = !auto;
          this.textContent = `🤖 Auto-fight: ${auto ? "on" : "off"}`;
        }),
      );
    };
    void makeFight;
    (group.userData as { fight: () => void }).fight = makeFight;
    (group.userData as { btn: typeof btn }).btn = btn;
    (group.userData as { bar: HTMLElement }).bar = bar;
  }

  // ——— Bosses and minion ———
  {
    const at = new THREE.Vector3(40, 0, 0);
    const ids = [...DUNGEON_BOSSES.map((b) => `boss:${b.id}`), "minion"];
    const size = grid(at, ids, 5, 3.6, 3.6);
    // The teaser's silhouettes, all shadow with only the eyes lit.
    DUNGEON_BOSSES.forEach((b, i) => {
      const s = new BossActor(b.id, { silhouette: true, taunts: false, plate: false, hp: 1, maxHp: 1 });
      const x = at.x + (i - 1.5) * 3.6;
      s.root.position.set(x, 0, at.z + 6.5);
      group.add(s.root);
      tag(`${b.name}: ???`, () => world(new THREE.Vector3(x, 2.4, at.z + 6.5)));
    });
    slab(at.clone().setZ(2.5), size.w, 14);
    sections.push({ name: "Bosses", at: at.clone().setY(1.2).setZ(3), view: 14 });
  }

  // ——— Loot ———
  {
    const at = new THREE.Vector3(80, 0, 0);
    const ids = [...LOOT_TABLE.filter((l) => l.slot !== "furniture").map((l) => l.id), "tile:Y", "tile:V"];
    const size = grid(at, ids, 7, 2.3, 3.6, (a) => a.name.replace(/ \((Common|Rare|Epic|Legendary),.*/, " · $1"));
    slab(at, size.w, size.d);
    sections.push({ name: "Loot", at: at.clone().setY(0.7), view: 12 });
    void RARITY_INFO;
  }

  // ——— Editions ———
  {
    const at = new THREE.Vector3(120, 0, 0);
    const size = grid(at, EDITION_LIST.map((e) => e.id), 7, 2.0, 2.9, (a) => a.name.replace(/ \(#.*/, ""));
    slab(at, size.w, size.d);
    sections.push({ name: "Editions", at: at.clone().setY(0.4), view: 10 });
  }

  // ——— Trophies ———
  {
    const at = new THREE.Vector3(160, 0, 0);
    const size = grid(at.clone().setZ(-3.2), TROPHY_DEFS.map((t) => `trophy:${t.id}`), 9, 1.6, 2.3, (a) => a.name.split(":")[0]!);
    const shelf = trophyShelf(new Set(TROPHY_DEFS.filter((_, i) => i % 4 !== 3).map((t) => t.id)));
    shelf.position.set(at.x, 0, at.z + 4.2);
    group.add(shelf);
    tag("Trophy shelf (unearned ones are outlines)", () => world(new THREE.Vector3(at.x, 2.5, at.z + 4.2)));
    slab(at, size.w, 13);
    sections.push({ name: "Trophies", at: at.clone().setY(0.9).setZ(1), view: 11 });
  }

  // ——— Badges ———
  {
    const at = new THREE.Vector3(200, 0, 0);
    const ids = [...BADGE_DEFS.map((b) => `badge:${b.id}`), "badge:tiers"];
    const size = grid(at, ids, 5, 2.9, 2.2, (a) => { const b = BADGE_DEFS.find((x) => `badge:${x.id}` === a.id); return b ? `${b.emoji} ${b.name}` : "Badge tiers"; });
    slab(at, size.w, size.d);
    sections.push({ name: "Badges", at: at.clone().setY(0.4), view: 11 });
  }

  // ——— Props ———
  {
    const at = new THREE.Vector3(240, 0, 0);
    const ids = ["tile:Z", "tile:j", "tile:l", "tile:l.open", "tile:r", "tile:G", "tile:G.boarded", "tile:R", "tile:D", "dungeon:exit", "tile:M", "dungeon:plaque", "dungeon:trophy"];
    const size = grid(at, ids, 4, 5.4, 3.8);
    slab(at, size.w, size.d);
    sections.push({ name: "Props", at: at.clone().setY(0.6), view: 12 });
  }

  let stage: { target: THREE.Vector3; sun: THREE.DirectionalLight; view: number } | null = null;
  const focus = (name: string) => {
    const s = sections.find((x) => x.name === name);
    if (!s || !stage) return;
    const p = world(s.at);
    stage.target.copy(p);
    stage.view = s.view;
    const sun = stage.sun;
    sun.target.position.copy(p);
    sun.position.set(p.x - 12, 14, p.z + 8);
    sun.target.updateMatrixWorld();
  };

  return {
    group,
    labels,
    sections,
    /** Hand over the stage (its camera target, sun and view) so the toolbar can move it. */
    attach(s: { target: THREE.Vector3; sun: THREE.DirectionalLight; view: number }) {
      stage = s;
      const bar = (group.userData as { bar: HTMLElement; btn: (t: string, f: () => void) => void; fight: () => void });
      for (const sec of sections) bar.btn(sec.name, () => focus(sec.name));
      bar.fight();
      focus(new URLSearchParams(location.search).get("section") ?? "Arena");
    },
    focus,
    /** Show or hide the toolbar. */
    show(on: boolean) {
      (group.userData as { bar: HTMLElement }).bar.hidden = !on;
    },
    update(dt: number, t: number) {
      for (const u of updates) u(dt, t);
    },
  };
}

void Model;
void ticks;
