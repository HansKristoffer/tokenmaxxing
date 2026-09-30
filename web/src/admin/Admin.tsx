import { compact } from "@tokenmaxxing/core/format.ts";
import { houseTierName } from "@tokenmaxxing/core/world.ts";
import type { AdminCompany, AdminLogEntry, AdminOverview, AdminUser } from "@tokenmaxxing/server/registry";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  type AdminConn,
  connectAdmin,
  errorText,
  forgetToken,
  isUnauthorized,
  savedToken,
  saveToken,
} from "./api.ts";

type Tab = "overview" | "users" | "companies" | "log";
type Act = (fn: () => Promise<unknown>, done: string) => Promise<void>;

interface Data {
  overview: AdminOverview;
  users: AdminUser[];
  companies: AdminCompany[];
  log: AdminLogEntry[];
}

export function Admin() {
  const [token, setToken] = useState(savedToken);
  const [why, setWhy] = useState<string | null>(null);
  const signOut = useCallback((reason: string | null) => {
    forgetToken();
    setWhy(reason);
    setToken(null);
  }, []);
  if (!token)
    return (
      <SignIn
        why={why}
        onToken={(t) => {
          saveToken(t);
          setWhy(null);
          setToken(t);
        }}
      />
    );
  return <Console token={token} onSignOut={signOut} />;
}

function SignIn({ why, onToken }: { why: string | null; onToken: (token: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onToken(value.trim());
  };
  return (
    <main className="signin">
      <form onSubmit={submit}>
        <h1>tokenmaxxing admin</h1>
        <p className="muted">
          Open <code>/admin#token=…</code>, or paste the server's <code>ADMIN_TOKEN</code>.
        </p>
        {why && <p className="error">{why}</p>}
        <input
          type="password"
          autoComplete="off"
          placeholder="Admin token"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="primary">
          Sign in
        </button>
      </form>
    </main>
  );
}

function Console({ token, onSignOut }: { token: string; onSignOut: (reason: string | null) => void }) {
  const conn = useMemo(() => connectAdmin(token), [token]);
  useEffect(() => () => void conn.dispose(), [conn]);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, users, companies, log] = await Promise.all([
        conn.adminOverview(),
        conn.adminUsers(),
        conn.adminCompanies(),
        conn.adminLog(),
      ]);
      setData({ overview, users, companies, log });
    } catch (err) {
      if (isUnauthorized(err)) onSignOut("That token didn't work.");
      else setMessage({ text: errorText(err), bad: true });
    } finally {
      setLoading(false);
    }
  }, [conn, onSignOut]);
  useEffect(() => void load(), [load]);

  const act: Act = async (fn, done) => {
    try {
      await fn();
      setMessage({ text: done, bad: false });
    } catch (err) {
      setMessage({ text: errorText(err), bad: true });
    }
    await load();
  };

  const tabs: [Tab, string][] = [
    ["overview", "Overview"],
    ["users", `Users${data ? ` (${data.users.length})` : ""}`],
    ["companies", `Companies${data ? ` (${data.companies.length})` : ""}`],
    ["log", "Log"],
  ];
  return (
    <>
      <header>
        <h1>tokenmaxxing admin</h1>
        <nav>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <span className="spacer" />
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button type="button" onClick={() => onSignOut(null)}>
          Sign out
        </button>
      </header>
      {message && (
        <button
          type="button"
          className={`message ${message.bad ? "bad" : ""}`}
          onClick={() => setMessage(null)}
        >
          {message.text} <span className="muted">×</span>
        </button>
      )}
      <main>
        {!data ? (
          <p className="muted">{loading ? "Loading…" : "Nothing yet."}</p>
        ) : tab === "overview" ? (
          <Overview o={data.overview} />
        ) : tab === "users" ? (
          <Users users={data.users} conn={conn} act={act} />
        ) : tab === "companies" ? (
          <Companies companies={data.companies} conn={conn} act={act} />
        ) : (
          <Log log={data.log} />
        )}
      </main>
    </>
  );
}

// MARK: Overview

