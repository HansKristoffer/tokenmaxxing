import { compact } from "@tokenmaxxing/core/format.ts";
import { hud, useHud } from "../store.ts";
import { RankList } from "./ui.tsx";

/** Always in the top-right corner: today's top five, and me if I'm further down (the server's `today`). */
export function MiniBoard() {
  const board = useHud((s) => s.board);
  const top = Math.max(0, ...board.map((r) => r.tokens));

  return (
    <section className="panel miniboard" aria-label="Today's leaderboard">
      <button type="button" className="plaque" onClick={() => hud.set({ panel: { kind: "leaderboard" } })}>
        Today ›
      </button>
      {board.length === 0 ? (
        <p className="muted small">Nobody has run an agent yet today.</p>
      ) : (
        <RankList
          rows={board.map((r) => ({
            id: r.userId,
            rank: r.tokens > 0 ? `#${r.rank}` : "–",
            who: r.name,
            value: compact(r.tokens),
            mine: r.isMe,
            share: top > 0 ? r.tokens / top : 0,
            open: { kind: "card", userId: r.userId },
          }))}
        />
      )}
    </section>
  );
}
