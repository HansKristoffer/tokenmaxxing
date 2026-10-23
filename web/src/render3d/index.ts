import { GameMap } from "@tokenmaxxing/core/maps.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { DIRS, type Facing, houseTier, mapOf, ownerOfOffice } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { setGeometryDetail } from "../demo3d/kit.ts";
import { Pipeline } from "../demo3d/pipeline.ts";
import { SHOP_INSET, type ShopDisplay, type ShopId } from "../demo3d/shops/index.ts";
import { viewHooks } from "../game/camera.ts";
import { gameHits } from "../game/games.ts";
import { peekHits } from "../game/houses.ts";
import { send, walkThen, walkTo } from "../game/input.ts";
import { chipHits, signHits } from "../game/labels.ts";
import { setRaiders } from "../game/raid.ts";
import type { Renderer, Tile } from "../game/renderer.ts";
import { skyNow } from "../game/sky.ts";
import { self, world } from "../game/world.ts";
import { conn, refreshMe, town } from "../net.ts";
import type { GraphicsSettings } from "../settings/graphics.ts";
import { hud } from "../store.ts";
import { gpuNow } from "./dispose.ts";
import { Drops } from "./drops.ts";
import { Entities } from "./entities.ts";
import { keyDirection } from "./motion.ts";
import { Overlay } from "./overlay.ts";
import { applyGraphics } from "./perf/tiers.ts";
import { castAt } from "./pick.ts";
import { Placer } from "./placer.ts";
import { CameraRig } from "./rig.ts";
import { buildRoom, type RoomCtx, type RoomView } from "./rooms.ts";
import { SEE } from "./seethrough.ts";
import { type InstalledShops, installShops, type ShopWorld } from "./shops/index.ts";
import "./room-generic.ts";
import "./room-skin.ts";
import "./room-furnished.ts";
import "./room-dungeon.ts";
import "./room-town.ts";
import { Signs } from "./signs.ts";
import { lightPipeline, RoomStage } from "./stage3d.ts";

/**
 * The 3D renderer's entry, loaded on demand (`loadRenderer`) so Three.js is never downloaded on the Low
 * tier. Return a `Renderer` (see `game/renderer.ts`), or null when 3D isn't available: the game then runs
 * on 2D. Throwing (a shader error, a lost context) also falls back, with a toast.
 */
export function create3D(): Renderer | null {
  return new Renderer3D();
}

/** The world's clock in minutes since midnight in Copenhagen, for the street's schedules. */
function minutesNow(): number {
  const w = worldWall(skyNow());
  return w.hour * 60 + w.minute + w.second / 60;
}

let mapIds = 0;
const mapKeys = new WeakMap<object, number>();
const mapKey = (m: object): number => {
  const known = mapKeys.get(m);
  if (known) return known;
  mapKeys.set(m, ++mapIds);
  return mapIds;
};

/** A blink between rooms: how long the screen takes to close when the server is moving us, and to open. */
const FADE_OUT_MS = 170;
const FADE_IN_MS = 360;

/**
 * The game, in 3D: the room the server says we are in, everyone in it as voxel people with their pets, name
 * tags and speech as DOM over the canvas, the town's sky from the game's own clock and weather, and the
 * camera following you. The state is the 2D game's (`world`): this only draws it, and turns clicks into the
 * same tiles the 2D game's input already knows what to do with.
 */
