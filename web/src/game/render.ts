import { compact } from "@tokenmaxxing/core/format.ts";
import { BLOCK_W } from "@tokenmaxxing/core/maps.ts";
import { petOutfit } from "@tokenmaxxing/core/pets.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import {
  companyOfRoom,
  cupsLeft,
  houseTier,
  JUMP_MS,
  ownerOfOffice,
  TILE,
} from "@tokenmaxxing/core/world.ts";
import { house, inn } from "../art/buildings.ts";
import { characterFrame, itemFrame, lookPalette, poseFor, sleeperFrame } from "../art/characters.ts";
import { type FancyPiece, fancyFrame, fancySprite, neonSprite } from "../art/furniture-fancy.ts";
import { drawSparkle, wearsLegendary } from "../art/loot.ts";
import { coloursOf } from "../art/merch.ts";
import { chairBack, objectAt, petBedFront, sortY } from "../art/objects.ts";
import { C } from "../art/palette.ts";
import { SLEEP_H, SLEEP_W, sleepingFrame } from "../art/pet-sleep.ts";
import { PET_H, PET_W, petFrame } from "../art/pets.ts";
import { hash, initialsOf } from "../art/pixels.ts";
import { drawWaterGlints } from "../art/tiles.ts";
import { hud } from "../store.ts";
import { camera, zoomScale } from "./camera.ts";
import { drawChalkboards } from "./chalkboard.ts";
import { drawCop, isCop } from "./cop.ts";
import { doorSwing, drawDoorSwing } from "./doors.ts";
import { drawGames } from "./games.ts";
import { buildings, companyOnPlot, drawFace, drawLogo, peekHits } from "./houses.ts";
import { avatarLabels, chipHits, chips, petLabel, sign, signHits } from "./labels.ts";
import { drawAura, drawPetCrown, labelLift } from "./legendary.ts";
import { drawLoot } from "./loot.ts";
import { drawMerchant } from "./merchant.ts";
import { followPet, prunePets } from "./pets.ts";
import { drawPicnic } from "./picnic.ts";
import { type Lap, racing } from "./race.ts";
import { drawRaid } from "./raid.ts";
import { drawLampGlow, drawLight, drawNightSky, drawSway, drawWeather, drawWindowGlow } from "./sky.ts";
import { snowAmount, snowLayers } from "./snow.ts";
import { drawStreet } from "./street.ts";
import { drawTrophies } from "./trophies.ts";
import { type Avatar, drawPos, stepping, WARP_MS, world } from "./world.ts";

let lastFrame = performance.now();

type Draw = { y: number; draw: () => void };

type Label = () => void;

/** Tiles within which other players' pet names show. */
const NAME_RANGE = 6;

