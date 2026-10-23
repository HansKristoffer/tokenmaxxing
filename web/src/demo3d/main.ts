/**
 * The 3D demo: a company office you can walk round and furnish, every asset in a catalogue, and a corner
 * of the town, all built in code (`kit.ts`) and drawn as pixel art or smooth cel shading (`pipeline.ts`).
 */
import * as THREE from "three";
import { HAIRS, OUTFITS, PANTS, SKINS } from "../art/palette.ts";
import { Avatar, type CharStyle, type Expression, type Look, Pet, type Pose, randomLook } from "./avatar.ts";
import { type BasementScene, buildBasement, dimBasement, isLanPartyAt, lanParty, setLanParty } from "./basement3d.ts";
import { mountDecorPanel } from "./decorPanel.ts";
import { buildDungeonGallery } from "./dungeon-gallery.ts";
import { BossActor } from "./dungeon3d.ts";
import { ASSETS, type Asset, assetById, deskWithScreen } from "./furniture.ts";
import { Fx } from "./fx3d.ts";
import { itemAt, type Look2D, lookFrom2D, nameTag, wornBy } from "./gear3d.ts";
import type { Hq } from "./hq3d.ts";
import { checker, type Model, painted, seeded, ticks, tint, toon } from "./kit.ts";
import { buildPetGallery, type Pet3D, petFrom2D } from "./pets3d.ts";
import { Pipeline } from "./pipeline.ts";
import { car } from "./props.ts";
import { loadSlices } from "./registry.ts";
import { type Placed, Room, setRoomNight, type Turn } from "./room.ts";
import "./tiles.ts";
import "./collapsible.ts";
import { applyDecor } from "./decor3d.ts";
import { type ShopDisplay, shopOfRoom, shopRoom } from "./shops/index.ts";
import type { ShopHooks } from "./shops/shopActions.ts";
import { mountShopPanel, type ShopPanel } from "./shops/shopPanel.ts";
import { wallet } from "./shops/wallet.ts";
import type { Age, Species, Top } from "./styles.ts";
import { buildDormRoom, buildTavernRoom, type DormRoom, setBarTab, setPlaque, setTavernNight, type TavernRoom } from "./tavern3d.ts";
import { buildTown, setTownNight, TOWN_W } from "./town.ts";
import type { Town3d } from "./town3d.ts";
import { type MapId, type Portal, ROOM_ORDER, type World, World as WorldGraph, type WorldRoom } from "./world.ts";
import { INSET } from "./world-rooms.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const labelLayer = document.querySelector<HTMLDivElement>("#labels")!;
const pipe = new Pipeline(canvas);

const ELEVATION = Math.atan(0.5); // 2:1 pixel lines, like Habbo's.
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 160);

/** A name tag, bubble or snore floating over something in the scene. */
interface Label {
  el: HTMLDivElement;
  at: () => THREE.Vector3;
}

interface Stage {
  name: string;
  scene: THREE.Scene;
  target: THREE.Vector3;
  /** World units shown top to bottom. */
  view: number;
  /** How far the camera looks down, if not the usual. */
  elevation?: number;
  labels: Label[];
  update: (dt: number, t: number) => void;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
}

function label(text: string, cls = "tag"): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `label ${cls}`;
  el.textContent = text;
  labelLayer.append(el);
  return el;
}

function lights(scene: THREE.Scene, centre: THREE.Vector3, reach: number) {
  const hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
  sun.position.set(centre.x - reach * 0.55, 14, centre.z + reach * 0.35);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = s.bottom = -reach;
  s.right = s.top = reach;
  s.near = 1;
  s.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { sun, hemi };
}

/** Someone walking from point to point, sitting, sleeping or typing when they arrive. */
/** How everyone is drawn; the panel switches it for the whole world. */
let charStyle: CharStyle = "voxel";
const everyone: Walker[] = [];
const PET_SCALE = 1.25;

class Walker {
  avatar: Avatar;
  private path: THREE.Vector3[] = [];
  private arrive?: () => void;
  speed = 2.1;
  readonly tag: HTMLDivElement;
  bubble?: HTMLDivElement;
  private bubbleUntil = 0;
  /** How they look when nothing's happening; `feel` changes it for a while. */
  mood: Expression = "neutral";
  /** Their name shows only while they talk. */
  quiet = false;
  private moodUntil = 0;

  private tagEntry: Label;
  private bubbleEntry?: Label;

  constructor(
    public stage: Stage,
    look: Look,
    readonly name: string,
    level: number,
    tagEl?: HTMLDivElement,
  ) {
    this.avatar = new Avatar(look, charStyle);
    everyone.push(this);
    stage.scene.add(this.avatar.root);
    if (tagEl) labelLayer.append(tagEl);
    this.tag = tagEl ?? label(`${name} · Lv${level}`);
    this.tagEntry = { el: this.tag, at: () => this.top() };
    stage.labels.push(this.tagEntry);
  }

  /** Moves to another stage (a room of the world), keeping the look. */
  enter(next: Stage): void {
    if (next === this.stage) return;
    this.stage.scene.remove(this.avatar.root);
    next.scene.add(this.avatar.root);
    for (const e of [this.tagEntry, this.bubbleEntry]) {
      if (!e) continue;
      const i = this.stage.labels.indexOf(e);
      if (i >= 0) this.stage.labels.splice(i, 1);
      next.labels.push(e);
      e.el.hidden = next !== stage;
    }
    this.stage = next;
  }

  /** A new look or style, keeping where they are and what they're doing (or waving, `hello`). */
  restyle(look: Look, hello = true): void {
    const old = this.avatar;
    this.avatar = new Avatar(look, charStyle);
    this.avatar.expression = old.expression;
    this.avatar.root.position.copy(old.root.position);
    this.avatar.root.rotation.copy(old.root.rotation);
    this.avatar.pose = this.walking ? "walk" : hello ? "wave" : old.pose;
    old.root.removeFromParent();
    this.stage.scene.add(this.avatar.root);
  }

  get pos(): THREE.Vector3 {
    return this.avatar.root.position;
  }

  top(): THREE.Vector3 {
    const a = this.avatar;
    const lift =
      a.pose === "sleep"
        ? 0.55
        : a.pose === "sit" || a.pose === "type"
          ? a.height - a.hip + 0.25
          : a.height + 0.22;
    return this.pos.clone().add(new THREE.Vector3(0, lift, 0));
  }

  at(x: number, z: number, pose: Pose = "stand", turn = 0, y = 0): this {
    this.pos.set(x, y, z);
    this.avatar.root.rotation.y = turn;
    this.avatar.pose = pose;
    return this;
  }

  go(points: THREE.Vector3[], arrive?: () => void): void {
    this.path = points;
    this.arrive = arrive;
    this.pos.y = 0;
    if (points.length) this.avatar.pose = "walk";
  }

  get walking(): boolean {
    return this.path.length > 0;
  }

  say(text: string, now: number): void {
    if (!this.bubble) {
      this.bubble = label("", "bubble");
      this.bubbleEntry = { el: this.bubble, at: () => this.top().add(new THREE.Vector3(0, 0.32, 0)) };
      this.stage.labels.push(this.bubbleEntry);
    }
    this.bubble.textContent = text;
    this.bubble.style.display = "";
    this.bubbleUntil = now + 4;
  }

  /** Shows `expression` for `seconds`, then goes back to their mood. */
  feel(expression: Expression, now: number, seconds = 3): void {
    this.avatar.expression = expression;
    this.moodUntil = now + seconds;
  }

  update(dt: number, t: number): void {
    const next = this.path[0];
    if (next) {
      const d = next.clone().sub(this.pos).setY(0);
      const step = this.speed * dt;
      if (d.length() <= step) {
        this.pos.set(next.x, this.pos.y, next.z);
        this.path.shift();
        if (!this.path.length) {
          this.avatar.pose = "stand";
          this.arrive?.();
        }
      } else {
        this.pos.add(d.normalize().multiplyScalar(step));
        const want = Math.atan2(d.x, d.z);
        const r = this.avatar.root.rotation;
        r.y += Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y)) * Math.min(1, dt * 14);
      }
    }
    if (this.bubble && t > this.bubbleUntil) this.bubble.style.display = "none";
    // The mouth moves for the first part of what they say.
    this.avatar.talking = t < this.bubbleUntil - 1.6;
    if (this.quiet) this.tag.style.display = t < this.bubbleUntil ? "" : "none";
    if (t > this.moodUntil) this.avatar.expression = this.mood;
    this.avatar.update(dt, t);
  }
}

/** A pet trotting after someone, or about on its own. */
class Follower {
  readonly pet: Pet;
  private wander = new THREE.Vector3();
  constructor(
    stage: Stage,
    kind: "cat" | "dog" | "duck",
    color: string,
    readonly owner: Walker | null,
    readonly name: string,
    start: THREE.Vector3,
    private readonly roam?: () => THREE.Vector3,
  ) {
    this.pet = new Pet(kind, color);
    this.pet.root.scale.setScalar(PET_SCALE);
    this.pet.root.position.copy(start);
    this.wander.copy(start);
    stage.scene.add(this.pet.root);
    const el = label(name, "tag pet");
    stage.labels.push({ el, at: () => this.pet.root.position.clone().add(new THREE.Vector3(0, 0.7, 0)) });
  }

