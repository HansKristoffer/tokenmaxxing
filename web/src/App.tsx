import type { SortKey } from "@tokenmaxxing/core/protocol.ts";
import { RANGES, type RangeKey } from "@tokenmaxxing/core/range.ts";
import { useState } from "react";
import { client, isUnauthorized, type Me, parseResponse } from "./api.ts";
import { GroupsCard } from "./components/GroupsCard.tsx";
import { LeaderboardTable } from "./components/LeaderboardTable.tsx";
import { StatsStrip } from "./components/StatsStrip.tsx";
import { ThemeHotkey } from "./components/ThemeToggle.tsx";
import { UserPanel } from "./components/UserPanel.tsx";
import { usePoll } from "./usePoll.ts";

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};
const tz = String(new Date().getTimezoneOffset());

export function App() {
  const me = usePoll(() => parseResponse(client.api.me.$get()), []);
  if (isUnauthorized(me.error)) return <SignedOut />;
  if (!me.data)
    return <div className="center muted">{me.error ? "Can't reach the server." : "Loading…"}</div>;
  return <Dashboard me={me.data} reloadMe={me.reload} />;
}

function Dashboard({ me, reloadMe }: { me: Me; reloadMe: () => void }) {
  const [range, setRange] = useState<RangeKey>("7d");
  const [sort, setSort] = useState<SortKey>("tokens");
  const [group, setGroup] = useState<number | null>(null);
  const [selected, setSelected] = useState(me.name);

  const board = usePoll(
    () =>
      parseResponse(
        client.api.leaderboard.$get({
          query: { range, sort, tz, ...(group !== null ? { group: String(group) } : {}) },
        }),
      ),
    [range, sort, group],
  );
  const mine = board.data?.entries.find((e) => e.name === me.name);
  // Removing someone changes both the group's member count and who the
  // leaderboard is allowed to show me, so reload the two together.
  const reloadGroups = () => {
    reloadMe();
    board.reload();
  };

  return (
    <div className="page">
      <ThemeHotkey />
      <header className="header">
        <span className="brand">⚡ tokenmaxxing</span>
        {me.groups.length > 0 && (
          <select
            value={group ?? ""}
            onChange={(e) => setGroup(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All groups</option>
            {me.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
        <div className="pills">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={r === range} onClick={() => setRange(r)}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <a
          className="link"
          href="https://github.com/HansKristoffer/tokenmaxxing"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <button
          type="button"
          className="link"
          onClick={() => void client.api.logout.$post().then(() => location.reload())}
        >
          Sign out
        </button>
      </header>

      {mine && <StatsStrip entry={mine} of={board.data?.entries.length ?? 0} />}

      <div className="grid-2">
        <section className="card">
          <h2>Leaderboard</h2>
          {board.data ? (
            <LeaderboardTable
              entries={board.data.entries}
              me={me.name}
              sort={sort}
              onSort={setSort}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            <p className="muted">Loading…</p>
          )}
        </section>
        <GroupsCard groups={me.groups} me={me.name} onChange={reloadGroups} />
      </div>

      <UserPanel name={selected} range={range} tz={tz} />
    </div>
  );
}

function SignedOut() {
  const expired = new URLSearchParams(location.search).has("login");
  return (
    <div className="center">
      <div className="card">
        <p className="brand">⚡ tokenmaxxing</p>
        <p style={{ marginTop: 12 }}>
          {expired ? "That sign-in link has expired. " : ""}
          Open the dashboard from the tokenmaxxing menu bar app to sign in.
        </p>
        <p className="muted" style={{ marginTop: 12 }}>
          Don't have it yet? <code className="mono">brew install --cask hanskristoffer/tap/tokenmaxxing</code>
        </p>
      </div>
    </div>
  );
}
