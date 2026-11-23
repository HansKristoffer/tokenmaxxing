/**
 * The net cafe's roulette table as a 3D prop. In 2D, `♦` is the 3x2 table and `♥` the eight spots: four above it and
 * four below, where the players stand. The table is green felt in a wooden rim. The wheel sits on the left half: a
 * bowl, a ring of 37 pockets in `WHEEL` order coloured by `colorOf`, a gold cone and a little white ball, turning
 * slowly. The betting layout is on the right half, painted on a small canvas (0 on the left, the numbers in three
 * rows).
 */
import { type Bet, colorOf, type RouletteState, SPIN_MS, WHEEL } from "@tokenmaxxing/core/roulette.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { canvasTexture, liveModel, Model, painted, tint } from "../kit/kit.ts";

const FELT = "#1f6b3f";
const POCKET = { red: "#c8352f", black: "#1d1a22", green: "#2f9a4f" } as const;
const FONT = "bold 9px ui-monospace, Menlo, Consolas, monospace";
/** The felt's top, and the wheel's centre on the left half. */
const TOP = 0.78;
const WHEEL_AT: [number, number] = [-0.75, 0];

/**
 * The betting layout's painted size in pixels, and its grid: the cells start at (X0, Y0) and are CELL_W by CELL_H.
 */
const LAYOUT_W = 262;
const LAYOUT_H = 98;
const X0 = 6;
const Y0 = 6;
const CELL_W = 20;
const CELL_H = 20;

/** The betting layout: 0, then three rows of numbers (3 on top) and the dozens under them. */
function layoutTexture() {
  return canvasTexture(LAYOUT_W, LAYOUT_H, (g) => {
    g.fillStyle = FELT;
    g.fillRect(0, 0, LAYOUT_W, LAYOUT_H);
    g.strokeStyle = "#f2efe0";
    g.lineWidth = 1.5;
    g.font = FONT;
    g.textAlign = "center";
    g.textBaseline = "middle";

    const cell = (x: number, y: number, w: number, h: number, fill: string | null, text: string) => {
      if (fill) {
        g.fillStyle = fill;
        g.fillRect(x, y, w, h);
      }
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.fillStyle = "#f6f2e4";
      g.fillText(text, x + w / 2, y + h / 2 + 1);
    };

    cell(X0, Y0, CELL_W, CELL_H * 3, POCKET.green, "0");
    for (let n = 1; n <= 36; n++) {
      const col = Math.floor((n - 1) / 3);
      const row = 2 - ((n - 1) % 3);
      cell(X0 + CELL_W * (1 + col), Y0 + CELL_H * row, CELL_W, CELL_H, POCKET[colorOf(n)], String(n));
    }

    const dozensY = Y0 + CELL_H * 3;
    for (let i = 0; i < 3; i++) {
      cell(X0 + CELL_W * (1 + i * 4), dozensY, CELL_W * 4, CELL_H, null, `${i * 12 + 1}-${i * 12 + 12}`);
    }

    const evenMoneyY = dozensY + CELL_H;
    const tags: [string, string | null][] = [
      ["1-18", null],
      ["EVEN", null],
      ["RED", POCKET.red],
      ["BLACK", POCKET.black],
      ["ODD", null],
      ["19-36", null],
    ];
    for (const [i, [text, fill]] of tags.entries()) {
      cell(X0 + CELL_W * (1 + i * 2), evenMoneyY, CELL_W * 2, CELL_H - 6, fill, text);
    }
  });
}

export interface RouletteModel extends Model {
  /** Where each spot's mat is, in the table's space (x, z): the chips and the glow go there. */
  setSpots(spots: readonly (readonly [number, number])[]): void;
  /** Drives the wheel, ball, result disc, history board, chips and glow from the server's state. */
  show(state: (RouletteState & { at: number }) | null, nowMs: number, dtSec: number): void;
}

/** One colour per seat: the same as the HUD's. */
const SEAT_COLORS = [
  "#3b82f6",
  "#a855f7",
  "#22c55e",
  "#f97316",
  "#facc15",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
] as const;

/** The layout sheet on the felt: its width in world units and the middle of it along x. */
const SHEET_W = 1.3;
const SHEET_AT = 0.75;