  update(dt: number, t: number): void {
    const p = this.pet.root.position;
    let goal = this.wander;
    if (this.owner) {
      const o = this.owner.pos;
      const back = new THREE.Vector3(
        Math.sin(this.owner.avatar.root.rotation.y),
        0,
        Math.cos(this.owner.avatar.root.rotation.y),
      );
      goal = new THREE.Vector3(o.x, 0, o.z).sub(back.multiplyScalar(0.7));
    } else if (p.distanceTo(this.wander) < 0.1 && Math.random() < dt * 0.4 && this.roam)
      this.wander = this.roam();
    const d = goal.clone().sub(p).setY(0);
    const far = d.length();
    this.pet.moving = far > (this.owner ? 0.45 : 0.05);
    if (this.pet.moving) {
      p.add(d.normalize().multiplyScalar(Math.min(far, dt * (this.owner ? 2.4 : 1.2))));
      this.pet.root.rotation.y = Math.atan2(d.x, d.z);
    }
    this.pet.update(t);
  }
}

const tile = (x: number, z: number) => new THREE.Vector3(x + 0.5, 0, z + 0.5);
const NAMES = ["noah", "sofie", "maja", "lin", "oskar", "kai", "ida", "ellen", "ada", "theo", "jonas"];
const CHAT = [
  "shipping the new build tonight",
  "who burned 40B this week?? 👀",
  "agents are cooking 🔥",
  "ping-pong after the deploy?",
  "Nightshift again 😅",
  "coffee machine is free",
  "merged ✅",
];

function newStage(
  name: string,
  centre: THREE.Vector3,
  reach: number,
  view: number,
  background: string,
): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const { sun, hemi } = lights(scene, centre, reach);
  return { name, scene, target: centre.clone(), view, labels: [], update: () => {}, sun, hemi };
}

// ——— The office ———
const office = newStage("Office", new THREE.Vector3(6, 0.6, 5), 11, 11.5, "#1b1f2a");
const room = new Room(12, 10);
const officeDecor = mountDecorPanel(room, office.target);
office.scene.add(room.group);
const put = (id: string, x: number, z: number, turn: Turn = 0, model?: Model) =>
  room.place(assetById.get(id)!, x, z, turn, model);

put("shelf", 0, 0);
put("bookshelf", 1, 0);
put("whiteboard", 2, 0);
put("server-rack", 5, 0);
put("server-rack", 6, 0);
put("tv", 8, 0);
put("coffee", 10, 0);
put("vending-machine", 11, 0);
const desks = [0, 2, 5].map((x, i) => {
  put("desk", x, 2, 0, deskWithScreen(i + 3));
  return put("chair", x, 3, 2);
});
put("rug", 8, 1);
put("coffee-table", 8, 2);
const sofaSeat = put("sofa", 8, 3, 2);
put("beanbag", 10, 2, 3);
const beds = [put("bed", 0, 5, 1), put("bed", 0, 7, 1)];
put("lava-lamp", 0, 6);
put("plant", 0, 9);
put("arcade-cabinet", 11, 5);
put("mini-fridge", 11, 7);
put("monstera", 11, 9);
put("ping-pong", 5, 6);
put("aquarium", 2, 9, 2);
put("gong", 8, 9, 2);
put("lounge-chair", 3, 6, 1);
put("water-cooler", 4, 0);
room.hang(assetById.get("neon-sign")!.build(), 9, 1.75);

const walkers: Walker[] = [];
const seatAt = (p: Placed, w: Walker, pose: Pose = "sit") => {
  const s = room.seatOf(p)!;
  w.at(s.at.x, s.at.z, pose, s.turn, s.at.y - 0.02);
};
desks.forEach((chair, i) => {
  const w = new Walker(office, randomLook(seeded(i + 11)), NAMES[i]!, 9 - i);
  w.mood = "focus";
  seatAt(chair, w, "type");
  walkers.push(w);
});
{
  const w = new Walker(office, randomLook(seeded(31)), "lin", 7);
  const b = room.bedOf(beds[0]!)!;
  w.at(b.at.x, b.at.z, "sleep", b.turn, b.at.y);
  walkers.push(w);
  const snore = label("z Z z", "snore");
  office.labels.push({ el: snore, at: () => w.top().add(new THREE.Vector3(0, 0.45, 0)) });
}
{
  const w = new Walker(office, randomLook(seeded(41)), "oskar", 8);
  w.mood = "happy";
  seatAt(sofaSeat, w);
  walkers.push(w);
}
const wanderer = new Walker(office, randomLook(seeded(52)), "kai", 7).at(7.5, 5.5);
walkers.push(wanderer);

const me = new Walker(office, randomLook(seeded(Date.now() % 1000)), "you", 6).at(
  4.5,
  8.5,
  "wave",
  Math.PI / 4,
);
walkers.push(me);
const pets = [
  new Follower(office, "cat", "#e8a65a", me, "Miso", tile(4, 7)),
  new Follower(office, "dog", "#c9853a", null, "Bao", tile(9, 6), () => {
    for (;;) {
      const x = Math.floor(Math.random() * 12);
      const z = 4 + Math.floor(Math.random() * 6);
      if (room.open(x, z)) return tile(x, z);
    }
  }),
];

/** Walks someone to a tile, or onto a seat or into a bed there. */
function walkTo(w: Walker, x: number, z: number): void {
  const from: [number, number] = [Math.floor(w.pos.x), Math.floor(w.pos.z)];
  const target = room.at(x, z);
  const seat = target && (room.seatOf(target) ?? room.bedOf(target));
  if (target && !seat && !room.open(x, z)) return;
  const steps = room.path(from, [x, z]);
  if (!steps) return;
  const points = steps.slice(1).map(([sx, sz]) => tile(sx, sz));
  if (seat) {
    points.pop();
    points.push(new THREE.Vector3(seat.at.x, 0, seat.at.z));
  }
  w.go(points, () => {
    if (!seat || !target) return;
    const pose: Pose = target.asset.bed ? "sleep" : "sit";
    w.at(seat.at.x, seat.at.z, pose, seat.turn, seat.at.y - (pose === "sit" ? 0.02 : 0));
  });
}

let wanderAt = 1;
office.update = (dt, t) => {
  if (!wanderer.walking && t > wanderAt) {
    wanderAt = t + 3 + Math.random() * 4;
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * 12);
      const z = 4 + Math.floor(Math.random() * 6);
      if (room.open(x, z)) {
        walkTo(wanderer, x, z);
        break;
      }
    }
    if (Math.random() < 0.5) {
      wanderer.say(CHAT[Math.floor(Math.random() * CHAT.length)]!, t);
      wanderer.feel(Math.random() < 0.5 ? "laugh" : "happy", t, 4);
    }
  }
  for (const w of walkers) w.update(dt, t);
  for (const p of pets) p.update(dt, t);
};

// ——— The catalogue ———
// Assets from the slice files (`registry.ts`) join the showroom after the shop's own.
const sliceAssets = await loadSlices();
const catalogAssets = [...ASSETS, ...sliceAssets.filter((a) => !assetById.has(a.id))];
const COLS = 6;
const CELL_W = 3.2;
const CELL_D = 4.4;
const rows = Math.ceil(catalogAssets.length / COLS) + 1;
const catW = COLS * CELL_W;
const catD = rows * CELL_D;
const catalog = newStage("Catalog", new THREE.Vector3(), Math.max(catW, catD) * 0.75, 12, "#1b1f2a");
// The showroom is turned to face the camera, so its rows run across the screen.
const showroom = new THREE.Group();
showroom.rotation.y = Math.PI / 4;
catalog.scene.add(showroom);
{
  const tex = checker("#e8dcc4", "#dccdb0", 2);
  tex.repeat.set(catW / 2, catD / 2);
  const side = toon(tint("#dccdb0", -0.4));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(catW, 0.3, catD), [
    side,
    side,
    painted(tex),
    side,
    side,
    side,
  ]);
  floor.position.set(0, -0.15, 0);
  floor.receiveShadow = true;
  showroom.add(floor);
}
/** The centre of a showroom cell, in the world. */
const cell = (col: number, row: number) =>
  new THREE.Vector3((col + 0.5) * CELL_W - catW / 2, 0, (row + 0.5) * CELL_D - catD / 2).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 4,
  );
catalog.target.copy(cell(COLS / 2 - 0.5, 1.5)).setY(0.5);
const spinning: THREE.Object3D[] = [];
catalogAssets.forEach((a, i) => {
  const m = a.build();
  m.position.copy(cell(i % COLS, Math.floor(i / COLS) + 1));
  catalog.scene.add(m);
  spinning.push(m);
  const top = new THREE.Box3().setFromObject(m).max.y;
  const el = label(`${a.name} · ${a.price}🪙`, "tag item");
  catalog.labels.push({ el, at: () => m.position.clone().setY(top + 0.25) });
});
const parade: Avatar[] = [];
for (let i = 0; i < 8; i++) {
  const a = new Avatar(randomLook(seeded(i * 13 + 5)));
  a.root.position.copy(cell(i * 0.5 - 0.25, 0));
  a.root.rotation.y = Math.PI / 4;
  a.pose = (["stand", "wave", "stand", "dance"] as const)[i % 4]!;
  a.expression = (["happy", "laugh", "surprised", "love", "wink", "focus", "neutral", "happy"] as const)[i]!;
  catalog.scene.add(a.root);
  parade.push(a);
}
const paradePets = (
  [
    ["cat", "#e8a65a"],
    ["dog", "#c9853a"],
    ["duck", "#f5d14a"],
    ["cat", "#3c4454"],
  ] as const
).map(([kind, color], i) => {
  const p = new Pet(kind, color);
  p.root.position.copy(cell(4 + i * 0.5 - 0.25, 0));
  p.root.rotation.y = Math.PI / 4;
  catalog.scene.add(p.root);
  return p;
});
let spin = true;
catalog.update = (dt, t) => {
  if (spin) for (const m of spinning) m.rotation.y += dt * 0.5;
  for (const a of parade) a.update(dt, t);
  paradePets.forEach((p, i) => {
    p.moving = i % 2 === 0;
    p.update(t);
  });
};