export function render(canvas: HTMLCanvasElement, now: number): void {
  const g = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const scale = zoomScale(dpr, w, h, now);
  const map = world.map;
  const viewW = w / scale;
  const viewH = h / scale;
  const me = world.avatars.get(world.selfId);
  const focus = me ? drawPos(me, now) : { x: map.x0 + map.width / 2, y: map.y0 + map.height / 2 };
  const clampCam = (center: number, view: number, start: number, size: number) =>
    start +
    (size <= view ? (size - view) / 2 : Math.min(Math.max(center - start - view / 2, 0), size - view));
  const camX =
    Math.round(clampCam((focus.x + 0.5) * TILE, viewW, map.x0 * TILE, map.width * TILE) * scale) / scale;
  const camY =
    Math.round(clampCam((focus.y + 0.5) * TILE, viewH, map.y0 * TILE, map.height * TILE) * scale) / scale;
  Object.assign(camera, { x: camX, y: camY, scale, dpr });

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = map.id === "town" ? C.leafInk : map.id === "dungeon" ? "#110f16" : "#1b1f2a";
  g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
  // Snow (town only): twins of the baked ground and sprites, cross-faded while it settles or melts.
  const outdoors = map.id === "town";
  const snow = outdoors ? snowAmount(now) : 0;
  const layers = (c: HTMLCanvasElement, ground = false) => snowLayers(c, snow, ground);
  if (world.ground)
    for (const [c, a] of layers(world.ground, true)) {
      g.globalAlpha = a;
      g.drawImage(c, map.x0 * TILE, map.y0 * TILE);
      g.globalAlpha = 1;
    }
  if (snow < 0.7) drawWaterGlints(g, map, now);

  const x0 = Math.max(map.x0, Math.floor(camX / TILE) - 1);
  const y0 = Math.max(map.y0, Math.floor(camY / TILE) - 1);
  const x1 = Math.min(map.x0 + map.width, Math.ceil((camX + viewW) / TILE) + 1);
  const y1 = Math.min(map.y0 + map.height, Math.ceil((camY + viewH) / TILE) + 3);
  const items: Draw[] = [];
  peekHits.length = 0;
  chipHits.length = 0;
  signHits.length = 0;
  const labels: Label[] = [];
  // Outdoors only: lamps and lit windows to shine over the night's tint (see `sky.ts`).
  const lamps: [number, number][] = [];
  const windows: ((glow: number) => void)[] = [];
  const toScreen = (px: number, py: number) => [(px - camX) * scale, (py - camY) * scale] as const;

  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const o = objectAt(map, x, y);
      const ch = map.at(x, y);
      if (o) {
        if (outdoors && ch === "L") lamps.push([x * TILE + TILE / 2, y * TILE - 11]);
        items.push({
          y: y * TILE + sortY(ch),
          draw: () => {
            // The company building's pieces are indoors, out of the snow.
            if (o.fancy) {
              g.drawImage(fancyCanvas(o.fancy, now), x * TILE + o.dx, y * TILE + o.dy);
              return;
            }
            for (const [c, a] of layers(o.canvas)) {
              g.globalAlpha = a;
              if (outdoors && (ch === "T" || ch === "^"))
                drawSway(g, c, ch, x * TILE + o.dx, y * TILE + o.dy, now);
              else g.drawImage(c, x * TILE + o.dx, y * TILE + o.dy);
            }
            g.globalAlpha = 1;
          },
        });
      }
      // The pet bed's near wall goes over whatever lies in it.
      if (ch === "Q") {
        const near = petBedFront();
        items.push({
          y: y * TILE + TILE - 1,
          draw: () => g.drawImage(near.canvas, x * TILE + near.dx, y * TILE + near.dy),
        });
      }
    }

  drawTrophies(map, g, items);

  for (const b of buildings(map)) {
    const company = b.plot === null ? null : companyOnPlot(b.plot);
    if (b.plot !== null && !company) continue; // the town catches up with a company closing
    const plan = company ? house(houseTier(company.tokens30d, company.members), company.brand) : null;
    const sprite = plan?.canvas ?? inn();
    const left = b.x * TILE;
    const bottom = (b.y + b.h) * TILE;
    const top = bottom - sprite.height;
    const inside = company ? (world.houses[company.id] ?? []) : [];
    const panes = plan?.panes ?? [];
    const plaque = plan?.plaque;
    const logo = company?.brand?.logo;
    const faces = inside.slice(0, panes.length);
    // A cellar hatch (tier 0) is already open; every other building's door swings.
    const swing =
      !company || houseTier(company.tokens30d, company.members) > 0
        ? doorSwing(b.x + 3, b.y + b.h - 1, now)
        : 0;
    for (const [i, p] of faces.entries()) {
      const pane = panes[i]!;
      peekHits.push({ x: left + pane.x, y: top + pane.y, w: pane.w, h: pane.h, id: p.id });
    }
    // At night each window shines: the people at home in it, or (for some empty rooms) just a lamp.
    if (outdoors)
      for (const [i, pane] of panes.entries()) {
        const p = faces[i];
        if (p ? p.state === "away" : hash(b.x * 31 + i, b.y, 11) > 0.3) continue;
        windows.push((glow) => {
          if (p) drawFace(g, p, left + pane.x, top + pane.y, pane, now);
          drawWindowGlow(g, left + pane.x, top + pane.y, pane.w, pane.h, glow);
        });
      }
    items.push({
      y: bottom - 1,
      draw: () => {
        for (const [c, a] of layers(sprite)) {
          g.globalAlpha = a;
          g.drawImage(c, left, top);
        }
        g.globalAlpha = 1;
        drawDoorSwing(g, sprite, left, top, swing);
        if (logo && plaque) drawLogo(g, logo, left + plaque.x, top + plaque.y, plaque.w, plaque.h);
        for (const [i, p] of faces.entries())
          drawFace(g, p, left + panes[i]!.x, top + panes[i]!.y, panes[i]!, now);
      },
    });
    const [sx, sy] = toScreen(left + (b.w * TILE) / 2, bottom - sprite.height);
    const text = company ? `🏢 ${company.name} · ${compact(company.todayTokens)} today` : "🛏 The Inn";
    labels.push(() => {
      const y = sy - 6 * dpr;
      const { w, h } = sign(g, sx, y, text, dpr, company !== null, (BLOCK_W - 0.5) * TILE * scale);
      if (company) signHits.push({ x: sx - w / 2, y: y - h, w, h, id: company.id });
    });
    if (inside.length) labels.push(() => chips(g, sx, sy + 4 * dpr, inside, dpr));
  }

  // Office doors: the owner's name over each, 🔒 when it's closed; yours stands out.
  for (const d of world.doors) {
    const [sx, sy] = toScreen((d.x + 0.5) * TILE, d.y * TILE);
    const text = `${d.open ? "" : "🔒 "}${d.name}`;
    labels.push(() => sign(g, sx, sy, text, dpr, d.userId === world.selfId, 1.9 * TILE * scale));
  }

  // Drops: furniture is in the map; a pet or a wearable lies there as itself.
  for (const d of world.drops) {
    const kind = itemById(d.item);
    if (!kind || kind.slot === "furniture") continue;
    const sprite = kind.slot === "pet" ? petFrame(kind.index, false, false) : itemFrame(kind);
    if (sprite)
      items.push({
        y: d.y * TILE + TILE / 2,
        draw: () =>
          g.drawImage(sprite, d.x * TILE + (TILE - sprite.width) / 2, (d.y + 1) * TILE - sprite.height - 1),
      });
  }

  drawGames(g, items, labels, toScreen, now, dpr);
  drawStreet(g, items, labels, toScreen, now, dpr);
  drawPicnic(g, items);
  drawChalkboards(g, items, labels, toScreen, now, dpr);
  drawMerchant(g, items, labels, toScreen, now, dpr);
  drawRaid(g, items, labels, toScreen, now, dpr);
  drawLoot(g, items, labels, toScreen, now, dpr);

  if (world.asleep > 0) {
    const [sx, sy] = toScreen((map.x0 + map.width / 2) * TILE, (map.y0 + 2) * TILE);
    labels.push(() => sign(g, sx, sy - 2 * dpr, `💤 ${world.asleep} asleep`, dpr, false));
  }

  const dt = Math.min(100, now - lastFrame);
  lastFrame = now;
  prunePets();
  for (const a of [...world.avatars.values(), ...world.leaving]) {
    // A Sprint Race's racers run laps of the square instead of standing at the table.
    const lap = racing(a.info.id, now);
    const pos = lap ?? drawPos(a, now);
    const px = pos.x * TILE;
    const py = pos.y * TILE;
    const tile = lap ? ":" : map.at(a.x, a.y);
    items.push({
      y: py + (tile === "b" || tile === "s" ? 1 : TILE - 0.5),
      draw: () => drawAvatar(g, a, px, py, tile, now, lap),
    });
    // A legendary sparkles on whoever wears it.
    if (wearsLegendary(a.info.look))
      items.push({ y: py + TILE, draw: () => drawSparkle(g, px, py - 2, now, a.info.id) });
    // In their own office the pet goes to its bed and sleeps there, whoever's looking.
    const bed = ownerOfOffice(world.room) === a.info.id ? map.find("Q")[0] : undefined;
    const pet = a.warp ? null : followPet(a, px, py, dt, bed);
    if (pet) {
      const hop = pet.moving && Math.floor(now / 140) % 2 === 0;
      const worn = a.info.look;
      const bare = petFrame(worn.pet, pet.left, hop, worn.petVariant, petOutfit(worn));
      // In bed it curls up without its gear.
      const asleep = pet.asleep ? sleepingFrame(bare, pet.left, Math.floor(now / 600)) : null;
      const frame =
        asleep ??
        (worn.petwear
          ? petFrame(worn.pet, pet.left, hop, worn.petVariant, petOutfit(worn), worn.petwear)
          : bare);
      if (frame)
        items.push({
          y: pet.y + PET_H,
          draw: () => {
            if (asleep) {
              g.drawImage(
                asleep,
                Math.round(pet.x) - (SLEEP_W - 12) / 2,
                Math.round(pet.y) + PET_H - SLEEP_H,
              );
              return;
            }
            g.drawImage(frame, Math.round(pet.x), Math.round(pet.y) + PET_H - frame.height);
            drawPetCrown(g, a, Math.round(pet.x), Math.round(pet.y), pet.left, hop);
          },
        });
    }
    // A pet's name shows for mine and for those within a few tiles of me.
    const petName = a.info.look.petName;
    if (pet && petName && (!me || Math.hypot(a.x - me.x, a.y - me.y) <= NAME_RANGE))
      labels.push(() => petLabel(g, ...toScreen(pet.x + PET_W / 2, pet.y + PET_H + 1), petName, dpr));
    labels.push(() => avatarLabels(g, a, ...toScreen(px + TILE / 2, py - labelLift(a)), tile, now, dpr));
  }

  items.sort((a, b) => a.y - b.y);
  for (const i of items) i.draw();

  // The sky: the sun's tint over the town, lights shining through it, then the weather. Labels
  // (and the HTML HUD) come after, so they stay readable.
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (outdoors) {
    const glow = drawLight(g, w, h, now);
    if (glow > 0.05) {
      g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
      for (const [lx, ly] of lamps) drawLampGlow(g, lx, ly, glow);
      for (const lit of windows) lit(glow);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    drawNightSky(g, w, h, dpr, now);
    drawWeather(g, w, h, dpr, now);
  }
  for (const l of labels) l();
}