class Renderer3D implements Renderer {
  readonly kind = "3d";
  private readonly canvas = document.createElement("canvas");
  private readonly pipe: Pipeline;
  private readonly overlay = new Overlay();
  private readonly rig = new CameraRig();
  private readonly entities = new Entities(this.overlay);
  private readonly signs = new Signs(this.overlay);
  private readonly drops = new Drops();
  private readonly caster = new THREE.Raycaster();
  private stage: RoomStage | null = null;
  /** The town is kept while you are indoors: coming back out doesn't rebuild it. */
  private town: { stage: RoomStage; key: string } | null = null;
  private key = "";
  private room = "";
  private w = 1;
  private h = 1;
  private detail: 0 | 1 | null = null;
  private shops: InstalledShops | null = null;
  private readonly placer = new Placer();
  /** A piece bought for the Office while elsewhere: placing starts once we are there. */
  private pendingPlace: string | null = null;
  private last = 0;
  private settings: GraphicsSettings | null = null;
  private fail?: (reason: string) => void;
  private selfAt: [number, number] | null = null;
  private drag: { x: number; y: number } | null = null;
  private errored = 0;
  private hooks3d: Required<typeof viewHooks> | null = null;
  private framing: { view: number; bounds: RoomView["bounds"] } | null = null;
  /** While a room works out what moves (`batch.ts`), the hour its schedules read. */
  private probeMinutes: number | null = null;
  private readonly hooks = { clock: (m: number | null) => (this.probeMinutes = m) };
  private readonly off: (() => void)[] = [];
  /** What the last frame cost, for the debug handle. */
  readonly stats = { frames: 0, builds: 0, lastBuildMs: 0, cpuMs: 0, entityMs: 0 };

  private readonly lost = (e: Event) => {
    e.preventDefault();
    this.fail?.("the graphics context was lost");
  };

  constructor() {
    this.canvas.id = "world";
    this.canvas.style.imageRendering = "auto";
    this.pipe = new Pipeline(this.canvas);
    this.pipe.autoQuality = false;
    // Draw calls and triangles are counted over the whole frame (the passes), reset by hand.
    this.pipe.renderer.info.autoReset = false;
    this.canvas.addEventListener("webglcontextlost", this.lost);
  }