// ——— The town ———
const town = buildTown();
const spots = town.spots;
const townStage = newStage("Old town", new THREE.Vector3(18, 0.5, 15), 24, 15, "#1b1f2a");
townStage.sun.shadow.mapSize.set(4096, 4096);
townStage.scene.add(town.group);
const v3 = (x: number, z: number) => new THREE.Vector3(x, 0, z);
const townPeople: Walker[] = [];
let born = 0;
function resident(mood: Expression = "neutral"): Walker {
  const w = new Walker(
    townStage,
    randomLook(seeded(born * 7 + 90)),
    NAMES[born % NAMES.length]!,
    4 + (born % 7),
  );
  born++;
  w.mood = mood;
  w.quiet = true;
  townPeople.push(w);
  return w;
}
const facing = (from: [number, number], to: [number, number]) => Math.atan2(to[0] - from[0], to[1] - from[1]);

spots.routes.forEach((r, i) => {
  const w = resident();
  const pts = r.points.map(([x, z]) => v3(x, z));
  w.at(pts[0]!.x, pts[0]!.z);
  w.speed = 1.3 + (i % 3) * 0.3;
  const round = () => w.go(r.loop ? [...pts.slice(1), pts[0]!] : [pts[1]!, pts[0]!], round);
  round();
});
const talkers: Walker[] = [];
spots.seats.forEach((seat, i) => {
  const w = resident(i % 2 ? "happy" : "neutral");
  w.at(seat.at[0], seat.at[1], "sit", seat.turn, seat.y - 0.02);
  talkers.push(w);
});
for (const [i, at] of spots.dancers.entries()) {
  const w = resident(i % 2 ? "laugh" : "happy");
  // Half face the DJ, half the crowd (and the camera).
  w.at(at[0], at[1], "dance", i % 2 ? facing(at, spots.dj) : Math.PI / 4 + (i - 1) * 0.4);
}
resident("happy").at(spots.dj[0], spots.dj[1], "dj");
resident("neutral").at(spots.bartender[0], spots.bartender[1], "stand");
resident("happy").at(spots.vendor[0], spots.vendor[1], "stand");
const customer = resident("love").at(spots.customer[0], spots.customer[1], "stand", Math.PI);
talkers.push(customer);
// A picnic for two.
for (const [x, z, turn] of [
  [23.1, 27.25, 0.9],
  [23.95, 27.65, -2.3],
  [27.4, 26.8, 0.2],
] as const) {
  const w = resident(turn > 0 ? "happy" : "wink");
  w.at(x, z, "sit", turn, 0.04);
  talkers.push(w);
}
const townMe = new Walker(townStage, randomLook(seeded(3)), "you", 6).at(
  spots.start[0],
  spots.start[1],
  "wave",
  0.6,
);
townMe.mood = "happy";
townPeople.push(townMe);

const townPets = [
  new Follower(townStage, "dog", "#e8e2d4", townPeople[1]!, "Pixel", v3(3, 18.4)),
  new Follower(townStage, "cat", "#3c4454", townMe, "Miso", v3(17, 13.5)),
  new Follower(townStage, "dog", "#c9853a", townPeople[3]!, "Bao", v3(18, 13)),
];
// Ducks paddling round the pond.
const ducks = [0, 1, 2].map((i) => {
  const d = new Pet("duck", i ? "#fbf7ef" : "#f5d14a");
  d.root.scale.setScalar(i ? 0.7 : 0.9);
  townStage.scene.add(d.root);
  return d;
});
// Traffic.
const cars = spots.lanes.flatMap((lane, i) =>
  [0, 1].map((k) => {
    const m = car(["#e25d5d", "#4f8fe0", "#f0b53c", "#f2f0ea"][i * 2 + k]!);
    m.position.z = lane.z;
    m.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    townStage.scene.add(m);
    return { m, lane, offset: k * 0.5 + i * 0.27, speed: 2.4 + k * 0.6 };
  }),
);
let chatAt = 1;
townStage.update = (dt, t) => {
  if (t > chatAt) {
    chatAt = t + 1.8;
    const w = talkers[Math.floor(Math.random() * talkers.length)]!;
    w.say(CHAT[Math.floor(Math.random() * CHAT.length)]!, t);
    w.feel((["laugh", "happy", "surprised", "wink"] as const)[Math.floor(Math.random() * 4)]!, t, 4);
  }
  for (const w of townPeople) w.update(dt, t);
  for (const p of townPets) p.update(dt, t);
  ducks.forEach((d, i) => {
    const a = t * 0.35 + i * 2.1;
    const { at, rx, rz } = spots.pond;
    d.root.position.set(
      at[0] + Math.cos(a) * rx * (1 - i * 0.2),
      -0.06,
      at[1] + Math.sin(a) * rz * (1 - i * 0.2),
    );
    d.root.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2;
    d.update(t * 0.3);
  });
  const span = TOWN_W + 6;
  for (const c of cars) {
    const f = (((t * c.speed) / span + c.offset) % 1) * span - 3;
    c.m.position.x = c.lane.dir > 0 ? f : TOWN_W - f;
  }
};

// ——— The Tavern and the dorm above it ———
const tavern = buildTavernRoom();
const tavernStage = newStage("Tavern", new THREE.Vector3(13, 0.6, 8), 20, 22, "#1b1f2a");
tavernStage.scene.add(tavern.room.group);
setBarTab(tavern.by.get("tile:J")![0]!, [["ADA", "21H"], ["NOAH", "14H"], ["SOFIE", "9.5H"], ["KAI", "6.2H"], ["MAJA", "3.0H"]], 0);
setPlaque(tavern.by.get("tile:P")![0]!, ["ADA", "NOA", "SOF"]);
setPlaque(tavern.by.get("tavern:plaque-2")![0]!, ["KAI", "MAJ"]);
{
  const seat = (x: number, z: number, look: number, name: string, pose: Pose = "sit") => {
    const p = tavern.room.at(x, z)!;
    const w = new Walker(tavernStage, randomLook(seeded(look)), name, 5 + (look % 9));
    const s = tavern.room.seatOf(p)!;
    w.at(s.at.x, s.at.z, pose, s.turn, s.at.y - 0.02);
    return w;
  };
  const patrons = [
    seat(2, 3, 61, "ida"),
    seat(6, 3, 62, "theo"),
    seat(5, 7, 63, "ellen"),
    seat(0, 11, 64, "jonas"),
    seat(22, 4, 65, "maja"),
    seat(16, 8, 66, "kai"),
    seat(4, 15, 67, "sofie"),
  ];
  patrons[4]!.mood = "happy";
  const keeper = new Walker(tavernStage, randomLook(), "Bent the Barkeep", 40);
  tavernStage.scene.remove(keeper.avatar.root);
  tavernStage.scene.add(tavern.barkeep.root);
  tavernStage.labels.push({ el: keeper.tag, at: () => tavern.barkeep.root.position.clone().setY(1.3) });
  tavernStage.update = (dt, t) => {
    for (const p of patrons) p.update(dt, t);
    tavern.barkeep.update(dt, t);
  };
}
const dorm = buildDormRoom();
const dormStage = newStage("Dorm", new THREE.Vector3(9, 0.6, 3.5), 12, 11, "#1b1f2a");
dormStage.scene.add(dorm.room.group);
{
  const sleepers = [0, 3, 5, 8, 11, 14].map((i) => {
    const w = new Walker(dormStage, randomLook(seeded(70 + i)), NAMES[i % NAMES.length]!, 3 + i);
    const b = dorm.room.bedOf(dorm.beds[i]!)!;
    w.at(b.at.x, b.at.z, "sleep", b.turn, b.at.y);
    return w;
  });
  dormStage.update = (dt, t) => {
    for (const w of sleepers) w.update(dt, t);
  };
}

// ——— The basement net cafe ———
const basementScene = buildBasement();
const basement = newStage("Basement", new THREE.Vector3(10, 0.6, 6.5), 16, 15, "#0b0a16");
basement.scene.add(basementScene.room.group);
const sitting: Walker[] = [];
{
  const sitters = [0, 3, 6, 9, 13, 17];
  sitters.forEach((ci, i) => {
    const w = new Walker(basement, randomLook(seeded(i * 5 + 70)), NAMES[i % NAMES.length]!, 3 + i);
    const s = basementScene.room.seatOf(basementScene.chairs[ci]!)!;
    w.mood = "focus";
    w.at(s.at.x, s.at.z, "type", s.turn, s.at.y - 0.02);
    sitting.push(w);
  });
}
basement.update = (dt, t) => {
  basementScene.update(dt, t);
  for (const w of sitting) w.update(dt, t);
};
dimBasement(basement.scene, basement.hemi, basement.sun);
setLanParty(isLanPartyAt());

// ——— The dungeon gallery ———
const dungeonGallery = buildDungeonGallery();
const dungeon = newStage("Dungeon", new THREE.Vector3(), 22, 17, "#14121b");
dungeon.scene.add(dungeonGallery.group);
dungeonGallery.attach(dungeon);
for (const l of dungeonGallery.labels) dungeon.labels.push({ el: label(l.text, l.cls), at: l.at });
dungeon.update = (dt, t) => dungeonGallery.update(dt, t);

// ——— The pets gallery (pets3d.ts) ———
const petsStage = newStage("Pets", new THREE.Vector3(0, 0.4, 0), 14, 17, "#1b1f2a");
{
  const gallery = buildPetGallery();
  gallery.group.rotation.y = Math.PI / 4;
  petsStage.scene.add(gallery.group);
  for (const l of gallery.labels) {
    const at = l.at.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    petsStage.labels.push({ el: label(l.text, "tag item"), at: () => at });
  }
  petsStage.update = gallery.update;
}


