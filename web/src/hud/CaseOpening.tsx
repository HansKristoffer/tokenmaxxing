import { CASE_ITEMS } from "@tokenmaxxing/core/case.ts";
import { CASE_PIECES } from "@tokenmaxxing/core/case-furniture.ts";
import { type CaseDef, MAX_OPEN } from "@tokenmaxxing/core/cases.ts";
import { RARITIES, RARITY_COLOR, type Rarity } from "@tokenmaxxing/core/rarity.ts";
import type { Item } from "@tokenmaxxing/core/shop.ts";
import { defaultLook } from "@tokenmaxxing/core/world.ts";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CASE_BOX_SIZE, caseBoxSprite } from "../art/case-box.ts";
import { nissePointer } from "../art/case-julemarked-box.ts";
import { ravenPointer } from "../art/case-ragnarok-box.ts";
import { errorText } from "../errors.ts";
import { audio, tone } from "../game/jukebox.ts";
import { hud, useHud } from "../store.ts";
import { itemChances, percent } from "./caseOdds.ts";
import { coins } from "./format.ts";
import { ItemImage } from "./Shop.tsx";
import { Modal } from "./ui.tsx";

/**
 * The key price and the odds are undecided. These are stand-ins so the screen can be seen working, not a design.
 * The real roll comes from the server (`roll` prop), which is the one place the odds live; this table only drives
 * the mock roll and the look of the strip's filler.
 */
const PLACEHOLDER_ODDS: Record<Rarity, number> = {
  common: 0.6,
  uncommon: 0.25,
  rare: 0.1,
  epic: 0.04,
  legendary: 0.01,
};
const PLACEHOLDER_KEY_PRICE = 250;

/** The case's name, when none is given (the dev preview). */
const CASE_NAME = "Night Market Case";

/** What a case looks like on its opening screen: the emoji in its title, and the strip's own colours (case.css, `data-case`). */
const THEME: Record<string, { emoji: string }> = {
  "night-market": { emoji: "🏮" },
  nusantara: { emoji: "⛵" },
  "ragnarok-eve": { emoji: "❄️" },
  julemarked: { emoji: "🎄" },
};
const themeOf = (def?: CaseDef) => THEME[def?.id ?? "night-market"] ?? THEME["night-market"]!;

/** Every item the case holds: wearables, pets and the six furniture pieces, as shop `Item`s. */
const CASE_POOL: readonly Item[] = [
  ...CASE_ITEMS,
  ...CASE_PIECES.map((p): Item => ({
    id: `furn.${p.ch}`,
    slot: "furniture",
    index: 0,
    name: p.name,
    price: 0,
    tradeable: true,
    rarity: p.rarity,
    blurb: p.blurb,
    case: true,
  })),
];

const rarityIn = (i: Item): Rarity => i.rarity ?? "common";
const pickFrom = (list: readonly Item[]): Item => list[Math.floor(Math.random() * list.length)]!;

/** The mock roll: a rarity by `PLACEHOLDER_ODDS`, then an item of it. Falls back down a tier if a tier is empty. */
function mockRoll(): Item {
  let r = Math.random();
  let tier: Rarity = "common";
  for (const k of RARITIES) {
    tier = k;
    r -= PLACEHOLDER_ODDS[k];
    if (r < 0) break;
  }
  const of = CASE_POOL.filter((i) => rarityIn(i) === tier);
  return pickFrom(of.length ? of : CASE_POOL);
}

/**
 * Filler for the strip: what the odds would show, so the strip looks like the case and not a uniform shuffle.
 * The weights are the odds times 1.6, plus 0.02 a tier. That is a display choice, not the roll.
 */
const fillerOf = (pool: readonly Item[], odds: Record<Rarity, number>) => (): Item => {
  let r = Math.random();
  let tier: Rarity = "common";
  for (const k of RARITIES) {
    tier = k;
    r -= odds[k] * 1.6 + 0.02;
    if (r < 0) break;
  }
  const of = pool.filter((i) => rarityIn(i) === tier);
  return pickFrom(of.length ? of : pool);
};

