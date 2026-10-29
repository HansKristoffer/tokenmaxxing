// Browser entry for the 2D case-art contact sheets (see sheets.mjs). Builds one <canvas id="sheet-..."> per group
// from the real art modules, so what you see is what the game draws. ?case=ragnarok-eve | night-market, ?scale=4.
import { caseAt } from "../../../core/src/case.ts";
import { casePieceOf } from "../../../core/src/case-furniture.ts";
import { caseById } from "../../../core/src/cases.ts";
import { FISHING_ITEMS } from "../../../core/src/fishing-loot.ts";
import { PRESTIGE_ITEMS, PRESTIGE_TRACKS } from "../../../core/src/prestige.ts";
import { defaultLook, TILE, type Look } from "../../../core/src/world.ts";
import { CA_H, CA_MS, CA_W, CA_X, CA_Y, caseAuraFrame } from "../../../web/src/art/case-aura.ts";
import { CASE_BOX_FRAMES, CASE_BOX_SIZE, caseBoxSprite } from "../../../web/src/art/case-box.ts";
import { characterFrame, itemFrame } from "../../../web/src/art/characters.ts";
import { fancyPiece, fancySprite, type FancyPiece } from "../../../web/src/art/furniture-fancy.ts";
import { petFrame } from "../../../web/src/art/pets.ts";
import { bake } from "../../../web/src/art/pixels.ts";
// Optional prestige modules (petwear, trophies, emblems): sheets.mjs stubs them as null until the files exist.
import { emblem, petwear, trophy } from "prestige-optional";

const q = new URLSearchParams(location.search);
const caseId = q.get("case") ?? "ragnarok-eve";
const S = Number(q.get("scale") ?? 4);
// `?case=pond`: the pond's treasures (`fishing-loot.ts`), which have no case and no box.
// `?case=prestige`: the twenty prestige wearables (`core/src/prestige.ts`), plus the per-track extras below.
const def =
  caseId === "pond"
    ? { name: "Pond treasures", items: FISHING_ITEMS }
    : caseId === "prestige"
      ? { name: "Prestige", items: PRESTIGE_ITEMS }
      : caseById(caseId)!;

type Sprite = HTMLCanvasElement;
interface Cell {
  label: string;
  sprites: (Sprite | null)[];
  bg?: string;
}

const base: Look = { ...defaultLook(1), skin: 0, hair: 1, style: 0, outfit: 3 };
const look = (over: Partial<Look>): Look => ({ ...base, ...over });
const pad = 6;

function sheet(id: string, title: string, cells: Cell[], cols: number, bg: string): void {
  const spriteMax = (c: Cell) => c.sprites.reduce((a, s) => a + (s ? s.width * S + pad : 0), 0);
  const cellW = Math.max(110, ...cells.map(spriteMax)) + pad;
  const cellH = Math.max(16, ...cells.flatMap((c) => c.sprites.map((s) => (s ? s.height * S : 0)))) + 36;
  const rows = Math.ceil(cells.length / cols);
  const cv = document.createElement("canvas");
  cv.id = `sheet-${id}`;
  cv.width = cols * cellW;
  cv.height = rows * cellH + 24;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#1c2230";
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#fff";
  g.font = "bold 13px sans-serif";
  g.fillText(title, 6, 16);
  cells.forEach((c, i) => {
    const x0 = (i % cols) * cellW;
    const y0 = 24 + Math.floor(i / cols) * cellH;
    g.fillStyle = c.bg ?? bg;
    g.fillRect(x0 + 2, y0 + 2, cellW - 4, cellH - 4);
    let x = x0 + pad;
    for (const s of c.sprites) {
      if (!s) continue;
      g.drawImage(s, x, y0 + 6, s.width * S, s.height * S);
      x += s.width * S + pad;
    }
    g.fillStyle = "#111";
    g.font = "11px sans-serif";
    g.fillText(c.label, x0 + 6, y0 + cellH - 8);
  });
  document.body.append(cv);
}

const items = (slot: string) => def.items.filter((i) => i.slot === slot);
const LAND = "#cfd3c4";

// Character views: front, side, back (and the second walking frame when it differs).
const views = (l: Look): Sprite[] => [
  characterFrame(l, "down", "stand"),
  characterFrame(l, "right", "stand"),
  characterFrame(l, "up", "stand"),
];