// ——— The characters: the styles side by side, trying on faces and moves ———
interface CastRow {
  name: string;
  style: CharStyle;
  /** Who stands where, by column; `undefined` leaves a gap. */
  cast: (Partial<Look> | undefined)[];
  /** A caption over each head. */
  captions?: string[];
}
const mixed = (species: Species[]) => species.map((s) => ({ species: s, job: undefined }));
/** One of them at three ages, dressed for each: a green hoodie, a blue blazer, a mustard cardigan. */
const aged = (species: Species, tops: Top[], beards: number[]) =>
  (["young", "adult", "senior"] as Age[]).map((age, i) => ({
    species,
    age,
    top: tops[i]!,
    outfit: OUTFITS[[2, 1, 3][i]!]!,
    pants: PANTS[[2, 1, 2][i]!]!,
    beard: beards[i]!,
    glasses: age === "senior",
    hat: "none" as const,
    job: undefined,
  }));
const CAST_ROWS: CastRow[] = [
  {
    name: "🧊 Voxel",
    style: "voxel",
    cast: [
      { species: "human", age: "adult", job: "chef", hat: "none" },
      { species: "human", age: "young", top: "hoodie", job: undefined },
      { species: "human", age: "adult", job: "farmer" },
      { species: "human", age: "adult", top: "blazer", beard: 2, job: undefined },
      { species: "human", age: "senior", top: "cardigan", job: undefined },
      { species: "human", age: "adult", job: "officer" },
      { species: "human", age: "young", top: "tee", hat: "headphones", job: undefined },
    ],
  },
  {
    name: "🦊 Voxel animals",
    style: "voxel",
    cast: mixed(["cat", "dog", "bunny", "bear", "pig", "fox", "mouse"]),
  },
  {
    name: "⏳ Aging",
    style: "voxel",
    cast: [
      ...aged("human", ["hoodie", "blazer", "cardigan"], [0, 1, 2]),
      undefined,
      ...aged("dog", ["tee", "blazer", "cardigan"], [0, 0, 0]),
    ],
    captions: ["20s", "40s", "70s", "", "20s", "40s", "70s"],
  },
  {
    name: "🧑 Smooth",
    style: "grown",
    cast: mixed(["human", "fox", "human", "bear", "human", "cat", "human"]),
  },
];
const CAST_COLS = 7;
const CAST_W = 1.3;
const CAST_D = 1.6;
/** Each row stands a step above the one in front, like a class photo. */
const CAST_STEP = 0.95;
const castW = CAST_COLS * CAST_W + 2;
const castD = CAST_ROWS.length * CAST_D;
const cast = newStage("Characters", new THREE.Vector3(), 9, 8.3, "#1b1f2a");
// Lower than elsewhere, to look them in the face.
cast.elevation = 0.24;
const rise = (row: number) => (CAST_ROWS.length - 1 - row) * CAST_STEP;
const spot = (col: number, row: number) =>
  new THREE.Vector3(
    1 + (col + 0.5) * CAST_W - castW / 2,
    rise(row),
    (row + 0.5) * CAST_D - castD / 2,
  ).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
{
  const show = new THREE.Group();
  show.rotation.y = Math.PI / 4;
  cast.scene.add(show);
  const side = toon(tint("#dccdb0", -0.4));
  CAST_ROWS.forEach((_, row) => {
    const tex = checker("#e8dcc4", "#dccdb0", 2);
    tex.repeat.set(castW / 2, CAST_D / 2);
    const h = rise(row) + 0.3;
    const step = new THREE.Mesh(new THREE.BoxGeometry(castW, h, CAST_D), [
      side,
      side,
      painted(tex),
      side,
      side,
      side,
    ]);
    step.position.set(0, rise(row) - h / 2, (row + 0.5) * CAST_D - castD / 2);
    step.castShadow = step.receiveShadow = true;
    show.add(step);
  });
}
cast.target.copy(spot(3, 1.5)).setY(2.95);
const CAST_POSES: Pose[] = ["wave", "stand", "dance", "stand", "walk", "stand", "dance"];
const CAST_FACES: Expression[] = ["happy", "laugh", "surprised", "love", "wink", "focus", "neutral"];
const castAvatars: { a: Avatar; i: number }[] = [];
CAST_ROWS.forEach((row, r) => {
  const el = label(row.name, "tag style-name");
  const at = spot(-0.8, r).add(new THREE.Vector3(0, 0.4, 0));
  cast.labels.push({ el, at: () => at });
  // The aging row is the same two, so they share a look.
  const base = row.captions ? randomLook(seeded(77)) : undefined;
  row.cast.forEach((who, i) => {
    if (!who) return;
    const look = { ...(base ?? randomLook(seeded(r * 31 + i * 7 + 3))), ...who };
    const a = new Avatar(look, row.style);
    a.root.position.copy(spot(i, r));
    a.root.rotation.y = Math.PI / 4;
    a.pose = row.captions ? "stand" : CAST_POSES[i]!;
    cast.scene.add(a.root);
    castAvatars.push({ a, i: i + r * 2 });
    const caption = row.captions?.[i];
    if (caption) {
      const tag = label(caption);
      // On the step at their feet.
      const over = spot(i, r).add(new THREE.Vector3(0, -0.12, 0));
      cast.labels.push({ el: tag, at: () => over });
    }
  });
});
cast.update = (dt, t) => {
  for (const { a, i } of castAvatars) {
    // Each tries the faces in turn, out of step with its neighbours.
    a.expression = CAST_FACES[(Math.floor(t / 2.2) + i) % CAST_FACES.length]!;
    a.talking = a.expression === "neutral";
    a.update(dt, t);
  }
};

function setCharStyle(id: CharStyle): void {
  charStyle = id;
  for (const w of everyone) w.restyle(w.avatar.look, false);
  choose("chars", id);
}

const stages = [office, catalog, townStage, tavernStage, dormStage, basement, dungeon, petsStage, cast];
let stage = office;

// ——— The world: the 2D town's rooms, walkable, joined by their doors ———
const world: World = new WorldGraph();
const worldStages = new Map<MapId, Stage>();
const roomOf = new Map<Stage, WorldRoom>();
const isWorld = (s: Stage): boolean => roomOf.has(s);
const roomParam = new URLSearchParams(location.search).get("room") as MapId | null;
let worldRoom: MapId = roomParam && ROOM_ORDER.includes(roomParam) ? roomParam : "town";
let worldMe: Walker | null = null;
let fading = false;
let night = false;
const decorPanels = new Map<Stage, HTMLElement>();

// ——— The people of the world: 2D looks dressed by gear3d, tags by nameTag, pets by pets3d ———
const gearIdx = (slot: "hat" | "glasses" | "held" | "back") =>
  [...Array(40).keys()].filter((i) => i > 0 && itemAt(slot, i));
const GEAR = { hat: gearIdx("hat"), glasses: gearIdx("glasses"), held: gearIdx("held"), back: gearIdx("back") };
/** A made-up saved look (`Look2D`): half of the people wear something from each slot. */
function look2dOf(seed: number): Look2D {
  const r = seeded(seed);
  const pick = (n: number) => Math.floor(r() * n);
  const some = (xs: number[]) => (r() < 0.5 || !xs.length ? 0 : xs[pick(xs.length)]!);
  return {
    style: pick(4),
    skin: pick(SKINS.length),
    hair: pick(HAIRS.length),
    outfit: pick(OUTFITS.length),
    glasses: some(GEAR.glasses),
    hat: some(GEAR.hat),
    held: some(GEAR.held),
    back: some(GEAR.back),
  };
}
const COMPANIES = [{ name: "Nightshift", color: "#3f7a78" }, { name: "Lumen", color: "#7a5ab8" }];
/** Someone in the world: a `Walker` in their 2D look, under a gear3d name tag. */
function person(s: Stage, look: Look2D, name: string, level: number, company?: { name: string; color: string }): Walker {
  const tagEl = nameTag({ name, level, rarity: wornBy(look).rarity, company });
  return new Walker(s, lookFrom2D(look, { level }), name, level, tagEl);
}

/** A pet (pets3d) trotting after someone, or pottering about its room. */
class Companion {
  pet: Pet3D;
  private readonly entry: Label;
  private wander = new THREE.Vector3();
  constructor(
    public stage: Stage,
    species: string,
    variant: number,
    readonly name: string,
    readonly owner: Walker | null,
    start: THREE.Vector3,
    private readonly roam?: () => THREE.Vector3,
  ) {
    this.pet = petFrom2D(species, variant, name);
    // The voxel folk are a head taller than the chibis the pets were drawn beside.
    this.pet.root.scale.setScalar(PET_SCALE);
    this.pet.root.position.copy(start);
    this.wander.copy(start);
    stage.scene.add(this.pet.root);
    const el = label(name, "tag pet");
    this.entry = { el, at: () => this.pet.root.position.clone().add(new THREE.Vector3(0, 0.7, 0)) };
    stage.labels.push(this.entry);
  }
  /** Swaps for another pet (the pet shop): same spot, new species, look and gear. */
  swap(species: string, variant: string, name: string, wear = 0): void {
    const old = this.pet.root;
    this.pet = petFrom2D(species, variant, name);
    this.pet.root.scale.setScalar(PET_SCALE);
    this.pet.root.position.copy(old.position);
    this.pet.root.rotation.copy(old.rotation);
    this.pet.wear = wear;
    old.removeFromParent();
    this.stage.scene.add(this.pet.root);
    this.entry.el.textContent = name;
  }
  enter(next: Stage): void {
    if (next === this.stage) return;
    this.stage.scene.remove(this.pet.root);
    next.scene.add(this.pet.root);
    const i = this.stage.labels.indexOf(this.entry);
    if (i >= 0) this.stage.labels.splice(i, 1);
    next.labels.push(this.entry);
    this.entry.el.hidden = next !== stage;
    this.stage = next;
  }
  update(dt: number, t: number): void {
    const p = this.pet.root.position;
    let goal = this.wander;
    if (this.owner) {
      const o = this.owner.pos;
      const ry = this.owner.avatar.root.rotation.y;
      goal = new THREE.Vector3(o.x - Math.sin(ry) * 0.7, 0, o.z - Math.cos(ry) * 0.7);
    } else if (p.distanceTo(this.wander) < 0.1 && Math.random() < dt * 0.4 && this.roam) this.wander = this.roam();
    const d = goal.clone().sub(p).setY(0);
    const far = d.length();
    this.pet.moving = far > (this.owner ? 0.45 : 0.05);
    if (this.pet.moving) {
      p.add(d.normalize().multiplyScalar(Math.min(far, dt * (this.owner ? 2.4 : 1.2))));
      this.pet.root.rotation.y = Math.atan2(d.x, d.z);
    }
    this.pet.update(t);
  }
}

