import type { RangeKey } from "@tokenmaxxing/core/range.ts";
import { client, parseResponse } from "../api.ts";
import { fmtCompact, fmtInt, fmtUsd } from "../format.ts";
import { usePoll } from "../usePoll.ts";
import { Activity } from "./Activity.tsx";

export function UserPanel({ name, range, tz }: { name: string; range: RangeKey; tz: string }) {
  const detail = usePoll(
    () => parseResponse(client.api.users[":name"].$get({ param: { name }, query: { range, tz } })),
    [name, range],
  );
  const year = usePoll(
    () => parseResponse(client.api.users[":name"].$get({ param: { name }, query: { range: "all", tz } })),
    [name],
    300_000,
  );
  return (
    <div className="grid-2">
      <section className="card">
        <h2>{name} · activity</h2>
        {year.data ? <Activity daily={year.data.daily} /> : <p className="muted">Loading…</p>}
      </section>
      <section className="card">
        <h2>{name} · models</h2>
        {detail.data && detail.data.models.length === 0 && <p className="muted">No usage in this range.</p>}
        <table>
          <tbody>
            {detail.data?.models.map((m) => (
              <tr key={m.model}>
                <td>{m.model}</td>
                <td className="num r">{fmtCompact(m.tokens)}</td>
                <td className="num r">{fmtUsd(m.costUsd)}</td>
                <td className="num r muted" title="Assistant turns">
                  {fmtInt(m.turns)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