  mount(host: HTMLElement): void {
    host.append(this.canvas);
    this.overlay.mount(host);
    // The 2D game's click targets are in canvas pixels; they are not ours.
    for (const hits of [chipHits, signHits, peekHits, gameHits]) hits.length = 0;
    this.hooks3d = {
      zoom: (step) => this.rig.zoom(step),
      rotate: (step) => this.rig.rotate(step),
      key: (dir) => keyDirection(dir as never, this.rig.turns) as never,
      shop: (_shop, x, y) => this.openShelf(x, y),
    };
    Object.assign(viewHooks, this.hooks3d);
    this.shops = installShops(this.shopWorld);
    this.bindShopping();
    // Panning: the middle button drags the picture; it settles back on you when you walk on.
    const down = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      this.drag = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.drag) return;
      this.rig.panBy(e.clientX - this.drag.x, e.clientY - this.drag.y, this.h);
      this.drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      this.drag = null;
    };
    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
    this.canvas.addEventListener("auxclick", (e) => e.preventDefault());
    this.off.push(() => {
      this.canvas.removeEventListener("pointerdown", down);
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
    });
    Object.assign(window, { __r3d: this });
    // `?r3dcheck`: builds and frees every room a few times over and says whether the GPU counts moved.
    // (The address is read from the navigation entry: signing in rewrites the page's own.)
    const opened = performance.getEntriesByType("navigation")[0]?.name ?? location.href;
    if (opened.includes("r3dcheck"))
      setTimeout(() => {
        const { before, after } = this.cycle(4);
        const leaked = before.geometries !== after.geometries || before.textures !== after.textures || before.programs !== after.programs;
        (leaked ? console.error : console.info)("3D leak check", leaked ? "LEAKED" : "ok", before, after);
      }, 3000);
  }

  onFail(cb: (reason: string) => void): void {
    this.fail = cb;
  }

  // MARK: Rooms

  /** The Office's wallpaper and floor as just chosen (the server's snapshot, which replaces the map, supersedes it). */
  private decorNow: { base: GameMap; map: GameMap } | null = null;

  /** Puts a wallpaper and floor on the Office at once: the room is built again from its map with them. */
  private applyDecor(d: { wall?: string; floor?: string }): void {
    if (ownerOfOffice(world.room) === null) return;
    const base = world.map;
    const m = this.decorNow?.base === base ? this.decorNow.map : base;
    this.decorNow = { base, map: new GameMap(m.id, m.name, m.rows, m.x0, m.y0, { ...m.decor, ...d }) };
    this.key = "";
  }

  private ctx(): RoomCtx {
    const map = this.decorNow && this.decorNow.base === world.map ? this.decorNow.map : world.map;
    return { map, companies: [...world.companies.values()], minutes: () => this.probeMinutes ?? minutesNow() };
  }

  /** The town's identity, worked out once per list of companies (`setCompanies` replaces the map each time). */
  private townKey: { companies: typeof world.companies; key: string } | null = null;

  /**
   * What identifies the room as drawn: the room itself, and for the town what its houses look like (each
   * company's plot, tier and brand: a new company, a house that grew or a new logo is a new town).
   */
  private roomKey(): string {
    if (world.room !== "town") return `${world.room}:${mapKey(world.map)}`;
    if (this.townKey?.companies !== world.companies)
      this.townKey = {
        companies: world.companies,
        key: `town:${[...world.companies.values()]
          .map((c) => `${c.plot}.${houseTier(c.tokens30d, c.members)}.${c.brand?.roof ?? ""}${c.brand?.logo ?? ""}.${c.deskFleet ?? 0}`)
          .sort()
          .join()}`,
      };
    return this.townKey.key;
  }

  /** Makes the stage match `world.room`, building it (and clearing the people) when the room changes. */
  private ensureStage(now: number): void {
    const key = this.roomKey();
    if (this.stage && key === this.key) return;
    const t0 = performance.now();
    const roomChanged = world.room !== this.room;
    const old = this.stage;
    this.entities.group.removeFromParent();
    this.drops.group.removeFromParent();
    if (roomChanged) this.entities.clear();
    this.drops.clear();
    let next: RoomStage;
    if (world.room === "town" && this.town?.key === key) next = this.town.stage;
    else {
      next = new RoomStage(buildRoom(world.room, this.ctx()), this.overlay, this.hooks);
      if (world.room === "town") {
        // A town for other plots replaces the one kept.
        if (this.town && this.town.stage !== old) this.town.stage.dispose();
        this.town = { stage: next, key };
      }
    }
    if (old && old !== next && old !== this.town?.stage) old.dispose();
    next.scene.add(this.entities.group, this.drops.group);
    this.stage = next;
    this.key = key;
    this.room = world.room;
    if (this.settings) next.applySettings(this.settings);
    const view = next.view;
    this.framing = { view: view.view, bounds: view.bounds };
    this.rig.frame(this.framing);
    this.rig.setAspect(this.w / this.h);
    this.selfAt = null;
    if (roomChanged) {
      this.shops?.panel.close();
      this.shops?.panel.tip(null);
      this.placer.cancel();
      if (this.pendingPlace && this.inOwnOffice()) {
        const id = this.pendingPlace;
        this.pendingPlace = null;
        this.beginPlacing(id);
      } else this.pendingPlace = null;
    }
    if (roomChanged) {
      this.overlay.snapFade(this.settings?.reduceMotion ? 0 : 1);
      this.overlay.fadeTowards(0, this.settings?.reduceMotion ? 0 : FADE_IN_MS, now);
    }
    this.stats.builds++;
    this.stats.lastBuildMs = performance.now() - t0;
  }

  // MARK: Frame

  frame(now: number): void {
    const started = performance.now();
    this.pipe.renderer.info.reset();
    const dt = this.last ? Math.min(100, Math.max(0.1, now - this.last)) : 16;
    this.last = now;
    this.ensureStage(now);
    const stage = this.stage!;
    const view = stage.view;
    const t = now / 1000;
    const calm = this.settings?.reduceMotion ?? false;

    // The camera: on you, off the room's edges, a pan easing back once you walk on.
    const me = this.entities.positionOf(world.selfId) ?? this.spotOf(view);
    const focus = me ?? [(view.bounds.minX + view.bounds.maxX) / 2, (view.bounds.minZ + view.bounds.maxZ) / 2];
    if (this.rig.panned() && me && this.selfAt && Math.hypot(me[0] - this.selfAt[0], me[1] - this.selfAt[1]) > 0.7)
      this.rig.easePan(dt);
    if (!this.rig.panned() || !this.selfAt) this.selfAt = me ? [me[0], me[1]] : null;
    this.rig.update(calm ? 1000 : dt, focus[0], focus[1]);
    const camera = this.rig.camera;
    camera.updateMatrixWorld();

    // The fade over a door: close it when the server is moving us, open it in the new room (ensureStage).
    if (world.portalPending && !calm) this.overlay.fadeTowards(1, FADE_OUT_MS, now);
    else if (this.overlay.faded > 0 && !world.portalPending) this.overlay.fadeTowards(0, calm ? 0 : FADE_IN_MS, now);
    this.overlay.stepFade(now);

    const before = this.entities.size;
    const e0 = performance.now();
    try {
      this.entities.update(now, dt, view, camera);
      this.signs.update(view, camera);
      this.drops.update(view, t);
    } catch (e) {
      // A bad look or label shouldn't take the whole picture down; say so once in a while.
      if (this.errored++ % 300 === 0) console.error("3D entities:", e);
    }
    this.stats.entityMs += (performance.now() - e0 - this.stats.entityMs) * 0.05;
    if (this.entities.size !== before || this.entities.dirty || this.drops.dirty) this.entities.dirty = this.drops.dirty = false;

    const dark = stage.update(dt / 1000, t, this.rig.focus, this.rig.viewShown, camera);
    view.tick(t, dt / 1000, this.rig.towardCamera());
    lightPipeline(this.pipe, stage, dark);
    this.seeSelf(me, camera);
    this.pipe.render(stage.scene, camera, this.w, this.h);
    this.stats.frames++;
    this.stats.cpuMs += (performance.now() - started - this.stats.cpuMs) * 0.05;
  }

  /** Where you stand in the room's units, from the game state: before your body has been drawn (a new room). */
  private spotOf(view: RoomView): [number, number] | null {
    const a = world.avatars.get(world.selfId);
    return a ? view.toWorld(a.x, a.y) : null;
  }

  /** Where the ring that cuts trees and roofs away round you is, in render pixels. */
  private seeSelf(me: [number, number] | null | undefined, camera: THREE.OrthographicCamera): void {
    if (!me) {
      SEE.value.w = 0;
      return;
    }
    const at = new THREE.Vector3(me[0], 0.9, me[1]);
    const depth = -at.clone().applyMatrix4(camera.matrixWorldInverse).z;
    at.project(camera);
    const ratio = this.pipe.renderer.getPixelRatio();
    SEE.value.set(
      (at.x * 0.5 + 0.5) * this.w * ratio,
      (at.y * 0.5 + 0.5) * this.h * ratio,
      depth,
      (this.h / this.rig.viewShown) * 0.95 * ratio,
    );
  }

  resize(w: number, h: number, _dpr: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.overlay.resize(this.w, this.h);
    this.rig.setAspect(this.w / this.h);
    if (this.settings) this.setQuality(this.settings);
  }

  setQuality(s: GraphicsSettings): void {
    this.settings = s;
    applyGraphics(this.pipe, s);
    // Medium builds lean rooms (plain boxes, fewer segments); a change of tier rebuilds what is built.
    const detail = s.tier === "medium" ? 0 : 1;
    if (detail !== this.detail) {
      const changed = this.detail !== null;
      this.detail = detail;
      setGeometryDetail(detail);
      if (changed) {
        if (this.town && this.town.stage !== this.stage) this.town.stage.dispose();
        this.town = null;
        this.key = "";
      }
    }
    this.stage?.applySettings(s);
    this.town?.stage.applySettings(s);
  }


  // MARK: Shops

  /** What the buy panel needs of this world (`render3d/shops`). */
  private readonly shopWorld: ShopWorld = {
    previewLook: (look) => this.entities.previewLook(look),
    renderStyle: () => ({
      style: this.pipe.style === "voxel" ? "voxel" : "classic",
      pixelSize: this.pipe.pixelSize,
      night: this.pipe.night > 0.5,
    }),
    startPlacement: (itemId) => this.startPlacement(itemId),
    applyDecor: (d) => this.applyDecor(d),
  };

  /** The display nearest a point of the window, within a few finger widths. */
  private shelfAt(clientX: number, clientY: number): { shop: ShopId; display: ShopDisplay } | null {
    const room = this.stage?.view.shop;
    if (!room) return null;
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector3();
    let best: ShopDisplay | null = null;
    let bestD = 30;
    for (const d of room.displays) {
      p.set(d.pos.x + SHOP_INSET[0], d.pos.y, d.pos.z + SHOP_INSET[1]).project(this.rig.camera);
      const dist = Math.hypot(((p.x + 1) / 2) * r.width + r.left - clientX, ((1 - p.y) / 2) * r.height + r.top - clientY);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best ? { shop: room.id, display: best } : null;
  }

  /** E on a display tile of the map: the buy panel on the first thing sold there. */
  private openShelf(x: number, y: number): boolean {
    const room = this.stage?.view.shop;
    const d = room?.displays.find((q) => q.tile[0] + SHOP_INSET[0] === x && q.tile[1] + SHOP_INSET[1] === y);
    if (!room || !d || !this.shops) return false;
    this.shops.open(room.id, d.item);
    return true;
  }

  /** Clicks on shelves, the price tip and the placement ghost: in the capture phase, before the game's own walking. */
  private bindShopping(): void {
    const click = (e: MouseEvent) => {
      if (hud.get().panel) return;
      if (this.placer.active) {
        e.stopImmediatePropagation();
        this.placeAt(e.clientX, e.clientY);
        return;
      }
      const hit = this.shelfAt(e.clientX, e.clientY);
      if (!hit || !this.shops) return;
      e.stopImmediatePropagation();
      this.shops.open(hit.shop, hit.display.item);
    };
    const move = (e: PointerEvent) => {
      if (this.placer.active && this.stage) {
        const t = this.pick(e.clientX, e.clientY);
        this.placer.aim(this.stage.view, t, t !== null && this.floorFree(t.x, t.y));
      }
      if (!this.shops) return;
      const near = this.stage?.view.shop && !this.placer.active ? this.shelfAt(e.clientX, e.clientY) : null;
      const it = near?.display.item;
      this.shops.panel.tip(it ? `${it.name}${it.price ? ` · 🪙 ${it.price}` : ""}` : null, e.clientX, e.clientY);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !this.placer.active) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.stopPlacing();
    };
    this.canvas.addEventListener("click", click, true);
    this.canvas.addEventListener("pointermove", move);
    window.addEventListener("keydown", key, true);
    this.off.push(() => {
      this.canvas.removeEventListener("click", click, true);
      this.canvas.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", key, true);
    });
  }

  // MARK: Placing furniture

  private inOwnOffice(): boolean {
    return ownerOfOffice(world.room) === world.selfId;
  }

  /** The Office placement mode for `itemId`; takes you to your Office first if you are elsewhere. */
  private startPlacement(itemId: string): boolean {
    if (!this.stage) return false;
    if (!this.inOwnOffice()) {
      this.pendingPlace = itemId;
      hud.set({ dialog: "Taking you to your Office to put it down." });
      send(conn.visit(world.selfId));
      return true;
    }
    return this.beginPlacing(itemId);
  }

  private beginPlacing(itemId: string): boolean {
    if (!this.stage || !this.placer.begin(itemId, this.stage.scene)) return false;
    this.shops?.panel.close();
    hud.set({ dialog: "Click where it goes. Esc to cancel." });
    return true;
  }

  private stopPlacing(): void {
    this.placer.cancel();
    this.pendingPlace = null;
    if (hud.get().dialog?.startsWith("Click where")) hud.set({ dialog: null });
  }

  /** Whether a piece can go on this tile: bare floor, nobody standing on it. */
  private floorFree(x: number, y: number): boolean {
    if (!world.map.walkable(x, y) || world.map.kind(x, y).portal) return false;
    for (let i = 0; i < this.placer.width; i++) {
      if (!world.map.walkable(x + i, y)) return false;
      for (const a of world.avatars.values()) if (a.x === x + i && a.y === y) return false;
    }
    return true;
  }

  /** Walks up to the tile, faces it, and puts the piece down there: the server places it where you face. */
  private placeAt(clientX: number, clientY: number): void {
    const id = this.placer.itemId;
    const tile = this.pick(clientX, clientY);
    const me = self();
    if (!id || !tile || !me || !this.floorFree(tile.x, tile.y)) return;
    const dirs = (Object.entries(DIRS) as [Facing, [number, number]][])
      .map(([facing, [dx, dy]]) => ({ facing, x: tile.x - dx, y: tile.y - dy }))
      .filter((c) => world.map.walkable(c.x, c.y))
      .sort((a, b) => Math.abs(a.x - me.x) + Math.abs(a.y - me.y) - (Math.abs(b.x - me.x) + Math.abs(b.y - me.y)));
    const drop = () => {
      this.stopPlacing();
      town.drop(id).then(
        async (r) => {
          hud.set({ dialog: r.notice });
          if (r.drop) hud.set((s) => ({ wallet: s.wallet && { ...s.wallet, items: s.wallet.items - 1 } }));
          await refreshMe();
        },
        (e: unknown) => hud.set({ dialog: e instanceof Error ? e.message : "That didn't work." }),
      );
    };
    for (const c of dirs) {
      if (me.x === c.x && me.y === c.y && me.facing === c.facing) {
        drop();
        return;
      }
      if (walkThen(c.x, c.y, c.facing, drop)) return;
    }
    hud.set({ dialog: "There's no way to get to it from here." });
  }

  // MARK: Picking

  /**
   * The tile under a point in the window. A person is their own tile; a prop that stands on a tile you can't
   * walk on (a desk, a door, a house) is that tile; otherwise the floor point under the click.
   */
  pick(clientX: number, clientY: number): Tile | null {
    const stage = this.stage;
    if (!stage) return null;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    this.caster.setFromCamera(ndc, this.rig.camera);
    const ray = this.caster.ray;
    const who = this.entities.pick(ray);
    const person = who === null ? undefined : world.avatars.get(who);
    if (person) return { x: person.x, y: person.y };
    const { floor, prop } = castAt(ray, stage.view.group, this.caster);
    const view = stage.view;
    if (prop) {
      const [x, y] = view.toTile(prop.x, prop.z);
      if (world.map.contains(x, y) && !world.map.walkable(x, y)) return { x, y };
    }
    if (!floor) return null;
    const [x, y] = view.toTile(floor.x, floor.z);
    return { x, y };
  }

  // MARK: Debug

  /** The window position of a tile's middle (for tests that click on tiles). */
  screenOf(tx: number, ty: number, y = 0.2): [number, number] | null {
    const view = this.stage?.view;
    if (!view) return null;
    const [x, z] = view.toWorld(tx, ty);
    const [sx, sy] = this.overlay.project(new THREE.Vector3(x, y, z), this.rig.camera);
    const r = this.canvas.getBoundingClientRect();
    return [r.left + sx, r.top + sy];
  }

  readonly world = world;

  /** Where a shelf of the shop you are in is in the window, by item id (tests); the first one without an id. */
  shelfScreen(itemId?: string): { id: string; name: string; price: number; at: [number, number] } | null {
    const d = this.stage?.view.shop?.displays.find((q) => !itemId || q.item.id === itemId);
    if (!d) return null;
    const p = new THREE.Vector3(d.pos.x + SHOP_INSET[0], d.pos.y, d.pos.z + SHOP_INSET[1]).project(this.rig.camera);
    const r = this.canvas.getBoundingClientRect();
    return { id: d.item.id, name: d.item.name, price: d.item.price, at: [((p.x + 1) / 2) * r.width + r.left, ((1 - p.y) / 2) * r.height + r.top] };
  }

  /** Goes to your own Office from anywhere, as the card's button does (tests). */
  visitOffice(): void {
    send(conn.visit(world.selfId));
  }

  /** Walks to a tile of the room as a click would (tests). */
  go(x: number, y: number): void {
    walkTo(x, y);
  }

  /** Shows room `id` from its core map without moving anyone (screenshots and tests); the next snapshot undoes it. */
  debugRoom(id: string): void {
    world.room = id as never;
    world.map = mapOf(id as never);
    world.avatars.clear();
  }

  /** Seats `n` made-up raiders at the war desks (screenshots and measuring a full dungeon); the next real list undoes it. */
  debugRaiders(n: number): void {
    const look = world.avatars.get(world.selfId)?.info.look;
    if (!look) return;
    const top = Array.from({ length: n }, (_, i) => ({
      id: -1000 - i,
      name: `raider${i + 1}`,
      look: { ...look, hair: i % 8, outfit: i % 12, skin: i % 5 },
      agents: 1 + (i % 6),
      burn: 1e5 * (1 + (i % 7)) * (i % 3 === 0 ? 0 : 1),
    }));
    setRaiders({ top, more: 0 });
  }

  /** Counts of what is on the GPU now (see `__r3d.gpu()` in the console). */
  gpu() {
    return gpuNow(this.pipe.renderer);
  }

  /**
   * Builds and frees every room `n` times over, for leak checks: the GPU counts after should equal those
   * before. Builds from the core maps, so it needs no server moves.
   */
  cycle(n: number, rooms: string[] = ["town", "hq", "inn", "upstairs", "basement", "dungeon", "office"]): {
    before: ReturnType<typeof gpuNow>;
    after: ReturnType<typeof gpuNow>;
  } {
    const warm = () => {
      for (const id of rooms) {
        const s = new RoomStage(buildRoom(id as never, { ...this.ctx(), map: mapOf(id as never) }), this.overlay, this.hooks);
        // Draw all of it once (nothing is uploaded until it is drawn), so freeing it is a real test.
        s.scene.traverse((o) => {
          o.frustumCulled = false;
        });
        this.rig.frame({ view: s.view.view, bounds: s.view.bounds });
        this.rig.update(16, s.view.bounds.maxX / 2, s.view.bounds.maxZ / 2, true);
        this.pipe.render(s.scene, this.rig.camera, this.w, this.h);
        s.dispose();
      }
    };
    warm();
    this.pipe.renderer.renderLists.dispose();
    const before = this.gpu();
    for (let i = 0; i < n; i++) warm();
    const after = this.gpu();
    // The live room's camera was borrowed.
    if (this.framing) this.rig.frame(this.framing);
    return { before, after };
  }

  dispose(): void {
    for (const f of this.off) f();
    // Only our own hooks: a renderer that replaced us may have mounted before we were disposed.
    if (this.hooks3d && viewHooks.zoom === this.hooks3d.zoom) {
      delete viewHooks.zoom;
      delete viewHooks.rotate;
      delete viewHooks.key;
      delete viewHooks.shop;
    }
    this.placer.cancel();
    this.shops?.dispose();
    this.shops = null;
    this.signs.dispose();
    this.entities.dispose();
    this.drops.dispose();
    if (this.stage && this.stage !== this.town?.stage) this.stage.dispose();
    this.town?.stage.dispose();
    this.stage = null;
    this.town = null;
    this.overlay.dispose();
    // Give the GPU context back now: browsers allow only a handful at once, and tiers can be switched often.
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.pipe.dispose();
    this.pipe.renderer.forceContextLoss();
    this.canvas.remove();
    if ((window as unknown as { __r3d?: unknown }).__r3d === this) delete (window as unknown as { __r3d?: unknown }).__r3d;
  }
}
