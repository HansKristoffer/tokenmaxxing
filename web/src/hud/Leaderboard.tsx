import { compact, hoursText, plural, usd } from "@tokenmaxxing/core/format.ts";
import type { RangeKey } from "@tokenmaxxing/core/range.ts";
import { houseTierName } from "@tokenmaxxing/core/world.ts";
import type {
  Leaderboard as Board,
  BoardCompany,
  BoardModel,
  BoardPlayer,
  GamePlayer,
  Spender,
  Trend,
} from "@tokenmaxxing/server/registry";
import { typedSwitch } from "hanzio";
import { type ReactNode, useEffect, useState } from "react";
import { town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { ranges } from "./format.ts";
import { PrestigeMini } from "./PrestigeMini.tsx";
import { prestigeOf } from "./prestige-badge.ts";
import { TrendChart, type TrendMode, type TrendSeries } from "./TrendChart.tsx";
import { AvatarImage, House, Modal, Pills, useLoad } from "./ui.tsx";

type Sort = Board["sort"];
type Totals = BoardPlayer | BoardCompany;

const RANGES = ranges("All time");
const SORTS = [
  ["tokens", "Tokens"],
  ["cost", "Cost"],
  ["hours", "Agent hours"],
  ["parallelism", "Parallel"],
  ["prs", "PRs"],
] as const;
const VIEWS = [
  ["board", "Board"],
  ["chart", "Chart"],
] as const;
const MODES = [
  ["daily", "Per day"],
  ["total", "Running total"],
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

const members = (n: number) => plural(n, "member");

const openCard = (userId: number) => hud.set({ panel: { kind: "card", userId } });
const openCompany = (companyId: number) => hud.set({ panel: { kind: "companyCard", companyId } });
const openRow = (r: Totals) => ("userId" in r ? openCard(r.userId) : openCompany(r.companyId));

/** A row's line under its name: a player's level and company, a company's members and house tier. */
function subOf(r: Totals): string {
  if (!("userId" in r)) return `${members(r.members)} · ${houseTierName(r.tier)}`;
  const company = r.company ? ` · ${r.company}` : "";
  return `Lv${r.level}${company}`;
}

export function Leaderboard() {
  const me = useHud((s) => s.me?.userId);
  const [range, setRange] = useState<RangeKey>("today");
  const [sort, setSort] = useState<Sort>("tokens");
  const [tab, setTab] = useState<"players" | "companies" | "games" | "models">("players");
  const [view, setView] = useState<"board" | "chart">("board");
  const [board, setBoard] = useState<Board | null>(null);
  const games = tab === "games";
  const models = tab === "models";
  const chart = !games && !models && view === "chart";

  // The games tab has a board of its own, and the chart its own numbers.
  useEffect(() => {
    if (games || models || chart) return;
    let live = true;
    const load = () => town.leaderboard(range, sort).then((b) => live && setBoard(b));
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [range, sort, games, models, chart]);

  const players = board?.players ?? [];
  const by = BY[sort];
  const companies = (board?.companies ?? []).filter((c) => by.value(c) > 0);
  const rows: Totals[] = tab === "players" ? players : companies;
  const top = rows[0] ? by.value(rows[0]) : 0;

  return (
    <Modal title="🏆 Leaderboard" wide>
      <div className="lb-controls">
        <Pills
          value={tab}
          options={[
            ["players", "Players"],
            ["companies", "Companies"],
            ["games", "Games"],
            ["models", "Models"],
          ]}
          onChange={setTab}
        />
        {chart ? (
          <span className="muted small">Tokens, last 30 days</span>
        ) : (
          <Pills value={range} options={RANGES} onChange={setRange} />
        )}
      </div>
      {games ? (
        <GamesBoard range={range} me={me} />
      ) : models ? (
        <ModelsBoard range={range} />
      ) : chart ? (
        <TrendView companies={tab === "companies"} me={me} onBoard={() => setView("board")} />
      ) : (
        <>
          <div className="lb-sort">
            <span className="muted small">Ranked by</span>
            <Pills value={sort} options={SORTS} onChange={setSort} />
            <ViewPills value={view} onChange={setView} />
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
                  <Step key={key(r)} place={i + 1} onClick={() => openRow(r)}>
                    {"userId" in r ? (
                      <AvatarImage look={r.look} scale={i === 0 ? 5 : 4} />
                    ) : (
                      <House companyId={r.companyId} tier={r.tier} scale={i === 0 ? 1 : 0.75} />
                    )}
                    <strong className="lb-name">
                      {r.name}
                      {"userId" in r && <PrestigeMini rank={prestigeOf(r).rank} />}
                    </strong>
                    <span className="lb-sub">
                      {"userId" in r ? (r.company ?? `Lv${r.level}`) : members(r.members)}
                    </span>
                    <span className="lb-value">{by.show(r)}</span>
                  </Step>
                ))}
              </Podium>
              {rows.length > 3 && (
                <ol className="lb-list">
                  {rows.slice(3).map((r) => (
                    <BoardRow
                      key={key(r)}
                      rank={r.rank}
                      picture={
                        "userId" in r ? (
                          <AvatarImage look={r.look} scale={2} />
                        ) : (
                          <House companyId={r.companyId} tier={r.tier} scale={0.3} />
                        )
                      }
                      name={
                        <>
                          {r.name}
                          {"userId" in r && <PrestigeMini rank={prestigeOf(r).rank} />}
                        </>
                      }
                      sub={subOf(r)}
                      share={top > 0 ? Math.max(0.02, by.value(r) / top) : 0}
                      value={by.show(r)}
                      aside={by.aside(r)}
                      mine={"userId" in r && r.userId === me}
                      onClick={() => openRow(r)}
                    />
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

function ViewPills({
  value,
  onChange,
}: {
  value: "board" | "chart";
  onChange: (v: "board" | "chart") => void;
}) {
  return (
    <span className="lb-view">
      <Pills value={value} options={VIEWS} onChange={onChange} />
    </span>
  );
}

/** One line per company or player, from the trend the server sent. */
function trendSeries(trend: Trend, companies: boolean, me: number | undefined): TrendSeries[] {
  if (companies) {
    return trend.companies.map((c) => ({
      key: `c${c.companyId}`,
      rank: c.rank,
      name: c.name,
      picture: <House companyId={c.companyId} tier={c.tier} scale={0.22} />,
      daily: c.daily,
    }));
  }
  return trend.players.map((p) => ({
    key: `p${p.userId}`,
    rank: p.rank,
    name: p.name,
    picture: <AvatarImage look={p.look} scale={1.5} />,
    daily: p.daily,
    mine: p.userId === me,
  }));
}

/** The leaderboard as lines: everyone by tokens, day by day over the last 30 days, the top 8 drawn. */
function TrendView({
  companies,
  me,
  onBoard,
}: {
  companies: boolean;
  me: number | undefined;
  onBoard: () => void;
}) {
  const [mode, setMode] = useState<TrendMode>("daily");
  const [trend, setTrend] = useState<Trend | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => town.trend().then((t) => live && setTrend(t));
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  const series = trend ? trendSeries(trend, companies, me) : [];
  const empty = series.every((s) => s.daily.every((d) => d === 0));

  return (
    <>
      <div className="lb-sort">
        <span className="muted small">Shown as</span>
        <Pills value={mode} options={MODES} onChange={setMode} />
        <ViewPills value="chart" onChange={(v) => v === "board" && onBoard()} />
      </div>
      {!trend ? (
        <p className="muted">Loading…</p>
      ) : empty ? (
        <p className="lb-empty">
          {companies ? "No company has used any tokens" : "Nobody has run an agent"} this month.
          <br />
          <span className="muted small">Start an agent and draw the first line 🚀</span>
        </p>
      ) : (
        // Players and companies each start from their own top 8.
        <TrendChart key={companies ? "companies" : "players"} days={trend.days} series={series} mode={mode} />
      )}
    </>
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
  typedSwitch(sort, {
    net: () => p.net,
    rate: () => p.wins / p.played,
    pot: () => p.biggestPot,
  });
const gameShown = (sort: GameSort, p: GamePlayer) =>
  sort === "rate" ? `${Math.round((p.wins / p.played) * 100)}%` : `🪙 ${gameValue(sort, p)}`;

/** Who's best at the arcade: most coins won, best win rate, biggest pots. */
function GamesBoard({ range, me }: { range: RangeKey; me: number | undefined }) {
  const [sort, setSort] = useState<GameSort>("net");
  const { data: all } = useLoad(() => town.gameBoard(range), [range]);
  // A win rate counts only from MIN_GAMES games; the other sorts only list players who have something to show.
  const eligible = (all ?? []).filter((p) =>
    sort === "rate" ? p.played >= MIN_GAMES : gameValue(sort, p) > 0,
  );
  const rows = eligible
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
                <BoardRow
                  key={r.userId}
                  rank={i + 4}
                  picture={<AvatarImage look={r.look} scale={2} />}
                  name={r.name}
                  sub={`${r.wins}/${r.played} won`}
                  share={Math.max(0.02, gameValue(sort, r) / top)}
                  value={gameShown(sort, r)}
                  mine={r.userId === me}
                  onClick={() => openCard(r.userId)}
                />
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

/** A place on the podium: a button when `onClick` opens something, else plain. */
function Step({ place, onClick, children }: { place: number; onClick?: () => void; children: ReactNode }) {
  const inside = (
    <>
      {place === 1 && <span className="crown">👑</span>}
      {children}
      <span className="pedestal">{place}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={`step p${place}`} onClick={onClick}>
      {inside}
    </button>
  ) : (
    <div className={`step p${place}`}>{inside}</div>
  );
}

/**
 * A row under the podium (and a company's people): who, a line under the name, a bar for `share` of
 * the top, and the number. Without a `rank`, the order says it.
 */
export function BoardRow({
  rank,
  picture,
  name,
  sub,
  share,
  value,
  aside,
  mine,
  onClick,
}: {
  rank?: number;
  picture: ReactNode;
  name: ReactNode;
  sub: string;
  share: number;
  value: string;
  aside?: string;
  mine?: boolean;
  /** Opens what the row is about; without one the row is plain. */
  onClick?: () => void;
}) {
  const Row = onClick ? "button" : "div";
  return (
    <li className={mine ? "mine" : undefined}>
      <Row className="lb-item" {...(onClick ? { type: "button", onClick } : {})}>
        {rank !== undefined && <span className="lb-rank">{rank}</span>}
        {picture}
        <span className="lb-who">
          <span className="lb-line">
            <strong>{name}</strong>
            <small className="muted">{sub}</small>
          </span>
          <span className="lb-bar">
            <span style={{ width: `${share * 100}%` }} />
          </span>
        </span>
        <span className="lb-values">
          <span className="lb-value">{value}</span>
          {aside !== undefined && <small className="muted">{aside}</small>}
        </span>
      </Row>
    </li>
  );
}

const MODEL_SORTS = [
  ["tokens", "Tokens"],
  ["users", "Users"],
  ["cost", "Cost"],
] as const;
type ModelSort = (typeof MODEL_SORTS)[number][0];

const modelValue = (sort: ModelSort, m: BoardModel) =>
  typedSwitch(sort, {
    tokens: () => m.tokens,
    users: () => m.users,
    cost: () => m.costUsd,
  });
const modelShown = (sort: ModelSort, m: BoardModel) =>
  typedSwitch(sort, {
    tokens: () => compact(m.tokens),
    users: () => plural(m.users, "user"),
    cost: () => usd(m.costUsd),
  });

/** A model's colour tile: its first letter on a hue its name picks, the same one every time. */
function ModelTile({ name, size }: { name: string; size: number }) {
  let hue = 0;
  for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="model-tile"
      style={{ width: size, height: size, fontSize: size * 0.45, background: `hsl(${hue} 55% 62%)` }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Which models the town runs: the town's totals, then every model ranked by tokens, users or cost. */
function ModelsBoard({ range }: { range: RangeKey }) {
  const [sort, setSort] = useState<ModelSort>("tokens");
  const { data } = useLoad(() => town.modelBoard(range), [range]);
  const rows = [...(data?.models ?? [])].sort((a, b) => modelValue(sort, b) - modelValue(sort, a));
  const top = rows[0] ? modelValue(sort, rows[0]) : 0;
  const t = data?.totals;
  return (
    <>
      {t && (
        <dl className="stats">
          <div>
            <dt>Tokens</dt>
            <dd>{compact(t.tokens)}</dd>
          </div>
          <div>
            <dt>People</dt>
            <dd>{t.users}</dd>
          </div>
          <div>
            <dt>Models in use</dt>
            <dd>{data.models.length}</dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>{usd(t.costUsd)}</dd>
          </div>
          <div>
            <dt>Turns</dt>
            <dd>{compact(t.turns)}</dd>
          </div>
          <div>
            <dt>Cache hit rate</dt>
            <dd>{t.cacheHit === null ? "–" : `${Math.round(t.cacheHit * 100)}%`}</dd>
          </div>
        </dl>
      )}
      <div className="lb-sort">
        <span className="muted small">Ranked by</span>
        <Pills value={sort} options={MODEL_SORTS} onChange={setSort} />
      </div>
      {!data ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 || top === 0 ? (
        <p className="lb-empty">
          No model has run {EMPTY[range]}.
          <br />
          <span className="muted small">Start an agent and put your model on the board 🚀</span>
        </p>
      ) : (
        <>
          <Podium>
            {rows.slice(0, 3).map((m, i) => (
              <Step key={m.model} place={i + 1}>
                <ModelTile name={m.model} size={i === 0 ? 64 : 52} />
                <strong className="lb-name">{m.model}</strong>
                <span className="lb-sub">{plural(m.users, "user")}</span>
                <span className="lb-value">{modelShown(sort, m)}</span>
              </Step>
            ))}
          </Podium>
          {rows.length > 3 && (
            <ol className="lb-list">
              {rows.slice(3).map((m, i) => (
                <BoardRow
                  key={m.model}
                  rank={i + 4}
                  picture={<ModelTile name={m.model} size={22} />}
                  name={m.model}
                  sub={plural(m.users, "user")}
                  share={Math.max(0.02, modelValue(sort, m) / top)}
                  value={modelShown(sort, m)}
                  aside={sort === "tokens" ? usd(m.costUsd) : compact(m.tokens)}
                />
              ))}
            </ol>
          )}
          <Spenders title="💸 Biggest spenders" list={data.spenders.most} />
          <Spenders title="🌱 Lightest spenders" list={data.spenders.least} />
        </>
      )}
    </>
  );
}

/** One end of the town's spending: people ranked by dollars, with their tokens beside. */
function Spenders({ title, list }: { title: string; list: Spender[] }) {
  if (list.length === 0) return null;
  const top = Math.max(...list.map((p) => p.costUsd));
  return (
    <>
      <h3>{title}</h3>
      <ol className="lb-list">
        {list.map((p) => (
          <BoardRow
            key={p.userId}
            picture={<AvatarImage look={p.look} scale={2} />}
            name={p.name}
            sub={p.company ?? "No company"}
            share={top > 0 ? Math.max(0.02, p.costUsd / top) : 0}
            value={usd(p.costUsd)}
            aside={`${compact(p.tokens)} tokens`}
            onClick={() => openCard(p.userId)}
          />
        ))}
      </ol>
    </>
  );
}
