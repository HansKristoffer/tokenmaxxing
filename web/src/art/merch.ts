/**
 * Company merch: a tee, a hoodie, a cap and a mug in a company's colours (its brand's roof and plaque,
 * or a pair picked by its id) with its initials. Worn over a character (`characters.ts`) and shown
 * on its own in the bag and the merch shop.
 */
import type { Brand } from "@tokenmaxxing/core/world.ts";
import { typedSwitch } from "hanzio";
import { C, shade } from "./palette.ts";
import { bake, cached, initialsOf, type Palette, type Pen } from "./pixels.ts";

interface MerchColours {
  main: string;
  shade: string;
  /** The logo, the cap's badge and the mug's print. */
  accent: string;
  /** For neon: a bright take on the main colour. */
  glow: string;
  initials: string;
}

/** Companies without a brand get one of these, by id: [main, accent]. */
const PAIRS: [string, string][] = [
  ["#3a6fb8", "#f5d14a"],
  ["#c4544b", "#fbf7ef"],
  ["#3f8c50", "#f4efe4"],
  ["#5b3fbf", "#3ddc84"],
  ["#2c3142", "#f08a3c"],
  ["#e0a15a", "#2b2433"],
  ["#cf6690", "#fbf7ef"],
  ["#1f2a24", "#3ddc84"],
];

/** A company's merch colours. */
function merchColours(c: MerchCompany): MerchColours {
  const [main, accent] = c.brand ? [c.brand.roof, c.brand.plaque] : PAIRS[c.id % PAIRS.length]!;
  // A plaque the colour of the roof would leave the logo invisible.
  const logo = accent.toLowerCase() === main.toLowerCase() ? C.white : accent;
  return {
    main,
    shade: shade(main, -0.25),
    accent: logo,
    glow: shade(main, 0.6),
    initials: initialsOf(c.name),
  };
}

type MerchCompany = { id: number; name: string; brand: Brand | null };

const FALLBACK: MerchColours = { main: C.metal, shade: C.ink, accent: C.white, glow: C.white, initials: "?" };
/** A key for caches: what merch in `m` looks like. */
const keyOf = (m: MerchColours) => `${m.main}${m.accent}${m.initials}`;

/** Every company's merch colours and their key, worked out as the world gets its companies (`setCompanies`). */
const COMPANIES = new Map<number, { colours: MerchColours; key: string }>();
let version = 0;

export function setMerchCompanies(list: readonly MerchCompany[]): void {
  COMPANIES.clear();
  for (const c of list) {
    const colours = merchColours(c);
    COMPANIES.set(c.id, { colours, key: keyOf(colours) });
  }
  version++;
}

/** Goes up whenever the companies change: for caches of anything wearing merch. */
export const merchVersion = (): number => version;

export const coloursOf = (companyId: number): MerchColours => COMPANIES.get(companyId)?.colours ?? FALLBACK;

/** A key for caches: what the merch of `companyId` looks like right now. */
export const merchKey = (companyId: number): string => COMPANIES.get(companyId)?.key ?? keyOf(FALLBACK);

/** The cap over the head, from row 0: `c` crown, `C` brim, `L` the badge. */
// Pixel art reads as a grid.
// prettier-ignore
export const CAP: Record<"down" | "side" | "up", string[]> = {
  down: ["................", ".....oooooo.....", "....occLLcco....", "...occcLLcccco..", "..oCCCCCCCCCCo.."],
  side: ["................", ".....oooooo.....", "....occccLco....", "...occcccLLco...", "...occcccCCCCCo."],
  up: ["................", ".....oooooo.....", "....occcccco....", "...occcccccco...", "...occcccccco...", "...oCCCCCCCCo..."],
};

export const capPalette = (m: MerchColours): Palette => ({ o: C.ink, c: m.main, C: m.shade, L: m.accent });

/**
 * Over the body (drawn at y = 9): the logo on the chest from the front, and for a hoodie its
 * drawstrings, pocket and, from behind, the hood.
 */
