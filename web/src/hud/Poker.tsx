import {
  BIG_BLIND,
  type Card,
  cardFace,
  type Legal,
  type PokerState,
  type SeatView,
} from "@tokenmaxxing/core/poker.ts";
import { useState } from "react";
import { world } from "../game/world.ts";
import { conn } from "../net.ts";
import { useHud } from "../store.ts";
import { useTicker } from "./ui.tsx";

/** One card, face up (`cardFace`), or face down with no card. */
export function PokerCard({ card, small }: { card?: Card; small?: boolean }) {
  const cls = `pk-card${small ? " small" : ""}`;
  if (card === undefined) return <span className={`${cls} back`} role="img" aria-label="Card face down" />;
  const { rank, suit, red } = cardFace(card);
  return (
    <span className={`${cls}${red ? " red" : ""}`} role="img" aria-label={`${rank} of ${suit}`}>
      <b>{rank}</b>
      {suit}
    </span>
  );
}

/** What the table says happened, in a line: "Ada wins 45 with Pair of Aces". */
function resultLine(poker: PokerState): string | null {
  const r = poker.result;
  if (!r) return null;
  const name = (id: number) => poker.names[id] ?? "Someone";
  return Object.entries(r.won)
    .map(([id, n]) => {
      const hand = r.shown.find((s) => s.userId === Number(id))?.name;
      return `${name(Number(id))} wins 🪙 ${n}${hand ? ` with ${hand}` : ""}`;
    })
    .join(" · ");
}

const STREETS = { preflop: "Pre-flop", flop: "Flop", turn: "Turn", river: "River" } as const;

/** One seat in the list: name and stack, their bet, their last move, the dealer's button and whose turn it is. */
function SeatRow({ seat, poker, at, me }: { seat: SeatView; poker: PokerState; at: number; me: boolean }) {
  const turn = poker.toAct === at;
  return (
    <li className={`${turn ? "turn" : ""}${seat.folded ? " folded" : ""}`}>
      <span className="pk-name">
        {poker.button === at && <span title="Dealer">🔘 </span>}
        {turn ? "▶ " : ""}
        {me ? "You" : (poker.names[seat.userId] ?? "?")}
      </span>
      <span>🪙 {seat.stack}</span>
      <span className="muted small">
        {seat.last ?? (seat.bet > 0 ? `in ${seat.bet}` : seat.ready ? "" : "buying in…")}
        {seat.leaving ? " · leaving" : ""}
      </span>
    </li>
  );
}

/** Fold, check or call, and the raise: a slider from the least to all-in, nudged in big blinds. Fresh for every change to the table, so a raise starts at its least. */
function Moves({
  legal,
  bet,
  pot,
  act,
}: {
  legal: Legal;
  bet: number;
  pot: number;
  act: (type: string, to?: number) => Promise<void>;
}) {
  const [raiseTo, setRaiseTo] = useState(legal.minTo);
  const to = Math.max(legal.minTo, Math.min(raiseTo, legal.maxTo));
  return (
    <div className="pk-moves">
      <button type="button" onClick={() => void act("fold")}>
        Fold
      </button>
      {legal.canCheck ? (
        <button type="button" className="go" onClick={() => void act("check")}>
          Check
        </button>
      ) : (
        <button type="button" className="go" onClick={() => void act("call")}>
          Call 🪙 {legal.toCall}
        </button>
      )}
      {legal.canRaise && (
        <div className="pk-raise">
          <button
            type="button"
            aria-label="Less"
            onClick={() => setRaiseTo(Math.max(legal.minTo, to - BIG_BLIND))}
          >
            −
          </button>
          <input
            type="range"
            aria-label="Raise to"
            min={legal.minTo}
            max={legal.maxTo}
            step={1}
            value={to}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
          />
          <button
            type="button"
            aria-label="More"
            onClick={() => setRaiseTo(Math.min(legal.maxTo, to + BIG_BLIND))}
          >
            +
          </button>
          <button type="button" onClick={() => setRaiseTo(Math.min(legal.maxTo, Math.max(legal.minTo, pot)))}>
            Pot
          </button>
          <button type="button" onClick={() => setRaiseTo(legal.maxTo)}>
            All in
          </button>
          <button type="button" className="go" onClick={() => void act("raise", to)}>
            {bet === 0 ? "Bet" : "Raise to"} 🪙 {to}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The poker table, docked while you sit at it: your two cards, the board and the pot, the other seats, the clock,
 * and the moves. The server decides everything; the buttons only ask (`pokerAct`).
 */
export function Poker() {
  const poker = useHud((s) => s.poker);
  const hole = useHud((s) => s.pokerHole);
  const [problem, setProblem] = useState<string | null>(null);
  const mine = poker?.seats.findIndex((s) => s?.userId === world.selfId) ?? -1;
  const seat = poker && mine >= 0 ? poker.seats[mine]! : null;
  const turn = !!poker && poker.toAct === mine && !seat?.leaving;
  const legal = turn ? poker!.legal : null;
  useTicker(250, !!poker && mine >= 0);
  if (!poker || !seat || seat.leaving) return null;

  const since = Date.now() - poker.at;
  const turnS = Math.max(0, Math.ceil((poker.turnMs - since) / 1000));
  const nextS = Math.max(0, Math.ceil((poker.nextMs - since) / 1000));
  const act = async (type: string, to = 0) => setProblem(await conn.pokerAct(type, to));
  const pot = poker.pot;
  const seated = poker.seats.filter((s) => s !== null).length;
  const status = turn
    ? `Your move · ${turnS}s`
    : poker.street === null
      ? seated < 2
        ? "Waiting for another player"
        : poker.nextMs > 0
          ? `Next hand in ${nextS}s`
          : "Dealing…"
      : !seat.inHand
        ? "Watching this hand: you're in on the next"
        : seat.folded
          ? "You folded"
          : seat.allIn
            ? "You're all in"
            : poker.toAct >= 0
              ? `${poker.names[poker.seats[poker.toAct]?.userId ?? 0] ?? "…"} to act · ${turnS}s`
              : "…";
  const result = poker.street === null ? resultLine(poker) : null;

  return (
    <section className="panel poker" aria-label="Poker table">
      <header>
        <strong className="title">🃏 Hold'em · 5/10</strong>
        <span className={turn ? "pk-status mine" : "pk-status"} role="status">
          {status}
        </span>
        <button type="button" onClick={() => void conn.pokerLeave().then(setProblem)}>
          Leave table
        </button>
      </header>
      <div className="pk-felt">
        <div className="pk-cards">
          {[0, 1, 2, 3, 4].map((i) =>
            poker.board[i] === undefined ? (
              <span key={i} className="pk-card empty" />
            ) : (
              <PokerCard key={i} card={poker.board[i]} />
            ),
          )}
        </div>
        <div className="pk-pot">
          Pot 🪙 {pot}
          {poker.street && <span className="muted small"> · {STREETS[poker.street]}</span>}
        </div>
        <div className="pk-hole">
          {hole.length === 2 ? (
            hole.map((c) => <PokerCard key={c} card={c} />)
          ) : (
            <>
              <span className="pk-card empty" />
              <span className="pk-card empty" />
            </>
          )}
        </div>
      </div>
      {result && <p className="pk-result">{result}</p>}
      <ul className="pk-seats">
        {poker.seats.map(
          (s, i) => s && <SeatRow key={s.userId} seat={s} poker={poker} at={i} me={i === mine} />,
        )}
      </ul>
      {legal && <Moves key={poker.v} legal={legal} bet={poker.bet} pot={pot} act={act} />}
      {problem && (
        <p className="error small" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