let worldPet: Companion | null = null;
let playerLook: Look2D = wallet.look ?? look2dOf(3);
const PLAYER_LEVEL = Number(new URLSearchParams(location.search).get("level") ?? 6);

/** What a room needs beyond its props: patrons, sleepers, the barkeep, the boss. Returns its per-frame update. */
function roomActors(id: MapId, r: WorldRoom, s: Stage): ((dt: number, t: number) => void) | null {
  const at = (v: THREE.Vector3, y = v.y): [number, number, number] => [v.x + INSET[0], y, v.z + INSET[1]];
  const sit = (look: number, name: string, p: Placed, room: Room, pose: Pose = "sit") => {
    const w = person(s, look2dOf(look), name, 3 + (look % 9));
    const seat = room.seatOf(p)!;
    const [x, y, z] = at(room.group.worldToLocal(seat.at.clone()));
    w.at(x, z, pose, seat.turn, y - 0.02);
    return w;
  };
  const ex = r.skin?.extra;
  if (id === "inn") {
    const inn = ex as TavernRoom;
    setBarTab(inn.by.get("tile:J")![0]!, [["ADA", "21H"], ["NOAH", "14H"], ["SOFIE", "9.5H"], ["KAI", "6.2H"], ["MAJA", "3.0H"]], 0);
    setPlaque(inn.by.get("tile:P")![0]!, ["ADA", "NOA", "SOF"]);
    setPlaque(inn.by.get("tavern:plaque-2")![0]!, ["KAI", "MAJ"]);
    const patrons = [[2, 3, "ida"], [6, 3, "theo"], [5, 7, "ellen"], [0, 11, "jonas"], [22, 4, "maja"], [16, 8, "kai"], [4, 15, "sofie"]].map(([x, z, n], i) =>
      sit(61 + i, n as string, inn.room.at(x as number, z as number)!, inn.room),
    );
    patrons[4]!.mood = "happy";
    const tag = nameTag({ name: "Bent the Barkeep", level: 40, company: { name: "Barkeep", color: "#8a5a3a" } });
    labelLayer.append(tag);
    tag.hidden = true;
    const p = new THREE.Vector3();
    s.labels.push({ el: tag, at: () => p.setFromMatrixPosition(inn.barkeep.root.matrixWorld).setY(1.55) });
    return (dt, t) => {
      for (const w of patrons) w.update(dt, t);
      inn.barkeep.update(dt, t);
    };
  }
  if (id === "upstairs") {
    const dorm = ex as DormRoom;
    const sleepers = [0, 3, 5, 8, 11, 14].map((i) => {
      const w = person(s, look2dOf(70 + i), NAMES[i % NAMES.length]!, 3 + i);
      const b = dorm.room.bedOf(dorm.beds[i]!)!;
      const [x, y, z] = at(dorm.room.group.worldToLocal(b.at.clone()));
      w.at(x, z, "sleep", b.turn, y);
      return w;
    });
    return (dt, t) => {
      for (const w of sleepers) w.update(dt, t);
    };
  }
  if (id === "basement") {
    const b = ex as BasementScene;
    const sitters = [0, 3, 6, 9, 13, 17].map((ci, i) => {
      const w = sit(i * 5 + 70, NAMES[i % NAMES.length]!, b.chairs[ci]!, b.room, "type");
      w.mood = "focus";
      return w;
    });
    return (dt, t) => {
      b.update(dt, t);
      for (const w of sitters) w.update(dt, t);
    };
  }
  if (id === "hq") {
    const hq = ex as Hq;
    const workers = [0, 1, 4].map((ci, i) => {
      const w = sit(i * 7 + 20, NAMES[(i + 4) % NAMES.length]!, hq.chairs[ci]!, hq.room, "type");
      w.mood = "focus";
      return w;
    });
    return (dt, t) => {
      for (const w of workers) w.update(dt, t);
    };
  }
  if (id === "office") {
    // The pet sleeps in its basket.
    const bed = r.map.find("Q")[0];
    if (bed) {
      const c = new Companion(s, "cat", 0, "Miso", null, new THREE.Vector3(bed[0] + 0.5, 0.1, bed[1] + 0.5));
      c.pet.pose = "sleep";
      return (dt, t) => c.update(dt, t);
    }
  }
  if (id === "dungeon") {
    const dais = r.drawn.get("Z")?.[0];
    const boss = new BossActor("rate-limit", { maxHp: 2e9, hp: 1.7e9 });
    if (dais) boss.root.position.set(dais.position.x, 0.28, dais.position.z);
    s.scene.add(boss.root);
    // Raiders at every other war-desk seat, typing at the boss.
    const raiders = (r.drawn.get("r") ?? []).filter((_, i) => i % 3 === 0).map((m, i) => {
      const w = person(s, look2dOf(300 + i), NAMES[i % NAMES.length]!, 10 + i);
      const dx = (dais?.position.x ?? 13) - m.position.x;
      const dz = (dais?.position.z ?? 4) - m.position.z;
      w.at(m.position.x, m.position.z, "type", Math.atan2(dx, dz), 0.33);
      w.mood = "focus";
      w.quiet = true;
      return w;
    });
    let nextHit = 3;
    return (dt, t) => {
      for (const w of raiders) w.update(dt, t);
      if (t > nextHit) {
        nextHit = t + 2.5 + Math.random() * 2;
        boss.hit(2e7);
      }
    };
  }
  return null;
}

function worldStage(id: MapId): Stage {
  let s = worldStages.get(id);
  if (s) return s;
  const r = world.room(id);
  const reach = Math.max(r.W, r.D) * 0.75;
  // The town's stage is "Town": the street life (`fx3d.ts`) looks for it by that name.
  s = newStage(id === "town" ? "Town" : `World:${id}`, new THREE.Vector3(r.W / 2, 0.5, r.D / 2), reach, id === "town" ? 14 : 11.5, "#1b1f2a");
  if (reach > 14) s.sun.shadow.mapSize.set(4096, 4096);
  s.scene.add(r.group);
  worldStages.set(id, s);
  roomOf.set(s, r);
  stages.push(s);
  for (const p of r.portals) {
    const el = label(`→ ${world.maps[p.to].name}`, "tag item");
    el.hidden = true;
    s.labels.push({ el, at: () => new THREE.Vector3(p.x + 0.5, id === "town" ? 2.4 : 2.9, p.y + 0.5) });
  }
  const actors = roomActors(id, r, s);
  const shopId = shopOfRoom(id);
  if (shopId) {
    const shop = shopRoom(shopId);
    const keeper = shopId === "clothes" ? ["Bree", "Stylist"] : null;
    if (keeper) {
      const tag = nameTag({ name: keeper[0]!, level: 20, company: { name: keeper[1]!, color: "#3f7a78" } });
      labelLayer.append(tag);
      tag.hidden = true;
      const p = new THREE.Vector3();
      s.labels.push({ el: tag, at: () => p.setFromMatrixPosition(shop.shopkeeper.root.matrixWorld).setY(1.6) });
    }
  }
  // A few locals wander about.
  const folk: Walker[] = [];
  const pets: Companion[] = [];
  const count = id === "dungeon" || id === "office" ? 1 : r.W * r.D > 300 ? 4 : 2;
  const rnd = seeded(id.length * 97 + r.W);
  const spot = (): [number, number] | null => {
    for (let tries = 0; tries < 80; tries++) {
      const x = Math.floor(rnd() * r.W);
      const y = Math.floor(rnd() * r.D);
      if (r.walkable(x, y)) return [x, y];
    }
    return null;
  };
  for (let i = 0; i < count; i++) {
    const w = person(s, look2dOf(i * 11 + r.W), NAMES[(i * 3 + r.D) % NAMES.length]!, 3 + i * 5, COMPANIES[i % 3]);
    w.quiet = true;
    const p = spot();
    if (p) w.at(p[0] + 0.5, p[1] + 0.5);
    folk.push(w);
  }
  if (id === "town" || id === "office") {
    const p = spot();
    if (p)
      pets.push(
        new Companion(s, id === "town" ? "dog" : "duck", 1, id === "town" ? "Waffle" : "Ducky", null, new THREE.Vector3(p[0] + 0.5, 0, p[1] + 0.5), () => {
          const q = spot();
          return q ? new THREE.Vector3(q[0] + 0.5, 0, q[1] + 0.5) : new THREE.Vector3();
        }),
      );
  }
  let nextWander = 0;
  s.update = (dt, t) => {
    if (t > nextWander) {
      nextWander = t + 2 + Math.random() * 3;
      const w = folk[Math.floor(Math.random() * folk.length)];
      if (w && !w.walking) {
        const from: [number, number] = [Math.floor(w.pos.x), Math.floor(w.pos.z)];
        for (let tries = 0; tries < 12; tries++) {
          const x = from[0] + Math.floor(Math.random() * 11) - 5;
          const y = from[1] + Math.floor(Math.random() * 11) - 5;
          if (!r.walkable(x, y)) continue;
          const steps = r.route(from, x, y);
          if (steps?.length) {
            w.go(steps.map(([a, b]) => r.centre(a, b)));
            if (Math.random() < 0.3) w.say(CHAT[Math.floor(Math.random() * CHAT.length)]!, t);
            break;
          }
        }
      }
    }
    for (const w of folk) w.update(dt, t);
    for (const p of pets) p.update(dt, t);
    actors?.(dt, t);
    if (worldMe?.stage === s) worldMe.update(dt, t);
    if (worldPet?.stage === s) worldPet.update(dt, t);
  };
  if (id === "basement") dimBasement(s.scene, s.hemi, s.sun);
  if (id === "office") {
    const el = mountDecorPanel(r.skin!.extra as Room, s.target);
    el.hidden = true;
    if (wallet.decor.wall || wallet.decor.floor) applyDecor(r.skin!.extra as Room, wallet.decor);
    decorPanels.set(s, el);
  }
  applyNight(s);
  return s;
}

