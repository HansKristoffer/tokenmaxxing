import { COUNTDOWN_MS, type HypeView, msToReach, multiplier } from "@tokenmaxxing/core/games/hype.ts";
import { sha256 } from "@tokenmaxxing/core/games/sha256.ts";
import { useEffect, useState } from "react";
import { useHud } from "../store.ts";
import type { GameProps } from "./types.ts";

const x = (n: number) => `×${(n / 100).toFixed(2)}`;

/** The server's clock every animation frame, so the line climbs smoothly. */
function useFrameNow(): number {
  const skew = useHud((s) => s.clockSkew);
  const [now, setNow] = useState(() => Date.now() - skew);
  useEffect(() => {
    let id = requestAnimationFrame(function frame() {
      setNow(Date.now() - skew);
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [skew]);
  return now;
}

export function Hype({ view, info, you, move }: GameProps<HypeView>) {
  const now = useFrameNow();
  const name = (id: number) => info.players.find((p) => p.userId === id)?.name ?? "?";
  // The last crash stays up for a moment before the next countdown.
  const next = view.rounds.length - 1;
  const i = next > 0 && now < view.rounds[next]!.startsAt - COUNTDOWN_MS ? next - 1 : next;
  const round = view.rounds[i]!;
  const running = round.endedAt === null && now >= round.startsAt;
  const elapsed = round.endedAt ?? now;
  const m = running ? multiplier(now - round.startsAt) : null;
  const mine = you === null ? undefined : round.cashed[you];
  const canCash = running && you !== null && mine === undefined && !view.forfeited.includes(you);

  return (
    <div className="hype">
      <p className="muted">
        Round {i + 1}/3
        {round.endedAt === null &&
          now < round.startsAt &&
          ` · starts in ${Math.ceil((round.startsAt - now) / 1000)}…`}
      </p>
      <Curve
        startsAt={round.startsAt}
        until={elapsed}
        crashed={round.crash}
        cashed={round.cashed}
        name={name}
      />
      <p className="hype-m">
        {m !== null ? (
          <span>📈 ×{m.toFixed(2)}</span>
        ) : round.crash !== null && round.endedAt !== null ? (
          multiplier(round.endedAt - round.startsAt) * 100 < round.crash - 1 ? (
            <span className="muted">Everyone got out · it would have crashed at {x(round.crash)}</span>
          ) : (
            <span className="crashed">💥 {x(round.crash)}</span>
          )
        ) : (
          <span className="muted">×1.00</span>
        )}
      </p>
      {canCash && (
        <button type="button" className="primary hype-cash" onClick={() => move({ cashOut: true })}>
          🪂 Cash out at ×{m!.toFixed(2)}
        </button>
      )}
      {mine !== undefined && round.endedAt === null && <p>🪂 You cashed out at {x(mine)}. Watch the rest…</p>}
      <table className="hype-scores">
        <thead>
          <tr>
            <th />
            {view.rounds.map((r, j) => (
              <th key={r.hash}>R{j + 1}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {[...view.players]
            .sort((a, b) => (view.totals[b] ?? 0) - (view.totals[a] ?? 0))
            .map((p) => (
              <tr key={p} className={p === you ? "me" : undefined}>
                <td>
                  {name(p)}
                  {view.forfeited.includes(p) && " 🏳️"}
                </td>
                {view.rounds.map((r) => (
                  <td key={r.hash}>
                    {r.cashed[p] !== undefined ? `🪂 ${x(r.cashed[p]!)}` : r.endedAt !== null ? "💥" : "…"}
                  </td>
                ))}
                <td>
                  <strong>{x(view.totals[p] ?? 0)}</strong>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <details className="hype-fair">
        <summary className="muted small">🔒 Provably fair</summary>
        <ul className="small">
          {view.rounds.map((r, j) => (
            <li key={r.hash}>
              R{j + 1} hash <code>{r.hash.slice(0, 16)}…</code>
              {r.seed !== null && (
                <>
                  {" "}
                  · seed <code>{r.seed}</code> {sha256(r.seed) === r.hash ? "✓" : "✗ doesn't match!"}
                </>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

const W = 300;
const H = 120;

/** The valuation so far: a line from ×1 climbing on a scale that grows with it. */
function Curve({
  startsAt,
  until,
  crashed,
  cashed,
  name,
}: {
  startsAt: number;
  until: number;
  crashed: number | null;
  cashed: Record<number, number>;
  name: (id: number) => string;
}) {
  const t = Math.max(0, until - startsAt);
  const top = Math.max(2, multiplier(t) * 1.15);
  const span = Math.max(10_000, t * 1.1);
  const px = (ms: number) => (ms / span) * W;
  const py = (mult: number) => H - ((mult - 1) / (top - 1)) * (H - 6);
  const points = Array.from({ length: 41 }, (_, k) => {
    const ms = (t * k) / 40;
    return `${px(ms).toFixed(1)},${py(multiplier(ms)).toFixed(1)}`;
  }).join(" ");
  return (
    <svg
      className={`hype-curve${crashed !== null ? " crashed" : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="The valuation"
    >
      <polyline points={points} fill="none" strokeWidth={3} />
      {Object.entries(cashed).map(([p, at]) => (
        <text key={p} x={px(msToReach(at / 100))} y={py(at / 100) - 6} fontSize={10}>
          🪂 {name(Number(p))}
        </text>
      ))}
    </svg>
  );
}