function Overview({ o }: { o: AdminOverview }) {
  const tiles: [string, string, string?][] = [
    ["Users", o.users.toLocaleString(), `${o.deleted} deleted`],
    ["Companies", o.companies.toLocaleString()],
    ["Sign-ups", o.signups24h.toLocaleString(), `${o.signups7d} in 7 days`],
    ["Active today", o.activeToday.toLocaleString(), `${o.active7d} in 7 days`],
    ["Tokens today", compact(o.tokensToday)],
    ["Tokens, 30 days", compact(o.tokens30d)],
    ["Games today", o.gamesToday.toLocaleString()],
    ["Coins in wallets", o.coins.toLocaleString()],
    ["Flagged", o.flagged.toLocaleString(), "past the per-minute cap, 30 days"],
  ];
  return (
    <div className="tiles">
      {tiles.map(([label, value, sub]) => (
        <div key={label} className="tile">
          <div className="muted">{label}</div>
          <div className="value">{value}</div>
          {sub && <div className="muted small">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

// MARK: Tables

interface Column<T> {
  label: string;
  /** What it sorts by; no sorting without it. */
  sort?: (row: T) => number | string;
  num?: boolean;
  cell: (row: T) => ReactNode;
}

function Table<T extends { id: number }>({
  rows,
  columns,
  initial,
}: {
  rows: T[];
  columns: Column<T>[];
  initial: number;
}) {
  const [by, setBy] = useState({ col: initial, desc: true });
  const sorted = useMemo(() => {
    const key = columns[by.col]?.sort;
    if (!key) return rows;
    return [...rows].sort((a, b) => {
      const [x, y] = [key(a), key(b)];
      const d = x < y ? -1 : x > y ? 1 : 0;
      return by.desc ? -d : d;
    });
  }, [rows, columns, by]);
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c.label} className={c.num ? "num" : ""}>
                {c.sort ? (
                  <button
                    type="button"
                    onClick={() => setBy({ col: i, desc: by.col === i ? !by.desc : true })}
                  >
                    {c.label}
                    {by.col === i ? (by.desc ? " ↓" : " ↑") : ""}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td key={c.label} className={c.num ? "num" : ""}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="muted">
                No matches.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
const matches = (q: string, ...texts: (string | number | null | undefined)[]) =>
  !q || texts.some((t) => t != null && String(t).toLowerCase().includes(q.toLowerCase()));

/** Asks for the name again before something that can't be undone. */
const confirmName = (what: string, name: string) =>
  window.prompt(`${what}\n\nThis can't be undone. Type "${name}" to go ahead.`)?.trim() === name;

// MARK: Users

function Users({ users, conn, act }: { users: AdminUser[]; conn: AdminConn; act: Act }) {
  const [q, setQ] = useState("");
  const rows = users.filter((u) => matches(q, u.id, u.name, u.company?.name));
  const columns: Column<AdminUser>[] = [
    { label: "ID", num: true, sort: (u) => u.id, cell: (u) => u.id },
    { label: "Name", sort: (u) => u.name, cell: (u) => <strong>{u.name}</strong> },
    {
      label: "Company",
      sort: (u) => u.company?.name ?? "",
      cell: (u) =>
        u.company ? (
          <>
            {u.company.name}
            {u.company.isOwner && <span className="tag">owner</span>}
          </>
        ) : (
          <span className="muted">—</span>
        ),
    },
    { label: "Lvl", num: true, sort: (u) => u.level, cell: (u) => u.level },
    { label: "Today", num: true, sort: (u) => u.tokensToday, cell: (u) => compact(u.tokensToday) },
    { label: "30 days", num: true, sort: (u) => u.tokens30d, cell: (u) => compact(u.tokens30d) },
    { label: "All time", num: true, sort: (u) => u.tokensTotal, cell: (u) => compact(u.tokensTotal) },
    {
      label: "Capped",
      num: true,
      sort: (u) => u.capped30d,
      cell: (u) =>
        u.capped30d > 0 ? (
          <span className="tag bad" title="Tokens past the per-minute cap in 30 days: they didn't count">
            ⚠ {compact(u.capped30d)}
          </span>
        ) : (
          ""
        ),
    },
    {
      label: "Last active",
      sort: (u) => u.lastDay ?? "",
      cell: (u) => u.lastDay ?? <span className="muted">never</span>,
    },
    { label: "Items", num: true, sort: (u) => u.items, cell: (u) => u.items },
    { label: "Games", num: true, sort: (u) => u.games, cell: (u) => u.games },
    {
      label: "Coins",
      num: true,
      sort: (u) => u.balance,
      cell: (u) => (
        <Coins
          key={u.balance}
          balance={u.balance}
          onSave={(n) =>
            act(() => conn.adminSetCoins(u.id, n), `${u.name} has 🪙 ${n.toLocaleString()} now.`)
          }
        />
      ),
    },
    { label: "Joined", sort: (u) => u.createdAt, cell: (u) => date(u.createdAt) },
    {
      label: "",
      cell: (u) => (
        <div className="actions">
          <button
            type="button"
            onClick={() => {
              const name = window.prompt(`New name for ${u.name}:`, u.name)?.trim();
              if (name && name !== u.name)
                void act(() => conn.adminRenameUser(u.id, name), `Renamed to ${name}.`);
            }}
          >
            Rename
          </button>
          {u.company && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Take ${u.name} out of ${u.company!.name}?`))
                  void act(() => conn.adminRemoveFromCompany(u.id), `${u.name} left ${u.company!.name}.`);
              }}
            >
              Remove from company
            </button>
          )}
          {u.tokensTotal > 0 && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (
                  confirmName(
                    `Wipe ${u.name}'s usage? Every synced event goes, with the coins and levels it earned.`,
                    u.name,
                  )
                )
                  void act(() => conn.adminWipeUsage(u.id), `Wiped ${u.name}'s usage.`);
              }}
            >
              Wipe usage
            </button>
          )}
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (
                confirmName(
                  `Delete ${u.name}? Their usage, coins and items go, and the app and browser sign them out.`,
                  u.name,
                )
              )
                void act(() => conn.adminDeleteUser(u.id), `Deleted ${u.name}.`);
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];
  return (
    <>
      <input
        className="search"
        placeholder="Search name, id or company"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Table rows={rows} columns={columns} initial={0} />
    </>
  );
}

/** A balance you click to change. */
function Coins({ balance, onSave }: { balance: number; onSave: (n: number) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null)
    return (
      <button type="button" className="link" title="Set balance" onClick={() => setDraft(String(balance))}>
        🪙 {balance.toLocaleString()}
      </button>
    );
  const n = Number(draft);
  const valid = draft !== "" && Number.isSafeInteger(n) && n >= 0;
  return (
    <form
      className="coins"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void onSave(n).then(() => setDraft(null));
      }}
    >
      <input
        // biome-ignore lint/a11y/noAutofocus: it opens because you clicked it
        autoFocus
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
      />
      <button type="submit" className="primary" disabled={!valid}>
        Set
      </button>
      <button type="button" onClick={() => setDraft(null)}>
        ×
      </button>
    </form>
  );
}

// MARK: Companies

function Companies({ companies, conn, act }: { companies: AdminCompany[]; conn: AdminConn; act: Act }) {
  const [q, setQ] = useState("");
  const rows = companies.filter((c) =>
    matches(q, c.id, c.name, c.website, c.owner.name, ...c.members.map((m) => m.name)),
  );
  const columns: Column<AdminCompany>[] = [
    { label: "ID", num: true, sort: (c) => c.id, cell: (c) => c.id },
    { label: "Name", sort: (c) => c.name, cell: (c) => <strong>{c.name}</strong> },
    { label: "Owner", sort: (c) => c.owner.name, cell: (c) => c.owner.name },
    {
      label: "Members",
      num: true,
      sort: (c) => c.members.length,
      cell: (c) => (
        <details>
          <summary>{c.members.length}</summary>
          {c.members.map((m) => m.name).join(", ")}
        </details>
      ),
    },
    { label: "Applicants", num: true, sort: (c) => c.applicants, cell: (c) => c.applicants || "" },
    { label: "House", sort: (c) => c.tier, cell: (c) => houseTierName(c.tier) },
    { label: "Today", num: true, sort: (c) => c.tokensToday, cell: (c) => compact(c.tokensToday) },
    { label: "30 days", num: true, sort: (c) => c.tokens30d, cell: (c) => compact(c.tokens30d) },
    {
      label: "Website",
      sort: (c) => c.website ?? "",
      cell: (c) =>
        c.website ? (
          <>
            <a href={`https://${c.website}`} target="_blank" rel="noreferrer">
              {c.website}
            </a>
            {c.branding && (
              <span className={`tag ${c.branding === "failed" ? "bad" : ""}`}>{c.branding}</span>
            )}
          </>
        ) : (
          <span className="muted">—</span>
        ),
    },
    { label: "Plot", num: true, sort: (c) => c.plot, cell: (c) => c.plot },
    { label: "Founded", sort: (c) => c.createdAt, cell: (c) => date(c.createdAt) },
    {
      label: "",
      cell: (c) => (
        <div className="actions">
          <button
            type="button"
            onClick={() => {
              const name = window.prompt(`New name for ${c.name}:`, c.name)?.trim();
              if (name && name !== c.name)
                void act(() => conn.adminRenameCompany(c.id, name), `Renamed to ${name}.`);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (
                confirmName(
                  `Close ${c.name}? Its ${c.members.length} members leave and its house goes.`,
                  c.name,
                )
              )
                void act(() => conn.adminCloseCompany(c.id), `Closed ${c.name}.`);
            }}
          >
            Close
          </button>
        </div>
      ),
    },
  ];
  return (
    <>
      <input
        className="search"
        placeholder="Search name, website or member"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Table rows={rows} columns={columns} initial={7} />
    </>
  );
}

// MARK: Log

function Log({ log }: { log: AdminLogEntry[] }) {
  const columns: Column<AdminLogEntry>[] = [
    { label: "When", sort: (e) => e.at, cell: (e) => new Date(e.at).toLocaleString() },
    { label: "Action", sort: (e) => e.action, cell: (e) => <strong>{e.action}</strong> },
    { label: "Who", sort: (e) => e.target, cell: (e) => e.target },
    { label: "Detail", cell: (e) => e.detail ?? <span className="muted">—</span> },
  ];
  return <Table rows={log} columns={columns} initial={0} />;
}