/** Puts the player in a room (at its default spawn, or at `at`). */
function placePlayer(id: MapId, at?: [number, number], turn = 0): void {
  const s = worldStage(id);
  const r = world.room(id);
  const spot = at ? { at, turn } : r.spawn();
  worldMe ??= person(s, playerLook, "you", 6);
  worldMe.enter(s);
  worldMe.go([]);
  worldMe.mood = "happy";
  const c = r.centre(...spot.at);
  worldMe.at(c.x, c.z, "stand", spot.turn);
  if (!worldPet) {
    const mine = wallet.pet;
    worldPet = new Companion(s, mine?.species ?? "cat", 0, mine?.name ?? "Miso", worldMe, c.clone().add(new THREE.Vector3(0.6, 0, 0.6)));
    if (mine) worldPet.swap(mine.species, mine.variant, mine.name, mine.wear);
  }
  worldPet.enter(s);
  worldPet.pet.root.position.set(c.x + 0.6, 0, c.z + 0.6);
}

/** Puts `w` on the seat (or bed) the room's 3D skin has at a map tile: its own anchor and facing, not the tile's centre. */
function sitOnPlaced(r: WorldRoom, x: number, y: number, w: Walker): boolean {
  const room = (r.skin?.extra as { room?: Room } | undefined)?.room;
  const p = room?.at(x - INSET[0], y - INSET[1]);
  if (!room || !p) return false;
  const s = room.seatOf(p);
  const b = s ? null : room.bedOf(p);
  const a = s ?? b;
  if (!a) return false;
  const local = room.group.worldToLocal(a.at.clone());
  w.at(local.x + INSET[0], local.z + INSET[1], b ? "sleep" : "sit", a.turn, local.y - (b ? 0 : 0.02));
  return true;
}

/** Walks the player to a tile; a seat sits, a portal travels, a prop is looked at. */
function worldGo(x: number, y: number): void {
  const me = worldMe;
  if (fading || !me || !isWorld(stage) || me.stage !== stage) return;
  const r = roomOf.get(stage)!;
  const from: [number, number] = [Math.floor(me.pos.x), Math.floor(me.pos.z)];
  const steps = r.route(from, x, y);
  if (!steps) return;
  const portal = r.portalAt(x, y);
  const seat = r.seatAt(x, y);
  const text = !portal && !seat && !r.walkable(x, y) ? r.textAt(x, y) : null;
  const arrive = () => {
    const now = performance.now() / 1000;
    if (portal) travel(portal);
    else if (seat && sitOnPlaced(r, x, y, me)) {
      // Seated or in bed on the skin's own anchor.
    } else if (seat) {
      const prev = steps.at(-2) ?? from;
      const turn = Math.atan2(x - prev[0], y - prev[1]);
      const c = r.centre(x, y);
      if (seat.kind === "bed") me.at(c.x, c.z + 0.35, "sleep", 0, seat.y);
      else me.at(c.x, c.z, "sit", turn, seat.y - 0.02);
    } else if (text) me.say(text, now);
  };
  const points = steps.map(([a, b]) => r.centre(a, b));
  me.go(points, arrive);
  if (!points.length) arrive();
}

function travel(portal: Portal): void {
  if (fading || !worldMe) return;
  fading = true;
  $("#fade").classList.add("on");
  setTimeout(() => {
    const t = world.travel(roomOf.get(stage)!, portal);
    placePlayer(t.room.id, t.at, t.turn);
    setStage(`World:${t.room.id}`);
    $("#fade").classList.remove("on");
    setTimeout(() => (fading = false), 200);
  }, 230);
}

/** Camera follow: the view keeps the player in frame, but not past the room's edge. */
function follow(dt: number): void {
  const r = roomOf.get(stage)!;
  const p = worldMe!.pos;
  const m = 4;
  const k = 1 - Math.exp(-dt * 5);
  const lo = (size: number) => Math.min(size / 2, m);
  stage.target.x += (Math.min(Math.max(p.x, lo(r.W)), r.W - lo(r.W)) - stage.target.x) * k;
  stage.target.z += (Math.min(Math.max(p.z, lo(r.D)), r.D - lo(r.D)) - stage.target.z) * k;
}

// ——— The shops: the buy panel, and what a purchase does to the player, their pet and their Office ———
function shopPick(e: PointerEvent): ShopDisplay | null {
  const id = shopOfRoom(roomOf.get(stage)?.id ?? "");
  if (!id || !isWorld(stage)) return null;
  const rect = canvas.getBoundingClientRect();
  let best: ShopDisplay | null = null;
  let bestD = 30;
  const p = new THREE.Vector3();
  for (const d of shopRoom(id).displays) {
    p.set(d.pos.x + INSET[0], d.pos.y, d.pos.z + INSET[1]).project(camera);
    const dist = Math.hypot(((p.x + 1) / 2) * rect.width + rect.left - e.clientX, ((1 - p.y) / 2) * rect.height + rect.top - e.clientY);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}
const shopHooks: ShopHooks = {
  level: () => PLAYER_LEVEL,
  look: () => playerLook,
  previewLook: (l) => worldMe?.restyle(lookFrom2D(l ?? playerLook, { level: PLAYER_LEVEL })),
  setLook(l) {
    playerLook = l;
    wallet.look = l;
    worldMe?.restyle(lookFrom2D(l, { level: PLAYER_LEVEL }));
  },
  pet: () => wallet.pet ?? { species: "cat", variant: "", name: "Miso", wear: 0 },
  setPet(p) {
    wallet.pet = p;
    worldPet?.swap(p.species, p.variant, p.name, p.wear);
  },
  placeFurniture(asset) {
    if (!document.querySelector(`#inventory .inv button[data-id="${asset.id}"]`)) {
      const b = document.createElement("button");
      b.dataset.id = asset.id;
      b.title = `${asset.name} (bought)`;
      b.innerHTML = `<span>${asset.name}</span>`;
      b.onclick = () => (placing?.asset === asset ? stopPlacing() : startPlacing(asset));
      $("#inventory .inv").prepend(b);
    }
    setStage("Office");
    startPlacing(asset);
  },
  decorOffice(d) {
    applyDecor(room, d);
    const wr = worldStages.has("office") ? (world.room("office").skin?.extra as Room | undefined) : undefined;
    if (wr) applyDecor(wr, d);
    for (const [, el] of decorPanels) {
      if (d.wall) el.querySelector<HTMLSelectElement>("#d-wall")!.value = d.wall;
      if (d.floor) el.querySelector<HTMLSelectElement>("#d-floor")!.value = d.floor;
    }
  },
  renderStyle: () => ({ style: pipe.style === "voxel" ? "voxel" : "classic", pixelSize: pipe.pixelSize, night }),
};
const shopPanel: ShopPanel = mountShopPanel(shopHooks);
if (wallet.decor.wall || wallet.decor.floor) applyDecor(room, wallet.decor);

// For poking at the world from the console or a test: `world3d.go(x, y)` walks to a tile of the room.
Object.assign(window, {
  world3d: {
    go: worldGo,
    world,
    travel,
    setStage,
    roomOf,
    worldStages,
    stages,
    shopPanel,
    shopRoom,
    /** Where a shop display of the current room is on the screen (client px), for tests: by item id. */
    shopScreen(itemId: string): [number, number] | null {
      const id = shopOfRoom(roomOf.get(stage)?.id ?? "");
      const d = id && shopRoom(id).displays.find((q) => q.item.id === itemId);
      if (!d) return null;
      const rect = canvas.getBoundingClientRect();
      const p = new THREE.Vector3(d.pos.x + INSET[0], d.pos.y, d.pos.z + INSET[1]).project(camera);
      return [((p.x + 1) / 2) * rect.width + rect.left, ((1 - p.y) / 2) * rect.height + rect.top];
    },
    wallet,
    get me() {
      return worldMe;
    },
    /** The camera: azimuth in radians (default pi/4), zoom factor. */
    cam(az?: number, z?: number) {
      if (az !== undefined) azimuth = azimuthGoal = az;
      if (z !== undefined) zoom = z;
    },
  },
});

const held = new Set<string>();
/** Arrow keys and WASD step across the grid, relative to the screen. */
function keyStep(): void {
  const me = worldMe;
  if (!me || fading || me.walking || !isWorld(stage) || me.stage !== stage) return;
  let fx = 0;
  let fy = 0;
  if (held.has("w") || held.has("arrowup")) fy += 1;
  if (held.has("s") || held.has("arrowdown")) fy -= 1;
  if (held.has("d") || held.has("arrowright")) fx += 1;
  if (held.has("a") || held.has("arrowleft")) fx -= 1;
  if (!fx && !fy) return;
  const r = roomOf.get(stage)!;
  const vx = fy * -Math.sin(azimuth) + fx * Math.cos(azimuth);
  const vz = fy * -Math.cos(azimuth) + fx * -Math.sin(azimuth);
  const len = Math.hypot(vx, vz);
  const dx = Math.abs(vx) > 0.38 * len ? Math.sign(vx) : 0;
  const dz = Math.abs(vz) > 0.38 * len ? Math.sign(vz) : 0;
  const x = Math.floor(me.pos.x);
  const z = Math.floor(me.pos.z);
  const ok = (a: number, b: number) => r.walkable(a, b) || r.portalAt(a, b) !== null;
  const tries: [number, number][] = [[dx, dz]];
  if (dx && dz) tries.push([dx, 0], [0, dz]);
  for (const [a, b] of tries) {
    if (!ok(x + a, z + b)) continue;
    if (a && b && !(r.walkable(x + a, z) && r.walkable(x, z + b))) continue;
    worldGo(x + a, z + b);
    return;
  }
}

// ——— Camera ———
let azimuth = Math.PI / 4;
let azimuthGoal = azimuth;
let zoom = Number(new URLSearchParams(location.search).get("zoom") ?? 1);

function aim(w: number, h: number): void {
  azimuth += (azimuthGoal - azimuth) * 0.15;
  const dist = 60;
  const t = stage.target;
  const el = stage.elevation ?? ELEVATION;
  camera.position.set(
    t.x + dist * Math.cos(el) * Math.sin(azimuth),
    t.y + dist * Math.sin(el),
    t.z + dist * Math.cos(el) * Math.cos(azimuth),
  );
  camera.lookAt(t);
  const half = (stage.view * zoom) / 2;
  const aspect = w / h;
  camera.left = -half * aspect;
  camera.right = half * aspect;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

// ——— Night, weather and street life (fx3d.ts): the light follows the Aarhus clock ———
const fx = new Fx({
  stages,
  town: worldStage("town"),
  current: () => stage.name,
  show: (name) => setStage(name),
  label: (st, text, cls, at) => {
    const el = label(text, cls);
    const entry = { el, at };
    el.hidden = stage !== st;
    (st as Stage).labels.push(entry);
    return {
      el,
      remove: () => {
        el.remove();
        const i = (st as Stage).labels.indexOf(entry);
        if (i >= 0) (st as Stage).labels.splice(i, 1);
      },
    };
  },
  me: () => {
    const w = stage.name === "Town" ? worldMe : stage === office ? me : null;
    return w ? { avatar: w.avatar, top: () => w.top(), go: (x, z, arrive) => w.go([v3(x, z)], arrive) } : null;
  },
  applyNight: (on) => {
    night = on;
    setRoomNight(on);
    setTavernNight(on);
    setTownNight(on);
    for (const s of stages) applyNight(s);
    dimBasement(basement.scene, basement.hemi, basement.sun);
    document.body.classList.toggle("night", on);
    $("#night").textContent = on ? "☀️ Day" : "🌙 Night";
  },
});
fx.setSleepers([{ name: "lin", level: 7 }]);
(roomOf.get(worldStage("town"))!.skin!.extra as Town3d).setClock(() => fx.minutes());
Object.assign(window, { fx, townStage, office, catalog, spinning });
function setNight(on: boolean): void {
  fx.setTime(on ? "23:30" : "12:00");
}
function applyNight(s: Stage): void {
  const on = night;
  s.hemi.intensity = on ? 0.55 : 1.6;
  s.hemi.color.set(on ? "#8fa0ff" : "#fff4e0");
  s.sun.intensity = on ? 0.35 : 2.4;
  s.sun.color.set(on ? "#9fb0ff" : "#fff1d6");
  (s.scene.background as THREE.Color).set(on ? "#0f111a" : "#1b1f2a");
  s.scene.traverse((o) => {
    if (o instanceof THREE.PointLight) o.intensity = on ? (o.userData.night ?? 0) : 0;
  });
}

// ——— Placing furniture ———
const hover = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false }),
);
hover.rotation.x = -Math.PI / 2;
hover.visible = false;
office.scene.add(hover);
let placing: { asset: Asset; turn: Turn; ghost: Model } | null = null;
let hoverTile: [number, number] | null = null;

