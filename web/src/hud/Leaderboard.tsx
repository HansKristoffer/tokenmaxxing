import { compact, hoursText, plural, usd } from "@tokenmaxxing/core/format.ts";
import type { RangeKey } from "@tokenmaxxing/core/range.ts";
import { houseTierName } from "@tokenmaxxing/core/world.ts";
import type {
  Leaderboard as Board,
  BoardCompany,
  BoardPlayer,
  GamePlayer,
} from "@tokenmaxxing/server/registry";
import { type ReactNode, useEffect, useState } from "react";
import { town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { AvatarImage, House, Modal, Pills } from "./ui.tsx";

type Sort = Board["sort"];
type Totals = BoardPlayer | BoardCompany;

const RANGES = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["all", "All time"],
] as const;
const SORTS = [
  ["tokens", "Tokens"],
  ["cost", "Cost"],
  ["hours", "Agent hours"],
  ["parallelism", "Parallel"],
  ["prs", "PRs"],
] as const;
const EMPTY: Record<RangeKey, string> = {
  today: "today",
  "7d": "this week",
  "30d": "this month",
  all: "yet",
};

/** Per sort: the number ranked by (for bars), how it shows, and a second number for context. */
const BY: Record<
  Sort,
  { value: (t: Totals) => number; show: (t: Totals) => string; aside: (t: Totals) => string }
> = {
  tokens: { value: (t) => t.tokens, show: (t) => compact(t.tokens), aside: (t) => usd(t.costUsd) },
  cost: { value: (t) => t.costUsd, show: (t) => usd(t.costUsd), aside: (t) => compact(t.tokens) },
  hours: {
    value: (t) => t.activeHours,
    show: (t) => hoursText(t.activeHours),
    aside: (t) => compact(t.tokens),
  },
  parallelism: {
    value: (t) => t.parallelism ?? 0,
    show: (t) => (t.parallelism === null ? "–" : `${t.parallelism.toFixed(1)}×`),
    aside: (t) => `peak ${t.peakAgents}`,
  },
  prs: { value: (t) => t.prs, show: (t) => plural(t.prs, "PR"), aside: (t) => compact(t.tokens) },
};
const metric = (sort: Sort, t: Totals) => BY[sort].value(t);
const shown = (sort: Sort, t: Totals) => BY[sort].show(t);
const aside = (sort: Sort, t: Totals) => BY[sort].aside(t);

const members = (n: number) => plural(n, "member");

const openCard = (userId: number) => hud.set({ panel: { kind: "card", userId } });
const openCompany = (companyId: number) => hud.set({ panel: { kind: "companyCard", companyId } });

