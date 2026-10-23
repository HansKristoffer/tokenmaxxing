import { COP_ID } from "@tokenmaxxing/core/cop.ts";
import { LEGENDARY_LEVEL } from "@tokenmaxxing/core/milestones.ts";
import { hasPolse } from "@tokenmaxxing/core/street.ts";
import { hasSpecial, specialBuff } from "@tokenmaxxing/core/tavern.ts";
import { cupsLeft, JUMP_MS, ownerOfOffice, TILE } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { PET_H, PET_W } from "../art/pets.ts";
import { Avatar as Avatar3D } from "../demo3d/avatar.ts";
import { type Look2D, lookFrom2D, nameTag, tagLift, wornBy } from "../demo3d/gear3d.ts";
import { Model } from "../demo3d/kit.ts";
import { type Pet3D, petFrom2D } from "../demo3d/pets3d.ts";
import { BURST_MS } from "../game/emoji.ts";
import { followPet, prunePets } from "../game/pets.ts";
import { type Lap, racing } from "../game/race.ts";
import { drawPos, type Avatar as GameAvatar, gamesOf, gameTag, stepping, WARP_MS, world } from "../game/world.ts";
import { town } from "../net.ts";
import { hud } from "../store.ts";
import { CopGear } from "./cop3d.ts";
import { disposeObject } from "./dispose.ts";
import { STOOL_Y, seatPose } from "./gamefx.ts";
import { approach, hopHeight, poseOf, turnToward, YAW } from "./motion.ts";
import { Burst, type Overlay } from "./overlay.ts";
import type { RoomView } from "./rooms.ts";
import { CopWatch, ShowcaseCache } from "./world-logic.ts";

const NONE: ReadonlySet<number> = new Set();
/** Pets are drawn a little bigger than life so they read from the iso camera. */
const PET_SCALE = 1.25;
/** Tiles within which other players' pets show their names. */
const NAME_RANGE = 6;
/** A step that has stopped keeps the walk going this long, so a gap between two steps doesn't flicker. */
const WALK_HOLD_MS = 140;

interface Rig {
  id: number;
  info: GameAvatar["info"];
  sig: string;
  avatar: Avatar3D;
  root: THREE.Group;
  /** Where they are drawn, in world units. */
  x: number;
  z: number;
  yaw: number;
  placed: boolean;
  walkUntil: number;
  /** Where the game says they are this frame, in tiles (a race's lap, else the step between two tiles). */
  at: { x: number; y: number };
  seen: number;
  bedroll: Model | null;
  halo: THREE.Mesh | null;
  /** Officer 429 only: his light bar and notepad, and what his lines say he is doing. */
  cop: { gear: CopGear; watch: CopWatch } | null;
  /** Where a Sprint Race has them (laps of the square) this frame, when it has. */
  lap: Lap | null;
  pet: { model: Pet3D; root: THREE.Group; sig: string; x: number; z: number; yaw: number; moving: boolean; placed: boolean } | null;
  // Labels
  stack: HTMLDivElement;
  tag: HTMLElement | null;
  tagKey: string;
  bubble: HTMLDivElement;
  bubbleText: string;
  pills: { polse: HTMLDivElement; game: HTMLDivElement; work: HTMLDivElement; zzz: HTMLDivElement };
  petLabel: HTMLDivElement | null;
  burst: Burst | null;
}

const lookSig = (info: GameAvatar["info"], look: GameAvatar["info"]["look"] = info.look): string => `${JSON.stringify(look)}|${info.level >= LEGENDARY_LEVEL}|${info.id === COP_ID}`;

/** Everyone in the room: their voxel bodies, pets and the labels over them, keyed by player id. */
export class Entities {
  readonly group = new THREE.Group();
  private readonly rigs = new Map<number, Rig>();
  private frame = 0;
  /** New meshes were added (a person, a pet): the renderer swaps them for blocks. */
  dirty = false;
  /** A try-on: the look shown on the local player in place of their saved one (the shops' fitting room). */
  private fitting: Look2D | null = null;
  /** Reduce motion: the siren glows steadily. */
  calm = false;
  /** Most emoji bursts at once, from the tier (each is ten DOM nodes). */
  maxBursts = 10;
  private bursts = 0;
  /** Bots whose bodies the room draws itself. */
  private keepers: ReadonlySet<number> = new Set();
  private readonly v = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  /** Showcase pins of those near me, for the chips on their name tags (asked a few at a time). */
  private readonly showcase = new ShowcaseCache({ fetch: (id) => town.profile(id, "today").then((p) => p.showcase ?? []) });