function startPlacing(asset: Asset): void {
  stopPlacing();
  const ghost = asset.build();
  ghost.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  office.scene.add(ghost);
  placing = { asset, turn: 0, ghost };
  ghost.visible = false;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".inv button"))
    b.classList.toggle("on", b.dataset.id === asset.id);
}

function stopPlacing(): void {
  if (placing) office.scene.remove(placing.ghost);
  placing = null;
  for (const b of document.querySelectorAll(".inv button")) b.classList.remove("on");
}

function updateWorldHover(): void {
  const r = roomOf.get(stage);
  if (!r || !hoverTile || !r.walkable(...hoverTile) && r.ch(...hoverTile) === "W") {
    hover.visible = false;
    return;
  }
  if (hover.parent !== stage.scene) stage.scene.add(hover);
  const [x, z] = hoverTile;
  hover.scale.set(1, 1, 1);
  hover.position.set(x + 0.5, 0.012, z + 0.5);
  hover.material.color.set(
    r.portalAt(x, z) || r.seatAt(x, z) ? "#ffd35c" : r.walkable(x, z) ? "#ffffff" : "#ff8a80",
  );
  hover.visible = x >= 0 && z >= 0 && x < r.W && z < r.D;
}

function updateHover(): void {
  if (isWorld(stage)) {
    updateWorldHover();
    return;
  }
  if (hover.parent !== office.scene) office.scene.add(hover);
  if (stage !== office || !hoverTile) {
    hover.visible = false;
    if (placing) placing.ghost.visible = false;
    return;
  }
  const [x, z] = hoverTile;
  const mat = hover.material;
  if (placing) {
    const [w, d] = Room.footprint(placing.asset, placing.turn);
    const ok = room.fits(placing.asset, x, z, placing.turn);
    hover.scale.set(w, d, 1);
    hover.position.set(x + w / 2, 0.012, z + d / 2);
    mat.color.set(ok ? "#3ddc84" : "#ff8a80");
    placing.ghost.visible = true;
    placing.ghost.position.set(x + w / 2, ok ? 0 : 0.05, z + d / 2);
    placing.ghost.rotation.y = (placing.turn * Math.PI) / 2;
  } else {
    hover.scale.set(1, 1, 1);
    hover.position.set(x + 0.5, 0.012, z + 0.5);
    const p = room.at(x, z);
    mat.color.set(p && (p.asset.seat || p.asset.bed) ? "#ffd35c" : "#ffffff");
  }
  hover.visible = room.inside(x, z);
}

const ray = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function tileUnder(e: PointerEvent): [number, number] | null {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(
    new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1),
    camera,
  );
  const hit = ray.ray.intersectPlane(floorPlane, new THREE.Vector3());
  if (!hit) return null;
  return [Math.floor(hit.x), Math.floor(hit.z)];
}

let drag: { x: number; y: number; moved: boolean; target: THREE.Vector3 } | null = null;
canvas.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: false, target: stage.target.clone() };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  hoverTile = tileUnder(e);
  const near = shopPick(e);
  canvas.style.cursor = near ? "pointer" : "";
  shopPanel.tip(near ? `${near.item.name}${near.item.price ? ` · 🪙 ${near.item.price}` : ""}` : null, e.clientX, e.clientY);
  if (!drag || isWorld(stage)) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true;
  const perPx = (stage.view * zoom) / canvas.clientHeight;
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const fwd = new THREE.Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth));
  stage.target
    .copy(drag.target)
    .addScaledVector(right, -dx * perPx)
    .addScaledVector(fwd, (dy * perPx) / Math.sin(stage.elevation ?? ELEVATION));
});
canvas.addEventListener("pointerup", (e) => {
  const click = drag && !drag.moved;
  drag = null;
  if (!click) return;
  if (isWorld(stage)) {
    const hit = shopPick(e);
    if (hit) {
      shopPanel.open(shopOfRoom(roomOf.get(stage)!.id)!, hit.item);
      worldGo(hit.tile[0] + INSET[0], hit.tile[1] + INSET[1]);
      return;
    }
    const t = tileUnder(e);
    if (t) worldGo(...t);
    return;
  }
  if (stage === townStage) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1),
      camera,
    );
    const hit = ray.ray.intersectPlane(floorPlane, new THREE.Vector3());
    if (hit) townMe.go([v3(Math.min(32, Math.max(3, hit.x)), Math.min(28.5, Math.max(3, hit.z)))]);
    return;
  }
  if (stage !== office) return;
  const t = tileUnder(e);
  if (!t || !room.inside(...t)) return;
  if (placing) {
    if (room.fits(placing.asset, t[0], t[1], placing.turn)) {
      const p = room.place(placing.asset, t[0], t[1], placing.turn);
      if (night)
        p.model.traverse((o) => {
          if (o instanceof THREE.PointLight) o.intensity = o.userData.night ?? 0;
        });
      popping.push({ m: p.model, at: performance.now() / 1000 });
      if (!e.shiftKey) stopPlacing();
    }
    return;
  }
  walkTo(me, ...t);
});
canvas.addEventListener("pointerleave", () => (hoverTile = null));
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoom = Math.min(2.2, Math.max(0.35, zoom * Math.exp(e.deltaY * 0.0012)));
  },
  { passive: false },
);
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  stopPlacing();
});

/** Newly placed furniture bounces in. */
const popping: { m: Model; at: number }[] = [];

