import type { SortKey } from "@tokenmaxxing/core/protocol.ts";
import type { Entry } from "../api.ts";
import { fmtCompact, fmtParallel, fmtUsd, relTime } from "../format.ts";

interface Props {
  entries: Entry[];
  me: string;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  selected: string;
  onSelect: (name: string) => void;
}

export function LeaderboardTable({ entries, me, sort, onSort, selected, onSelect }: Props) {
  const sortable = (key: SortKey, label: string, title?: string) => (
    <th
      className="r sortable"
      aria-sort={sort === key ? "descending" : "none"}
      title={title}
      onClick={() => onSort(key)}
    >
      {label}
      {sort === key ? " ↓" : ""}
    </th>
  );
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          {sortable("tokens", "Tokens")}
          {sortable("cost", "Cost")}
          {sortable("parallelism", "Parallel", "Average agents running at once while active")}
          <th className="r" title="Most agents running at the same time">
            Peak
          </th>
          {sortable("prs", "PRs", "Pull requests created on GitHub (needs gh)")}
          <th>Top model</th>
          <th className="r">Last active</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.name}
            className={[e.name === me ? "me" : "", e.name === selected ? "selected" : ""].join(" ")}
            onClick={() => onSelect(e.name)}
          >
            <td className="num muted">{e.rank}</td>
            <td>{e.name}</td>
            <td className="num r">{fmtCompact(e.tokens)}</td>
            <td className="num r">{fmtUsd(e.costUsd)}</td>
            <td className="num r">{fmtParallel(e.parallelism)}</td>
            <td className="num r">{e.peakAgents || "—"}</td>
            <td className="num r">{e.prs || "—"}</td>
            <td className="muted">{e.topModel ?? "—"}</td>
            <td className="r muted">{relTime(e.lastActiveAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
