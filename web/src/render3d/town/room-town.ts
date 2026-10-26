import { compact } from "@tokenmaxxing/core/format.ts";
import * as THREE from "three";
import { hud } from "../../store.ts";
import { GateLive } from "../dungeon/gate3d.ts";
import { disposeObject } from "../engine/dispose.ts";
import { ExitMarkers } from "../rooms/exit-markers.ts";
import { type RoomCtx, type RoomView, registerRoom, type Sign, withTicks } from "../rooms/rooms.ts";
import { GamesLayer } from "./games3d.ts";
import { dropPropsNight, setPropsNight } from "./props.ts";
import { TownEvents } from "./town-events.ts";
import { buildTown3d, type Town3d } from "./town3d.ts";

/** The picture height the town starts at: the square and a few houses. */
const TOWN_VIEW = 12;

/**
 * The town, from `buildTown3d` (so its tiles are the 2D game's): houses for the real companies,
 * the Tavern, the pond, the boards. The street's schedules (the pølsevogn, the snail, the paperboy) follow
 * the game's clock.
 */
export function buildTownView(id: string, ctx: RoomCtx): RoomView {
  const built = withTicks(() => buildTown3d([...ctx.companies], { arcade: false }));
  const town: Town3d = built.value;
  town.setClock(ctx.minutes);
  const [W, D] = town.size;
  const events = new TownEvents((tx, ty) => town.toWorld(tx, ty));
  const group = new THREE.Group();
  group.add(town.group);
  // What changes with the game: the raid gate's boards, and the tables of the games on the square.
  const gate = town.doors.find((d) => d.kind === "dungeon");
  const gateLive = gate ? new GateLive([gate.at[0], gate.at[1] + 0.25]) : null;
  const games = new GamesLayer((tx, ty) => town.toWorld(tx, ty));
  if (gateLive) group.add(gateLive.group);
  group.add(games.group);
  // The leaderboard on the square shows today's top five, as the HUD's mini board has them.
  let board: ReturnType<typeof hud.get>["board"] | null = null;
  const showBoard = () => {
    if (board === hud.get().board) return;
    board = hud.get().board;
    town.boards.leaderboard.show(
      board
        .filter((r) => r.rank <= 5 && r.tokens > 0)
        .map((r) => ({ name: r.name, value: compact(r.tokens) })),
    );
  };
  const markers = new ExitMarkers(ctx.map, (tx, ty) => town.toWorld(tx, ty));
  group.add(markers.group);
  const signs = (): Sign[] =>
    town.doors.flatMap((d): Sign[] => {
      const at: [number, number, number] = [d.at[0], 3.2, d.at[1]];
      if (d.kind === "inn") return [{ key: "inn", at: [d.at[0], 3.4, d.at[1]], kind: "inn" }];
      if (d.kind === "hq" && d.companyId !== undefined)
        return [{ key: `co:${d.companyId}`, at, kind: "company", companyId: d.companyId }];
      if (d.kind === "shop")
        return [{ key: d.id, at: [d.at[0], 2.6, d.at[1] + 0.2], kind: "door", text: `🛍 ${d.label}` }];
      return [];
    });
  return {
    id,
    group,
    outdoors: true,
    bounds: { minX: 0, maxX: W, minZ: 0, maxZ: D, height: 3 },
    view: TOWN_VIEW,
    toWorld: (tx, ty) => town.toWorld(tx, ty),
    toTile: (x, z) => town.toTile(x, z),
    seatY: (_x, _y, kind) => (kind === "bench" ? 0.3 : 0.32),
    tick(t, _dt, toward) {
      for (const f of built.ticks) f(t);
      gateLive?.update(t);
      games.update(t, toward);
    },
    extras: events.group,
    frame(f) {
      showBoard();
      markers.update(f.me, f.t);
      events.update(f);
    },
    onToss: (tx, ty) => events.toss(tx, ty),
    leave: () => events.leave(),
    signs,
    liveSigns: () => [...(gateLive?.signs() ?? []), ...games.signs()],
    night: (on) => setPropsNight(on),
    dispose() {
      markers.dispose();
      events.dispose();
      games.dispose();
      gateLive?.dispose();
      dropPropsNight(group);
      group.removeFromParent();
      disposeObject(group);
    },
  };
}

registerRoom("town", buildTownView);
