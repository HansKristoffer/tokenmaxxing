import { CASE_ITEMS, CASE_TRADE_LOCK_MS } from "@tokenmaxxing/core/case.ts";
import { CASE_PIECES } from "@tokenmaxxing/core/case-furniture.ts";
import { RARITIES, RARITY_COLOR, type Rarity } from "@tokenmaxxing/core/rarity.ts";
import type { Item } from "@tokenmaxxing/core/shop.ts";
import { defaultLook } from "@tokenmaxxing/core/world.ts";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CASE_BOX_SIZE, caseBoxSprite } from "../art/case-box.ts";
import { audio, tone } from "../game/jukebox.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { ItemImage } from "./Shop.tsx";
import { Modal } from "./ui.tsx";

/*
 * ============================ PLACEHOLDER ECONOMY ============================
 * The key price and the odds are UNDECIDED. These are stand-ins so the screen can be seen working;
 * do not read them as a design. The real roll comes from the server (`roll` prop), which is the one
 * place the odds live; this table only drives the mock roll and the look of the strip's filler.
 */
export const PLACEHOLDER_ODDS: Record<Rarity, number> = {
  common: 0.6,
  uncommon: 0.25,
  rare: 0.1,
  epic: 0.04,
  legendary: 0.01,
};
export const PLACEHOLDER_KEY_PRICE = 250;
/* ============================================================================ */

/** The case's name. */
const CASE_NAME = "Night Market Case";

/** Every item the case holds: wearables, pets and the six furniture pieces, as shop `Item`s. */
export const CASE_POOL: readonly Item[] = [
  ...CASE_ITEMS,
  ...CASE_PIECES.map(
    (p): Item => ({
      id: `furn.${p.ch}`,
      slot: "furniture",
      index: 0,
      name: p.name,
      price: 0,
      tradeable: true,
      rarity: p.rarity,
      blurb: p.blurb,
      case: true,
    }),
  ),
];

const rarityIn = (i: Item): Rarity => i.rarity ?? "common";
const pickFrom = (list: readonly Item[]): Item => list[Math.floor(Math.random() * list.length)]!;

/** The mock roll: a rarity by `PLACEHOLDER_ODDS`, then an item of it. Falls back down a tier if a tier is empty. */
export function mockRoll(): Item {
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

/** Filler for the strip: what the odds would show, so the strip looks like the case and not a uniform shuffle. */
const filler = (): Item => {
  let r = Math.random();
  let tier: Rarity = "common";
  for (const k of RARITIES) {
    tier = k;
    r -= PLACEHOLDER_ODDS[k] * 1.6 + 0.02;
    if (r < 0) break;
  }
  const of = CASE_POOL.filter((i) => rarityIn(i) === tier);
  return pickFrom(of.length ? of : CASE_POOL);
};

/* ----- the spin's numbers ----- */
const TILE = 124;
const GAP = 6;
const PITCH = TILE + GAP;
const TILES = 60;
const WINNER_AT = 50;
/** Seconds of spin. */
const SPIN_S = 6.5;
/** The same, when motion is reduced: a short slide, then the reveal. */
const REDUCED_S = 0.35;
/** Position 0..1 of the way there at time 0..1: cubic ease-out, so it starts at ~3x the average speed and ends in a crawl. */
export const ease = (t: number): number => 1 - (1 - t) ** 3;

interface Run {
  tiles: Item[];
  winner: Item;
  /** Where inside the winning tile the marker lands, -0.42..0.42 of a tile, like CS. */
  jitter: number;
}

const buildRun = (winner: Item): Run => {
  const tiles = Array.from({ length: TILES }, filler);
  tiles[WINNER_AT] = winner;
  return { tiles, winner, jitter: (Math.random() - 0.5) * 0.84 };
};

const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const slotLabel = (i: Item): string => (i.slot === "furniture" ? "furniture" : i.slot);

/** The case, drawn from its pixel art: lid down, then lid up while it opens (`art/case-box.ts`). */
function CaseArt({ opening }: { opening: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const kind = opening ? "open" : "closed";
    const { w, h } = CASE_BOX_SIZE[kind];
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ref.current!.width, ref.current!.height);
    ctx.drawImage(caseBoxSprite(kind, 0), 0, 0, w * 3, h * 3);
  }, [opening]);
  return <canvas ref={ref} width={72} height={84} className="cs-box-art" aria-hidden="true" />;
}

function Tile({ item, hidden, won }: { item: Item; hidden?: boolean; won?: boolean }) {
  const rarity = rarityIn(item);
  const mystery = hidden && rarity === "legendary";
  return (
    <li
      className={`cs-tile${mystery ? " mystery" : ""}${won ? " won" : ""}`}
      style={{ "--r": RARITY_COLOR[mystery ? "legendary" : rarity] } as CSSProperties}
    >
      {mystery ? (
        <span className="cs-q">???</span>
      ) : (
        <>
          <span className="cs-pic">
            <ItemImage item={item} look={LOOK} bare />
          </span>
          <span className="cs-name">{item.name}</span>
          <span className="cs-slot">{slotLabel(item)}</span>
        </>
      )}
    </li>
  );
}

const LOOK = defaultLook(1);

type Phase = "idle" | "waiting" | "spinning" | "reveal";

/**
 * The case-opening screen. No server calls: `roll` decides the winner BEFORE the strip is built.
 * Contract for the server: `roll()` resolves to the `Item` (shop item, id like `hat.203` / `furn.Ж`) the
 * server has already granted. It may reject (shown as an error, nothing spins). `keyPrice` is what the
 * button shows. The spin is cosmetic; the result never depends on it.
 */
