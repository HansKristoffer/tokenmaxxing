import * as THREE from "three";
import { Pipeline } from "../pipeline.ts";
import { setPropsNight } from "../props.ts";
import { setTavernNight } from "../tavern3d.ts";
import { type Crowd, crowdAt, populate } from "./chars.ts";
import type { Theme } from "./city.ts";
import { logDims } from "./dims.ts";
import type { Landmarks } from "./landmarks.ts";
import { addLandmarks } from "./landmarks.ts";
import { clouds, cyberPass, farSkyline, streetDress } from "./neon.ts";
import { finish, type PostOpts } from "./post.ts";
import { addWet, aim, type Cam, makeWorld, type World } from "./scene.ts";

interface Shot {
  theme: Theme;
  cam: Cam | ((w: World, lm: Landmarks) => Cam);
  wet?: boolean;
  people?: number;
  pets?: number;
  post?: Partial<PostOpts>;
  lights?: (world: World, lm: Landmarks) => void;
  extra?: (world: World, lm: Landmarks, crowd: Crowd) => void;
}

const SHOTS: Record<string, Shot> = {
  "1-day": { theme: "day", cam: { az: 40, el: 30, target: [22, 28, 22], view: 132 }, people: 160, pets: 30 },
  "2-golden": {
    theme: "dusk",
    cam: { az: 40, el: 30, target: [22, 28, 22], view: 132 },
    people: 160,
    pets: 30,
  },
  "4-street": {
    theme: "cyber",
    cam: (_w, lm) => ({ az: 16, el: 9, target: [lm.plaza.x - 3, 2.9, lm.plaza.z - 1], view: 13.5 }),
    post: { bloom: 0.22 },
    wet: true,
    people: 30,
    pets: 8,
    lights: (w, lm) => streetDress(w, lm.plaza.x, lm.plaza.z),
    extra: (w, lm) => {
      crowdAt(w, lm.plaza.x - 1, lm.plaza.z + 2, 0.06, 14, 4.5, 3.2, 21, 4);
      crowdAt(w, lm.plaza.x - 11, lm.plaza.z + 5.6, 0.06, 7, 3, 0.8, 22, 2);
    },
  },
  "5-terrace": {
    theme: "day",
    cam: (_w, lm) => ({
      az: 30,
      el: 22,
      target: [lm.anchors.hq![0], lm.anchors.hq![1] + 2.5, lm.anchors.hq![2] - 1],
      view: 12.5,
    }),
    people: 30,
    pets: 10,
    extra: (w, lm) => {
      const [hx, hy, hz] = lm.anchors.hq!;
      crowdAt(w, hx, hz + 1.4, hy, 9, 5.2, 0.7, 31, 4);
      crowdAt(w, hx + 5, hz - 3, hy, 4, 1, 2.5, 32, 2);
    },
  },
  "3-cyber-wide": {
    theme: "cyber",
    cam: { az: 40, el: 30, target: [22, 28, 22], view: 132 },
    people: 100,
    pets: 20,
  },
};

const q = new URLSearchParams(location.search);
const shotName = q.get("shot");
const shot: Shot = (shotName && SHOTS[shotName]) || {
  theme: (q.get("theme") ?? "day") as Theme,
  cam: {
    az: Number(q.get("az") ?? 40),
    el: Number(q.get("el") ?? 30),
    target: [Number(q.get("tx") ?? 20), Number(q.get("ty") ?? 22), Number(q.get("tz") ?? 20)],
    view: Number(q.get("view") ?? 110),
  },
  people: Number(q.get("people") ?? 60),
  pets: 12,
};
const W = Number(q.get("w") ?? 2560);
const H = Number(q.get("h") ?? 1440);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
if (q.get("dims")) logDims();

const pipe = new Pipeline(canvas, { preserve: true });
pipe.style = "voxel";
pipe.pixelSize = 1;
pipe.autoQuality = false;
pipe.quality = 2;

const t0 = performance.now();
const night = shot.theme === "cyber";
setPropsNight(night);
setTavernNight(night);
const world = makeWorld(shot.theme);
const lm = addLandmarks(world);
farSkyline(world, night ? 60 : 50);
if (shot.theme !== "cyber") clouds(world, shot.theme === "dusk" ? "#ffd9c0" : "#ffffff", 8);
if (night) cyberPass(world);
const crowd = populate(world, shot.people ?? 60, shot.pets ?? 12, [], 3);
shot.lights?.(world, lm);
shot.extra?.(world, lm, crowd);
addWet(world, night ? 0.6 : 0.5, shot.wet ? 0.74 : 0);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 500);
const cam = typeof shot.cam === "function" ? shot.cam(world, lm) : shot.cam;
if (q.get("view")) cam.view = Number(q.get("view"));
aim(camera, cam, W / H);
pipe.gradient = true;
pipe.night = night ? 1 : 0;
pipe.skyTop.set(world.look.skyTop);
pipe.skyHor.set(world.look.skyHor);
pipe.hazeColor.set(world.look.haze);
pipe.render(world.scene, camera, W, H);
const post = finish(canvas, { theme: shot.theme, ...(shot.post ?? {}) });
post.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px`;
document.body.append(post);
canvas.style.visibility = "hidden";
(window as unknown as { out: HTMLCanvasElement }).out = post;
document.title = `done ${Math.round(performance.now() - t0)}ms ${world.city.lit.count} boxes`;
(window as unknown as { ready: boolean }).ready = true;