/** Where a bet sits on the felt, in the table's space (x, z): the centre of its cell in the painted layout. */
function betSpot(on: string): [number, number] | null {
  const dozensY = Y0 + CELL_H * 3;
  const evenMoneyY = dozensY + CELL_H;
  let px: number;
  let py: number;
  if (on.startsWith("n:")) {
    const n = Number(on.slice(2));
    if (n === 0) {
      px = X0 + CELL_W / 2;
      py = Y0 + (CELL_H * 3) / 2;
    } else {
      px = X0 + CELL_W * (1 + Math.floor((n - 1) / 3)) + CELL_W / 2;
      py = Y0 + CELL_H * (2 - ((n - 1) % 3)) + CELL_H / 2;
    }
  } else if (on === "d1" || on === "d2" || on === "d3") {
    px = X0 + CELL_W * (1 + (Number(on[1]) - 1) * 4) + CELL_W * 2;
    py = dozensY + CELL_H / 2;
  } else if (on === "c1" || on === "c2" || on === "c3") {
    // The columns end the rows at the right. No cell is drawn there, so they sit on the last number of each row.
    px = X0 + CELL_W * 12 + CELL_W / 2;
    py = Y0 + CELL_H * (3 - Number(on[1])) + CELL_H / 2;
  } else {
    const i = ["low", "even", "red", "black", "odd", "high"].indexOf(on);
    if (i < 0) return null;
    px = X0 + CELL_W * (1 + i * 2) + CELL_W;
    py = evenMoneyY + (CELL_H - 6) / 2;
  }

  // The sheet's middle is the origin along x and z of the felt's layout space.
  const sheetX = SHEET_AT + ((px - LAYOUT_W / 2) / LAYOUT_W) * SHEET_W;
  const sheetZ = ((py - LAYOUT_H / 2) / LAYOUT_H) * SHEET_W * (LAYOUT_H / LAYOUT_W);
  return [sheetX, sheetZ];
}

const MAX_CHIPS = 4 * 12 * 5;
const TAU = Math.PI * 2;

function overlayMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
}

