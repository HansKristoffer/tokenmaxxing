import { addDays } from "@tokenmaxxing/core/range.ts";
import { town } from "../net.ts";
import { dayText } from "./format.ts";
import { Modal, useLoad } from "./ui.tsx";

/** A market move as its arrow and percentage; a null change has no arrow and no colour. */
function marketChange(change: number | null) {
  if (change === null) return { className: "", text: "" };

  const isUp = change >= 0;
  const arrow = isUp ? "▲" : "▼";
  return {
    className: isUp ? "up" : "down",
    text: `${arrow} ${Math.round(Math.abs(change) * 100)}%`,
  };
}

/** E on a paper by a door: today's front page, about yesterday in town. */
export function PaperPanel() {
  const { data: paper, error } = useLoad(() => town.paper(), []);
  if (!paper) return <Modal title="📰 The morning paper">{error ?? "Unfolding…"}</Modal>;
  const [lead, ...rest] = paper.headlines;
  return (
    <Modal title="📰 The morning paper" wide>
      <article className="paper">
        <header className="paper-mast">
          <h3>Token Tidende</h3>
          <p>
            <span>
              {dayText(addDays(paper.day, 1), {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span>Yesterday in town</span>
            <span>Free, like the coffee</span>
          </p>
        </header>
        {lead && (
          <section className="paper-lead">
            <h4>{lead.title}</h4>
            <p>{lead.deck}</p>
          </section>
        )}
        <div className="paper-cols">
          {rest.map((h) => (
            <section key={h.title}>
              <h5>{h.title}</h5>
              <p>{h.deck}</p>
            </section>
          ))}
        </div>
        <div className="paper-sides">
          <section className="paper-markets">
            <h6>Markets</h6>
            <table>
              <tbody>
                {paper.markets.map((m) => {
                  const change = marketChange(m.change);
                  return (
                    <tr key={m.label}>
                      <th>{m.label}</th>
                      <td>{m.value}</td>
                      <td className={change.className}>{change.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p>
              <b>Forecast:</b> {paper.forecast}
            </p>
          </section>
          <section>
            <h6>In brief</h6>
            <ul>
              {paper.briefs.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
          {paper.corners.map((c) => (
            <section key={c.kicker}>
              <h6>{c.kicker}</h6>
              <p>{c.text}</p>
            </section>
          ))}
        </div>
      </article>
    </Modal>
  );
}