for (const slot of ["hat", "glasses", "outfit", "held", "back"] as const) {
  const cells = items(slot).map((it): Cell => {
    const key = slot as "hat";
    const l = look({ [key]: it.index } as Partial<Look>);
    const sp = [...views(l)];
    if (slot === "back") sp.push(characterFrame(l, "right", "walkB"));
    sp.push(itemFrame(it));
    return { label: `${it.id} ${it.name}`, sprites: sp };
  });
  if (cells.length) sheet(slot, `${def.name}: ${slot}`, cells, slot === "back" ? 2 : 3, LAND);
}

// Pets: both frames alone, then beside an owner.
{
  const cells = items("pet").map((it): Cell => {
    const l = look({ pet: it.index });
    return {
      label: `${it.id} ${it.name}`,
      sprites: [
        petFrame(it.index, false, false),
        petFrame(it.index, false, true),
        characterFrame(l, "right", "stand"),
        petFrame(it.index, false, false),
      ],
    };
  });
  if (cells.length) sheet("pets", `${def.name}: pets (frame 0, frame 1, with owner)`, cells, 2, LAND);
}

// Auras: eight frames on a dark sky, character in the middle.
{
  const cells: Cell[] = [];
  for (const it of items("aura")) {
    const l = look({ aura: it.index });
    for (const half of [0, 4]) {
      const sp: Sprite[] = [];
      for (let f = half; f < half + 4; f++) {
        const fr = caseAuraFrame(it.index, f * CA_MS);
        const cv = document.createElement("canvas");
        cv.width = CA_W;
        cv.height = CA_H;
        const g = cv.getContext("2d")!;
        if (fr) g.drawImage(fr, 0, 0);
        g.drawImage(characterFrame(l, "down", "stand"), CA_X, CA_Y);
        sp.push(cv);
      }
      cells.push({ label: `${it.id} ${it.name} frames ${half}-${half + 3}`, sprites: sp });
    }
  }
  if (cells.length) sheet("auras", `${def.name}: auras`, cells, 2, "#27304a");
}

// Furniture: every frame.
{
  const cells = def.items
    .filter((i) => i.slot === "furniture")
    .map((i): Cell => {
      const p = casePieceOf(i.id.slice(5))!;
      const a = fancyPiece(p.art);
      const sp = a ? Array.from({ length: a.frames }, (_, f) => fancySprite(p.art, f)) : [];
      return { label: `${p.art} ${p.name} (${a?.frames ?? 0}f)`, sprites: sp };
    });
  if (cells.length) sheet("furniture", `${def.name}: furniture`, cells, 2, "#8a7a62");
}

// The box: closed, open (two frames), key; also at the game's 3x for the opening screen.
if (caseId !== "pond" && caseId !== "prestige") {
  const sp = (k: "closed" | "open" | "key", f: number) => caseBoxSprite(k, f, caseId);
  sheet(
    "box",
    `${def.name}: box and key`,
    [
      { label: "closed", sprites: [sp("closed", 0)] },
      { label: "open 0", sprites: [sp("open", 0)] },
      { label: "open 1", sprites: [sp("open", 1)] },
      { label: "key", sprites: [sp("key", 0)] },
    ],
    4,
    "#3a4560",
  );
}
if (caseId === "prestige") prestigeExtras();
void CASE_BOX_FRAMES;
void CASE_BOX_SIZE;
void caseAt;
document.title = "ready";