window.addEventListener("keydown", (e) => {
  held.add(e.key.toLowerCase());
  if (e.key.startsWith("Arrow") && isWorld(stage)) e.preventDefault();
  if (e.key === "q" || e.key === "Q") rotate(-1);
  if (e.key === "e" || e.key === "E") rotate(1);
  if ((e.key === "r" || e.key === "R") && placing) placing.turn = ((placing.turn + 1) % 4) as Turn;
  if (e.key === "Escape") stopPlacing();
  // In the Tavern: J puts a record on (or takes it off), T tosses a coin in the fountain.
  if ((e.key === "j" || e.key === "J") && stage === tavernStage) {
    tavern.jukebox.playing = !tavern.jukebox.playing;
    tavern.jukebox.track = "Green CI";
  }
  if (e.key === "t" || e.key === "T") tavern.fountain?.toss();
});

window.addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => held.clear());

function rotate(dir: number): void {
  azimuthGoal += (dir * Math.PI) / 2;
}

// ——— The panel ———
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
function choose(group: string, value: string): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>(`[data-group="${group}"]`))
    b.classList.toggle("on", b.dataset.value === value);
}

function setStage(name: string): void {
  if (name === "World") name = `World:${worldRoom}`;
  if (name === "Town") name = "World:town";
  if (name.startsWith("World:")) {
    const id = name.slice(6) as MapId;
    if (worldMe?.stage !== worldStage(id)) placePlayer(id);
    worldRoom = id;
    name = worldStage(id).name;
  }
  stage = stages.find((s) => s.name === name)!;
  choose("stage", isWorld(stage) ? "World" : name);
  $("#worldbar").hidden = !isWorld(stage);
  $("#room-name").hidden = !isWorld(stage);
  $("#room-name").textContent = roomOf.get(stage)?.name ?? "";
  $<HTMLSelectElement>("#room").value = worldRoom;
  stopPlacing();
  shopPanel.tip(null);
  if (!shopOfRoom(roomOf.get(stage)?.id ?? "")) shopPanel.close();
  for (const s of stages) for (const l of s.labels) l.el.hidden = s !== stage;
  $("#inventory").hidden = stage !== office;
  for (const [s, el] of decorPanels) el.hidden = s !== stage;
  officeDecor.hidden = stage !== office;
  if (fx.panel) fx.panel.hidden = stage.name !== "Town";
  $("#spin").hidden = stage !== catalog;
  dungeonGallery.show(stage === dungeon);
}

function setStyle(px: number): void {
  pipe.style = "classic";
  pipe.pixelSize = px;
  ($("#px") as HTMLInputElement).value = String(px);
  $("#px-value").textContent = px === 1 ? "smooth" : `${px}×`;
  choose("style", px === 1 ? "smooth" : "pixel");
  canvas.classList.toggle("smooth", px === 1);
  localStorage.setItem("demo3d.style", px === 1 ? "smooth" : "pixel");
}

/** Voxel (Plethora): soft lit matte blocks, AO, haze and grading (see pipeline.ts). */
function setVoxel(): void {
  pipe.style = "voxel";
  pipe.pixelSize = 1;
  choose("style", "voxel");
  canvas.classList.add("smooth");
  localStorage.setItem("demo3d.style", "voxel");
}

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-group=stage]"))
  b.onclick = () => setStage(b.dataset.value!);
$("[data-value=pixel]").onclick = () => setStyle(3);
$("[data-value=smooth]").onclick = () => setStyle(1);
$("[data-value=voxel]").onclick = setVoxel;
$<HTMLInputElement>("#px").oninput = (e) => setStyle(Number((e.target as HTMLInputElement).value));
$<HTMLInputElement>("#outline").onchange = (e) =>
  (pipe.outline = pipe.crease = (e.target as HTMLInputElement).checked ? 1 : 0);
$("#lan").onclick = () => {
  setLanParty(!lanParty());
  $("#lan").textContent = lanParty() ? "🎉 LAN: on" : "🎉 LAN party";
};
$("#night").onclick = () => {
  setNight(!night);
};
$("#rot-l").onclick = () => rotate(-1);
$("#rot-r").onclick = () => rotate(1);
$("#spin").onclick = () => {
  spin = !spin;
};
$("#look").onclick = () => {
  if (!isWorld(stage)) return (stage === townStage ? townMe : me).restyle(randomLook());
  playerLook = look2dOf(Math.floor(Math.random() * 1e6));
  wallet.look = playerLook;
  worldMe!.restyle(lookFrom2D(playerLook, { level: 6 }));
};
const picker = $<HTMLSelectElement>("#room");
for (const id of ROOM_ORDER) picker.append(new Option(world.maps[id].name, id));
picker.onchange = () => setStage(`World:${picker.value}`);
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-group=chars]"))
  b.onclick = () => setCharStyle(b.dataset.value as CharStyle);

// ——— Emotes: a face (or a move) for a few seconds, with the emoji over your head ———
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-emote]")) {
  b.onclick = () => {
    const now = performance.now() / 1000;
    const emote = b.dataset.emote!;
    if (stage === catalog) {
      for (const a of parade) a.expression = emote as Expression;
      return;
    }
    const w = isWorld(stage) ? worldMe! : stage === townStage ? townMe : me;
    if (emote === "dance" || emote === "wave") {
      if (w.walking || w.avatar.pose === "sit" || w.avatar.pose === "sleep") return;
      w.avatar.pose = emote;
      w.feel("happy", now, 4);
      setTimeout(() => {
        if (w.avatar.pose === emote) w.avatar.pose = "stand";
      }, 4000);
    } else w.feel(emote as Expression, now, 4);
    const pop = label(b.textContent ?? "", "emote");
    const entry = { el: pop, at: () => w.top().add(new THREE.Vector3(0, 0.25, 0)) };
    stage.labels.push(entry);
    setTimeout(() => {
      pop.remove();
      stage.labels.splice(stage.labels.indexOf(entry), 1);
    }, 1600);
  };
}

// ——— Icons: every piece drawn once more through the same pipeline, for the inventory ———
async function drawIcons(): Promise<void> {
  const size = 96;
  const iconCanvas = document.createElement("canvas");
  iconCanvas.width = iconCanvas.height = size;
  const iconPipe = new Pipeline(iconCanvas, { preserve: true });
  iconPipe.pixelSize = 2;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.8));
  const sun = new THREE.DirectionalLight("#fff1d6", 2.2);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const bar = $("#inventory .inv");
  for (const a of catalogAssets) {
    if (a.id === "neon-sign") continue;
    const m = a.build();
    scene.add(m);
    const box = new THREE.Box3().setFromObject(m);
    const centre = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    cam.position.set(
      centre.x + 20 * Math.cos(ELEVATION) * Math.sin(Math.PI / 4),
      centre.y + 20 * Math.sin(ELEVATION),
      centre.z + 20 * Math.cos(ELEVATION) * Math.cos(Math.PI / 4),
    );
    cam.lookAt(centre);
    cam.left = cam.bottom = -r * 0.95;
    cam.right = cam.top = r * 0.95;
    cam.updateProjectionMatrix();
    iconPipe.render(scene, cam, size, size);
    scene.remove(m);
    const b = document.createElement("button");
    b.dataset.id = a.id;
    b.title = `${a.name} · ${a.price} coins (${a.w}×${a.d})`;
    b.innerHTML = `<img src="${iconCanvas.toDataURL()}" alt=""><span>${a.price}</span>`;
    b.onclick = () => (placing?.asset === a ? stopPlacing() : startPlacing(a));
    bar.append(b);
    await new Promise((r) => setTimeout(r, 0));
  }
  iconPipe.renderer.dispose();
}

// ——— The loop ———
const v = new THREE.Vector3();
let last = performance.now() / 1000;
function frame(): void {
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - last);
  last = now;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (isWorld(stage) && worldMe) follow(dt);
  aim(w, h);
  for (const tick of ticks) tick(now);
  keyStep();
  stage.update(dt, now);
  fx.update(dt, now, camera);
  const view = camera.position.clone().sub(stage.target).setY(0).normalize();
  if (stage === office) room.facing(view);
  else roomOf.get(stage)?.facing(view);
  if (stage === tavernStage) tavern.room.facing(view);
  if (stage === dormStage) dorm.room.facing(view);
  for (let i = popping.length - 1; i >= 0; i--) {
    const p = popping[i]!;
    const k = Math.min(1, (now - p.at) / 0.35) - 1;
    // Ease out with a little overshoot.
    p.m.scale.setScalar(0.6 + 0.4 * (1 + 2.7 * k ** 3 + 1.7 * k ** 2));
    if (k >= 0) popping.splice(i, 1);
  }
  updateHover();
  const inTown = fx.hasSky();
  pipe.gradient = !inTown;
  pipe.night = night ? 1 : 0;
  if (inTown) pipe.hazeColor.copy(fx.horizon());
  else {
    pipe.skyTop.set(night ? "#0d1226" : "#8ccbe6");
    pipe.skyHor.set(night ? "#1a2240" : "#dcf0ee");
    pipe.hazeColor.copy(pipe.skyHor);
  }
  pipe.render(stage.scene, camera, w, h);
  for (const l of stage.labels) {
    if (l.el.style.display === "none") continue;
    v.copy(l.at()).project(camera);
    l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
  }
  requestAnimationFrame(frame);
}

{
  const saved = localStorage.getItem("demo3d.style");
  if (saved === "smooth") setStyle(1);
  else if (saved === "pixel") setStyle(3);
  else setVoxel();
  const q = new URLSearchParams(location.search).get("q");
  if (q !== null) {
    pipe.quality = Number(q);
    pipe.autoQuality = false;
  }
}
setStage(new URLSearchParams(location.search).get("stage") ?? "World");
setCharStyle((new URLSearchParams(location.search).get("chars") as CharStyle | null) ?? "voxel");
me.say("hi! click the floor to walk 👋", last + 0.5);
requestAnimationFrame(frame);
void drawIcons();
