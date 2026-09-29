/**
 * Games in the world: tables (and arenas) in the town square with a banner or a
 * live scoreboard over them, and a 🎮 sign over the host of every open table.
 * Clicking a banner watches the game; clicking a sign opens the arcade.
 */
import { clock, compact } from "@tokenmaxxing/core/format.ts";
import { propTiles } from "@tokenmaxxing/core/games/gather.ts";
import { GAMES } from "@tokenmaxxing/core/games/index.ts";
import { TILE, type WorldGame } from "@tokenmaxxing/core/world.ts";
import { C } from "../art/palette.ts";
import { arenaDesk, gameTable } from "../art/tables.ts";
import { openMatch } from "../net.ts";
import { hud } from "../store.ts";
import { bubble, FONT, pill } from "./labels.ts";
import { drawPos, world } from "./world.ts";

/** Banners and signs this frame, in canvas (device) pixels. */
export const gameHits: { x: number; y: number; w: number; h: number; open: () => void }[] = [];

type Draw = { y: number; draw: () => void };
type ToScreen = (px: number, py: number) => readonly [number, number];

export function drawGames(
  g: CanvasRenderingContext2D,
  items: Draw[],
  labels: (() => void)[],
  toScreen: ToScreen,
  now: number,
  dpr: number,
): void {
  gameHits.length = 0;
  const serverNow = Date.now() - hud.get().clockSkew;
  if (world.room === "town")
    for (const game of world.games.values()) {
      if (game.spot.kind === "table") drawTable(g, game, items, labels, toScreen, serverNow, now, dpr);
      else drawArena(g, game, items, labels, toScreen, serverNow, now, dpr);
    }
  drawSigns(g, labels, toScreen, now, dpr);
}

