import { CASES } from "@tokenmaxxing/core/cases.ts";
import { SHOP_ROOM } from "@tokenmaxxing/core/shoprooms.ts";
import { useEffect, useState } from "react";
import { errorText } from "../errors.ts";
import { town } from "../net.ts";
import { useHud } from "../store.ts";
import { coins } from "./format.ts";
import { Modal } from "./ui.tsx";

type Leaders = Awaited<ReturnType<typeof town.caseLeaderboard>>;

/** Refetched on each visit, including after returning from a case opening. */
export function CaseLeaderboard() {
  const inShop = useHud((s) => s.room === SHOP_ROOM.natmarked);
  const me = useHud((s) => s.me);
  const [leaders, setLeaders] = useState<Leaders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version is the explicit refresh trigger.
  useEffect(() => {
    if (!inShop) return;
    let live = true;
    setLeaders(null);
    setError(null);
    void town.caseLeaderboard().then(
      (rows) => live && setLeaders(rows),
      (e) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [version, inShop]);

  if (!inShop)
    return (
      <Modal title="Case leaderboard">
        Visit Natmarked and click the board beside the entrance to see the leaderboard.
      </Modal>
    );

  return (
    <Modal title="Natmarked · Case leaderboard" wide="xl">
      <section className="cshop-board" aria-labelledby="case-board-title" aria-busy={!leaders && !error}>
        <div className="cshop-board-heading">
          <div>
            <h3 id="case-board-title">Case leaderboard</h3>
            <p className="muted small">
              All time · Top 100 by coins spent on keys. Counts include rewards sold or traded.
            </p>
          </div>
          <button type="button" disabled={!leaders && !error} onClick={() => setVersion((n) => n + 1)}>
            {error ? "Try again" : "Refresh"}
          </button>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : !leaders ? (
          <p className="muted" role="status">
            Loading case leaderboard…
          </p>
        ) : leaders.length === 0 ? (
          <p className="muted">No cases opened yet. The first opening starts the board.</p>
        ) : (
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the overflowing table must be keyboard-scrollable.
          <section className="cshop-board-scroll" aria-label="Case spending and openings" tabIndex={0}>
            <table className="cshop-board-table">
              <caption className="muted small">Ranked by coins spent; ties use total cases opened.</caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player</th>
                  <th scope="col">Coins spent</th>
                  <th scope="col">Total opened</th>
                  {CASES.map((def) => (
                    <th scope="col" key={def.id}>
                      {def.name}
                      <span className="muted small">opened</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaders.map((row, index) => (
                  <tr key={row.userId} className={row.userId === me?.userId ? "is-me" : undefined}>
                    <td>{index + 1}</td>
                    <th scope="row">
                      <span className="cshop-board-name">{row.name}</span>
                      {row.userId === me?.userId && <span className="muted small"> (you)</span>}
                    </th>
                    <td>{coins(row.spent)}</td>
                    <td>{row.opened.toLocaleString()}</td>
                    {CASES.map((def) => (
                      <td key={def.id}>{(row.cases[def.id] ?? 0).toLocaleString()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </Modal>
  );
}
