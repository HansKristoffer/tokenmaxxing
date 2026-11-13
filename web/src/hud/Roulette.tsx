import {
  type Bet,
  type BetOn,
  colorOf,
  MAX_BETS,
  MAX_SPIN,
  PAYS,
  type RouletteState,
  SPIN_MS,
  SPOTS,
  WHEEL,
} from "@tokenmaxxing/core/roulette.ts";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { sitRoulette } from "../game/input.ts";
import { world } from "../game/world.ts";
import { conn, refreshWallet } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { Modal, useTicker } from "./ui.tsx";

type Table = RouletteState & { at: number };

const CHIPS = [5, 10, 25, 50, 100];
const HISTORY = 12;
const DOCK_HISTORY = 5;
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

const PLAYER_COLORS = [
  "#e9b73d",
  "#4aa3ff",
  "#c46bff",
  "#ff8a4a",
  "#4ade80",
  "#f472b6",
  "#22d3ee",
  "#a3e635",
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
const LEGEND = `Number ${PAYS.n!}:1 · Dozen and column ${PAYS.d1}:1 · Red, black, odd, even, 1-18, 19-36 ${PAYS.red}:1 · Zero loses every outside bet.`;

const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r] as const;
};

/** Milliseconds left in the table's phase, on the server's clock. */
const phaseLeft = (table: Table | null) =>
  table ? Math.max(0, table.phaseEndsAt - (Date.now() + (table.now - table.at))) : 0;

/** What the table is doing, in a line: "Bets close in 14s", "17 red". */
const statusLine = (table: Table | null, left: number) => {
  const phase = table?.phase;
  const last = table?.last;
  return phase === "betting"
    ? `Bets close in ${Math.ceil(left / 1000)}s`
    : phase === "spinning"
      ? "No more bets…"
      : phase === "result" && last
        ? `${last.pocket} ${last.color}`
        : "Waiting for a player";
};

const colorOfUser = (table: Table | null, id: number) =>
  PLAYER_COLORS[table?.seats.find((x) => x.userId === id)?.spot ?? 0]!;

/** The wheel: pockets in wheel order. `angle` turns it; the ball arm turns the other way and stops at the top. */
function Wheel({ table }: { table: Table | null }) {
  const [wheel, setWheel] = useState(0);
  const [arm, setArm] = useState(0);
  const [animate, setAnimate] = useState(false);
  const seen = useRef(table?.phase === "spinning" ? 0 : (table?.last?.id ?? 0));
  const mounted = useRef(false);
  const lastId = table?.last?.id ?? 0;
  const phase = table?.phase;

  /** Turns the wheel and ball to land on `pocket`, always forwards by a few turns. */
  const landOn = (pocket: number, animated: boolean) => {
    const i = WHEEL.indexOf(pocket as (typeof WHEEL)[number]);
    if (i < 0) return;
    if (reduced() || !animated) {
      setAnimate(false);
      setWheel((w) => w - ((((w + i * STEP) % 360) + 360) % 360));
      setArm((a) => Math.round(a / 360) * 360);
      return;
    }
    setAnimate(true);
    setWheel((w) => {
      const target = -i * STEP;
      return target + Math.ceil((w + 360 * 3 - target) / 360) * 360;
    });
    setArm((a) => Math.floor(a / 360) * 360 - 360 * 5);
  };
  // The wheel lands on each spin once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the spin id and phase alone.
  useEffect(() => {
    const last = table?.last;
    if (!mounted.current) {
      // Opened between spins: the wheel already stands on the last pocket.
      mounted.current = true;
      if (last && phase !== "spinning") landOn(last.pocket, false);
    }
    if (last && last.id !== seen.current) {
      seen.current = last.id;
      landOn(last.pocket, phase === "spinning");
    }
  }, [lastId, phase]);

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
        <span className={`rl-ball${table?.last && phase !== "betting" ? " in" : ""}`} />
      </div>
      <span className="rl-pointer" />
    </div>
  );
}

/** The last pockets, newest first. */
function History({ table, count }: { table: Table | null; count: number }) {
  const strip = (table?.history ?? []).slice(0, count);
  return (
    <div className="rl-history" title="Last pockets">
      {strip.length === 0 && <span className="muted small">No spins yet</span>}
      {strip.map((n, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the same pocket can repeat; the strip only ever shifts.
        <span key={i} className={`rl-hist ${colorOf(n)}`}>
          {n}
        </span>
      ))}
    </div>
  );
}

function Spot({
  on,
  className,
  stake,
  others,
  onAdd,
  onRemove,
  children,
}: {
  on: BetOn;
  className: string;
  stake: number;
  /** Other players' chips on this spot, in their colours. */
  others: { color: string; name: string; stake: number }[];
  onAdd: (on: BetOn) => void;
  onRemove: (on: BetOn) => void;
  children: ReactNode;
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
      {others.length > 0 && (
        <span className="rl-others">
          {others.map((o) => (
            <i key={o.name} title={`${o.name}: ${o.stake}`} style={{ background: o.color }}>
              {o.stake}
            </i>
          ))}
        </span>
      )}
    </button>
  );
}

