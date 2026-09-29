import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import {
  type ChatLine,
  type CompanyInfo,
  type Facing,
  type Houses,
  type Moves,
  mapOf,
  type PlayerInfo,
  type PlayerPos,
  type PlayerState,
  type PlayerView,
  type RoomId,
  RUN_STEP_MS,
  type Snapshot,
  WALK_STEP_MS,
} from "@tokenmaxxing/core/world.ts";
import { bakeGround } from "../art/tiles.ts";
import { hud } from "../store.ts";

/** Someone in the room, as drawn: a logical tile plus an in-flight step. */
export interface Avatar {
  info: PlayerInfo;
  x: number;
  y: number;
  facing: Facing;
  state: PlayerState;
  from: { x: number; y: number; at: number; ms: number } | null;
  /** Steps received but not yet walked (remote players). */
  queue: PlayerPos[];
  bubble: { text: string; until: number } | null;
  warp: { at: number; out: boolean } | null;
}

export const BUBBLE_MS = 6000;
export const WARP_MS = 300;

export const world = {
  room: "town" as RoomId,
  selfId: 0,
  map: mapOf("town") as GameMap,
  ground: null as HTMLCanvasElement | null,
  avatars: new Map<number, Avatar>(),
  /** Avatars playing their warp-out before disappearing. */
  leaving: [] as Avatar[],
  companies: new Map<number, CompanyInfo>(),
  /** Town only: who is inside each company house, drawn through its walls. */
  houses: {} as Houses,
  /** Waiting for the server to move us through a door. */
  portalPending: false,
};

const grounds = new Map<GameMap, HTMLCanvasElement>();

const avatarOf = (v: PlayerView, now: number, warp: boolean): Avatar => ({
  info: v,
  x: v.x,
  y: v.y,
  facing: v.facing,
  state: v.state,
  from: null,
  queue: [],
  bubble: null,
  warp: warp ? { at: now, out: false } : null,
});

export const self = (): Avatar | undefined => world.avatars.get(world.selfId);

export function loadSnapshot(s: Snapshot): void {
  const now = performance.now();
  const changedRoom = s.room !== world.room || world.selfId === 0;
  world.room = s.room;
  world.selfId = s.selfId;
  world.map = mapOf(s.room);
  const ground = grounds.get(world.map) ?? bakeGround(world.map);
  grounds.set(world.map, ground);
  world.ground = ground;
  const bubbles = new Map([...world.avatars].map(([id, a]) => [id, a.bubble]));
  world.avatars = new Map(
    s.players.map((p) => {
      const a = avatarOf(p, now, false);
      if (!changedRoom) a.bubble = bubbles.get(p.id) ?? null;
      return [p.id, a];
    }),
  );
  world.leaving = [];
  world.portalPending = false;
  setCompanies(s.companies);
  world.houses = s.houses;
  hud.set({
    room: s.room,
    occupancy: s.occupancy,
    chat: s.chat,
    ...(changedRoom ? { banner: { text: roomName(s.room), at: Date.now() }, dialog: null } : {}),
  });
}

export function setCompanies(list: CompanyInfo[]): void {
  world.companies = new Map(list.map((c) => [c.id, c]));
  hud.set({ companies: list });
}

export function roomName(room: RoomId): string {
  if (room === "town") return "Town square";
  if (room === "inn") return "The Inn";
  const company = world.companies.get(Number(room.slice(3)));
  return company ? `${company.name}'s house` : "Company house";
}

/** One tick of changes from the server. */
export function applyMoves(m: Moves): void {
  if (m.room !== world.room) return;
  const now = performance.now();
  for (const id of m.leave) {
    const a = world.avatars.get(id);
    if (!a || id === world.selfId) continue;
    world.avatars.delete(id);
    world.leaving.push({ ...a, warp: { at: now, out: true } });
  }
  for (const v of m.join) {
    if (v.id === world.selfId) continue;
    world.avatars.set(v.id, avatarOf(v, now, true));
  }
  for (const pos of m.m) {
    const a = world.avatars.get(pos[0]);
    if (!a) continue;
    if (pos[0] === world.selfId) reconcileSelf(a, pos);
    else {
      a.queue.push(pos);
      if (a.queue.length > 6) a.queue.splice(0, a.queue.length - 6);
    }
  }
}

/** The server moved us (to bed, off a seat): take its word unless it's a step we already made. */
function reconcileSelf(a: Avatar, [, x, y, facing, state]: PlayerPos): void {
  if (state === a.state && Math.abs(x - a.x) + Math.abs(y - a.y) <= 1) return;
  Object.assign(a, { x, y, facing, state, from: null });
}

export function applyInfo(info: PlayerInfo): void {
  const a = world.avatars.get(info.id);
  if (a) a.info = info;
}

export function applyChat(line: ChatLine): void {
  if (line.room !== world.room) return;
  hud.set((s) => ({ chat: [...s.chat.slice(-99), line] }));
  const a = world.avatars.get(line.userId);
  if (a) a.bubble = { text: line.text, until: performance.now() + BUBBLE_MS };
}

/** Starts a one-tile step animation. */
export function beginStep(a: Avatar, x: number, y: number, ms: number): void {
  a.from = { x: a.x, y: a.y, at: performance.now(), ms };
  a.x = x;
  a.y = y;
}

export const stepping = (a: Avatar, now: number): boolean => a.from !== null && now < a.from.at + a.from.ms;

/** Where to draw an avatar right now, in tiles. */
export function drawPos(a: Avatar, now: number): { x: number; y: number } {
  if (!a.from || now >= a.from.at + a.from.ms) return { x: a.x, y: a.y };
  const t = (now - a.from.at) / a.from.ms;
  return { x: a.from.x + (a.x - a.from.x) * t, y: a.from.y + (a.y - a.from.y) * t };
}

/** Remote players walk their queued steps; long queues catch up at running pace. */
export function advanceRemotes(now: number): void {
  for (const a of world.avatars.values()) {
    if (a.info.id === world.selfId || stepping(a, now)) continue;
    const next = a.queue.shift();
    if (!next) {
      a.from = null;
      continue;
    }
    const [, x, y, facing, state] = next;
    a.facing = facing;
    a.state = state;
    if (Math.abs(x - a.x) + Math.abs(y - a.y) === 1)
      beginStep(a, x, y, a.queue.length > 1 ? RUN_STEP_MS : WALK_STEP_MS);
    else Object.assign(a, { x, y, from: null });
  }
  world.leaving = world.leaving.filter((a) => now - a.warp!.at < WARP_MS);
}

export const avatarAt = (x: number, y: number): Avatar | undefined =>
  [...world.avatars.values()].find((a) => a.x === x && a.y === y && a.info.id !== world.selfId);