export function drawTop(
  p: Pen,
  m: MerchColours,
  view: "down" | "side" | "up",
  hoodie: boolean,
  flip: boolean,
) {
  const x = (n: number) => (flip ? 15 - n : n);
  typedSwitch(view, {
    down: () => {
      p.rect(7, 10, 2, hoodie ? 1 : 2, m.accent);
      if (hoodie) {
        p.px(6, 9, C.white);
        p.px(9, 9, C.white);
        p.rect(6, 11, 4, 1, m.shade);
      }
    },
    side: () => p.px(x(9), 10, m.accent),
    up: () => {
      if (!hoodie) return;
      // The hood, down the back of the head.
      p.rect(4, 6, 8, 3, C.ink);
      p.rect(5, 6, 6, 3, m.main);
      p.rect(5, 8, 6, 1, m.shade);
    },
  });
}

/** The mug, in the right hand. From behind, it's hidden. */
export function drawMug(p: Pen, m: MerchColours, view: "down" | "side" | "up", flip: boolean) {
  if (view === "up") return;
  const [x0, y0] = view === "down" ? [12, 10] : [10, 10];
  const x = (n: number, w = 1) => (flip ? 16 - n - w : n);
  p.rect(x(x0, 3), y0, 3, 4, C.ink);
  p.rect(x(x0 + 1), y0 + 1, 1, 2, m.main);
  p.px(x(x0 + 1), y0 + 1, m.accent);
  p.rect(x(x0 + 3), y0 + 1, 1, 2, C.ink);
}

/** One piece on its own, 16×16, for the bag, the floor and the shop: big enough for the initials. */
export const merchFrame = cached(
  (companyId: number, bit: number) => `${companyId}:${bit}:${merchKey(companyId)}`,
  (companyId: number, bit: number) => {
    const m = coloursOf(companyId);
    return bake(16, 16, (p) => {
      if (bit === 4) return cap(p, m);
      if (bit === 8) return mug(p, m);
      shirt(p, m, bit === 2);
    });
  },
);

/** The initials, centred on `cx`, from row `y`. */
function print(p: Pen, m: MerchColours, cx: number, y: number, color = m.accent) {
  p.text(m.initials, Math.round(cx - (m.initials.length * 4 - 1) / 2), y, color);
}

function shirt(p: Pen, m: MerchColours, hoodie: boolean) {
  // Sleeves out, body down: a tee laid flat.
  p.rect(4, 2, 8, 13, C.ink);
  p.rect(0, 3, 16, 6, C.ink);
  p.rect(1, 4, 14, 4, m.main);
  p.rect(5, 3, 6, 11, m.main);
  p.rect(1, 7, 3, 1, m.shade);
  p.rect(12, 7, 3, 1, m.shade);
  p.rect(5, 13, 6, 1, m.shade);
  if (hoodie) {
    // The hood behind the neck, strings, the pouch.
    p.rect(5, 0, 6, 3, C.ink);
    p.rect(6, 1, 4, 2, m.shade);
    p.px(7, 3, C.white);
    p.px(8, 3, C.white);
    p.px(7, 4, C.white);
    p.px(8, 4, C.white);
    p.rect(5, 12, 6, 1, m.shade);
    print(p, m, 8, 6);
  } else {
    p.rect(7, 3, 2, 1, m.shade);
    print(p, m, 8, 6);
  }
}

function cap(p: Pen, m: MerchColours) {
  p.rect(3, 5, 10, 7, C.ink);
  p.rect(2, 7, 12, 5, C.ink);
  p.rect(4, 6, 8, 5, m.main);
  p.rect(3, 8, 10, 3, m.main);
  p.rect(1, 11, 15, 3, C.ink);
  p.rect(2, 12, 13, 1, m.shade);
  p.px(7, 4, C.ink);
  p.px(8, 4, C.ink);
  print(p, m, 8, 6, m.accent);
}

function mug(p: Pen, m: MerchColours) {
  p.rect(2, 14, 11, 2, C.shadow);
  p.rect(2, 3, 11, 12, C.ink);
  p.rect(3, 4, 9, 10, m.main);
  p.rect(3, 4, 9, 1, shade(m.main, 0.3));
  p.rect(12, 6, 3, 6, C.ink);
  p.rect(13, 7, 1, 4, m.shade);
  p.rect(12, 7, 1, 4, m.main);
  print(p, m, 7, 6);
  // Steam.
  p.px(5, 1, C.stoneLight);
  p.px(6, 0, C.stoneLight);
  p.px(9, 1, C.stoneLight);
}
