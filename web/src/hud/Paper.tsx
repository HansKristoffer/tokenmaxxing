import type { Paper } from "@tokenmaxxing/core/paper.ts";
import { addDays } from "@tokenmaxxing/core/range.ts";
import { useEffect, useState } from "react";
import { errorText, town } from "../net.ts";
import { Modal } from "./ui.tsx";

const dateLine = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** E on a paper by a door: today's front page, about yesterday in town. */
export function PaperPanel() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    void town.paper().then(setPaper, (e) => setFailed(errorText(e)));
  }, []);
  if (!paper) return <Modal title="📰 The morning paper">{failed ?? "Unfolding…"}</Modal>;
  const [lead, ...rest] = paper.headlines;
  return (
    <Modal title="📰 The morning paper" wide>
      <article className="paper">
        <header className="paper-mast">
          <h3>Token Tidende</h3>
          <p>
            <span>{dateLine(addDays(paper.day, 1))}</span>
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
      </article>
    </Modal>
  );
}