/**
 * The net cafe's roulette table, docked while you hold a spot at it, like the poker table: bets are open for a
 * while, then the wheel spins once for the whole table and pays everyone. The server owns the rounds
 * (`rouletteBet`, `rouletteReady`); walking off the spot or Leave table gives it up.
 */
export function Roulette() {
  const seated = useHud((s) => s.roulette?.seats.some((x) => x.userId === world.selfId) ?? false);
  const wallet = useHud((s) => s.wallet);
  // A fresh board every time you sit down.
  return seated && wallet ? <RouletteDock /> : null;
}

function RouletteDock() {
  const wallet = useHud((s) => s.wallet);
  const table = useHud((s) => s.roulette);
  const me = world.selfId;
  useTicker(250);
  const mine = table?.players.find((p) => p.userId === me) ?? null;
  const [chip, setChip] = useState(10);
  /** Every chip put down this round, oldest first; Undo takes the last. */
  const [placed, setPlaced] = useState<Bet[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const round = useRef(table?.round ?? 0);
  const flight = useRef<{ busy: boolean; dirty: boolean; bets: Bet[] }>({
    busy: false,
    dirty: false,
    bets: [],
  });

  // A new round starts with an empty board.
  useEffect(() => {
    if (!table || table.round === round.current) return;
    round.current = table.round;
    setPlaced([]);
  }, [table]);
  // The wallet follows what the round paid.
  const phase = table?.phase;
  useEffect(() => {
    if (phase === "result") void refreshWallet();
  }, [phase]);

  const stakes = new Map<BetOn, number>();
  for (const p of placed) stakes.set(p.on, (stakes.get(p.on) ?? 0) + p.stake);
  const bets: Bet[] = [...stakes].map(([on, stake]) => ({ on, stake }));
  const total = sum(bets);
  const left = phaseLeft(table);
  const open = !!table && phase === "betting" && left > 0;
  const balance = (wallet?.balance ?? 0) + sum(mine?.bets ?? []);

  /** Sends the whole bet set; one at a time (the server refuses overlapping ones), the latest set wins. */
  const push = async (next: Bet[]) => {
    const f = flight.current;
    f.bets = next;
    if (f.busy) {
      f.dirty = true;
      return;
    }
    f.busy = true;
    try {
      do {
        f.dirty = false;
        const r = await conn.rouletteBet(f.bets);
        setProblem(r && "notice" in r ? r.notice : null);
      } while (f.dirty);
      void refreshWallet();
    } finally {
      f.busy = false;
    }
  };
  const set = (next: Bet[]) => {
    setPlaced(next);
    const m = new Map<BetOn, number>();
    for (const p of next) m.set(p.on, (m.get(p.on) ?? 0) + p.stake);
    void push([...m].map(([on, stake]) => ({ on, stake })));
  };
  const add = (on: BetOn) => {
    if (!open) return;
    if (!stakes.has(on) && stakes.size >= MAX_BETS) return;
    if (total + chip > MAX_SPIN || total + chip > balance) return;
    set([...placed, { on, stake: chip }]);
  };
  const remove = (on: BetOn) => {
    if (!open) return;
    const i = placed.findLastIndex((x) => x.on === on);
    if (i >= 0) set(placed.filter((_, j) => j !== i));
  };
  const ready = async () => {
    const r = await conn.rouletteReady(!mine?.ready);
    setProblem(r && "notice" in r ? r.notice : null);
  };

  const last = table?.last ?? null;
  const players = table?.players ?? [];
  const readyCount = players.filter((p) => p.ready).length;
  const mineOut = phase === "result" ? last?.results.find((o) => o.userId === me) : undefined;
  const status =
    phase === "betting"
      ? `${statusLine(table, left)} · ${readyCount}/${players.length} ready`
      : mineOut
        ? `${statusLine(table, left)} · You ${signed(mineOut.payout - mineOut.staked)}`
        : statusLine(table, left);
  const othersOn = (on: BetOn) =>
    players
      .filter((p) => p.userId !== me)
      .flatMap((p) => {
        const stake = sum(p.bets.filter((b) => b.on === on));
        const name = table?.seats.find((x) => x.userId === p.userId)?.name ?? "?";
        return stake > 0 ? [{ color: colorOfUser(table, p.userId), name, stake }] : [];
      });
  const spot = (on: BetOn, className: string, label: ReactNode) => (
    <Spot
      key={on}
      on={on}
      className={className}
      stake={stakes.get(on) ?? 0}
      others={othersOn(on)}
      onAdd={add}
      onRemove={remove}
    >
      {label}
    </Spot>
  );

  return (
    <section className="panel poker rl-dock" aria-label="Roulette table">
      <header>
        <strong className="title">🎡 Roulette · single zero</strong>
        <span className={open ? "pk-status mine" : "pk-status"} role="status">
          {status}
        </span>
        <button type="button" onClick={() => void conn.rouletteLeave()}>
          Leave table
        </button>
      </header>
      <div className="rl-dock-main">
        <div className="rl-dock-wheel">
          <Wheel table={table} />
          <History table={table} count={DOCK_HISTORY} />
        </div>
        <div
          className="rl-board"
          title={`Click to add a chip, right-click or shift-click to take one off. ${LEGEND}`}
        >
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
          disabled={!open || placed.length === 0}
          onClick={() => set(placed.slice(0, -1))}
        >
          Undo
        </button>
        <button type="button" disabled={!open || placed.length === 0} onClick={() => set([])}>
          Clear
        </button>
        <span className="rl-total muted small">
          {bets.length === 0 ? (
            "Click the board to bet"
          ) : (
            <>
              Staked <strong>{coins(total)}</strong>
            </>
          )}
          <br />
          {coins(wallet?.balance ?? 0)} yours
        </span>
        <button
          type="button"
          className="primary rl-spin"
          aria-pressed={!!mine?.ready}
          disabled={!open || bets.length === 0}
          onClick={() => void ready()}
        >
          {mine?.ready ? "Ready ✓" : "Spin now"}
        </button>
      </div>
      <ul className="rl-players">
        {(table?.seats ?? []).map((seat) => {
          const p = players.find((x) => x.userId === seat.userId);
          const out = phase === "result" ? last?.results.find((o) => o.userId === seat.userId) : undefined;
          const net = out ? out.payout - out.staked : 0;
          const staked = p ? sum(p.bets) : 0;
          return (
            <li key={seat.userId}>
              <i className="rl-dot" style={{ background: PLAYER_COLORS[seat.spot] }} />
              {seat.userId === me ? "You" : seat.name}
              {out ? (
                <strong className={net > 0 ? "up" : net < 0 ? "down" : ""}> {signed(net)}</strong>
              ) : (
                staked > 0 && <span className="muted"> 🪙 {staked}</span>
              )}
              {!out && p?.ready && " ✓"}
            </li>
          );
        })}
      </ul>
      {problem && (
        <p className="error small" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}

/** The roulette table from the sidelines (E on the ♦ sign): the wheel, the last spin and who is playing. */
export function RouletteWatch() {
  const table = useHud((s) => s.roulette);
  const me = world.selfId;
  useTicker(250, !!table);
  const [problem, setProblem] = useState<string | null>(null);
  const seated = table?.seats.some((x) => x.userId === me) ?? false;
  const phase = table?.phase;
  const left = phaseLeft(table);
  const status = statusLine(table, left);
  const last = table?.last ?? null;
  const landed = !!last && (phase !== "spinning" || left <= 0);
  const take = async () => {
    setProblem(null);
    if (await sitRoulette()) hud.set({ panel: null });
    else setProblem("Walk onto a free spot below the table first.");
  };

  return (
    <Modal title="🎡 Roulette · watching" wide="xl">
      <div className="rl-bar">
        <span className="muted small">
          Single zero · {table?.seats.length ?? 0}/{SPOTS} at the table
        </span>
        {!seated && (table?.seats.length ?? 0) < SPOTS && (
          <button type="button" className="primary" onClick={() => void take()}>
            Take a spot
          </button>
        )}
        <button type="button" className="shop-leave" onClick={() => hud.set({ panel: null })}>
          Close
        </button>
      </div>
      <div className="rl-main">
        <div className="rl-left">
          <Wheel table={table} />
          <p className="rl-status" role="status">
            {status}
          </p>
          <History table={table} count={HISTORY} />
        </div>
        <div className="rl-right">
          {landed && last && phase !== "spinning" ? (
            <div className="rl-result" role="status">
              <div className="rl-res-head">
                <span className={`rl-hist big ${last.color}`}>{last.pocket}</span>
                <span className="rl-res-name">{last.color}</span>
              </div>
              <ul className="rl-res-list">
                {last.results.map((o) => (
                  <li key={o.userId} className={o.payout > o.staked ? "won" : "lost"}>
                    <span>
                      {o.userId === me ? "You" : o.name}{" "}
                      {o.payout > o.staked
                        ? `won ${o.payout - o.staked} on ${last.pocket} ${last.color}`
                        : `lost ${o.staked - o.payout}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted">{status}</p>
          )}
          <h4>At the table</h4>
          <ul className="rl-seats">
            {Array.from({ length: SPOTS }, (_, i) => {
              const seat = table?.seats.find((x) => x.spot === i);
              const p = seat && table?.players.find((x) => x.userId === seat.userId);
              const staked = p ? sum(p.bets) : 0;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: spots are fixed places.
                <li key={i} className={seat ? "" : "muted"}>
                  {seat && <i className="rl-dot" style={{ background: PLAYER_COLORS[i] }} />}
                  {seat ? (seat.userId === me ? `${seat.name} (you)` : seat.name) : "Open spot"}
                  {seat && staked > 0 && ` · 🪙 ${staked}`}
                  {p?.ready && " · ready ✓"}
                </li>
              );
            })}
          </ul>
          {problem && <p className="error">{problem}</p>}
        </div>
      </div>
    </Modal>
  );
}
