/** 2D finishing on top of the engine's frame: bloom, rain, fog, split-tone grade, grain. */
import type { Theme } from "./city.ts";

export interface PostOpts {
  theme: Theme;
  rain?: number;
  bloom?: number;
  fog?: number;
  seed?: number;
  /** Extra stylised streaks of light (vehicle trails etc. are in the scene; this is for lens flares). */
  flares?: [number, number, string][];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function finish(src: HTMLCanvasElement, o: PostOpts): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const R = rng(o.seed ?? 5);
  const night = o.theme === "cyber";

  // Bloom: threshold-ish by contrast, blur at two radii, add back.
  const bl = o.bloom ?? (night ? 0.9 : o.theme === "dusk" ? 0.35 : 0.12);
  if (bl > 0) {
    const small = document.createElement("canvas");
    small.width = Math.round(w / 3);
    small.height = Math.round(h / 3);
    const sg = small.getContext("2d")!;
    sg.filter = night ? "brightness(0.8) contrast(2.6) saturate(1.5)" : "brightness(0.9) contrast(2.2)";
    sg.drawImage(src, 0, 0, small.width, small.height);
    sg.filter = "none";
    g.globalCompositeOperation = "lighter";
    for (const [blur, a] of [
      [w / 400, 0.55],
      [w / 140, 0.7],
      [w / 55, 0.6],
    ] as const) {
      g.filter = `blur(${blur}px)`;
      g.globalAlpha = Math.min(1, a * bl);
      g.drawImage(small, 0, 0, w, h);
    }
    g.filter = "none";
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Fog banks.
  const fog = o.fog ?? (night ? 0.55 : 0.1);
  if (fog > 0) {
    const grad = g.createLinearGradient(0, h * 0.35, 0, h);
    if (night) {
      grad.addColorStop(0, "rgba(120,40,160,0)");
      grad.addColorStop(0.6, `rgba(90,50,150,${0.18 * fog})`);
      grad.addColorStop(1, `rgba(40,150,190,${0.34 * fog})`);
    } else if (o.theme === "dusk") {
      grad.addColorStop(0, "rgba(255,170,110,0)");
      grad.addColorStop(1, `rgba(255,170,110,${0.2 * fog})`);
    } else {
      grad.addColorStop(0, "rgba(220,240,235,0)");
      grad.addColorStop(1, `rgba(220,240,235,${0.35 * fog})`);
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }

  // Split-tone grade.
  g.globalCompositeOperation = "soft-light";
  if (night) {
    const a = g.createLinearGradient(0, 0, w, h);
    a.addColorStop(0, "rgba(255,40,190,0.5)");
    a.addColorStop(0.5, "rgba(80,40,200,0.25)");
    a.addColorStop(1, "rgba(0,220,255,0.5)");
    g.fillStyle = a;
    g.fillRect(0, 0, w, h);
  } else if (o.theme === "dusk") {
    g.fillStyle = "rgba(255,150,70,0.35)";
    g.fillRect(0, 0, w, h);
  } else {
    g.fillStyle = "rgba(255,235,190,0.22)";
    g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = "source-over";

  // Rain
  const rain = o.rain ?? (night ? 1 : 0);
  if (rain > 0) {
    g.lineCap = "round";
    const n = Math.round(((w * h) / 2600) * rain);
    for (let i = 0; i < n; i++) {
      const x = R() * (w + 200);
      const y = R() * h;
      const len = (0.012 + R() * 0.03) * h;
      const a = 0.05 + R() * 0.2;
      g.strokeStyle = `rgba(190,220,255,${a})`;
      g.lineWidth = (0.6 + R() * 1.2) * (w / 1600);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - len * 0.18, y + len);
      g.stroke();
    }
  }
  // Flares
  for (const [fx, fy, c] of o.flares ?? []) {
    const rg = g.createRadialGradient(fx * w, fy * h, 0, fx * w, fy * h, w * 0.05);
    rg.addColorStop(0, c);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "lighter";
    g.fillStyle = rg;
    g.fillRect(fx * w - w * 0.05, fy * h - w * 0.05, w * 0.1, w * 0.1);
    g.globalCompositeOperation = "source-over";
  }
  // Film grain
  const grain = document.createElement("canvas");
  grain.width = grain.height = 256;
  const gg = grain.getContext("2d")!;
  const id = gg.createImageData(256, 256);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = R() * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 255;
  }
  gg.putImageData(id, 0, 0);
  g.globalAlpha = 0.045;
  g.globalCompositeOperation = "overlay";
  g.fillStyle = g.createPattern(grain, "repeat")!;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  return out;
}