/* ----- the spin's numbers ----- */
const TILE = 124;
const GAP = 6;
const PITCH = TILE + GAP;
const TILES = 60;
const WINNER_AT = 50;
/** Seconds of spin. */
const SPIN_S = 6.5;
/** With several cases at once, each reel lands this much after the one above it. */
const STAGGER_S = 0.3;
/** The same, when motion is reduced: a short slide, then the reveal. */
const REDUCED_S = 0.35;
/** Position 0..1 of the way there at time 0..1: cubic ease-out, so it starts at ~3x the average speed and ends in a crawl. */
const ease = (t: number): number => 1 - (1 - t) ** 3;

interface Run {
  tiles: Item[];
  winner: Item;
  /** Where inside the winning tile the marker lands, -0.42..0.42 of a tile, like CS. */
  jitter: number;
}

/** A reel whose strip and viewport are both mounted, so it can be animated. */
interface MountedReel {
  run: Run;
  el: HTMLUListElement;
  vp: HTMLDivElement;
}

const buildRun = (winner: Item, filler: () => Item): Run => {
  const tiles = Array.from({ length: TILES }, filler);
  tiles[WINNER_AT] = winner;
  return { tiles, winner, jitter: (Math.random() - 0.5) * 0.84 };
};

const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The strip's speed class (case.css) for its speed in px a second. */
const speedClass = (pxPerSecond: number): string => {
  if (pxPerSecond > 1800) return "fast";
  if (pxPerSecond > 700) return "mid";
  return "slow";
};

/** The case `caseId` (the Night Market's if left out), drawn from its pixel art: lid down, then lid up while it opens (`art/case-box.ts`). */
function CaseArt({ opening, caseId }: { opening: boolean; caseId?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const kind = opening ? "open" : "closed";
    const { w, h } = CASE_BOX_SIZE[kind];
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(caseBoxSprite(kind, 0, caseId), 0, 0, w * 3, h * 3);
  }, [opening, caseId]);
  return (
    <span aria-hidden="true" className="cs-box-wrap">
      <canvas ref={ref} width={72} height={84} className="cs-box-art" />
    </span>
  );
}

function Tile({ item, won }: { item: Item; won?: boolean }) {
  const rarity = rarityIn(item);
  // A legendary is never named on the strip, even when it lands: the reveal panel below shows it.
  const mystery = rarity === "legendary";
  return (
    <li
      className={`cs-tile${mystery ? " mystery" : ""}${won ? " won" : ""}`}
      style={{ "--r": RARITY_COLOR[mystery ? "legendary" : rarity] } as CSSProperties}
    >
      {mystery ? (
        <>
          <span className="cs-q">???</span>
          <span className="cs-name">Legendary Item!</span>
        </>
      ) : (
        <>
          <span className="cs-pic">
            <ItemImage item={item} look={LOOK} bare />
          </span>
          <span className="cs-name">{item.name}</span>
          <span className="cs-slot">{item.slot}</span>
        </>
      )}
    </li>
  );
}

const LOOK = defaultLook(1);

/** How far up the bell triad climbs for the rarity that lands: rare rings the first bell. */
const BELL_RISE = { rare: 0, epic: 1, legendary: 2 } as const;

type Phase = "idle" | "waiting" | "spinning" | "reveal";

/** A rarity's place on the ladder: common is 0, legendary the last. */
const rankOf = (r: Rarity): number => RARITIES.indexOf(r);

/** The best rarity among `items` (common for none). */
const bestOf = (items: readonly Item[]): Rarity =>
  items.reduce<Rarity>((best, it) => (rankOf(rarityIn(it)) > rankOf(best) ? rarityIn(it) : best), "common");

/** The open button's words: one case or several, the first time or again. */
const openLabel = (n: number, again: boolean): string => {
  if (n === 1) return again ? "Open another" : "Open case";
  return again ? `Open ${n} more` : `Open ${n} cases`;
};

/**
 * The case-opening screen. No server calls of its own: `roll` decides the winners BEFORE the strips are built.
 * `roll(count)` resolves to the `count` `Item`s (shop items, ids like `hat.203` / `furn.Ж`) the server has already
 * granted (the case shop passes the real `openCases`). It may reject (shown as an error, nothing spins). The player
 * picks 1 to `MAX_OPEN` at a time; each gets its own reel. `keyPrice` is one key, what the button multiplies.
 * The spin is cosmetic; the result never depends on it.
 *
 * With no `roll` it is the dev preview: the mock roll on the placeholder pool and odds, no coins spent. `def`
 * is the case being opened (its name, items and odds); `onClose` takes the Close button somewhere other than
 * out of the panel (the case shop, back to its list).
 */