  constructor(private readonly overlay: Overlay) {
    this.group.name = "entities";
  }

  /** Shows `look` on the local player for now; null puts the saved one back. */
  previewLook(look: Look2D | null): void {
    this.fitting = look;
  }

  /** What `info` is drawn wearing: their look, or the try-on if it is the local player. */
  private lookOf(info: GameAvatar["info"]): GameAvatar["info"]["look"] {
    return this.fitting && info.id === world.selfId ? { ...info.look, ...this.fitting } : info.look;
  }

  get size(): number {
    return this.rigs.size;
  }

  /** The player ids drawn right now. */
  ids(): number[] {
    return [...this.rigs.keys()];
  }

  /** Where someone is drawn (world x, z), if they are in the room. */
  positionOf(id: number): [number, number] | null {
    const r = this.rigs.get(id);
    return r ? [r.x, r.z] : null;
  }

  /** The player whose body the ray hits first, if any. */
  pick(ray: THREE.Ray): number | null {
    this.ray.ray.copy(ray);
    const roots: THREE.Object3D[] = [];
    for (const r of this.rigs.values()) if (r.root.visible) roots.push(r.avatar.root);
    const hit = this.ray.intersectObjects(roots, true)[0];
    if (!hit) return null;
    for (const r of this.rigs.values()) {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (o === r.avatar.root) return r.id;
    }
    return null;
  }

  private create(a: GameAvatar, view: RoomView): Rig {
    const look = lookFrom2D(this.lookOf(a.info), { level: a.info.level });
    if (a.info.id === COP_ID) look.job = "officer";
    const avatar = new Avatar3D(look, "voxel");
    this.dirty = true;
    const root = new THREE.Group();
    root.add(avatar.root);
    this.group.add(root);
    const stack = this.overlay.make("r3-stack");
    const bubble = document.createElement("div");
    bubble.className = "r3-bubble";
    bubble.style.display = "none";
    const pill = (cls: string) => {
      const el = document.createElement("div");
      el.className = `r3-pill ${cls}`;
      el.style.display = "none";
      return el;
    };
    const pills = {
      polse: pill(""),
      game: pill("r3-game"),
      work: pill("r3-work"),
      zzz: pill("r3-zzz"),
    };
    pills.zzz.textContent = "z";
    stack.append(bubble, pills.polse, pills.game, pills.work, pills.zzz);
    const [x, z] = view.toWorld(a.x, a.y);
    return {
      id: a.info.id,
      info: a.info,
      sig: lookSig(a.info, this.lookOf(a.info)),
      avatar,
      root,
      x,
      z,
      yaw: YAW[a.facing],
      placed: false,
      walkUntil: 0,
      at: { x: a.x, y: a.y },
      seen: 0,
      bedroll: null,
      halo: null,
      cop: a.info.id === COP_ID ? { gear: new CopGear(avatar, root), watch: new CopWatch() } : null,
      lap: null,
      pet: null,
      stack,
      tag: null,
      tagKey: "",
      bubble,
      bubbleText: "",
      pills,
      petLabel: null,
      burst: null,
    };
  }

  private remove(r: Rig): void {
    r.root.removeFromParent();
    disposeObject(r.root);
    r.stack.remove();
    r.petLabel?.remove();
    r.burst?.dispose();
    this.rigs.delete(r.id);
  }

  /** Throws everyone away (the room changed). */
  clear(): void {
    for (const r of [...this.rigs.values()]) this.remove(r);
    this.group.clear();
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }

  /** Brings the 3D people up to date with `world` for the frame at `now` (ms), `dt` ms after the last. */
  update(now: number, dt: number, view: RoomView, camera: THREE.OrthographicCamera): void {
    this.keepers = view.keepers ?? NONE;
    const frame = ++this.frame;
    const dtS = dt / 1000;
    const t = now / 1000;
    const me = world.avatars.get(world.selfId);
    const list: GameAvatar[] = [...world.avatars.values()];
    for (const l of world.leaving) if (!world.avatars.has(l.info.id)) list.push(l);
    prunePets();
    this.bursts = 0;
    for (const r of this.rigs.values()) if (r.burst) this.bursts++;
    for (const a of list) {
      let r = this.rigs.get(a.info.id);
      if (r && r.sig !== lookSig(a.info, this.lookOf(a.info))) {
        this.remove(r);
        r = undefined;
      }
      r ??= this.create(a, view);
      if (!this.rigs.has(r.id)) this.rigs.set(r.id, r);
      r.seen = frame;
      r.info = a.info;
      this.step(r, a, me, view, camera, now, dt, dtS, t);
    }
    for (const r of [...this.rigs.values()]) if (r.seen !== frame) this.remove(r);
  }

