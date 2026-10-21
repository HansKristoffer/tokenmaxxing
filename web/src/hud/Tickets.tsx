import { chargeOf, type Ticket } from "@tokenmaxxing/core/cop.ts";
import { plural } from "@tokenmaxxing/core/format.ts";

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The 429 Cop's tickets on a player card: a badge of honour, opened to read them. */
export function Tickets({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) return null;
  return (
    <details className="tickets">
      <summary className="badge">🎫 {plural(tickets.length, "speeding ticket")}</summary>
      <ol>
        {tickets.map((t) => (
          <li key={t.day} className="ticket">
            <span className="ticket-head">
              TOKENMAXXING PD · No. 429-{t.day.replaceAll("-", "")} · {dayLabel(t.day)}
            </span>
            {chargeOf(t)}.<span className="ticket-sign">Officer 429</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
