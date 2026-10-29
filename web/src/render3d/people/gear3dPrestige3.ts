/**
 * Prestige track 3's hat, outfit, back item and aura in 3D (`core/src/prestige.ts`): Voidwalker, obsidian and magenta.
 * Loaded by `gear3dPrestige.ts`, it adds the hat to `HAT_BUILDERS` by item name and pulls in the body
 * (`gear3dPrestige3Body.ts`: the armour and the Rift mantle) and aura (`gear3dPrestige3Aura.ts`) halves. Same frames as
 * `gear3dHead.ts`: the head frame has its origin at the skull's centre, +z is the face and +y up; a voxel head draws
 * every ball as a cube.
 */
import type { Model } from "../kit/kit.ts";
import "./gear3dPrestige3Aura.ts";
import "./gear3dPrestige3Body.ts";
import { band, COVERS_HAIR, type Ctx, dome, HAT_BUILDERS, lit, ring, see } from "./gear3dHead.ts";
import { isVox } from "./voxgear.ts";

const OBSIDIAN = "#241a33";
const OBSIDIAN_LIGHT = "#3d2d57";
const OBSIDIAN_DARK = "#150e20";
const VOID = "#04020a";
const MAGENTA = "#d946ef";
const PINK = "#ff7cf5";
const WHITE = "#ffeafd";

/**
 * A helm of black obsidian with a crest of light along the top and one wide dark visor across the brow. On the visor
 * is the event horizon: a black disc with a bright ring of bent light round it, a fainter ring of lensed light further
 * out, and a white hot spot that circles the disc. Cracks of magenta glow in the shell.
 */
function visorHat(m: Model, c: Ctx): void {
  const vox = isVox(m);
  // The voxel head's hair stands taller.
  const up = vox ? 0.07 : 0;
  const lensY = 0.11 + up;
  const lensZ = vox ? 0.292 : 0.274;
  // The shell and the band round its foot.
  dome(m, OBSIDIAN, 0.29, 0.02 + up, 0.5);
  band(m, OBSIDIAN_DARK, 0.292, 0.045, 0.0 + up);
  if (!vox) dome(m, OBSIDIAN_LIGHT, 0.284, 0.034 + up, 0.34);
  // The crest: a fin front to back along the crown, a line of pink light on its edge.
  m.box([0.036, 0.1, 0.3], OBSIDIAN_LIGHT, [0, 0.27 + up, -0.02], 0.01);
  m.box([0.012, 0.012, 0.26], lit(PINK), [0, 0.374 + up, -0.02], 0.002);
  // The visor: a dark pane across the brow, edged in light top and bottom.
  m.box([0.38, 0.11, 0.02], VOID, [0, lensY - 0.055, lensZ - 0.012], 0.006);
  for (const y of [-0.057, 0.049])
    m.box([0.38, 0.008, 0.024], lit(MAGENTA), [0, lensY + y, lensZ - 0.012], 0.002);
  // The event horizon: the dark disc, the ring of bent light, the lensed ring round it.
  m.ball(0.052, VOID, [0, lensY, lensZ + 0.002], [1, 1, 0.2]);
  ring(m, lit(PINK), 0.064, 0.011, [0, lensY, lensZ + 0.006], false);
  const halo = ring(m, see(PINK, 0.4, true), 0.092, 0.005, [0, lensY, lensZ + 0.002], false);
  // The hot spot and the pale spark behind it, circling the disc.
  const spot = m.ball(0.015, lit(WHITE), [0, lensY, lensZ + 0.02]);
  const spark = m.ball(0.009, lit(PINK), [0, lensY, lensZ + 0.018]);
  // Cracks in the shell, on both sides: little stairs of light on the dome's surface.
  for (const s of [-1, 1])
    for (const [y, z, h] of [
      [0.2, 0.1, 0.05],
      [0.16, 0.14, 0.04],
      [0.12, 0.1, 0.05],
      [0.19, -0.06, 0.04],
      [0.15, -0.1, 0.05],
    ] as const) {
      const x = vox ? 0.288 : Math.sqrt(0.29 ** 2 - (y + 0.02 - 0.02) ** 2 - z * z);
      m.box([0.012, h, 0.03], lit(MAGENTA), [s * x, y + up, z], 0.002);
    }
  c.tick((t) => {
    const a = t * 1.7;
    spot.position.set(Math.cos(a) * 0.064, lensY + Math.sin(a) * 0.064, lensZ + 0.02);
    spark.position.set(Math.cos(a - 0.5) * 0.064, lensY + Math.sin(a - 0.5) * 0.064, lensZ + 0.018);
    halo.scale.setScalar(1 + Math.sin(t * 2.3) * 0.05);
  });
}

Object.assign(HAT_BUILDERS, {
  "Event-horizon visor": (m: Model, c: Ctx) => visorHat(m, c),
});
COVERS_HAIR.add("Event-horizon visor");