  private step(
    r: Rig,
    a: GameAvatar,
    me: GameAvatar | undefined,
    view: RoomView,
    camera: THREE.OrthographicCamera,
    now: number,
    dt: number,
    dtS: number,
    t: number,
  ): void {
    const info = a.info;
    // Where they are: the 2D game's own step interpolation, eased so corners round off.
    // In a Sprint Race they run laps of the square instead of standing at their table.
    const lap = racing(info.id, now);
    r.lap = lap;
    const p = lap ?? drawPos(a, now);
    r.at = p;
    const [tx, tz] = view.toWorld(p.x, p.y);
    const dx = tx - r.x;
    const dz = tz - r.z;
    if (!r.placed || Math.hypot(dx, dz) > 3) {
      r.x = tx;
      r.z = tz;
      r.placed = true;
    } else {
      r.x = approach(r.x, tx, dt, 45);
      r.z = approach(r.z, tz, dt, 45);
    }
    const moving = (lap ? lap.running : stepping(a, now)) || Math.hypot(tx - r.x, tz - r.z) > 0.04;
    if (moving) r.walkUntil = now + WALK_HOLD_MS;
    const seatKind = lap ? undefined : world.map.kind(a.x, a.y).seat;
    const onSeat = !lap && (a.state === "sit" || a.state === "working");
    const placed = poseOf({ state: lap ? "idle" : a.state, dozing: info.dozing && !lap }, onSeat ? seatKind : undefined, now < r.walkUntil);
    const { lying } = placed;
    // At a game table they sit on a stool, at an arena desk they type.
    const gamePose = a.state === "playing" ? seatPose(gamesOf(info.id)[0], lap !== null) : null;
    const pose = gamePose ?? placed.pose;
    const av = r.avatar;
    // On the Tavern's stage while the jukebox plays: dance.
    const dancing = pose === "stand" && world.room === "inn" && world.map.at(a.x, a.y) === "e" && hud.get().jukebox !== null;
    av.pose = dancing ? "dance" : pose;
    const hop = a.jump === null ? 0 : hopHeight((now - a.jump) / JUMP_MS);
    // Sitters and sleepers lie on their seat's height; everyone else on the floor.
    let y = 0;
    if (lying) y = seatKind === "bed" ? view.seatY(a.x, a.y, "bed") : 0.02;
    else if (gamePose) y = STOOL_Y;
    else if (pose === "sit" || pose === "type") y = seatKind ? view.seatY(a.x, a.y, seatKind) : 0.04;
    y += hop;
    let yawTarget = YAW[lap?.facing ?? a.facing];
    if (lying) yawTarget = 0;
    r.yaw = turnToward(r.yaw, yawTarget, dt, 70);

    // Coffee and the Tavern's special: a buzz, or a warm glow.
    const unow = Date.now();
    const special = hasSpecial(info.specialUntil ?? 0, unow) ? specialBuff(info.specialUntil ?? 0) : null;
    const shake = this.calm ? 0 : Math.min(4, Math.max(cupsLeft(info.coffeeUntil, unow), special === "jitter" ? 1.5 : 0));
    const jx = shake > 0 ? ((Math.random() * 2 - 1) * shake) / TILE : 0;
    const jz = shake > 0 ? ((Math.random() * 2 - 1) * shake * 0.5) / TILE : 0;
    r.root.position.set(r.x + jx, y, r.z + jz);
    r.root.rotation.y = r.yaw;
    if (special === "glow") {
      if (!r.halo) {
        r.halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.62, 16, 12),
          new THREE.MeshBasicMaterial({
            color: "#ffde78",
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        r.halo.position.y = 0.55;
        r.halo.userData.nopick = true;
        r.halo.userData.noBlock = true;
        r.root.add(r.halo);
      }
      r.halo.scale.setScalar(1 + 0.12 * Math.sin(t * 3.1));
    } else if (r.halo) {
      r.halo.removeFromParent();
      disposeObject(r.halo);
      r.halo = null;
    }
    // Appearing and disappearing: a pop.
    let pop = 1;
    if (a.warp) {
      const k = Math.min(1, (now - a.warp.at) / WARP_MS);
      pop = Math.max(0.01, a.warp.out ? 1 - k : k);
    }
    r.root.scale.setScalar(pop);

    // A sleeping bag on the floor for anyone who dozes off away from a bed.
    const bag = a.state === "away" && seatKind !== "bed";
    if (bag && !r.bedroll) {
      r.bedroll = new Model();
      r.bedroll.box([0.7, 0.05, 1.75], "#4a4452", [0, 0, 0.05], 0.02);
      r.bedroll.box([0.6, 0.03, 1.6], "#6b5a8a", [0, 0.05, 0.05], 0.015);
      r.bedroll.userData.nopick = true;
      r.root.add(r.bedroll);
    } else if (!bag && r.bedroll) {
      r.bedroll.removeFromParent();
      disposeObject(r.bedroll);
      r.bedroll = null;
    }

    // Off screen: positions keep up, but nothing is posed or labelled.
    this.v.set(r.x, 1, r.z).project(camera);
    const near = Math.abs(this.v.x) < 1.35 && Math.abs(this.v.y) < 1.35;
    r.root.visible = near && !this.keepers.has(r.id);
    const bubbleOn = a.bubble !== null && now < a.bubble.until;
    av.talking = bubbleOn;
    if (near) av.update(dtS, t);
    if (r.cop) r.cop.gear.update(r.cop.watch.read(bubbleOn && a.bubble ? a.bubble.text : "", now), now, this.calm);

    this.pet(r, a, me, view, camera, dt, t, near);
    const close = !me || Math.hypot(a.x - me.x, a.y - me.y) <= NAME_RANGE;
    this.labels(r, a, camera, now, near, close, bubbleOn, pose, y);
  }

  private pet(
    r: Rig,
    a: GameAvatar,
    me: GameAvatar | undefined,
    view: RoomView,
    camera: THREE.OrthographicCamera,
    dt: number,
    t: number,
    near: boolean,
  ): void {
    const look = this.lookOf(a.info);
    if (!look.pet || a.warp) {
      if (r.pet) {
        r.pet.root.removeFromParent();
        disposeObject(r.pet.root);
        r.pet = null;
      }
      return;
    }
    const sig = `${look.pet}|${look.petVariant}|${look.petName ?? ""}|${look.petwear}|${a.info.level >= LEGENDARY_LEVEL}`;
    if (r.pet && r.pet.sig !== sig) {
      r.pet.root.removeFromParent();
      disposeObject(r.pet.root);
      r.pet = null;
    }
    if (!r.pet) {
      const model = petFrom2D(look.pet, look.petVariant, look.petName ?? "");
      model.wear = look.petwear;
      model.crown = a.info.level >= LEGENDARY_LEVEL;
      const root = new THREE.Group();
      model.root.scale.setScalar(PET_SCALE);
      root.add(model.root);
      this.group.add(root);
      this.dirty = true;
      r.pet = { model, root, sig, x: r.x, z: r.z, yaw: 0, moving: false, placed: false };
    }
    const owner = ownerOfOffice(world.room);
    const bed = owner === a.info.id ? world.map.find("Q")[0] : undefined;
    const pos = r.at;
    const spot = followPet(a, pos.x * TILE, pos.y * TILE, dt, bed);
    if (!spot) return;
    // The 2D spot is the sprite's top-left in pixels; the 3D pet stands on its bottom middle.
    const [wx, wz] = view.toWorld((spot.x + PET_W / 2) / TILE - 0.5, (spot.y + PET_H) / TILE - 0.5);
    const pet = r.pet;
    const ddx = wx - pet.x;
    const ddz = wz - pet.z;
    if (!pet.placed) {
      pet.x = wx;
      pet.z = wz;
      pet.placed = true;
    } else {
      pet.x = approach(pet.x, wx, dt, 60);
      pet.z = approach(pet.z, wz, dt, 60);
    }
    const speed = Math.hypot(ddx, ddz) / Math.max(dt / 1000, 0.001);
    const pm = spot.moving && !spot.asleep;
    pet.moving = pm;
    pet.model.moving = pm;
    if (pm && speed > 0.25) pet.yaw = turnToward(pet.yaw, Math.atan2(ddx, ddz), dt, 90);
    else if (!spot.asleep) pet.yaw = turnToward(pet.yaw, Math.atan2(r.x - pet.x, r.z - pet.z), dt, 220);
    pet.model.pose = spot.asleep ? "sleep" : a.state !== "idle" && !pm ? "sit" : "stand";
    pet.root.position.set(pet.x, 0, pet.z);
    pet.root.rotation.y = pet.yaw;
    pet.root.visible = near;
    if (near) pet.model.update(t);
    // Its name, for mine and for those close to me.
    const name = look.petName;
    const close = !me || Math.hypot(a.x - me.x, a.y - me.y) <= NAME_RANGE;
    if (name && close && near) {
      if (!r.petLabel) {
        r.petLabel = this.overlay.make("r3-pet");
        r.petLabel.style.transform = "translate(-9999px, -9999px)";
      }
      if (r.petLabel.textContent !== name) r.petLabel.textContent = name;
      this.v.set(pet.x, 0.5, pet.z);
      this.overlay.place(r.petLabel, this.v, camera, 0, 14);
    } else if (r.petLabel) {
      r.petLabel.remove();
      r.petLabel = null;
    }
  }

  private labels(
    r: Rig,
    a: GameAvatar,
    camera: THREE.OrthographicCamera,
    now: number,
    near: boolean,
    close: boolean,
    bubbleOn: boolean,
    pose: string,
    y: number,
  ): void {
    const info = a.info;
    if (!near || a.warp?.out) {
      if (r.stack.style.display !== "none") r.stack.style.display = "none";
      return;
    }
    const resting = a.state === "away";
    // The name tag: name, level, rarity ring, company; yours is left off, you know who you are.
    const company = info.companyId === null ? undefined : world.companies.get(info.companyId);
    const isMe = info.id === world.selfId;
    if (close && !isMe) this.showcase.want(info.id, now);
    const pins = isMe ? null : this.showcase.get(info.id);
    const tagKey = `${info.name}|${info.level}|${info.online}|${company?.name ?? ""}|${company?.brand?.roof ?? ""}|${info.look.hat}|${info.look.outfit}|${pins?.key ?? ""}`;
    if (!isMe && (!r.tag || r.tagKey !== tagKey)) {
      r.tag?.remove();
      r.tag = nameTag({
        name: info.name,
        level: info.level,
        rarity: wornBy(info.look).rarity,
        online: info.online,
        company: company ? { name: company.name, color: company.brand?.roof ?? "#3f7a78" } : undefined,
        badges: pins?.chips.badges,
        trophies: pins?.chips.trophies,
      });
      r.tag.classList.remove("label");
      r.tagKey = tagKey;
      r.stack.append(r.tag);
    } else if (isMe && r.tag) {
      r.tag.remove();
      r.tag = null;
    }
    // Over their head, top to bottom: what they said, a sausage, the game they are in, the desk, the nap.
    const set = (el: HTMLElement, text: string | null) => {
      if (text === null) {
        if (el.style.display !== "none") el.style.display = "none";
        return;
      }
      if (el.style.display === "none") el.style.display = "";
      if (el.textContent !== text) el.textContent = text;
    };
    if (bubbleOn && a.bubble && !resting) {
      if (r.bubbleText !== a.bubble.text) {
        r.bubbleText = a.bubble.text;
        r.bubble.textContent = a.bubble.text.length > 120 ? `${a.bubble.text.slice(0, 119)}…` : a.bubble.text;
      }
      r.bubble.style.display = "";
      const left = a.bubble.until - now;
      r.bubble.style.opacity = left < 400 ? String(Math.max(0, left / 400)) : "1";
    } else r.bubble.style.display = "none";
    set(r.pills.polse, hasPolse(info.polseUntil, Date.now()) ? "🌭" : null);
    set(r.pills.game, gameTag(info.id));
    set(r.pills.work, a.state === "working" ? `💻 ×${Math.max(1, info.liveAgents)}` : null);
    set(r.pills.zzz, resting || info.dozing ? "z" : null);
    const lift = tagLift(info.level, pose);
    this.v.set(r.x, y + lift - (pose === "sleep" ? 0 : 0) + 0.05, r.z);
    this.overlay.place(r.stack, this.v, camera);

    // Emoji-only lines burst round the head instead of showing a bubble.
    if (a.burst && now - a.burst.at < BURST_MS) {
      if (!r.burst?.matches(a.burst.emojis, a.burst.at)) {
        r.burst?.dispose();
        r.burst = null;
        // Busy rooms: past the tier's cap a new burst waits (and is skipped once its time is up).
        if (this.bursts < this.maxBursts) {
          r.burst = new Burst(this.overlay, a.burst.emojis, a.burst.at);
          this.bursts++;
        }
      }
      if (!r.burst) return;
      const [sx, sy] = this.overlay.project(this.v.set(r.x, y + lift - 0.2, r.z), camera);
      if (!r.burst.step(now, sx, sy)) {
        r.burst.dispose();
        r.burst = null;
      }
    } else if (r.burst) {
      r.burst.dispose();
      r.burst = null;
    }
  }
}
