import { lightAt } from "@tokenmaxxing/core/sky.ts";
import * as THREE from "three";
import { blockify } from "../demo3d/blocky.ts";
import { Fx } from "../demo3d/fx3d.ts";
import type { Pipeline } from "../demo3d/pipeline.ts";
import { skyNow, weatherNow } from "../game/sky.ts";
import type { GraphicsSettings } from "../settings/graphics.ts";
import { batchStatic } from "./batch.ts";
import { disposeObject } from "./dispose.ts";
import type { Overlay } from "./overlay.ts";
import type { RoomView } from "./rooms.ts";
import { seeThrough } from "./seethrough.ts";

const ROOM_BACKGROUND = "#1b1f2a";
const SHADOW_FAR = 90;

/**
 * A room as the renderer shows it: its scene and lights. Outdoors it also owns the sky: `Fx` (the demo's
 * sky dome, sun, moon, clouds, weather and lamps) driven by the game's own clock and the server's weather.
 * Indoors the light is fixed, as the 2D game's rooms are (only the town is tinted by the hour).
 */
/** What the stage can ask of the renderer: the clock the room's schedules read, for working out what moves. */
export interface StageHooks {
  clock: (minutes: number | null) => void;
}

/** Hours of the day the batching probe tries (minutes since midnight), so a schedule that moves things shows. */
const PROBE_MINUTES = [120, 450, 690, 750, 870, 1010, 1200];

export class RoomStage {
  readonly scene = new THREE.Scene();
  readonly hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
  readonly sun = new THREE.DirectionalLight("#fff1d6", 2.4);
  /** Where the sun looks: near the player, so shadows follow and weather falls where they are. */
  readonly target = new THREE.Vector3();
  readonly fx: Fx | null;
  private reach = 0;
  private darkness = 0;
  private settled = false;

  /** Milliseconds each step of making the stage took (for the debug handle). */
  readonly timing: Record<string, number> = {};

  /** What batching the still parts of the room into few meshes did. */
  batched = { before: 0, after: 0, batches: 0 };

  constructor(
    readonly view: RoomView,
    overlay: Overlay,
    hooks: StageHooks = { clock: () => {} },
  ) {
    const { scene, sun } = this;
    scene.background = new THREE.Color(ROOM_BACKGROUND);
    sun.userData.sun = true;
    const b = view.bounds;
    this.target.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    sun.target.position.copy(this.target);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = SHADOW_FAR;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.setReach(Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.75);
    this.place();
    scene.add(this.hemi, sun, sun.target, view.group);
    view.lights?.(scene, this.hemi, sun);
    if (view.outdoors) {
      const ref = { name: "Town", scene, sun, hemi: this.hemi, target: this.target };
      this.fx = new Fx(
        {
          stages: [ref],
          town: ref,
          current: () => "Town",
          show: () => {},
          label: (_stage, text, cls) => {
            const el = overlay.make(cls, text);
            el.style.display = "none";
            return { el: el as HTMLDivElement, remove: () => el.remove() };
          },
          me: () => null,
          applyNight: (on) => view.night?.(on),
        },
        { clock: skyNow, weather: weatherNow, light: lightAt, demo: false, streetLife: false },
      );
    } else this.fx = null;
    const t0 = performance.now();
    seeThrough(view.group);
    this.timing.see = performance.now() - t0;
    const opened = performance.getEntriesByType("navigation")[0]?.name ?? "";
    if (!opened.includes("nobatch")) this.batch(hooks);
    else if (!opened.includes("noblock")) blockify(view.group);
    if (view.extras) scene.add(view.extras);
    this.timing.total = performance.now() - t0;
  }

  /** Turns the parts of the room that never move into a few meshes: far fewer draw calls (`batch.ts`). */
  private batch(hooks: StageHooks): void {
    const { view } = this;
    const t0 = performance.now();
    blockify(view.group);
    this.timing.blockify = performance.now() - t0;
    const toward = new THREE.Vector3();
    this.batched = batchStatic(view.group, {
      chunk: 14,
      samples: PROBE_MINUTES.length,
      probe: (i) => {
        hooks.clock(PROBE_MINUTES[i % PROBE_MINUTES.length]!);
        view.night?.(i % 2 === 1);
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        view.tick(0.11 + i * 1.37, 0.7, toward.set(Math.sin(a), 0, Math.cos(a)));
      },
    });
    this.timing.batch = performance.now() - t0 - this.timing.blockify!;
    hooks.clock(null);
    view.night?.(false);
    view.tick(0, 10, toward.set(Math.SQRT1_2, 0, Math.SQRT1_2));
    this.scene.userData.blockyDone = true;
  }

  /** The sun's shadow box, `reach` world units either way. */
  private setReach(reach: number): void {
    if (Math.abs(reach - this.reach) < this.reach * 0.08) return;
    this.reach = reach;
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -reach;
    s.right = s.top = reach;
    s.updateProjectionMatrix();
  }

  private place(): void {
    const { sun, target } = this;
    if (this.view.outdoors) return;
    sun.position.set(target.x - this.reach * 0.55, 14, target.z + this.reach * 0.35);
    sun.target.position.copy(target);
  }

  /** Shadows on or off, and how sharp (the graphics settings'). */
  applySettings(s: GraphicsSettings): void {
    const on = s.shadowMap > 0;
    if (this.sun.castShadow !== on) this.sun.castShadow = on;
    if (on && this.sun.shadow.mapSize.x !== s.shadowMap) {
      this.sun.shadow.mapSize.set(s.shadowMap, s.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (this.fx) {
      this.fx.density = s.weather;
      this.fx.calm = s.reduceMotion;
    }
  }

  /**
   * Once a frame. `focus` is the player's spot; `viewHeight` the camera's picture height. Outdoors this runs
   * the sky and returns how dark it is (0 day, 1 night) for the composite's exposure.
   */
  update(dt: number, t: number, focus: THREE.Vector2, viewHeight: number, camera: THREE.OrthographicCamera): number {
    // The shadow box and the weather follow the player, in half-tile steps so shadows don't crawl.
    this.target.set(Math.round(focus.x * 2) / 2, 0, Math.round(focus.y * 2) / 2);
    this.setReach(Math.max(12, Math.min(34, viewHeight * 1.4)));
    if (this.fx) {
      if (!this.settled) {
        this.settled = true;
        this.fx.settle(t, camera);
      }
      this.fx.spread = Math.max(1, Math.min(2.4, viewHeight / 12));
      this.fx.update(dt, t, camera);
      this.darkness = this.fx.clockDark();
    } else this.place();
    return this.darkness;
  }

  /** The haze colour at the horizon, when there is a sky. */
  horizon(): THREE.Color | null {
    return this.fx?.hasSky() ? this.fx.horizon() : null;
  }

  dispose(): void {
    this.fx?.dispose();
    this.view.dispose();
    disposeObject(this.scene);
    this.scene.clear();
  }
}

/** Feeds the composite pass what the stage's sky says. */
export function lightPipeline(pipe: Pipeline, stage: RoomStage, dark: number): void {
  const horizon = stage.horizon();
  pipe.night = dark;
  if (horizon) {
    pipe.gradient = false;
    pipe.hazeColor.copy(horizon);
  } else {
    pipe.gradient = true;
    pipe.skyTop.set(ROOM_BACKGROUND);
    pipe.skyHor.set("#252a38");
    pipe.hazeColor.copy(pipe.skyHor);
  }
}
