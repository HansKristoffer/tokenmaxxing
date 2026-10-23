import { onBattery, startDetection } from "../settings/detect.ts";
import { Governor, percentile, type Step } from "../settings/governor.ts";
import { graphics, TIER_NAMES } from "../settings/graphics.ts";
import { loadRenderer, type Renderer, type RendererKind, type Tile } from "./renderer.ts";

/** Live numbers for the FPS meter. */
export const perf = { fps: 0, ms: 0, p95: 0, renderer: "", scale: 1 };

/** With no input for this long the frame rate drops to 30. */
const IDLE_MS = 15_000;
const UNDO_HOLD_MS = 5 * 60_000;

let active: Renderer | null = null;

/** The tile under a point in the window, as the current renderer sees it. */
export const pickTile = (clientX: number, clientY: number): Tile | null =>
  active?.pick(clientX, clientY) ?? null;

/**
 * Runs the game's frame loop through whichever renderer the graphics settings call for, and swaps it when
 * they change. `tick` steps the game each animation frame and says whether there is a world to draw.
 */
export function startStage(host: HTMLElement, tick: (now: number) => boolean): void {
  let renderer: Renderer | null = null;
  let loading: RendererKind | null = null;
  /** Counts swaps: one that finds a newer one started while it loaded is out of date and drops its renderer. */
  let swaps = 0;
  let size = "";
  let lastDraw = 0;
  let lastInput = performance.now();
  let fpsFrames = 0;
  let fpsSince = performance.now();
  const gaps: number[] = [];
  const governor = new Governor(graphics.tier(), graphics.get().runtime.scaleMul, performance.now());
  /** The tier and scale the governor last set, to tell its changes from the player's. */
  let mine = `${governor.tier}:${governor.scaleMul}`;

  for (const type of ["keydown", "pointerdown", "pointermove", "wheel"])
    window.addEventListener(type, () => (lastInput = performance.now()), { passive: true });

  const fail = (reason: string) => {
    graphics.setRuntime({ failed3d: reason });
    graphics.toast(`3D graphics stopped (${reason}). Using classic 2D.`);
  };

  const swap = async (kind: RendererKind) => {
    loading = kind;
    const turn = ++swaps;
    const { renderer: next, reason, fellBack } = await loadRenderer(kind);
    if (turn !== swaps) return next.dispose();
    loading = null;
    next.mount(host);
    next.onFail?.(fail);
    renderer?.dispose();
    renderer = active = next;
    size = "";
    next.setQuality(graphics.effective());
    if (fellBack) {
      graphics.setRuntime({ failed3d: reason ?? "not available" });
      if (reason) graphics.toast(`3D graphics couldn't start (${reason}). Using classic 2D.`);
    }
  };

  const sync = () => {
    const s = graphics.effective();
    if (s.renderer !== (loading ?? renderer?.kind)) void swap(s.renderer);
    else renderer?.setQuality(s);
    const { choice } = graphics.get();
    governor.autoUp = choice === "auto";
    const now = `${graphics.tier()}:${graphics.get().runtime.scaleMul}`;
    if (now !== mine) {
      governor.reset(graphics.tier(), graphics.get().runtime.scaleMul, performance.now());
      mine = now;
    }
  };
  graphics.subscribe(sync);
  sync();
  startDetection();

  const apply = (step: Step) => {
    const before = graphics.tier();
    const beforeMul = graphics.get().runtime.scaleMul;
    mine = `${governor.tier}:${governor.scaleMul}`;
    graphics.setRuntime({ governed: governor.tier, scaleMul: governor.scaleMul });
    if (step.kind === "scale") return;
    const undo = () => {
      governor.reset(before, beforeMul, performance.now(), UNDO_HOLD_MS);
      mine = `${before}:${beforeMul}`;
      graphics.setRuntime({ governed: before, scaleMul: beforeMul });
      graphics.toast(`Back to ${TIER_NAMES[before]} graphics`);
    };
    graphics.toast(
      step.kind === "tier"
        ? `Switched to ${TIER_NAMES[step.tier]} graphics to keep it smooth`
        : `Stable for a while: now on ${TIER_NAMES[step.tier]} graphics`,
      undo,
    );
  };

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const draw = tick(now);
    if (!draw || !renderer || document.hidden) return;

    const settings = graphics.effective();
    const idle = now - lastInput > IDLE_MS;
    const saving = graphics.get().choice === "auto" && onBattery();
    const cap = idle || saving ? (settings.fpsCap === 0 ? 30 : Math.min(30, settings.fpsCap)) : settings.fpsCap;
    const target = cap === 0 ? 0 : 1000 / cap;
    // A little slack, or a 60 Hz screen drops to every third frame at a 30 fps cap.
    if (target && now - lastDraw < target - 2) return;
    const gap = now - lastDraw;
    lastDraw = now;

    const dpr = window.devicePixelRatio || 1;
    const key = `${window.innerWidth}x${window.innerHeight}@${dpr}`;
    if (key !== size) {
      size = key;
      renderer.resize(window.innerWidth, window.innerHeight, dpr);
    }
    try {
      renderer.frame(now);
    } catch (e) {
      if (renderer.kind === "2d") throw e;
      return fail(e instanceof Error ? e.message : "render error");
    }

    if (gap < 500) {
      gaps.push(gap);
      if (gaps.length > 60) gaps.shift();
      perf.ms = gap;
      perf.p95 = percentile([...gaps].sort((a, b) => a - b), 0.95);
    }
    fpsFrames++;
    if (now - fpsSince >= 500) {
      perf.fps = Math.round((fpsFrames * 1000) / (now - fpsSince));
      fpsFrames = 0;
      fpsSince = now;
    }
    perf.renderer = renderer.kind;
    perf.scale = settings.renderScale;

    if (graphics.get().choice === "auto" && settings.tier !== "low" && gap < 500) {
      // Judged against the fps the settings ask for, not a battery or idle cap we chose.
      const step = governor.push(gap, settings.fpsCap === 0 ? 1000 / 60 : 1000 / settings.fpsCap, now);
      if (step) apply(step);
    }
  };
  requestAnimationFrame(frame);
}
