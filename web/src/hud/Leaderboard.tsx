import { compact, usd } from "@tokenmaxxing/core/format.ts";
import type { RangeKey } from "@tokenmaxxing/core/range.ts";
import type { Leaderboard as Board } from "@tokenmaxxing/server/registry";
import { useEffect, useState } from "react";
import { town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { AvatarImage, Modal, Pills } from "./ui.tsx";

type Sort = Board["sort"];

const RANGES = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["all", "All time"],
] as const;
const SORTS = [
  ["tokens", "Tokens"],
  ["cost", "Cost"],
  ["parallelism", "Parallel"],
  ["prs", "PRs"],
] as const;

const value = (
  sort: Sort,
  t: { tokens: number; costUsd: number; parallelism: number | null; prs: number },
) =>
  sort === "tokens"
    ? compact(t.tokens)
    : sort === "cost"
      ? usd(t.costUsd)
      : sort === "prs"
        ? String(t.prs)
        : t.parallelism === null
          ? "–"
          : `${t.parallelism.toFixed(1)}×`;

export function Leaderboard() {
  const me = useHud((s) => s.me?.userId);
  const [range, setRange] = useState<RangeKey>("today");
  const [sort, setSort] = useState<Sort>("tokens");
  const [tab, setTab] = useState<"players" | "companies">("players");
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => town.leaderboard(range, sort).then((b) => live && setBoard(b));
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [range, sort]);

  return (
    <Modal title="🏆 Leaderboard" wide>
      <div className="toolbar">
        <Pills
          value={tab}
          options={[
            ["players", "Players"],
            ["companies", "Companies"],
          ]}
          onChange={setTab}
        />
        <Pills value={range} options={RANGES} onChange={setRange} />
        <Pills value={sort} options={SORTS} onChange={setSort} />
      </div>
      {!board ? (
        <p className="muted">Loading…</p>
      ) : tab === "players" ? (
        <ol className="board">
          {board.players.length === 0 && <p className="muted">Nobody has run an agent yet today.</p>}
          {board.players.map((p) => (
            <li key={p.userId} className={p.userId === me ? "mine" : ""}>
              <button type="button" onClick={() => hud.set({ panel: { kind: "card", userId: p.userId } })}>
                <span className="rank">#{p.rank}</span>
                <AvatarImage look={p.look} scale={2} />
                <span className="who">
                  <strong>{p.name}</strong>
                  <small>
                    Lv{p.level}
                    {p.company ? ` · ${p.company}` : ""}
                  </small>
                </span>
                <span className="value">{value(sort, p)}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="board">
          {board.companies.length === 0 && (
            <p className="muted">No companies yet. Start one from the menu.</p>
          )}
          {board.companies.map((c) => (
            <li key={c.companyId}>
              <div className="row">
                <span className="rank">#{c.rank}</span>
                <span className="who">
                  <strong>🏢 {c.name}</strong>
                  <small>
                    {c.members} {c.members === 1 ? "member" : "members"}
                  </small>
                </span>
                <span className="value">{value(sort, c)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
