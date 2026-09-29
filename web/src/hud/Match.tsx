import { gameOf } from "@tokenmaxxing/core/games/index.ts";
import { MAX_SIDE_BET, MAX_STAKE, odds, potShares, SPLITS } from "@tokenmaxxing/core/games/payouts.ts";
import type { Frame } from "@tokenmaxxing/core/games/wire.ts";
import { defaultLook } from "@tokenmaxxing/core/world.ts";
import { useEffect, useState } from "react";
import { world } from "../game/world.ts";
import { COMPONENTS } from "../games/index.ts";
import { arcade, closeMatch, conn, errorText, matchConn } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { AvatarImage, Modal } from "./ui.tsx";

/** Re-renders a few times a second, for countdowns. */
function useTicker(ms: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

const lookOf = (userId: number) => world.avatars.get(userId)?.info.look ?? defaultLook(userId);

/** The shared frame around every game: players, pot, timer, forfeit, side bets and the end screen. */
export function MatchPanel({ id }: { id: number }) {
  const frame = useHud((s) => s.frame);
  const skew = useHud((s) => s.clockSkew);
  const [error, setError] = useState<string | null>(null);
  useTicker(250);
  useEffect(() => () => closeMatch(), []);
  if (!frame || frame.info.id !== id) return <Modal title="🎮 Game">Loading…</Modal>;
  const { info, you } = frame;
  const def = gameOf(info.game)!;
  const Game = COMPONENTS[info.game];
  const now = Date.now() - skew;
  const call = (fn: () => Promise<unknown>) => () => {
    setError(null);
    fn().catch((err) => setError(errorText(err)));
  };
  const move = (m: unknown) => call(() => matchConn!.move(m))();

  return (
    <Modal title={`${def.emoji} ${def.name}`} wide>
      <div className="match-head">
        <ul className="match-players">
          {info.players.map((p) => (
            <li key={p.userId} className={p.userId === you ? "me" : undefined}>
              <AvatarImage look={lookOf(p.userId)} scale={3} />
              <span>{p.name}</span>
              {info.bets[p.userId] && (
                <small className="muted">
                  🎲 🪙 {info.bets[p.userId]} · ×{odds(betList(frame), p.userId)?.toFixed(1)}
                </small>
              )}
            </li>
          ))}
        </ul>
        <p className="match-pot">
          🪙 <strong>{info.pot}</strong> pot
          {info.players.length > 2 && <small className="muted"> · {SPLITS[info.split]}</small>}
          {frame.watchers > 0 && <small className="muted"> · 👀 {frame.watchers}</small>}
        </p>
      </div>
      {Game ? <Game view={frame.view} info={info} you={you} now={now} move={move} /> : <p>Unknown game.</p>}
      {info.outcome ? (
        <Result frame={frame} onError={setError} />
      ) : you !== null ? (
        <button type="button" className="danger" onClick={call(() => matchConn!.forfeit())}>
          Forfeit (your stake stays in the pot)
        </button>
      ) : (
        <SideBet frame={frame} now={now} onError={setError} />
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

/** Every side bet so far, as `odds` wants them (just the pools per player matter). */
const betList = (frame: Frame) =>
  Object.entries(frame.info.bets).map(([on, amount]) => ({ userId: 0, on: Number(on), amount }));

function SideBet({
  frame,
  now,
  onError,
}: {
  frame: Frame;
  now: number;
  onError: (e: string | null) => void;
}) {
  const lobby = useHud((s) => s.lobby);
  const wallet = useHud((s) => s.wallet);
  const [on, setOn] = useState(frame.info.players[0]!.userId);
  const [amount, setAmount] = useState(10);
  const mine = lobby?.me.bets[frame.info.id];
  const left = Math.ceil((frame.info.betsCloseAt - now) / 1000);
  if (mine) {
    const who = frame.info.players.find((p) => p.userId === mine.on)?.name;
    return (
      <p className="muted">
        You bet 🪙 {mine.amount} on {who}.
      </p>
    );
  }
  if (left <= 0) return <p className="muted small">👀 Watching · side bets are closed.</p>;
  const cap = Math.min(MAX_SIDE_BET, wallet?.balance ?? 0);
  return (
    <form
      className="side-bet"
      onSubmit={(e) => {
        e.preventDefault();
        onError(null);
        arcade.bet(frame.info.id, on, amount).catch((err) => onError(errorText(err)));
      }}
    >
      <span>🎲 Side bet ({left}s left):</span>
      <select value={on} onChange={(e) => setOn(Number(e.target.value))}>
        {frame.info.players.map((p) => (
          <option key={p.userId} value={p.userId}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={cap}
        value={amount}
        onChange={(e) => setAmount(Math.max(1, Math.min(cap, Number(e.target.value))))}
      />
      <button type="submit" className="primary" disabled={cap < 1}>
        Bet 🪙 {amount}
      </button>
    </form>
  );
}

/** Who won what, then double or nothing (1v1) and the way back. */
function Result({ frame, onError }: { frame: Frame; onError: (e: string | null) => void }) {
  const { info, you } = frame;
  const outcome = info.outcome!;
  const name = (id: number) => info.players.find((p) => p.userId === id)?.name ?? "?";
  if ("void" in outcome)
    return (
      <div className="match-result">
        <p>{outcome.void} Everyone got their coins back.</p>
      </div>
    );
  const shares = potShares(outcome.places, info.pot, info.split);
  const medals = ["🥇", "🥈", "🥉"];
  const back = () => {
    void conn.back();
    hud.set({ panel: null });
  };
  return (
    <div className="match-result">
      <ol>
        {outcome.places.map((group, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: places are fixed once the game is over
          <li key={i}>
            {medals[i] ?? `${i + 1}.`} {group.map(name).join(" & ")}
            {group.map((id) => shares.get(id) ?? 0).some((n) => n > 0) && (
              <strong> +🪙 {group.map((id) => shares.get(id) ?? 0).reduce((a, b) => a + b, 0)}</strong>
            )}
          </li>
        ))}
      </ol>
      {you !== null && (
        <div className="row-actions">
          {info.players.length === 2 && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                onError(null);
                arcade.rematch(info.id).catch((err) => onError(errorText(err)));
              }}
            >
              {info.stake > 0
                ? `🔁 Double or nothing · 🪙 ${Math.min(MAX_STAKE, info.stake * 2)}`
                : "🔁 Rematch"}
            </button>
          )}
          <button type="button" onClick={back}>
            ↩ Back to where I was
          </button>
        </div>
      )}
    </div>
  );
}
