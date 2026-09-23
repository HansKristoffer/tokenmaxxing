import type { Entry } from "../api.ts";
import { fmtCompact, fmtInt, fmtParallel, fmtUsd } from "../format.ts";

export function StatsStrip({ entry, of }: { entry: Entry; of: number }) {
  const stats: [string, string, string?][] = [
    ["Rank", of > 1 ? `#${entry.rank} of ${of}` : "—"],
    ["Tokens", fmtCompact(entry.tokens)],
    ["Cost", fmtUsd(entry.costUsd)],
    [
      "Parallelism",
      fmtParallel(entry.parallelism),
      "Average agents running at once while active (needs 1 active hour)",
    ],
    ["Peak agents", fmtInt(entry.peakAgents), "Most agents running at the same time"],
    [
      "Tokens / active h",
      entry.tokensPerActiveHour === null ? "—" : fmtCompact(entry.tokensPerActiveHour),
      "Tokens divided by hours with at least one agent running",
    ],
    ["Prompts", fmtInt(entry.prompts)],
  ];
  return (
    <section className="card stats">
      {stats.map(([label, value, title]) => (
        <div key={label} className="stat" title={title}>
          <div className="label">{label}</div>
          <div className="value">{value}</div>
        </div>
      ))}
    </section>
  );
}