export function CaseOpening({
  roll,
  keyPrice = PLACEHOLDER_KEY_PRICE,
  def,
  onClose,
}: {
  roll?: (count: number) => Item[] | Promise<Item[]>;
  keyPrice?: number;
  def?: CaseDef;
  onClose?: () => void;
}) {
  const preview = !roll;
  const pool = def?.items ?? CASE_POOL;
  const filler = useMemo(() => fillerOf(pool, def?.odds ?? PLACEHOLDER_ODDS), [pool, def]);
  const chances = useMemo(
    () => (def ? new Map(itemChances(def).map((c) => [c.item.id, c.chance])) : null),
    [def],
  );
  const wallet = useHud((s) => s.wallet);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(1);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const viewports = useRef<(HTMLDivElement | null)[]>([]);
  const strips = useRef<(HTMLUListElement | null)[]>([]);
  const raf = useRef(0);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
      cancelAnimationFrame(raf.current);
    },
    [],
  );

  const idle = useMemo(
    () => Array.from({ length: MAX_OPEN }, () => Array.from({ length: 12 }, filler)),
    [filler],
  );
  const byRarity = useMemo(
    () => [...RARITIES].reverse().map((r) => ({ r, items: pool.filter((i) => rarityIn(i) === r) })),
    [pool],
  );

  const tick = useCallback(() => {
    if (hud.get().jukeSettings.muted) return;
    const c = audio();
    if (!c || c.state !== "running") return;
    tone(c, c.currentTime, 0.04, 1500 + Math.random() * 80, "square", 0.25);
  }, []);

  // Runs the animation once the strips for `runs` are on screen: one frame loop for every reel, each with its own
  // landing spot and (with several) a little later than the one above. Only the top reel ticks.
  useEffect(() => {
    if (phase !== "spinning" || !runs.length) return;
    // A reel can only run once React has put its strip and viewport on screen.
    const mounted = runs.map((run, i) => ({ run, el: strips.current[i], vp: viewports.current[i] }));
    if (!mounted.every((r): r is MountedReel => !!r.el && !!r.vp)) return;

    const reduced = reducedMotion();
    const t0 = performance.now();
    const reels = mounted.map((r, i) => {
      const vw = r.vp.clientWidth;
      return {
        el: r.el,
        vw,
        target: WINNER_AT * PITCH + TILE / 2 + r.run.jitter * TILE - vw / 2,
        ms: (reduced ? REDUCED_S : SPIN_S + i * STAGGER_S) * 1000,
        lastIdx: -1,
        lastX: 0,
        lastT: t0,
      };
    });
    const frame = (now: number) => {
      let done = true;
      reels.forEach((r, i) => {
        const t = Math.min(1, (now - t0) / r.ms);
        const x = r.target * ease(t);
        r.el.style.transform = `translate3d(${-x}px,0,0)`;
        const idx = Math.floor((x + r.vw / 2) / PITCH);
        if (idx !== r.lastIdx) {
          if (i === 0 && r.lastIdx >= 0 && !reduced) tick();
          r.lastIdx = idx;
        }
        const dt = now - r.lastT;
        if (dt > 0) {
          const pxPerSecond = ((x - r.lastX) / dt) * 1000;
          r.el.dataset.speed = t < 1 ? speedClass(pxPerSecond) : "slow";
          r.lastX = x;
          r.lastT = now;
        }
        if (t < 1) done = false;
      });
      if (!done) raf.current = requestAnimationFrame(frame);
      else if (live.current) setPhase("reveal");
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, runs, tick]);

  const affordable = (n: number) => preview || !wallet || wallet.balance >= keyPrice * n;

  const open = async () => {
    if (phase === "waiting" || phase === "spinning") return;
    setError(null);
    setPhase("waiting");
    audio(); // wakes the audio inside the click that asked for it
    for (const el of strips.current) if (el) el.style.transform = "translate3d(0,0,0)";
    let winners: Item[];
    try {
      winners = roll ? await roll(count) : Array.from({ length: count }, mockRoll);
    } catch (e) {
      if (live.current) {
        let message = "Couldn't open the case.";
        if (roll) message = errorText(e);
        else if (e instanceof Error) message = e.message;
        setError(message);
        setPhase("idle");
      }
      return;
    }
    if (!live.current) return;
    setRuns(winners.map((w) => buildRun(w, filler)));
    setPhase("spinning");
  };

  const busy = phase === "waiting" || phase === "spinning";
  const spun = runs.length > 0 && phase !== "idle" && phase !== "waiting";
  // The reels on screen: the last spin's, or (before one, or while asking) as many idle ones as are picked.
  const reels: { tiles: Item[]; won?: Item }[] = spun
    ? runs.map((r) => ({ tiles: r.tiles, won: phase === "reveal" ? r.winner : undefined }))
    : idle.slice(0, count).map((tiles) => ({ tiles }));
  const wins = phase === "reveal" ? runs.map((r) => r.winner) : [];
  const wonIds = new Set(wins.map((w) => w.id));
  const multi = reels.length > 1;

  // Julemarked: a soft bell triad when a rare or better item lands (a higher bell for each tier above rare).
  const bellFor = wins.length > 0 && def?.id === "julemarked" ? bestOf(wins) : undefined;
  useEffect(() => {
    if (!bellFor || bellFor === "common" || bellFor === "uncommon") return;
    if (hud.get().jukeSettings.muted) return;
    const c = audio();
    if (!c || c.state !== "running") return;

    const up = BELL_RISE[bellFor];
    // E5, G5 and B5: a major triad, each bell rung in turn.
    [659.25, 783.99, 987.77].forEach((hz, i) => {
      const f = hz * 2 ** ((up / 12) * 2);
      tone(c, c.currentTime + i * 0.13, 1.1, f, "sine", 0.22);
      tone(c, c.currentTime + i * 0.13, 0.6, f * 2.76, "sine", 0.05);
    });
  }, [bellFor]);

  return (
    <Modal title={`${themeOf(def).emoji} ${def?.name ?? CASE_NAME}`} wide="xl">
      <div className="cs-top">
        <CaseArt opening={busy} caseId={def?.id} />
        <div className="cs-info">
          <p>A key opens it. Everything inside is cosmetic, tradeable and found nowhere else.</p>
          {!preview && wallet && (
            <p className="muted small">
              You have <strong>{coins(wallet.balance)}</strong>
            </p>
          )}
          <fieldset className="cs-count" aria-label="How many cases to open">
            {Array.from({ length: MAX_OPEN }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={count === n}
                className={count === n ? "on" : undefined}
                disabled={busy || !affordable(n)}
                title={affordable(n) ? `Open ${n} at once` : `${n} keys are ${coins(keyPrice * n)}`}
                onClick={() => setCount(n)}
              >
                {n}×
              </button>
            ))}
          </fieldset>
          <div className="cs-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void open()}>
              {openLabel(count, phase === "reveal")} · {coins(keyPrice * count)}
            </button>
            {!busy && (phase === "reveal" || onClose) && (
              <button type="button" onClick={onClose ?? (() => hud.set({ panel: null }))}>
                {onClose ? "Back to the shop" : "Close"}
              </button>
            )}
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </div>

      <div className={`cs-reels${multi ? " multi" : ""}`}>
        {reels.map((reel, r) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: one reel per case opened, in order
            key={r}
            className={`cs-roulette${busy ? " live" : ""}${reel.won ? " landed" : ""}`}
            data-case={def?.id}
            data-win={reel.won ? rarityIn(reel.won) : undefined}
            ref={(el) => {
              viewports.current[r] = el;
            }}
          >
            <ul
              className="cs-strip"
              ref={(el) => {
                strips.current[r] = el;
              }}
              data-speed="slow"
              aria-hidden={busy}
            >
              {reel.tiles.map((it, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the strip is positional; a winner repeats items
                <Tile key={i} item={it} won={!!reel.won && i === WINNER_AT} />
              ))}
            </ul>
            <span className="cs-marker" aria-hidden="true" />
            {def?.id === "ragnarok-eve" && <PerchedPointer sprite={ravenPointer} className="cs-raven" />}
            {def?.id === "julemarked" && (
              <PerchedPointer sprite={nissePointer} className="cs-raven cs-nisse" />
            )}
            {def?.id === "julemarked" && reel.won && rarityIn(reel.won) === "legendary" && (
              <span aria-hidden="true" className="cs-snowfall" />
            )}
            <span className="cs-fade l" />
            <span className="cs-fade r" />
          </div>
        ))}
      </div>

      {wins.length === 1 && <Reveal item={wins[0]!} />}
      {wins.length > 1 && <RevealAll items={wins} />}

      <h3>Contains</h3>
      <div className="cs-contains">
        {byRarity.map(({ r, items }) => (
          <section key={r} className="cs-group" style={{ "--r": RARITY_COLOR[r] } as CSSProperties}>
            <h4>
              <span style={{ color: RARITY_COLOR[r] }}>{r}</span>
              {r !== "legendary" && <span className="muted small"> · {items.length}</span>}
            </h4>
            <ul>
              {r === "legendary" ? (
                // Like a CS knife: it says there is one in here, never which. You see it when you win it.
                <li
                  title="Something rarer than the rest. You find out when you open it."
                  className={`mystery${wins.some((w) => rarityIn(w) === "legendary") ? " got" : ""}`}
                >
                  <span className="cs-q">???</span>
                  <span className="cs-name">Legendary Item!</span>
                  {chances && (
                    <span className="cs-slot">
                      {percent(items.reduce((a, it) => a + (chances.get(it.id) ?? 0), 0))}
                    </span>
                  )}
                </li>
              ) : (
                items.map((it) => (
                  <li key={it.id} title={it.blurb} className={wonIds.has(it.id) ? "got" : undefined}>
                    <ItemImage item={it} look={LOOK} bare />
                    <span className="cs-name">{it.name}</span>
                    <span className="cs-slot">
                      {it.slot}
                      {chances && ` · ${percent(chances.get(it.id) ?? 0)}`}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>
      {preview && <PlayerHint />}
    </Modal>
  );
}

/**
 * A small creature perched on the marker, drawn from its cached sprite (case.css): Ragnarok Eve's raven hops with
 * the strip while it spins, Julemarked's nisse tips his cap on each tick.
 */
function PerchedPointer({ sprite, className }: { sprite: () => CanvasImageSource; className: string }) {
  return (
    <span aria-hidden="true" className="cs-raven-wrap">
      <canvas
        className={className}
        width={6}
        height={6}
        ref={(c) => {
          const g = c?.getContext("2d");
          if (!g) return;
          g.clearRect(0, 0, 6, 6);
          g.drawImage(sprite(), 0, 0);
        }}
      />
    </span>
  );
}

/** Who is opening, for the wallet; nothing to show yet because the key is not charged in this mock. */
function PlayerHint() {
  const me = useHud((s) => s.me);
  return me ? null : <p className="muted small">Preview: no coins are spent.</p>;
}

/** Several cases at once: everything won, best first, each card in its rarity's colour. */
function RevealAll({ items }: { items: readonly Item[] }) {
  const sorted = [...items].sort((a, b) => rankOf(rarityIn(b)) - rankOf(rarityIn(a)));
  const best = bestOf(items);
  return (
    <div className="cs-reveal-all" role="status">
      <p className="cs-reveal-all-head">
        You got {items.length} items. Best:{" "}
        <span className="cs-rarity" style={{ color: RARITY_COLOR[best] }}>
          {best}
        </span>
      </p>
      <ul>
        {sorted.map((item, i) => {
          const rarity = rarityIn(item);
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: the same item can be won twice
              key={i}
              title={item.blurb}
              style={{ "--r": RARITY_COLOR[rarity], animationDelay: `${i * 70}ms` } as CSSProperties}
            >
              <span className="cs-pic">
                <ItemImage item={item} look={LOOK} bare />
              </span>
              <strong>{item.name}</strong>
              <span className="cs-rarity" style={{ color: RARITY_COLOR[rarity] }}>
                {rarity} · {item.slot}
              </span>
            </li>
          );
        })}
      </ul>
      <span className="muted small">Tradeable right away</span>
    </div>
  );
}

function Reveal({ item }: { item: Item }) {
  const rarity = rarityIn(item);
  return (
    <div className="cs-reveal" style={{ "--r": RARITY_COLOR[rarity] } as CSSProperties} role="status">
      <div className="cs-big">
        <ItemImage item={item} look={LOOK} bare />
      </div>
      <div className="cs-reveal-text">
        <span className="cs-rarity" style={{ color: RARITY_COLOR[rarity] }}>
          {rarity} · {item.slot}
        </span>
        <strong>{item.name}</strong>
        {item.blurb && <span className="muted">{item.blurb}</span>}
        <span className="muted small">Tradeable right away</span>
      </div>
    </div>
  );
}
