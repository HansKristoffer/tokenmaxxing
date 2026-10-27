import {
  type Bet,
  type BetOn,
  colorOf,
  MAX_BETS,
  MAX_SPIN,
  PAYS,
  type Settled,
  WHEEL,
} from "@tokenmaxxing/core/roulette.ts";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { Modal, useRun } from "./ui.tsx";

const CHIPS = [5, 10, 25, 50, 100];
const SPIN_MS = 4000;
const HISTORY = 12;
const STEP = 360 / WHEEL.length;
/** Three rows of the grid, top to bottom: 3, 6, 9... then 2, 5... then 1, 4... (columns c3, c2, c1). */
const ROWS = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, i) => i * 3 + r));
const OUTSIDE: { on: BetOn; label: string }[] = [
  { on: "low", label: "1-18" },
  { on: "even", label: "Even" },
  { on: "red", label: "Red" },
  { on: "black", label: "Black" },
  { on: "odd", label: "Odd" },
  { on: "high", label: "19-36" },
];

const sum = (bets: readonly Bet[]) => bets.reduce((a, b) => a + b.stake, 0);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const NAMES: Record<string, string> = {
  d1: "1st 12",
  d2: "2nd 12",
  d3: "3rd 12",
  c1: "Column 1",
  c2: "Column 2",
  c3: "Column 3",
};
const betName = (on: BetOn): string =>
  on.startsWith("n:")
    ? `Number ${on.slice(2)}`
    : (OUTSIDE.find((o) => o.on === on)?.label ?? NAMES[on] ?? on);

const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r] as const;
};

