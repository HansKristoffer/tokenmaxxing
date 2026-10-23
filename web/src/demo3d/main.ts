/**
 * The 3D demo: a company office you can walk round and furnish, every asset in a catalogue, and a corner
 * of the town, all built in code (`kit.ts`) and drawn as pixel art or smooth cel shading (`pipeline.ts`).
 */
import * as THREE from "three";
import { Avatar, type Expression, type Look, Pet, type Pose, randomLook } from "./avatar.ts";
import { ASSETS, type Asset, assetById, deskWithScreen } from "./furniture.ts";
import { FX_ASSETS, Fx } from "./fx3d.ts";
import { checker, type Model, painted, seeded, ticks, tint, toon } from "./kit.ts";
import { Pipeline } from "./pipeline.ts";
import { car } from "./props.ts";
import { type Placed, Room, setRoomNight, type Turn } from "./room.ts";
import { buildTown, setTownNight, TOWN_W } from "./town.ts";

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

  constructor(
    readonly stage: Stage,
    look: Look,
    readonly name: string,
    level: number,
  ) {
    this.avatar = new Avatar(look);
    stage.scene.add(this.avatar.root);
    this.tag = label(`${name} · Lv${level}`);
    stage.labels.push({ el: this.tag, at: () => this.top() });
  }

  /** A new look, keeping where they are and what they're doing. */
  restyle(look: Look): void {
    const old = this.avatar.root;
    const expression = this.avatar.expression;
    this.avatar = new Avatar(look);
    this.avatar.expression = expression;
    this.avatar.root.position.copy(old.position);
    this.avatar.root.rotation.copy(old.rotation);
    this.avatar.pose = this.walking ? "walk" : "wave";
    this.stage.scene.remove(old);
    this.stage.scene.add(this.avatar.root);
  }

  get pos(): THREE.Vector3 {
    return this.avatar.root.position;
  }

  top(): THREE.Vector3 {
    const lift =
      this.avatar.pose === "sleep"
        ? 0.55
        : this.avatar.pose === "sit" || this.avatar.pose === "type"
          ? 1.0
          : 1.2;
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
      this.stage.labels.push({ el: this.bubble, at: () => this.top().add(new THREE.Vector3(0, 0.32, 0)) });
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
    this.pet.root.position.copy(start);
    this.wander.copy(start);
    stage.scene.add(this.pet.root);
    const el = label(name, "tag pet");
    stage.labels.push({ el, at: () => this.pet.root.position.clone().add(new THREE.Vector3(0, 0.55, 0)) });
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
const COLS = 6;
const CELL_W = 3.2;
const CELL_D = 4.4;
/** Everything in the showroom: the furniture, and the street-life pieces from `fx3d.ts`. */
const SHOWROOM = [...ASSETS, ...FX_ASSETS];
const rows = Math.ceil(SHOWROOM.length / COLS) + 1;
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
SHOWROOM.forEach((a, i) => {
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
const townStage = newStage("Town", new THREE.Vector3(18, 0.5, 15), 24, 15, "#1b1f2a");
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

const stages = [office, catalog, townStage];
let stage = office;

// ——— Camera ———
let azimuth = Math.PI / 4;
let azimuthGoal = azimuth;
let zoom = 1;

function aim(w: number, h: number): void {
  azimuth += (azimuthGoal - azimuth) * 0.15;
  const dist = 60;
  const t = stage.target;
  camera.position.set(
    t.x + dist * Math.cos(ELEVATION) * Math.sin(azimuth),
    t.y + dist * Math.sin(ELEVATION),
    t.z + dist * Math.cos(ELEVATION) * Math.cos(azimuth),
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

// ——— Night, weather and street life (fx3d.ts): the light follows the Copenhagen clock ———
let night = false;
const fx = new Fx({
  stages,
  town: townStage,
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
    const w = stage === townStage ? townMe : stage === office ? me : null;
    return w ? { avatar: w.avatar, top: () => w.top(), go: (x, z, arrive) => w.go([v3(x, z)], arrive) } : null;
  },
  applyNight: (on) => {
    night = on;
    setRoomNight(on);
    setTownNight(on);
    document.body.classList.toggle("night", on);
    $("#night").textContent = on ? "☀️ Day" : "🌙 Night";
  },
});
fx.setSleepers([{ name: "lin", level: 7 }]);
Object.assign(window, { fx, townStage, office, catalog, spinning });
function setNight(on: boolean): void {
  fx.setTime(on ? "23:30" : "12:00");
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

function updateHover(): void {
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
  if (!drag) return;
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
    .addScaledVector(fwd, (dy * perPx) / Math.sin(ELEVATION));
});
canvas.addEventListener("pointerup", (e) => {
  const click = drag && !drag.moved;
  drag = null;
  if (!click) return;
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
  if (e.key === "q" || e.key === "Q") rotate(-1);
  if (e.key === "e" || e.key === "E") rotate(1);
  if ((e.key === "r" || e.key === "R") && placing) placing.turn = ((placing.turn + 1) % 4) as Turn;
  if (e.key === "Escape") stopPlacing();
});

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
  stage = stages.find((s) => s.name === name)!;
  choose("stage", name);
  stopPlacing();
  for (const s of stages) for (const l of s.labels) l.el.hidden = s !== stage;
  $("#inventory").hidden = stage !== office;
  $("#spin").hidden = stage !== catalog;
}

function setStyle(px: number): void {
  pipe.pixelSize = px;
  ($("#px") as HTMLInputElement).value = String(px);
  $("#px-value").textContent = px === 1 ? "smooth" : `${px}×`;
  choose("style", px === 1 ? "smooth" : "pixel");
  canvas.classList.toggle("smooth", px === 1);
}

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-group=stage]"))
  b.onclick = () => setStage(b.dataset.value!);
$("[data-value=pixel]").onclick = () => setStyle(3);
$("[data-value=smooth]").onclick = () => setStyle(1);
$<HTMLInputElement>("#px").oninput = (e) => setStyle(Number((e.target as HTMLInputElement).value));
$<HTMLInputElement>("#outline").onchange = (e) =>
  (pipe.outline = pipe.crease = (e.target as HTMLInputElement).checked ? 1 : 0);
$("#night").onclick = () => {
  setNight(!night);
};
$("#rot-l").onclick = () => rotate(-1);
$("#rot-r").onclick = () => rotate(1);
$("#spin").onclick = () => {
  spin = !spin;
};
$("#look").onclick = () => (stage === townStage ? townMe : me).restyle(randomLook());

// ——— Emotes: a face (or a move) for a few seconds, with the emoji over your head ———
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-emote]")) {
  b.onclick = () => {
    const now = performance.now() / 1000;
    const emote = b.dataset.emote!;
    if (stage === catalog) {
      for (const a of parade) a.expression = emote as Expression;
      return;
    }
    const w = stage === townStage ? townMe : me;
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
  for (const a of ASSETS) {
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
  aim(w, h);
  for (const tick of ticks) tick(now);
  stage.update(dt, now);
  fx.update(dt, now, camera);
  if (stage === office) room.facing(camera.position.clone().sub(stage.target).setY(0).normalize());
  for (let i = popping.length - 1; i >= 0; i--) {
    const p = popping[i]!;
    const k = Math.min(1, (now - p.at) / 0.35) - 1;
    // Ease out with a little overshoot.
    p.m.scale.setScalar(0.6 + 0.4 * (1 + 2.7 * k ** 3 + 1.7 * k ** 2));
    if (k >= 0) popping.splice(i, 1);
  }
  updateHover();
  pipe.render(stage.scene, camera, w, h);
  for (const l of stage.labels) {
    if (l.el.style.display === "none") continue;
    v.copy(l.at()).project(camera);
    l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
  }
  requestAnimationFrame(frame);
}

setStyle(1);
setStage(new URLSearchParams(location.search).get("stage") ?? "Office");
me.say("hi! click the floor to walk 👋", last + 0.5);
requestAnimationFrame(frame);
void drawIcons();
