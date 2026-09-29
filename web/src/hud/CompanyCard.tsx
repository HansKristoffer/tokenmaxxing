import { compact, plural } from "@tokenmaxxing/core/format.ts";
import type { RangeKey } from "@tokenmaxxing/core/range.ts";
import { houseTierName } from "@tokenmaxxing/core/world.ts";
import type { CompanyProfile } from "@tokenmaxxing/server/registry";
import { useEffect, useState } from "react";
import { errorText, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { DailyChart, RANGES, StatsGrid } from "./PlayerCard.tsx";
import { AvatarImage, House, Modal, Pills } from "./ui.tsx";

const openCard = (userId: number) => hud.set({ panel: { kind: "card", userId } });

/** A company's page, like a player's: its house and logo, website, numbers and people. */
export function CompanyCard({ companyId }: { companyId: number }) {
  const [range, setRange] = useState<RangeKey>("7d");
  const [c, setC] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = useHud((s) => s.me?.company?.id === companyId);

  useEffect(() => {
    let live = true;
    town.company(companyId, range).then(
      (r) => live && setC(r),
      (e) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [companyId, range]);

  if (error) return <Modal title="Company">{error}</Modal>;
  if (!c) return <Modal title="Company">Loading…</Modal>;
  const top = Math.max(1, ...c.members.map((m) => m.tokens));
  return (
    <Modal title={`🏢 ${c.name}`}>
      <div className="card-head company-head">
        <House companyId={c.id} tier={c.tier} scale={1} />
        <div>
          {c.logo && <img className="company-logo" src={c.logo} alt={`${c.name} logo`} />}
          <p>
            <strong>{houseTierName(c.tier)}</strong> · {plural(c.members.length, "member")}
          </p>
          {c.website && (
            <p>
              <a href={`https://${c.website}`} target="_blank" rel="noreferrer noopener">
                🔗 {c.website}
              </a>
            </p>
          )}
          {c.rank !== null && (
            <p className="muted">
              #{c.rank} in town {RANGES.find(([k]) => k === range)?.[1].toLowerCase()}
            </p>
          )}
          {mine && (
            <button type="button" onClick={() => hud.set({ panel: { kind: "company" } })}>
              Manage your company
            </button>
          )}
        </div>
      </div>
      <Pills value={range} options={RANGES} onChange={setRange} />
      <StatsGrid totals={c.totals} />
      <DailyChart daily={c.daily} />
      <h3>People</h3>
      <ol className="lb-list company-people">
        {c.members.map((m) => (
          <li key={m.userId}>
            <button type="button" className="lb-item" onClick={() => openCard(m.userId)}>
              <AvatarImage look={m.look} scale={2} />
              <span className="lb-who">
                <span className="lb-line">
                  <strong>
                    {m.name}
                    {m.isOwner && " 👑"}
                  </strong>
                  <small className="muted">Lv{m.level}</small>
                </span>
                <span className="lb-bar">
                  <span style={{ width: `${Math.max(0.02, m.tokens / top) * 100}%` }} />
                </span>
              </span>
              <span className="lb-values">
                <span className="lb-value">{compact(m.tokens)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
