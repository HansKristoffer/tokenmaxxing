/** The town's places, reimagined as skyline landmarks and hung off the generated volumes. */
import * as THREE from "three";
import { glow, Model, seeded } from "../kit.ts";
import { arcadeBuilding, bush, grandFountain, hotDogCart, loungeSofa, parkBench, picnic, stool, tree } from "../props.ts";
import { companyHouse, tavernBuilding } from "../town3d-houses.ts";
import { Batch } from "./batch.ts";
import { C, FL, type Vol } from "./city.ts";
import type { World } from "./scene.ts";
import { onWall, pixels, sign } from "./signs.ts";


export interface Landmarks {
  /** Where the plaza sits (world), and its surface height. */
  plaza: { x: number; z: number; y: number };
  /** Handy anchors for cameras and characters. */
  anchors: Record<string, [number, number, number]>;
}

export function addLandmarks(world: World): Landmarks {
  const { city, plan, theme } = world;
  const cyber = theme === "cyber";
  const g = world.content;
  const m = plan.marks;
  const rnd = seeded(99);
  const anchors: Landmarks["anchors"] = {};
  const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, s = 1): T => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    o.scale.setScalar(s);
    g.add(o);
    return o;
  };
  const faceZ = (v: Vol) => city.cz(v.j1) + C / 2;
  const sg = (t: string, w: number, h: number, fg: string, extra: Partial<Parameters<typeof sign>[3]> = {}) => sign(t, w, h, { fg, theme, ...extra });

  // ——— The Tavern Square: ground plaza with the Tavern, fountain, trees, benches ———
  const pb = plan.blocks.find((b) => plan.plaza.some((p) => p.i0 === b.i0 && p.j0 === b.j0))!;
  const px0 = city.cx(pb.i0) - C / 2;
  const pz0 = city.cz(pb.j0) - C / 2;
  const pcx = px0 + (4 * C) / 2;
  const pcz = pz0 + (4 * C) / 2;
  const plaza = { x: pcx, z: pcz, y: 0.06 };
  const tav = add(tavernBuilding(), pcx - 0.4, 0.06, pz0 + 5.2, 0, 1.45);
  tav.name = "tavern";
  anchors.tavern = [pcx - 0.4, 2.5, pz0 + 5.2];
  add(grandFountain(), pcx + 3.4, 0.06, pcz + 3.4, 0, 0.8);
  const lamps = new Batch();
  // lamp posts around the square in neon-ish steel
  for (const [lx, lz] of [[px0 + 0.5, pz0 + 0.5], [px0 + 11.5, pz0 + 0.5], [px0 + 0.5, pz0 + 11.5], [px0 + 11.5, pz0 + 11.5], [pcx, pz0 + 6.5]] as const) {
    lamps.box(lx, 0.06, lz, 0.1, 3.2, 0.1, "#3c4454");
    lamps.box(lx, 3.2, lz, 0.5, 0.08, 0.1, "#3c4454");
    const gl = new Batch();
    gl.jitter = 0;
    gl.box(lx, 3.0, lz, 0.4, 0.12, 0.24, cyber ? "#ffd9a0" : "#fff2c0", cyber ? 2.2 : 1);
    g.add(gl.build({ glow: true }));
  }
  g.add(lamps.build());
  for (const [tx, tz, kind] of [
    [px0 + 0.8, pz0 + 9.6, "oak"],
    [px0 + 11.3, pz0 + 9.0, "pink"],
    [px0 + 0.7, pz0 + 3.6, "round"],
    [px0 + 11.4, pz0 + 3.4, "orange"],
  ] as const)
    add(tree(kind, Math.floor(tx * 7 + tz), 1.2), tx, 0.06, tz);
  add(parkBench("#9b7fe0"), pcx - 3.6, 0.06, pcz + 4.6, 0);
  add(parkBench("#e08f7f"), pcx + 5.2, 0.06, pcz + 1.4, -Math.PI / 2);
  add(hotDogCart(), px0 + 10.2, 0.06, pz0 + 5.4, -Math.PI / 2 + 0.3, 1.1);
  for (let k = 0; k < 3; k++) {
    add(picnic(["#e2443a", "#4f8fe0", "#f0b43a"][k]!), pcx - 4.4 + k * 2.0, 0.06, pcz + 3.6 - (k % 2) * 0.9, k * 0.4, 1.2);
    add(stool(), pcx - 4.2 + k * 1.9 + 1.2, 0.06, pcz + 1.0, 0);
  }
  for (const b of [[px0 + 3.5, pz0 + 10.8], [px0 + 8.6, pz0 + 11.0]] as const) add(bush(Math.floor(b[0] * 3), "#4fb04a"), b[0], 0.06, b[1], 0, 1.4);
  // ——— the Tavern Tower: mug on the roof, vertical neon, barrels on terraces ———
  const tt = m.tavern!;
  const topY = tt.f1 * FL;
  const tx = city.cx(tt.i0);
  const tz = city.cz(tt.j0);
  const mug = new Batch();
  mug.jitter = 0.02;
  mug.box(tx, topY + 0.2, tz, 2.0, 2.4, 2.0, cyber ? "#e8a022" : "#f2b43a");
  mug.box(tx, topY + 2.4, tz, 2.1, 0.5, 2.1, "#fff7e6");
  mug.box(tx - 0.6, topY + 2.9, tz + 0.2, 0.9, 0.4, 0.9, "#fff7e6");
  mug.box(tx + 0.5, topY + 2.9, tz - 0.3, 1.0, 0.5, 1.0, "#ffffff");
  mug.box(tx + 1.3, topY + 0.8, tz, 0.5, 1.2, 0.3, "#d9962a");
  mug.box(tx + 1.7, topY + 0.8, tz, 0.3, 0.3, 0.3, "#d9962a");
  mug.box(tx + 1.7, topY + 1.8, tz, 0.3, 0.3, 0.3, "#d9962a");
  mug.box(tx + 1.6, topY + 0.8, tz, 0.3, 1.3, 0.3, "#d9962a");
  g.add(mug.build());
  if (cyber) {
    const mg = new Batch();
    mg.jitter = 0;
    mg.box(tx, topY + 0.6, tz + 1.02, 1.6, 0.12, 0.02, "#ffd27a", 2);
    mg.box(tx, topY + 1.4, tz + 1.02, 1.6, 0.12, 0.02, "#ffd27a", 2);
    g.add(mg.build({ glow: true }));
  }
  // vertical sign on the plaza-facing corner of the tower
  const vsign = sg("TAVERN", 1.5, 6.5, cyber ? "#ffb347" : "#ffe28a", { alt: "#ff7a3d" });
  const vtex = vsign;
  onWall(g, vtex, city.cx(tt.i0) - C / 2 - 0.2, 5 * FL, city.cz(tt.j1 + 1) - C / 2 + 1.0, 0, 1);
  // big hanging TAVERN board on the lowest deck
  const board = sg("THE TAVERN", 5.2, 1.0, cyber ? "#ffb347" : "#ffe28a", { alt: "#ff3d9a" });
  onWall(g, board, city.cx(tt.i0) + 1.2, 3.1 * FL + 0.2, city.cz(m.tavern!.j0 + 0) + C / 2 + 1.5, 0, 1);

  // ——— HQ ziggurat: company houses by tier ———
  const hq0 = m.hq0!;
  const hq1 = m.hq1!;
  const hy0 = hq0.f1 * FL + 0.24;
  const hy1 = hq1.f1 * FL + 0.24;
  const hx = (i: number) => city.cx(i);
  const hz = (j: number) => city.cz(j);
  const names = ["Basement", "Pixel Co", "Mint & Co", "Acme", "Globex", "Hooli"];
  // front row of L0 (rows j+2, j+3): tier 5 and 4
  add(companyHouse(5, names[5]!, null), (hx(hq0.i0) + hx(hq0.i0 + 1)) / 2 + 0.2, hy0, hz(hq0.j0 + 3) - 0.3, 0, 0.78);
  add(companyHouse(4, names[4]!, null), (hx(hq0.i0 + 2) + hx(hq0.i0 + 3)) / 2 + 0.2, hy0, hz(hq0.j0 + 3) - 0.3, 0, 0.78);
  // right column rows j+0..j+1: tier 3 (turned to face +x)
  add(companyHouse(3, names[3]!, null), hx(hq0.i0 + 3) + 0.0, hy0, hz(hq0.j0) + 1.5, Math.PI / 2, 0.8);
  // L1 roof: tier 2 and tier 1
  add(companyHouse(2, names[2]!, null), hx(hq1.i0 + 1) + 0.2, hy1, hz(hq1.j1) - 0.2, 0, 0.62);
  add(companyHouse(1, names[1]!, null), hx(hq1.i0 + 2) - 0.5, hy1, hz(hq1.j1) - 0.2, 0, 0.62);
  anchors.hq = [hx(hq0.i0 + 1), hy0, hz(hq0.j0 + 3)];
  const hqsign = sg("HQ", 2.2, 1.1, cyber ? "#7fe9ff" : "#fff2c0", { alt: "#ff3d9a", bg: cyber ? "#0b0716" : "#254a8a" });
  onWall(g, hqsign, hx(m.hqTop!.i0), (m.hqTop!.f0 + 1.2) * FL, hz(m.hqTop!.j1) + C / 2 + 0.1, 0, 1);

  // ——— Shops: four trades along the stack's front ———
  const sv = m.shops!;
  const trades: { name: string; colour: string; alt: string; prop: (x: number, z: number) => void }[] = [
    {
      name: "FURNITURE",
      colour: "#ffb347",
      alt: "#ff7a3d",
      prop: (x, z) => {
        add(loungeSofa(1.6), x - 0.2, 0.06, z + 0.9, 0, 0.9);
        const lamp = new Model();
        lamp.box([0.08, 1.1, 0.08], "#3c4454");
        lamp.box([0.4, 0.3, 0.4], "#ffe0a0", [0, 1.1, 0]);
        add(lamp, x + 0.9, 0.06, z + 0.8);
      },
    },
    {
      name: "CLOTHES",
      colour: "#ff6bd6",
      alt: "#7fe9ff",
      prop: (x, z) => {
        const rack = new Model();
        rack.box([1.4, 0.05, 0.05], "#cfd3da", [0, 1.1, 0]);
        for (const [dx, c] of [[-0.5, "#e8584a"], [-0.2, "#4f8fe0"], [0.1, "#f2c14e"], [0.4, "#8f5ad8"]] as const) rack.box([0.22, 0.5, 0.06], c, [dx, 0.6, 0]);
        rack.box([0.05, 1.1, 0.05], "#cfd3da", [-0.7, 0, 0]);
        rack.box([0.05, 1.1, 0.05], "#cfd3da", [0.7, 0, 0]);
        add(rack, x, 0.06, z + 0.9);
      },
    },
    {
      name: "BARBER",
      colour: "#7fe9ff",
      alt: "#ff4d6d",
      prop: (x, z) => {
        const pole = new Model();
        pole.box([0.34, 0.08, 0.34], "#cfd3da", [0, 0, 0]);
        for (let k = 0; k < 8; k++) pole.box([0.24, 0.16, 0.24], ["#e83c4a", "#ffffff", "#3c6ae8", "#ffffff"][k % 4]!, [0, 0.08 + k * 0.16, 0]);
        pole.box([0.32, 0.08, 0.32], "#cfd3da", [0, 1.36, 0]);
        add(pole, x - 0.6, 0.06, z + 0.9);
        const chair = new Model();
        chair.box([0.7, 0.3, 0.7], "#d84a4a", [0, 0, 0]);
        chair.box([0.7, 0.8, 0.14], "#d84a4a", [0, 0.3, -0.3]);
        add(chair, x + 0.5, 0.06, z + 0.9);
      },
    },
    {
      name: "PET SHOP",
      colour: "#9dff8a",
      alt: "#ff9ad8",
      prop: (x, z) => {
        const cage = new Model();
        cage.box([1.4, 0.06, 0.9], "#8c6a4a", [0, 0, 0]);
        for (const dx of [-0.65, 0.65]) for (const dz of [-0.4, 0.4]) cage.box([0.05, 0.9, 0.05], "#e8e4d8", [dx, 0, dz]);
        cage.box([1.4, 0.05, 0.9], "#e8e4d8", [0, 0.9, 0]);
        add(cage, x, 0.06, z + 0.9);
      },
    },
  ];
  trades.forEach((t, k) => {
    const x = city.cx(sv.i0 + k);
    const z = faceZ(sv);
    const awn = new Model();
    const stripe = (n: number) => (n % 2 ? "#ffffff" : t.colour);
    for (let s = 0; s < 6; s++) awn.box([0.5, 0.12, 0.9], cyber ? (s % 2 ? "#251c3a" : t.colour) : stripe(s), [(s - 2.5) * 0.5, 0, 0], 0.01).rotation.x = 0.45;
    add(awn, x, 1.28, z + 0.5);
    const sp = sg(t.name, 2.7, 0.55, t.colour, { alt: t.alt });
    onWall(g, sp, x, 1.75, z + 0.1, 0, 1);
    t.prop(x, z);
    // glowing display window
    const dw = new Batch();
    dw.jitter = 0;
    dw.box(x, 0.3, z + 0.02, 2.6, 1.0, 0.04, cyber ? t.colour : "#fff0c8", cyber ? 0.9 : 0.8);
    g.add(dw.build({ glow: true }));
  });
  // shop signs facing the plaza on the +x side
  anchors.shops = [city.cx(sv.i0 + 2), 1.5, faceZ(sv)];

  // ——— THE BASEMENT: an arcade podium ———
  const av = m.arcade!;
  const aSign = sg("BASEMENT", 5.6, 1.1, "#c89bff", { alt: "#ff3d9a", bg: "#120a24" });
  onWall(g, aSign, (city.cx(av.i0) + city.cx(av.i0 + 1)) / 2 + 0.5, 1.9, faceZ(av) + 0.08, 0, 1);
  const cabinets = new Batch();
  cabinets.jitter = 0;
  const cabGlow = new Batch();
  cabGlow.jitter = 0;
  for (let k = 0; k < 14; k++) {
    const x = city.cx(av.i0) - 1.2 + k * 0.86;
    const z = faceZ(av) + 0.45;
    const col = ["#ff3d9a", "#7fe9ff", "#ffd24a", "#8aff7a"][k % 4]!;
    cabinets.box(x, 0.06, z, 0.7, 1.3, 0.55, "#2c2145");
    cabGlow.box(x, 0.75, z + 0.29, 0.5, 0.36, 0.02, col, 1.1);
    cabinets.box(x, 0.06 + 0.5, z + 0.16, 0.6, 0.05, 0.3, "#e8e4f4");
    cabGlow.box(x - 0.14, 0.62, z + 0.33, 0.06, 0.04, 0.04, "#ff5050");
  }
  g.add(cabinets.build(), cabGlow.build({ glow: true }));
  // the pixel invader on the roof
  const inv = pixels(
    ["..x.....x..", "...x...x...", "..xxxxxxx..", ".xx.xxx.xx.", "xxxxxxxxxxx", "x.xxxxxxx.x", "x.x.....x.x", "...xx.xx..."],
    0.32,
    { x: cyber ? "#7bffb5" : "#4fd06a" },
  );
  add(inv, city.cx(av.i0 + 3) + 0.0, av.f1 * FL + 0.3, city.cz(av.j0) + 0.6, 0, 1.4);
  anchors.arcade = [city.cx(av.i0 + 1), 1.5, faceZ(av)];

  // ——— THE RAID GATE ———
  const rv = m.raid!;
  const gx = (city.cx(rv.i0 + 1) + city.cx(rv.i0 + 2)) / 2;
  const gz = city.cz(rv.j1) + C / 2;
  const gy = 16 * FL + 0.24; // the forecourt on the dark podium
  const gate = new Batch();
  gate.jitter = 0.03;
  const stone = cyber ? "#2a2733" : "#5c5666";
  gate.box(gx - 2.7, gy, gz + 0.4, 1.0, 7.4, 1.0, stone);
  gate.box(gx + 2.7, gy, gz + 0.4, 1.0, 7.4, 1.0, stone);
  gate.box(gx, gy + 6.4, gz + 0.4, 6.4, 1.2, 1.0, stone);
  gate.box(gx, gy + 7.6, gz + 0.4, 1.6, 0.8, 1.0, "#463e52");
  gate.box(gx - 2.7, gy + 7.4, gz + 0.4, 1.3, 0.4, 1.3, "#463e52");
  gate.box(gx + 2.7, gy + 7.4, gz + 0.4, 1.3, 0.4, 1.3, "#463e52");
  g.add(gate.build());
  const portal = new Model();
  const ptex = document.createElement("canvas");
  ptex.width = 256;
  ptex.height = 400;
  const pg = ptex.getContext("2d")!;
  const gr = pg.createRadialGradient(128, 220, 10, 128, 220, 200);
  gr.addColorStop(0, "#ffffff");
  gr.addColorStop(0.2, "#e08bff");
  gr.addColorStop(0.55, "#7a2bd8");
  gr.addColorStop(1, "#1a0a3a");
  pg.fillStyle = gr;
  pg.fillRect(0, 0, 256, 400);
  pg.strokeStyle = "rgba(255,255,255,0.5)";
  pg.lineWidth = 5;
  for (let r = 24; r < 200; r += 30) {
    pg.beginPath();
    pg.ellipse(128, 220, r, r * 1.5, 0.3 * r * 0.02, 0.5, 5.4);
    pg.stroke();
  }
  const tex = new THREE.CanvasTexture(ptex);
  tex.colorSpace = THREE.SRGBColorSpace;
  portal.plane(4.4, 6.4, glow("#fff", tex), [0, 3.2, 0]);
  add(portal, gx, gy, gz + 0.5);
  const raidSign = sg("RAID", 3.6, 1.1, "#ff4d5a", { alt: "#ff9a3d", bg: "#12060a" });
  onWall(g, raidSign, gx, gy + 8.1, gz + 0.95, 0, 1);
  for (const sx of [-1, 1]) {
    const torch = new Batch();
    torch.jitter = 0;
    torch.box(gx + sx * 3.7, gy, gz + 0.9, 0.2, 2.2, 0.2, "#4a3a2c");
    g.add(torch.build());
    const fl = new Batch();
    fl.jitter = 0;
    fl.box(gx + sx * 3.7, gy + 2.2, gz + 0.9, 0.5, 0.7, 0.5, "#ff7a1a", 1.6);
    fl.box(gx + sx * 3.7, gy + 2.7, gz + 0.9, 0.3, 0.5, 0.3, "#ffd24a", 1.8);
    g.add(fl.build({ glow: true }));
  }
  anchors.raid = [gx, gy + 3, gz + 1.5];
  void rnd;
  void arcadeBuilding;
  return { plaza, anchors };
}