export function CaseOpening({
  roll = mockRoll,
  keyPrice = PLACEHOLDER_KEY_PRICE,
}: {
  roll?: () => Item | Promise<Item>;
  keyPrice?: number;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLUListElement>(null);
  const raf = useRef(0);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
      cancelAnimationFrame(raf.current);
    },
    [],
  );

  const preview = useMemo(() => Array.from({ length: 12 }, filler), []);
  const byRarity = useMemo(
    () =>
      [...RARITIES].reverse().map((r) => ({ r, items: CASE_POOL.filter((i) => rarityIn(i) === r) })),
    [],
  );

  const tick = useCallback(() => {
    if (hud.get().jukeSettings.muted) return;
    const c = audio();
    if (!c || c.state !== "running") return;
    tone(c, c.currentTime, 0.04, 1500 + Math.random() * 80, "square", 0.25);
  }, []);

  // Runs the animation once the strip for `run` is on screen.
  useEffect(() => {
    if (phase !== "spinning" || !run || !strip.current || !viewport.current) return;
    const el = strip.current;
    const vw = viewport.current.clientWidth;
    const target = WINNER_AT * PITCH + TILE / 2 + run.jitter * TILE - vw / 2;
    const ms = (reducedMotion() ? REDUCED_S : SPIN_S) * 1000;
    const fx = !reducedMotion();
    const t0 = performance.now();
    let lastIdx = -1;
    let lastX = 0;
    let lastT = t0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const x = target * ease(t);
      el.style.transform = `translate3d(${-x}px,0,0)`;
      const idx = Math.floor((x + vw / 2) / PITCH);
      if (idx !== lastIdx) {
        if (lastIdx >= 0 && fx) tick();
        lastIdx = idx;
      }
      const dt = now - lastT;
      if (dt > 0) {
        const v = ((x - lastX) / dt) * 1000;
        el.dataset.speed = v > 1800 ? "fast" : v > 700 ? "mid" : "slow";
        lastX = x;
        lastT = now;
      }
      if (t < 1) raf.current = requestAnimationFrame(frame);
      else {
        el.dataset.speed = "slow";
        if (live.current) setPhase("reveal");
      }
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, run, tick]);

  const open = async () => {
    if (phase === "waiting" || phase === "spinning") return;
    setError(null);
    setPhase("waiting");
    audio(); // wakes the audio inside the click that asked for it
    let winner: Item;
    try {
      winner = await roll();
    } catch (e) {
      if (live.current) {
        setError(e instanceof Error ? e.message : "Couldn't open the case.");
        setPhase("idle");
      }
      return;
    }
    if (!live.current) return;
    if (strip.current) strip.current.style.transform = "translate3d(0,0,0)";
    setRun(buildRun(winner));
    setPhase("spinning");
  };

  const busy = phase === "waiting" || phase === "spinning";
  const shown = run && phase !== "idle" && phase !== "waiting" ? run.tiles : null;
  const won = phase === "reveal" ? run?.winner : undefined;
  const hours = Math.round(CASE_TRADE_LOCK_MS / 3_600_000);

  return (
    <Modal title={`🏮 ${CASE_NAME}`} wide="xl">
      <div className="cs-top">
        <CaseArt opening={busy} />
        <div className="cs-info">
          <p>A key opens it. Everything inside is cosmetic, tradeable and found nowhere else.</p>
          <div className="cs-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void open()}>
              {phase === "reveal" ? "Open another" : "Open case"} · {coins(keyPrice)}
            </button>
            {phase === "reveal" && (
              <button type="button" onClick={() => hud.set({ panel: null })}>
                Close
              </button>
            )}
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </div>

      <div className={`cs-roulette${busy ? " live" : ""}`} ref={viewport}>
        <ul className="cs-strip" ref={strip} data-speed="slow" aria-hidden={busy}>
          {(shown ?? preview).map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the strip is positional; a winner repeats items
            <Tile key={i} item={it} hidden={!won} won={!!won && i === WINNER_AT} />
          ))}
        </ul>
        <span className="cs-marker" aria-hidden="true" />
        <span className="cs-fade l" />
        <span className="cs-fade r" />
      </div>

      {won && <Reveal item={won} hours={hours} />}

      <h3>Contains</h3>
      <div className="cs-contains">
        {byRarity.map(({ r, items }) => (
          <section key={r} className="cs-group" style={{ "--r": RARITY_COLOR[r] } as CSSProperties}>
            <h4>
              <span style={{ color: RARITY_COLOR[r] }}>{r}</span>
              <span className="muted small"> · {items.length}</span>
            </h4>
            <ul>
              {items.map((it) => (
                <li key={it.id} title={it.blurb} className={won?.id === it.id ? "got" : undefined}>
                  <ItemImage item={it} look={LOOK} bare />
                  <span className="cs-name">{it.name}</span>
                  <span className="cs-slot">{slotLabel(it)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <PlayerHint />
    </Modal>
  );
}

/** Who is opening, for the wallet; nothing to show yet because the key is not charged in this mock. */
function PlayerHint() {
  const me = useHud((s) => s.me);
  return me ? null : <p className="muted small">Preview: no coins are spent.</p>;
}

function Reveal({ item, hours }: { item: Item; hours: number }) {
  const rarity = rarityIn(item);
  return (
    <div className="cs-reveal" style={{ "--r": RARITY_COLOR[rarity] } as CSSProperties} role="status">
      <div className="cs-big">
        <ItemImage item={item} look={LOOK} bare />
      </div>
      <div className="cs-reveal-text">
        <span className="cs-rarity" style={{ color: RARITY_COLOR[rarity] }}>
          {rarity} · {slotLabel(item)}
        </span>
        <strong>{item.name}</strong>
        {item.blurb && <span className="muted">{item.blurb}</span>}
        <span className="muted small">Tradeable after {hours}h</span>
      </div>
    </div>
  );
}
