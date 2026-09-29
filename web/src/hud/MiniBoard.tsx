import { compact } from "@tokenmaxxing/core/format.ts";
import { hud, useHud } from "../store.ts";

const SHOWN = 5;

/** Always in the top-right corner: today's top five, and me if I'm further down. */
export function MiniBoard() {
  const board = useHud((s) => s.board);
  const top = board.filter((r) => r.tokens > 0).slice(0, SHOWN);
  const me = board.find((r) => r.isMe);
  const rows = me && !top.includes(me) ? [...top, me] : top;

  return (
    <section className="panel miniboard" aria-label="Today's leaderboard">
      <button
        type="button"
        className="miniboard-title"
        onClick={() => hud.set({ panel: { kind: "leaderboard" } })}
      >
        🏆 Today <span className="muted">· all ›</span>
      </button>
      {rows.length === 0 ? (
        <p className="muted small">Nobody has run an agent yet today.</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={r.userId} className={r.isMe ? "mine" : ""}>
              <button type="button" onClick={() => hud.set({ panel: { kind: "card", userId: r.userId } })}>
                <span className="rank">{r.tokens > 0 ? `#${r.rank}` : "–"}</span>
                <span className="who">{r.name}</span>
                <span className="value">{compact(r.tokens)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
