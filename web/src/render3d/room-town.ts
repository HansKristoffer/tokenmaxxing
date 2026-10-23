import * as THREE from "three";
import { dropPropsNight, setPropsNight } from "../demo3d/props.ts";
import { buildTown3d, type Town3d } from "../demo3d/town3d.ts";
import { disposeObject } from "./dispose.ts";
import { type RoomCtx, type RoomView, registerRoom, type Sign, withTicks } from "./rooms.ts";
import { TownEvents } from "./town-events.ts";

/** The picture height the town starts at: the square and a few houses. */
const TOWN_VIEW = 12;

/**
 * The town, from the demo's `buildTown3d` (so its tiles are the 2D game's): houses for the real companies,
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
  const signs = (): Sign[] =>
    town.doors.flatMap((d): Sign[] => {
      const at: [number, number, number] = [d.at[0], 3.2, d.at[1]];
      if (d.kind === "inn") return [{ key: "inn", at: [d.at[0], 3.4, d.at[1]], kind: "inn" }];
      if (d.kind === "hq" && d.companyId !== undefined)
        return [{ key: `co:${d.companyId}`, at, kind: "company", companyId: d.companyId }];
      if (d.kind === "shop") return [{ key: d.id, at: [d.at[0], 2.6, d.at[1] + 0.2], kind: "door", text: `🛍 ${d.label}` }];
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
    tick(t) {
      for (const f of built.ticks) f(t);
    },
    extras: events.group,
    frame: (f) => events.update(f),
    onToss: (tx, ty) => events.toss(tx, ty),
    signs,
    night: (on) => setPropsNight(on),
    dispose() {
      events.dispose();
      dropPropsNight(group);
      group.removeFromParent();
      disposeObject(group);
    },
  };
}

registerRoom("town", buildTownView);
