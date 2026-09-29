import { secondsUntil } from "@tokenmaxxing/core/format.ts";
import { PICKS, type Pick, type SprView } from "@tokenmaxxing/core/games/spr.ts";
import type { GameProps } from "./types.ts";

const ORDER: Pick[] = ["ship", "pivot", "raise"];

export function Spr({ view, info, you, now, move, name }: GameProps<SprView>) {
  const other = view.players.find((p) => p !== you) ?? view.players[1];
  const last = view.rounds.at(-1);
  const seconds = secondsUntil(view.deadline, now);
  return (
    <div className="spr">
      <div className="spr-score">
        {view.players.map((p) => (
          <span key={p} className={p === you ? "me" : undefined}>
            {name(p)} {"★".repeat(view.wins[p] ?? 0)}
            <span className="muted">{"☆".repeat(3 - (view.wins[p] ?? 0))}</span>
          </span>
        ))}
      </div>
      {view.revealUntil !== null && last ? (
        <div className="spr-reveal">
          {view.players.map((p) => (
            <span key={p} className="big">
              {last.picks[p] ? PICKS[last.picks[p]!].emoji : "⌛"}
            </span>
          ))}
          <p>
            {last.winner === null
              ? "Draw: play it again"
              : `${name(last.winner)} wins the round${
                  last.picks[last.winner] && last.picks[view.players.find((p) => p !== last.winner)!]
                    ? `: ${PICKS[last.picks[last.winner]!].why}`
                    : ""
                }`}
          </p>
        </div>
      ) : info.outcome ? null : (
        <>
          <p className="muted">
            Round {view.rounds.length + 1} · {seconds}s to pick
          </p>
          {you !== null && !view.mine ? (
            <div className="spr-picks">
              {ORDER.map((p) => (
                <button key={p} type="button" className="card" onClick={() => move({ pick: p })}>
                  <span className="big">{PICKS[p].emoji}</span>
                  {p[0]!.toUpperCase() + p.slice(1)}
                  <small className="muted">beats {PICKS[p].beats}</small>
                </button>
              ))}
            </div>
          ) : (
            <p>
              {you !== null && view.mine && `You picked ${PICKS[view.mine].emoji}. `}
              {view.players
                .filter((p) => p !== you)
                .map((p) => `${name(p)} ${view.picked[p] ? "has picked ✓" : "is thinking…"}`)
                .join(" · ")}
            </p>
          )}
          {you !== null && view.mine === null && view.picked[other!] && (
            <p className="muted small">{name(other!)} has picked. Your move!</p>
          )}
        </>
      )}
      {view.rounds.length > 0 && (
        <ol className="spr-history">
          {view.rounds.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rounds are only ever appended
            <li key={i}>
              {view.players.map((p) => (r.picks[p] ? PICKS[r.picks[p]!].emoji : "⌛")).join(" vs ")}{" "}
              <span className="muted">{r.winner === null ? "draw" : name(r.winner)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