/** The wheel: pockets in wheel order. `angle` turns it; the ball arm turns the other way and stops at the top. */
function Wheel({
  wheel,
  arm,
  animate,
  ballIn,
}: {
  wheel: number;
  arm: number;
  animate: boolean;
  ballIn: boolean;
}) {
  const t = animate ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.6, 0.2, 1)` : "none";
  return (
    <div className="rl-wheel" aria-hidden="true">
      <div className="rl-wheel-rot" style={{ transform: `rotate(${wheel}deg)`, transition: t }}>
        <svg viewBox="-100 -100 200 200" role="img" aria-label="Roulette wheel">
          <circle r="99" className="rl-rim" />
          {WHEEL.map((n, i) => {
            const [x1, y1] = pt((i - 0.5) * STEP, 88);
            const [x2, y2] = pt((i + 0.5) * STEP, 88);
            const [x3, y3] = pt((i + 0.5) * STEP, 62);
            const [x4, y4] = pt((i - 0.5) * STEP, 62);
            const [tx, ty] = pt(i * STEP, 75);
            return (
              <g key={n}>
                <path
                  className={`rl-pocket ${colorOf(n)}`}
                  d={`M${x1} ${y1}A88 88 0 0 1 ${x2} ${y2}L${x3} ${y3}A62 62 0 0 0 ${x4} ${y4}Z`}
                />
                <text x={tx} y={ty} transform={`rotate(${i * STEP} ${tx} ${ty})`} className="rl-pn">
                  {n}
                </text>
              </g>
            );
          })}
          <circle r="58" className="rl-hub" />
          <circle r="14" className="rl-cap" />
        </svg>
      </div>
      <div className="rl-arm" style={{ transform: `rotate(${arm}deg)`, transition: t }}>
        <span className={`rl-ball${ballIn ? " in" : ""}`} />
      </div>
      <span className="rl-pointer" />
    </div>
  );
}

function Spot({
  on,
  className,
  stake,
  onAdd,
  onRemove,
  children,
}: {
  on: BetOn;
  className: string;
  stake: number;
  onAdd: (on: BetOn) => void;
  onRemove: (on: BetOn) => void;
  children: React.ReactNode;
}) {
  const click = (e: MouseEvent) => (e.shiftKey ? onRemove(on) : onAdd(on));
  return (
    <button
      type="button"
      className={`rl-spot ${className}${stake ? " has" : ""}`}
      aria-label={`${betName(on)}${stake ? `, ${stake} coins` : ""}`}
      onClick={click}
      onContextMenu={(e) => {
        e.preventDefault();
        onRemove(on);
      }}
    >
      {children}
      {stake > 0 && <span className="rl-stack">{stake}</span>}
    </button>
  );
}

/**
 * A solo roulette table against the house. The server settles a spin (`town.spinRoulette`) and returns the pocket
 * before the wheel turns; the wheel then only lands on it.
 */
export function RoulettePanel() {
  const wallet = useHud((s) => s.wallet);
  const [chip, setChip] = useState(10);
  /** Every chip put down, oldest first; Undo takes the last. */
  const [placed, setPlaced] = useState<Bet[]>([]);
  const [wheel, setWheel] = useState(0);
  const [arm, setArm] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Settled | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const { error, busy, run } = useRun();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const stakes = new Map<BetOn, number>();
  for (const p of placed) stakes.set(p.on, (stakes.get(p.on) ?? 0) + p.stake);
  const bets: Bet[] = [...stakes].map(([on, stake]) => ({ on, stake }));
  const total = sum(bets);
  const balance = wallet?.balance ?? 0;
  const locked = spinning || busy;

  const why =
    bets.length === 0
      ? "Place a bet to spin."
      : bets.length > MAX_BETS
        ? `At most ${MAX_BETS} different bets a spin.`
        : total > MAX_SPIN
          ? `The table takes at most ${MAX_SPIN} coins a spin.`
          : total > balance
            ? "You don't have enough coins for these bets."
            : null;

  const add = (on: BetOn) => {
    if (locked) return;
    if (!stakes.has(on) && stakes.size >= MAX_BETS) return;
    if (total + chip > MAX_SPIN) return;
    setPlaced((p) => [...p, { on, stake: chip }]);
  };
  const remove = (on: BetOn) => {
    if (locked) return;
    setPlaced((p) => {
      const i = p.findLastIndex((x) => x.on === on);
      return i < 0 ? p : p.filter((_, j) => j !== i);
    });
  };

  const spin = run(async () => {
    if (why) return;
    setResult(null);
    const r = await town.spinRoulette(bets);
    const { spin: s } = r;
    setSpinning(true);
    const i = WHEEL.indexOf(s.pocket as (typeof WHEEL)[number]);
    const finish = () => {
      hud.set({ wallet: r.wallet });
      setResult(s);
      setHistory((h) => [s.pocket, ...h].slice(0, HISTORY));
      setSpinning(false);
    };
    if (reduced()) {
      setAnimate(false);
      setWheel((w) => w - ((((w + i * STEP) % 360) + 360) % 360));
      setArm((a) => Math.round(a / 360) * 360);
      finish();
      return;
    }
    // Land pocket `i` at the top, where the ball ends; always forwards by a few turns.
    setAnimate(true);
    setWheel((w) => {
      const target = -i * STEP;
      return target + Math.ceil((w + 360 * 3 - target) / 360) * 360;
    });
    setArm((a) => Math.floor(a / 360) * 360 - 360 * 5);
    await new Promise<void>((resolve) => {
      timer.current = setTimeout(resolve, SPIN_MS + 100);
    });
    finish();
  });

  if (!wallet) return <Modal title="🎡 Roulette">Loading…</Modal>;

  const net = result ? result.payout - result.staked : 0;
  const stakeOf = (on: BetOn) => stakes.get(on) ?? 0;
  const spot = (on: BetOn, className: string, label: React.ReactNode) => (
    <Spot key={on} on={on} className={className} stake={stakeOf(on)} onAdd={add} onRemove={remove}>
      {label}
    </Spot>
  );

  return (
    <Modal title="🎡 Roulette" wide="xl">
      <div className="rl-bar">
        <span className="coin-chip on">
          <strong>{coins(wallet.balance)}</strong> yours
        </span>
        <span className="muted small">Single zero · {coins(MAX_SPIN)} a spin at most</span>
        <button type="button" className="shop-leave" onClick={() => hud.set({ panel: null })}>
          Leave
        </button>
      </div>
      <div className="rl-main">
        <div className="rl-left">
          <Wheel wheel={wheel} arm={arm} animate={animate} ballIn={spinning || result !== null} />
          <div className="rl-history" title="Last pockets">
            {history.length === 0 && <span className="muted small">No spins yet</span>}
            {history.map((n, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the same pocket can repeat; the strip only ever shifts.
              <span key={i} className={`rl-hist ${colorOf(n)}`}>
                {n}
              </span>
            ))}
          </div>
        </div>
        <div className="rl-right">
          <div className="rl-board">
            {spot("n:0", "green rl-zero", "0")}
            {ROWS.map((row, r) => row.map((n) => spot(`n:${n}`, `${colorOf(n)} rl-r${r + 1}`, n)))}
            {(["c3", "c2", "c1"] as const).map((c, r) => spot(c, `rl-col rl-r${r + 1}`, "2:1"))}
            {(["d1", "d2", "d3"] as const).map((d, i) =>
              spot(d, `rl-dozen rl-d${i + 1}`, ["1st 12", "2nd 12", "3rd 12"][i]),
            )}
            {OUTSIDE.map((o, i) =>
              spot(o.on, `rl-out ${o.on === "red" || o.on === "black" ? o.on : ""} rl-o${i + 1}`, o.label),
            )}
          </div>
          <div className="rl-chips">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={chip === c}
                className={`rl-chip${chip === c ? " on" : ""}`}
                onClick={() => setChip(c)}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              disabled={locked || placed.length === 0}
              onClick={() => setPlaced((p) => p.slice(0, -1))}
            >
              Undo
            </button>
            <button type="button" disabled={locked || placed.length === 0} onClick={() => setPlaced([])}>
              Clear
            </button>
            <span className="rl-total">
              Staked <strong>{coins(total)}</strong> on {bets.length} {bets.length === 1 ? "spot" : "spots"}
            </span>
          </div>
          <p className="muted small rl-legend">
            Click to add a chip · right-click or shift-click to take one off · Number {PAYS.n!}:1 · Dozen and
            column {PAYS.d1}:1 · Red, black, odd, even, 1-18, 19-36 {PAYS.red}:1 · Zero loses every outside
            bet.
          </p>
          <div className="rl-go">
            <button
              type="button"
              className="primary rl-spin"
              disabled={locked || why !== null}
              onClick={spin}
            >
              {spinning ? "Spinning…" : result ? "Spin again" : "Spin"}
            </button>
            {why && !locked && <span className="muted small">{why}</span>}
          </div>
          {error && <p className="error">{error}</p>}
          {result && !spinning && (
            <div className="rl-result" role="status">
              <div className="rl-res-head">
                <span className={`rl-hist big ${result.color}`}>{result.pocket}</span>
                <span className="rl-res-name">{result.color}</span>
                <strong className={`rl-net ${net > 0 ? "up" : net < 0 ? "down" : ""}`}>
                  {signed(net)} 🪙
                </strong>
              </div>
              <ul className="rl-res-list">
                {result.results.map((b) => (
                  <li key={b.on} className={b.won ? "won" : "lost"}>
                    <span>{betName(b.on)}</span>
                    <span className="muted">{b.stake}</span>
                    <strong>{b.won ? `+${b.payout - b.stake}` : `-${b.stake}`}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