/** The roulette table, 3 tiles by 2, its bottom centre at the origin. */
export function rouletteTable3d(): RouletteModel {
  const table = new Model() as RouletteModel;

  // Base and legs, the rim, the felt.
  table.box([2.8, 0.1, 1.8], C.woodDark, [0, 0.12, 0], 0.02);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) table.cyl(0.07, 0.62, C.woodDark, [sx * 1.25, 0, sz * 0.75], 0.06, 8);
  }
  table.box([2.9, 0.12, 1.9], C.woodDark, [0, 0.62, 0], 0.02);
  table.box([2.94, 0.06, 1.94], C.woodLight, [0, 0.72, 0], 0.02);
  table.box([2.7, 0.025, 1.7], "#5e2a2a", [0, 0.775, 0], 0.01);
  table.box([2.62, 0.02, 1.62], FELT, [0, 0.79, 0], 0.005);
  const feltTop = TOP + 0.03;

  // The layout, flat on the right half.
  const tex = layoutTexture();
  const sheet = table.plane(SHEET_W, SHEET_W * (LAYOUT_H / LAYOUT_W), painted(tex), [
    SHEET_AT,
    feltTop + 0.002,
    0,
  ]);
  sheet.rotation.x = -Math.PI / 2;
  sheet.castShadow = false;

  // The wheel: a still bowl and rim, and the turning part (pockets, cone, ball).
  const [wx, wz] = WHEEL_AT;
  table.cyl(0.52, 0.07, C.woodDark, [wx, feltTop, wz], 0.5, 28);
  table.cyl(0.46, 0.1, C.woodLight, [wx, feltTop + 0.05, wz], 0.4, 28);
  table.cyl(0.42, 0.03, "#7a4a2a", [wx, feltTop + 0.13, wz], 0.34, 28);

  const spin = liveModel();
  spin.position.set(wx, feltTop + 0.15, wz);
  const pocketCount = WHEEL.length;
  const ringRadius = 0.3;
  const pocketWidth = (2 * Math.PI * ringRadius) / pocketCount;
  WHEEL.forEach((pocket, i) => {
    const angle = (i / pocketCount) * Math.PI * 2;
    const pocketMesh = spin.box(
      [0.05, 0.022, pocketWidth * 0.92],
      POCKET[colorOf(pocket)],
      [Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius],
      0.003,
    );
    pocketMesh.rotation.y = -angle;
  });
  spin.cyl(0.24, 0.03, "#3a2a1c", [0, -0.01, 0], 0.22, 24);
  spin.cyl(0.07, 0.07, "#e9b930", [0, 0.01, 0], 0.012, 12);
  table.add(spin);

  // The white ball runs round the bowl the other way, then drops into its pocket.
  const ball = liveModel();
  ball.position.set(wx, feltTop + 0.18, wz);
  const bead = ball.ball(0.017, "#ffffff", [0.37, 0, 0]);
  table.add(ball);

  // Over the table: the landed number on a disc, and a little board at the back edge with the last pockets.
  const numTex = canvasTexture(64, 64, () => {});
  const numMat = overlayMaterial(numTex);
  const numPlane = table.plane(0.5, 0.5, numMat, [wx, feltTop + 0.95, wz + 0.1]);
  numPlane.visible = false;
  numPlane.rotation.x = -0.35;

  const HISTORY_SHOWN = 6;
  const histTex = canvasTexture(96, 20, () => {});
  const histMat = overlayMaterial(histTex);
  const histPlane = table.plane(0.62, 0.13, histMat, [0.75, feltTop + 0.1, -0.82]);
  histPlane.rotation.x = -0.4;
  const drawHistory = (history: readonly number[]) => {
    const g = (histTex.image as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, 96, 20);
    g.fillStyle = "#2a1c1c";
    g.fillRect(0, 0, 96, 20);
    g.strokeStyle = "#e9b930";
    g.strokeRect(0.5, 0.5, 95, 19);
    for (let i = 0; i < HISTORY_SHOWN; i++) {
      const pocket = history[i];
      g.fillStyle = pocket === undefined ? "#3a3030" : POCKET[colorOf(pocket)];
      g.beginPath();
      g.arc(9 + i * 15.5, 10, i === 0 ? 6.5 : 5, 0, TAU);
      g.fill();
      if (pocket !== undefined && i === 0) {
        g.strokeStyle = "#ffffff";
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
    histTex.needsUpdate = true;
  };
  drawHistory([]);

  // Chips on the felt (one instanced mesh), a glow and a "ready" dot per seated spot.
  const props = liveModel();
  table.add(props);
  const chipMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.034, 0.034, 0.012, 10),
    new THREE.MeshBasicMaterial(),
    MAX_CHIPS,
  );
  chipMesh.count = 0;
  chipMesh.frustumCulled = false;
  chipMesh.userData.live = true;
  props.add(chipMesh);

  const glows: THREE.Mesh[] = [];
  const dots: THREE.Mesh[] = [];
  const glowMat = new THREE.MeshBasicMaterial({
    color: "#ffb35a",
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dotMat = new THREE.MeshBasicMaterial({ color: "#4ade80" });
  table.setSpots = (spots) => {
    for (const o of [...glows, ...dots]) o.removeFromParent();
    glows.length = 0;
    dots.length = 0;
    for (const [sx, sz] of spots) {
      const glow = props.cyl(0.46, 0.006, glowMat, [sx, 0.035, sz], 0.46, 24);
      glow.visible = false;
      glows.push(glow);
      const dot = props.ball(0.07, dotMat, [sx, 1.85, sz]);
      dot.visible = false;
      dots.push(dot);
    }
  };

  const tmp = new THREE.Object3D();
  const col = new THREE.Color();
  let chipKey = "";
  const putChips = (state: RouletteState | null) => {
    const players = state?.players ?? [];
    const key = JSON.stringify(players.map((p) => [p.userId, p.bets]));
    if (key === chipKey) return;
    chipKey = key;

    let chipIndex = 0;
    for (const player of players) {
      const seat = state?.seats.find((s) => s.userId === player.userId)?.spot ?? 0;
      col.set(SEAT_COLORS[seat % SEAT_COLORS.length]!);
      for (const bet of player.bets as Bet[]) {
        const at = betSpot(bet.on);
        if (!at) continue;
        const stackHeight = Math.min(5, Math.max(1, Math.ceil(bet.stake / 25)));
        for (let level = 0; level < stackHeight && chipIndex < MAX_CHIPS; level++) {
          tmp.position.set(
            at[0] + (seat - 3.5) * 0.03,
            feltTop + 0.008 + level * 0.013,
            at[1] + (seat % 2) * 0.012,
          );
          tmp.updateMatrix();
          chipMesh.setMatrixAt(chipIndex, tmp.matrix);
          chipMesh.setColorAt(chipIndex, col);
          chipIndex++;
        }
      }
    }
    chipMesh.count = chipIndex;
    chipMesh.instanceMatrix.needsUpdate = true;
    if (chipMesh.instanceColor) chipMesh.instanceColor.needsUpdate = true;
  };

  // Animation state.
  let theta = 0;
  let labelKey = "";
  let histKey = "";
  const IDLE = 0.35;

  const drawLabel = (text: string, fill: string) => {
    const g = (numTex.image as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = "#f2efe0";
    g.beginPath();
    g.arc(32, 32, 30, 0, TAU);
    g.fill();
    g.fillStyle = fill;
    g.beginPath();
    g.arc(32, 32, 26, 0, TAU);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 30px ui-monospace, Menlo, Consolas, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 32, 34);
    numTex.needsUpdate = true;
  };

  table.show = (state, now, dt) => {
    const phase = state?.phase ?? "idle";
    const last = state?.last ?? null;
    // The server's clock, from when this state was sent.
    const server = state ? state.now + (now - state.at) : now;

    const historyKey = state ? state.history.slice(0, HISTORY_SHOWN).join(",") : "";
    if (historyKey !== histKey) {
      histKey = historyKey;
      drawHistory(state?.history ?? []);
    }
    putChips(state);

    // Wheel and ball.
    let speed = IDLE;
    let ballAngle: number | null = null;
    let drop = 0;
    const landed = last ? WHEEL.indexOf(last.pocket as (typeof WHEEL)[number]) : -1;
    if (phase === "spinning" && last && landed >= 0 && state) {
      const progress = Math.min(1, Math.max(0, 1 - (state.phaseEndsAt - server) / SPIN_MS));
      speed = IDLE + 5 * (1 - progress) ** 2;
      const eased = 1 - (1 - progress) ** 3;
      theta -= speed * dt;
      // Pocket i sits at angle a - theta in the table's xz plane; the ball closes in on it from three laps behind.
      ballAngle = (landed / pocketCount) * TAU - theta + (1 - eased) * TAU * 3;
      drop = Math.max(0, (progress - 0.7) / 0.3);
    } else {
      theta -= speed * dt;
      if (landed >= 0) {
        ballAngle = (landed / pocketCount) * TAU - theta;
        drop = 1;
      }
    }
    spin.rotation.y = theta;
    if (ballAngle === null) ballAngle = (-now / 1000) * 1.1;
    ball.rotation.y = -ballAngle;
    bead.position.x = 0.37 - 0.07 * drop;
    bead.position.y = -0.012 * drop;

    // The label over the table: the clock while bets are open, "..." while it spins, the number once it landed.
    let text = "";
    let fill = "#3a3a46";
    if (state && phase === "betting") {
      text = String(Math.max(0, Math.ceil((state.phaseEndsAt - server) / 1000)));
    } else if (phase === "spinning") {
      text = "...";
    } else if (phase === "result" && last) {
      text = String(last.pocket);
      fill = POCKET[colorOf(last.pocket)];
    }
    if (text && text + fill !== labelKey) {
      labelKey = text + fill;
      drawLabel(text, fill);
    }
    numPlane.visible = text !== "";

    // Seated players.
    const taken = new Set(state?.seats.map((s) => s.spot) ?? []);
    const ready = new Set(
      (state?.players ?? [])
        .filter((p) => p.ready)
        .map((p) => state?.seats.find((s) => s.userId === p.userId)?.spot),
    );
    const pulse = 0.8 + 0.2 * Math.sin(now / 400);
    glowMat.opacity = 0.45 * pulse;
    glows.forEach((glow, i) => {
      glow.visible = taken.has(i);
      if (dots[i]) dots[i].visible = ready.has(i);
    });
  };
  return table;
}

/** A faint round mat (a stack of chips) under each spot, `at` in room tiles: flat, so it never blocks the way. */
export function rouletteMats(spots: readonly (readonly [number, number])[]): Model {
  const mats = new Model();
  for (const [x, z] of spots) {
    mats.cyl(0.34, 0.012, tint("#7a2f3a", 0.1), [x + 0.5, 0.012, z + 0.5], 0.34, 20);
    mats.cyl(0.25, 0.016, "#3a2a2f", [x + 0.5, 0.024, z + 0.5], 0.25, 20);
    for (let i = 0; i < 3; i++) {
      mats.cyl(
        0.07,
        0.025,
        [C.rug, "#f2efe0", "#2a2a33"][i]!,
        [x + 0.5, 0.03 + i * 0.026, z + 0.5],
        0.07,
        10,
      );
    }
  }
  return mats;
}