export function Leaderboard() {
  const me = useHud((s) => s.me?.userId);
  const [range, setRange] = useState<RangeKey>("today");
  const [sort, setSort] = useState<Sort>("tokens");
  const [tab, setTab] = useState<"players" | "companies" | "games">("players");
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

  const players = board?.players ?? [];
  const companies = (board?.companies ?? []).filter((c) => metric(sort, c) > 0);
  const rows: Totals[] = tab === "players" ? players : companies;
  const top = rows[0] ? metric(sort, rows[0]) : 0;

  return (
    <Modal title="🏆 Leaderboard" wide>
      <div className="lb-controls">
        <Pills
          value={tab}
          options={[
            ["players", "Players"],
            ["companies", "Companies"],
            ["games", "🎮 Games"],
          ]}
          onChange={setTab}
        />
        <Pills value={range} options={RANGES} onChange={setRange} />
      </div>
      {tab === "games" ? (
        <GamesBoard range={range} me={me} />
      ) : (
        <>
          <div className="lb-sort">
            <span className="muted small">Ranked by</span>
            <Pills value={sort} options={SORTS} onChange={setSort} />
          </div>
          {!board ? (
            <p className="muted">Loading…</p>
          ) : rows.length === 0 || top === 0 ? (
            <p className="lb-empty">
              {tab === "players" ? "Nobody has run an agent" : "No company has anything to show"}{" "}
              {EMPTY[range]}.
              <br />
              <span className="muted small">Start an agent and take the top spot 🚀</span>
            </p>
          ) : (
            <>
              <Podium>
                {rows.slice(0, 3).map((r, i) => (
                  <Step
                    key={key(r)}
                    place={i + 1}
                    onClick={"userId" in r ? () => openCard(r.userId) : () => openCompany(r.companyId)}
                  >
                    {"userId" in r ? (
                      <AvatarImage look={r.look} scale={i === 0 ? 5 : 4} />
                    ) : (
                      <House companyId={r.companyId} tier={r.tier} scale={i === 0 ? 1 : 0.75} />
                    )}
                    <strong className="lb-name">{r.name}</strong>
                    <span className="lb-sub">
                      {"userId" in r ? (r.company ?? `Lv${r.level}`) : members(r.members)}
                    </span>
                    <span className="lb-value">{shown(sort, r)}</span>
                  </Step>
                ))}
              </Podium>
              {rows.length > 3 && (
                <ol className="lb-list">
                  {rows.slice(3).map((r) => (
                    <Row key={key(r)} row={r} sort={sort} top={top} mine={"userId" in r && r.userId === me} />
                  ))}
                </ol>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

const GAME_SORTS = [
  ["net", "Coins won"],
  ["rate", "Win rate"],
  ["pot", "Biggest pot"],
] as const;
type GameSort = (typeof GAME_SORTS)[number][0];
/** Win rates only count from this many games, so one lucky win doesn't top the board. */
const MIN_GAMES = 10;

const gameValue = (sort: GameSort, p: GamePlayer) =>
  sort === "net" ? p.net : sort === "rate" ? p.wins / p.played : p.biggestPot;
const gameShown = (sort: GameSort, p: GamePlayer) =>
  sort === "rate" ? `${Math.round((p.wins / p.played) * 100)}%` : `🪙 ${gameValue(sort, p)}`;

/** Who's best at the arcade: most coins won, best win rate, biggest pots. */
function GamesBoard({ range, me }: { range: RangeKey; me: number | undefined }) {
  const [sort, setSort] = useState<GameSort>("net");
  const [all, setAll] = useState<GamePlayer[] | null>(null);
  useEffect(() => {
    let live = true;
    town.gameBoard(range).then((b) => live && setAll(b));
    return () => {
      live = false;
    };
  }, [range]);
  const rows = (all ?? [])
    .filter((p) => (sort === "rate" ? p.played >= MIN_GAMES : gameValue(sort, p) > 0))
    .sort((a, b) => gameValue(sort, b) - gameValue(sort, a) || b.played - a.played)
    .slice(0, 100);
  const top = rows[0] ? gameValue(sort, rows[0]) : 0;
  return (
    <>
      <div className="lb-sort">
        <span className="muted small">Ranked by</span>
        <Pills value={sort} options={GAME_SORTS} onChange={setSort} />
      </div>
      {!all ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="lb-empty">
          {sort === "rate" ? `Nobody has played ${MIN_GAMES} games` : "Nobody has won a game"} {EMPTY[range]}.
          <br />
          <span className="muted small">Open a table in the 🎮 arcade 🎲</span>
        </p>
      ) : (
        <>
          <Podium>
            {rows.slice(0, 3).map((r, i) => (
              <Step key={r.userId} place={i + 1} onClick={() => openCard(r.userId)}>
                <AvatarImage look={r.look} scale={i === 0 ? 5 : 4} />
                <strong className="lb-name">{r.name}</strong>
                <span className="lb-sub">
                  {r.wins}/{r.played} won
                </span>
                <span className="lb-value">{gameShown(sort, r)}</span>
              </Step>
            ))}
          </Podium>
          {rows.length > 3 && (
            <ol className="lb-list">
              {rows.slice(3).map((r, i) => (
                <li key={r.userId} className={r.userId === me ? "mine" : undefined}>
                  <button type="button" className="lb-item" onClick={() => openCard(r.userId)}>
                    <span className="lb-rank">{i + 4}</span>
                    <AvatarImage look={r.look} scale={2} />
                    <span className="lb-who">
                      <span className="lb-line">
                        <strong>{r.name}</strong>
                        <small className="muted">
                          {r.wins}/{r.played} won
                        </small>
                      </span>
                      <span className="lb-bar">
                        <span style={{ width: `${Math.max(0.02, gameValue(sort, r) / top) * 100}%` }} />
                      </span>
                    </span>
                    <span className="lb-values">
                      <span className="lb-value">{gameShown(sort, r)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </>
  );
}

const key = (r: Totals) => ("userId" in r ? `p${r.userId}` : `c${r.companyId}`);

function Podium({ children }: { children: ReactNode[] }) {
  // Second, first, third: the winner stands in the middle.
  const [first, second, third] = children;
  return (
    <div className="podium">
      {second ?? <div className="step empty" />}
      {first}
      {third ?? <div className="step empty" />}
    </div>
  );
}

function Step({ place, onClick, children }: { place: number; onClick?: () => void; children: ReactNode }) {
  const body = (
    <>
      {place === 1 && <span className="crown">👑</span>}
      {children}
      <span className="pedestal">{place}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={`step p${place}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={`step p${place}`}>{body}</div>
  );
}

function Row({ row, sort, top, mine }: { row: Totals; sort: Sort; top: number; mine: boolean }) {
  const player = "userId" in row ? row : null;
  const share = top > 0 ? Math.max(0.02, metric(sort, row) / top) : 0;
  const body = (
    <>
      <span className="lb-rank">{row.rank}</span>
      {player ? (
        <AvatarImage look={player.look} scale={2} />
      ) : (
        <House companyId={(row as BoardCompany).companyId} tier={(row as BoardCompany).tier} scale={0.3} />
      )}
      <span className="lb-who">
        <span className="lb-line">
          <strong>{row.name}</strong>
          <small className="muted">
            {player
              ? `Lv${player.level}${player.company ? ` · ${player.company}` : ""}`
              : `${members((row as BoardCompany).members)} · ${houseTierName((row as BoardCompany).tier)}`}
          </small>
        </span>
        <span className="lb-bar">
          <span style={{ width: `${share * 100}%` }} />
        </span>
      </span>
      <span className="lb-values">
        <span className="lb-value">{shown(sort, row)}</span>
        <small className="muted">{aside(sort, row)}</small>
      </span>
    </>
  );
  return (
    <li className={mine ? "mine" : undefined}>
      <button
        type="button"
        className="lb-item"
        onClick={() => (player ? openCard(player.userId) : openCompany((row as BoardCompany).companyId))}
      >
        {body}
      </button>
    </li>
  );
}