/**
 * Company furniture as it is right now: its frame, and the neon sign with the company's own name
 * (its initials when the name won't fit) in its colours.
 */
function fancyCanvas(piece: FancyPiece, now: number): HTMLCanvasElement {
  const frame = fancyFrame(piece, now);
  const id = companyOfRoom(world.room);
  const company = id === null ? undefined : hud.get().companies.find((c) => c.id === id);
  if (piece.id !== "neon-sign" || !company) return fancySprite(piece.id, frame);
  const word = company.name
    .toUpperCase()
    .replace(/[^A-Z0-9&! ]/g, "")
    .trim();
  const text = word.length > 0 && word.length <= 7 ? word : initialsOf(company.name);
  return neonSprite(text, frame, coloursOf(company.id).glow);
}

function drawAvatar(
  g: CanvasRenderingContext2D,
  a: Avatar,
  px: number,
  py: number,
  tile: string,
  now: number,
  lap: Lap | null,
): void {
  const look = a.info.look;
  // Coffee: a random nudge every frame, a pixel per cup still in their system.
  const shake = Math.min(4, cupsLeft(a.info.coffeeUntil, Date.now()));
  if (shake > 0) {
    px += Math.round((Math.random() * 2 - 1) * shake);
    py += Math.round((Math.random() * 2 - 1) * shake * 0.5);
  }
  if (a.warp) {
    const t = Math.min(1, (now - a.warp.at) / WARP_MS);
    g.globalAlpha = a.warp.out ? 1 - t : t;
  }
  const lying = a.state === "away" || (a.state === "sit" && tile === "b");
  if (lying) {
    if (tile !== "b") {
      // A sleeping bag on the floor.
      g.fillStyle = C.ink;
      g.fillRect(px + 2, py + 1, 12, 15);
      g.fillStyle = C.fabricDark;
      g.fillRect(px + 3, py + 2, 10, 13);
    }
    g.drawImage(sleeperFrame(look), px, py + 1);
    const pal = lookPalette(look);
    g.fillStyle = pal.c!;
    g.fillRect(px + 3, py + 8, 10, 7);
    g.fillStyle = pal.C!;
    g.fillRect(px + 3, py + 8, 10, 1);
  } else if (a.state === "working" || (a.state === "sit" && tile === "c")) {
    const typing = a.state === "working" && Math.floor(now / 180) % 2 === 0 ? 1 : 0;
    drawAura(g, a, px, py - 6 + typing, now);
    g.drawImage(characterFrame(look, "up", "sit"), px, py - 6 + typing);
    g.drawImage(chairBack(), px, py);
  } else if (a.state === "sit") {
    drawAura(g, a, px, py - 5, now);
    g.drawImage(characterFrame(look, a.facing === "up" ? "up" : "down", "sit"), px, py - 5);
  } else {
    const walking = lap ? lap.running : stepping(a, now);
    const facing = lap?.facing ?? a.facing;
    const pose = poseFor(a.state, walking, now);
    // A hop: up and down on an arc, the shadow shrinking while they're in the air.
    const t = a.jump === null ? 1 : (now - a.jump) / JUMP_MS;
    const lift = t < 1 ? Math.round(Math.sin(t * Math.PI) * 7) : 0;
    const shrink = lift > 3 ? 1 : 0;
    g.fillStyle = C.shadow;
    g.fillRect(px + 4 + shrink, py + 14, 8 - 2 * shrink, 2);
    drawAura(g, a, px, py - 2 - lift, now);
    const top = py - 2 - lift - (pose === "walkA" ? 1 : 0);
    if (isCop(a)) drawCop(g, a, pose, px, top, py, now);
    else g.drawImage(characterFrame(look, facing, pose), px, top);
  }
  g.globalAlpha = 1;
}