// Nothing below runs unless ?case=prestige.
function prestigeExtras(): void {
  const mix = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * a + [28, 34, 48][i]! * (1 - a)));
    return `rgb(${ch.join(",")})`;
  };
  const auraFrame = (l: Look, view: "down" | "right" | "up", f: number): Sprite => {
    const cv = document.createElement("canvas");
    cv.width = CA_W;
    cv.height = CA_H;
    const g = cv.getContext("2d")!;
    const fr = caseAuraFrame(l.aura, f * CA_MS);
    if (fr) g.drawImage(fr, 0, 0);
    g.drawImage(characterFrame(l, view, "stand"), CA_X, CA_Y);
    return cv;
  };
  // One overview a track: the full set (hat + outfit + back + aura) from front, side and back.
  PRESTIGE_TRACKS.forEach((t) => {
    const n = 700 + t.rank - 1;
    const l = look({ hat: n, outfit: n, back: n, aura: n });
    const cells: Cell[] = [
      {
        label: `${t.roman} ${t.name}: full set (aura frame 0)`,
        sprites: (["down", "right", "up"] as const).map((v) => auraFrame(l, v, 0)),
        bg: mix(t.colors.main, 0.45),
      },
      {
        label: `aura frame 3`,
        sprites: (["down", "right", "up"] as const).map((v) => auraFrame(l, v, 3)),
        bg: mix(t.colors.main, 0.45),
      },
    ];
    sheet(`overview-${t.key}`, `Prestige ${t.roman} ${t.name}: all five tracks' set`, cells, 2, "#1c2230");
  });

  // Optional modules: each is probed by name; a missing or empty one just leaves a labelled gap.
  const probe = (ns: Record<string, unknown> | null, name: string) =>
    ns && typeof ns[name] === "function" ? (ns[name] as (...a: unknown[]) => unknown) : null;
  const asSprite = (v: unknown): Sprite | null => (v instanceof HTMLCanvasElement ? v : null);
  const gaps: string[] = [];
  const tryAll = <T,>(label: string, fn: () => T): T | null => {
    try {
      return fn();
    } catch (e) {
      gaps.push(`${label}: ${(e as Error).message}`);
      return null;
    }
  };

  const pw = probe(petwear, "prestigePetwear");
  if (pw) {
    // Each accessory on two pets (frames 0 and 1 of the hop), at four moments of its loop.
    const cells = PRESTIGE_TRACKS.map((t): Cell => {
      const sp: Sprite[] = [];
      for (const pet of [1, 2]) {
        for (const now of [0, 300, 600, 900]) {
          const base = petFrame(pet, false, false) ?? document.createElement("canvas");
          const cv = document.createElement("canvas");
          cv.width = base.width;
          cv.height = base.height + 8;
          const g = cv.getContext("2d")!;
          g.drawImage(base, 0, 8);
          const r = tryAll(`petwear ${t.key}`, () => pw(t.rank, pet, false, false, now) as [Sprite, number, number] | null);
          if (r) g.drawImage(r[0], r[1], r[2] + 8);
          sp.push(cv);
        }
      }
      return { label: `${t.roman} ${t.petwear.name}`, sprites: sp, bg: mix(t.colors.main, 0.35) };
    });
    sheet("petwear", "Prestige: pet accessories (pets 1 and 2, t = 0/300/600/900ms)", cells, 1, LAND);
  } else gaps.push("petwear: prestigePetwear missing");

  const pt = probe(trophy, "prestigeTrophy");
  if (pt) {
    // The piece is not in `fancyPiece`'s lookup, so bake its frames straight from `draw`.
    const cells = PRESTIGE_TRACKS.map((t): Cell => {
      const piece = tryAll(`trophy ${t.key}`, () => pt(t.rank) as FancyPiece | undefined);
      const frames = piece
        ? Array.from({ length: piece.frames }, (_, f) =>
            tryAll(`trophy ${t.key}`, () => bake(piece.w * TILE, piece.height, (p) => piece.draw(p, f, "#888"))),
          )
        : [];
      return { label: `${t.roman} ${t.trophy.name} (${piece?.frames ?? 0}f)`, sprites: frames, bg: "#8a7a62" };
    });
    sheet("trophies", "Prestige: home trophies, every frame", cells, 1, "#8a7a62");
  } else gaps.push("trophy: prestigeTrophy missing");

  const es = probe(emblem, "emblemSprite");
  if (es) {
    const cells = PRESTIGE_TRACKS.map((t): Cell => ({
      label: `${t.roman} ${t.emblem}`,
      sprites: [tryAll(`emblem ${t.key}`, () => asSprite(es(t.rank))) , tryAll(`emblem ${t.key}`, () => asSprite(es(t.emblem)))],
      bg: mix(t.colors.main, 0.35),
    }));
    sheet("emblems", "Prestige: tag emblems (by rank, by name)", cells, 3, LAND);
  } else gaps.push("emblem: emblemSprite missing");
  console.log("GAPS " + gaps.join(" | "));
}