function banner(game: WorldGame, serverNow: number): string {
  const def = GAMES[game.game]!;
  const info = hud.get().lobby?.matches.find((m) => m.id === game.id);
  return [
    `${def.emoji} ${def.name}`,
    game.headline,
    game.endsAt ? `${clock(game.endsAt - serverNow)} left` : null,
    info && info.pot > 0 ? `🪙 ${info.pot}` : null,
    game.watchers > 0 ? `👀 ${game.watchers}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function drawTable(
  g: CanvasRenderingContext2D,
  game: WorldGame,
  items: Draw[],
  labels: (() => void)[],
  toScreen: ToScreen,
  serverNow: number,
  now: number,
  dpr: number,
): void {
  const [[tx, ty]] = propTiles(game.spot) as [[number, number]];
  items.push({ y: (ty + 1) * TILE - 2, draw: () => g.drawImage(gameTable(game.game), tx * TILE, ty * TILE) });
  const [sx, sy] = toScreen((game.spot.x + game.spot.w / 2) * TILE, game.spot.y * TILE);
  labels.push(() => {
    const y = sy - 24 * dpr;
    const h = pill(g, sx, y, banner(game, serverNow), dpr, "rgba(233, 183, 61, 0.95)", C.ink);
    hitPill(g, sx, y, h, banner(game, serverNow), dpr, () => openMatch(game.id));
    const said = world.tableBubbles.get(game.id);
    if (said && now < said.until) bubble(g, sx, y - h - 2 * dpr, said.text, dpr, said.until - now);
  });
}

/** Tokenmaxxing's arena: a desk per player and a live scoreboard above them. */
function drawArena(
  g: CanvasRenderingContext2D,
  game: WorldGame,
  items: Draw[],
  labels: (() => void)[],
  toScreen: ToScreen,
  serverNow: number,
  now: number,
  dpr: number,
): void {
  const rows = game.board ?? [];
  const rank = new Map(rows.map((r, i) => [r.player, i]));
  for (const [i, seat] of game.seats.entries()) {
    const player = game.players[i]!;
    // The leader's screen blazes; the rest flicker, faster the higher they rank.
    const place = rank.get(player) ?? rows.length;
    const speed = 120 + place * 90;
    const glow = place === 0 ? 3 : Math.floor(now / speed) % 2 === 0 ? 2 : 1;
    items.push({
      y: (seat.y - 1) * TILE + TILE - 1,
      draw: () => g.drawImage(arenaDesk(glow), seat.x * TILE, (seat.y - 1) * TILE),
    });
  }
  const [sx, sy] = toScreen((game.spot.x + game.spot.w / 2) * TILE, game.spot.y * TILE);
  labels.push(() => scoreboard(g, game, sx, sy - 10 * dpr, serverNow, dpr));
}

function scoreboard(
  g: CanvasRenderingContext2D,
  game: WorldGame,
  cx: number,
  bottom: number,
  serverNow: number,
  dpr: number,
): void {
  const rows = game.board ?? [];
  const title = banner(game, serverNow);
  const lh = 15 * dpr;
  const w = 250 * dpr;
  const h = 26 * dpr + rows.length * lh + 6 * dpr;
  const x = cx - w / 2;
  const y = bottom - h;
  g.fillStyle = "rgba(20, 24, 34, 0.92)";
  g.strokeStyle = "#e9b73d";
  g.lineWidth = 2 * dpr;
  g.beginPath();
  g.roundRect(x, y, w, h, 6 * dpr);
  g.fill();
  g.stroke();
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.font = `700 ${11 * dpr}px ${FONT}`;
  g.fillStyle = "#ffd35c";
  g.fillText(title, cx, y + 12 * dpr, w - 12 * dpr);
  const top = rows[0]?.value || 1;
  const names = new Map(
    (hud.get().lobby?.matches.find((m) => m.id === game.id)?.players ?? []).map((p) => [p.userId, p.name]),
  );
  for (const [i, r] of rows.entries()) {
    const ry = y + 26 * dpr + i * lh;
    const barW = (w - 20 * dpr) * Math.max(0.02, r.value / top);
    g.fillStyle = i === 0 ? "rgba(255, 211, 92, 0.35)" : "rgba(143, 227, 255, 0.22)";
    g.fillRect(x + 10 * dpr, ry + 1 * dpr, barW, lh - 3 * dpr);
    g.font = `600 ${10 * dpr}px ${FONT}`;
    g.textAlign = "left";
    g.fillStyle = C.white;
    g.fillText(`${i === 0 ? "👑" : `${i + 1}.`} ${names.get(r.player) ?? "?"}`, x + 14 * dpr, ry + lh / 2);
    g.textAlign = "right";
    g.fillText(r.label || compact(r.value), x + w - 14 * dpr, ry + lh / 2);
  }
  gameHits.push({ x, y, w, h, open: () => openMatch(game.id) });
}

/** "🎮 Hype Cycle 2/6 · 🪙 50" over the host of an open table: people passing by can join. */
function drawSigns(
  g: CanvasRenderingContext2D,
  labels: (() => void)[],
  toScreen: ToScreen,
  now: number,
  dpr: number,
) {
  const lobby = hud.get().lobby;
  if (!lobby) return;
  for (const t of lobby.tables) {
    if (!t.open) continue;
    const host = world.avatars.get(t.host);
    if (!host || host.state === "playing") continue;
    const pos = drawPos(host, now);
    const [sx, sy] = toScreen(pos.x * TILE + TILE / 2, pos.y * TILE);
    const join = t.host === hud.get().me?.userId ? "" : " · Join";
    const text = `🎮 ${GAMES[t.game]!.name} ${t.seated.length}/${t.seats} · 🪙 ${t.stake}${join}`;
    labels.push(() => {
      const y = sy - 30 * dpr;
      const h = pill(g, sx, y, text, dpr, "rgba(143, 227, 255, 0.95)", C.ink);
      hitPill(g, sx, y, h, text, dpr, () => hud.set({ panel: { kind: "arcade" } }));
    });
  }
}

/** Records a centred pill (as drawn by `pill`) as clickable. */
function hitPill(
  g: CanvasRenderingContext2D,
  cx: number,
  bottom: number,
  h: number,
  text: string,
  dpr: number,
  open: () => void,
) {
  g.font = `600 ${11 * dpr}px ${FONT}`;
  const w = g.measureText(text).width + 10 * dpr;
  gameHits.push({ x: cx - w / 2, y: bottom - h, w, h, open });
}
