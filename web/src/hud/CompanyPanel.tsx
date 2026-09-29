import { compact, plural } from "@tokenmaxxing/core/format.ts";
import { CORE_BLOCKS, frontier, plotBlock } from "@tokenmaxxing/core/maps.ts";
import { houseTierName, nextTierAt, perMember } from "@tokenmaxxing/core/world.ts";
import type { Listing } from "@tokenmaxxing/server/registry";
import { useEffect, useState } from "react";
import { refreshMe, town } from "../net.ts";
import { useHud } from "../store.ts";
import { Modal, useRun } from "./ui.tsx";

export function CompanyPanel() {
  const me = useHud((s) => s.me);
  const { error, run: call } = useRun();
  // Every change here shows in `me`.
  const run = (fn: () => Promise<unknown>) =>
    call(async () => {
      await fn();
      await refreshMe();
    });
  const co = me?.company;
  const branding = co?.branding;
  const [plot, setPlot] = useState<number | null>(null);
  // Reading a website takes a little while; keep the panel current until it's done.
  useEffect(() => {
    if (branding !== "working") return;
    const timer = setInterval(() => void refreshMe(), 3000);
    return () => clearInterval(timer);
  }, [branding]);

  if (!me) return <Modal title="Company">Loading…</Modal>;
  if (!co)
    return (
      <Modal title="🏢 Pick a company">
        <p className="muted">
          Companies get a house in town. Members sleep there, work at its desks while their agents run, and
          share a private chat inside. You can also freelance for now and sleep at the Inn.
        </p>
        <PlotPicker value={plot} onChange={setPlot} />
        <CompanyForm
          label="Start a company"
          placeholder="Company name"
          onSubmit={(name) => run(() => town.createCompany(name, plot))()}
        />
        <h3>Or ask to join one</h3>
        {me.application && (
          <p className="applied">
            Waiting for <strong>{me.application.name}</strong> to answer.{" "}
            <button type="button" className="link" onClick={() => void run(() => town.withdraw())()}>
              Withdraw
            </button>
          </p>
        )}
        <Listings
          applied={me.application?.companyId ?? null}
          onApply={(id) => void run(() => town.apply(id))()}
        />
        {error && <p className="error">{error}</p>}
      </Modal>
    );

  const next = nextTierAt(co.tier);
  return (
    <Modal title={`🏢 ${co.name}`}>
      <p>
        <strong>{houseTierName(co.tier)}</strong> · {compact(perMember(co.tokens30d, co.members.length))}{" "}
        tokens per member in 30 days
        {next !== null && <span className="muted"> · next house at {compact(next)} each</span>}
      </p>
      <p className="muted small">
        Your house shows how hard your people push, not how many you are: tokens per member decide it.
      </p>
      <h3>Website</h3>
      <p className="muted small">
        {co.website ? (
          <>
            <a href={`https://${co.website}`} target="_blank" rel="noreferrer noopener">
              {co.website}
            </a>{" "}
            is on your sign.{" "}
            {co.branding === "working"
              ? "Painting your house in its colours…"
              : co.branding === "failed"
                ? "Couldn't read its colours and logo; the house keeps its own."
                : ""}
          </>
        ) : (
          "Add your website: it goes on your sign, and your house gets your brand's colours and logo."
        )}
      </p>
      {co.isOwner && (
        <CompanyForm
          label={co.website ? "Change website" : "Set website"}
          placeholder={co.website ?? "acme.com"}
          maxLength={256}
          onSubmit={(url) => run(() => town.setWebsite(url))()}
        />
      )}
      {co.isOwner && co.applicants.length > 0 && (
        <>
          <h3>Asking to join ({co.applicants.length})</h3>
          <ul className="members">
            {co.applicants.map((a) => (
              <li key={a.userId}>
                <span>
                  {a.name} <small className="muted">Lv{a.level}</small>
                </span>
                <span className="answer">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void run(() => town.approve(a.userId))()}
                  >
                    Accept
                  </button>
                  <button type="button" onClick={() => void run(() => town.decline(a.userId))()}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Members ({co.members.length})</h3>
      <ul className="members">
        {co.members.map((m) => (
          <li key={m.userId}>
            <span>
              {m.name}
              {m.isOwner && <small className="muted"> owner</small>}
            </span>
            {co.isOwner && m.userId !== me.userId && (
              <button type="button" className="link" onClick={() => void run(() => town.kick(m.userId))()}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {co.isOwner && (
        <CompanyForm
          label="Rename"
          placeholder={co.name}
          onSubmit={(name) => run(() => town.renameCompany(name))()}
        />
      )}
      <button type="button" className="danger" onClick={() => void run(() => town.leaveCompany())()}>
        Leave {co.name}
      </button>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

function CompanyForm({
  label,
  placeholder,
  maxLength = 32,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  maxLength?: number;
  onSubmit: (v: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <label>
        {label}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      </label>
      <button type="submit">{label.split(" ")[0]}</button>
    </form>
  );
}

/** Which way a block lies from the square: "north-east". */
function direction(plot: number): string {
  const [bx, by] = plotBlock(plot);
  const ns = by < 0 ? "north" : by > 1 ? "south" : "";
  const ew = bx < 0 ? "west" : bx > 1 ? "east" : "";
  return [ns, ew].filter(Boolean).join("-");
}

/**
 * The town seen from above, a square per block: the town square, the companies, and every empty
 * block next to them to build on. `null` picks the one nearest the square.
 */
function PlotPicker({ value, onChange }: { value: number | null; onChange: (plot: number) => void }) {
  const companies = useHud((s) => s.companies);
  const built = companies.map((c) => [c.plot, c.name] as const);
  const free = frontier(built.map(([p]) => p));
  const chosen = value !== null && free.includes(value) ? value : free[0]!;
  const blocks = [...CORE_BLOCKS, ...[...built.map(([p]) => p), ...free].map(plotBlock)];
  const minX = Math.min(...blocks.map(([x]) => x));
  const minY = Math.min(...blocks.map(([, y]) => y));
  const cols = Math.max(...blocks.map(([x]) => x)) - minX + 1;
  const place = (plot: number) => {
    const [bx, by] = plotBlock(plot);
    return { gridColumn: bx - minX + 1, gridRow: by - minY + 1 };
  };
  return (
    <fieldset className="plots">
      <legend>Where to build</legend>
      <div className="plot-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1.9em)` }}>
        <span
          className="plot-core"
          style={{ gridColumn: `${1 - minX} / span 2`, gridRow: `${1 - minY} / span 2` }}
        >
          ⛲
        </span>
        {built.map(([p, name]) => (
          <span key={p} className="plot-house" style={place(p)} title={name}>
            🏠
          </span>
        ))}
        {free.map((p) => (
          <button
            key={p}
            type="button"
            className="plot-free"
            style={place(p)}
            aria-pressed={p === chosen}
            aria-label={`Build ${direction(p)} of the square`}
            title={`${direction(p)} of the square`}
            onClick={() => onChange(p)}
          >
            {p === chosen ? "📍" : ""}
          </button>
        ))}
      </div>
      <small className="muted">The town grows wherever you build: pick any spot next to it.</small>
    </fieldset>
  );
}

/** Every company in town, busiest first, with a button to ask to join. */
function Listings({ applied, onApply }: { applied: number | null; onApply: (id: number) => void }) {
  const [list, setList] = useState<Listing[] | null>(null);
  useEffect(() => {
    void town.listings().then(setList, () => setList([]));
  }, []);
  if (!list) return <p className="muted small">Loading…</p>;
  if (list.length === 0) return <p className="muted small">No companies yet: start the first one.</p>;
  return (
    <ul className="listings">
      {list.map((c) => (
        <li key={c.id}>
          <span>
            <strong>{c.name}</strong>
            {c.website && <span className="muted"> · {c.website}</span>}
            <br />
            <small className="muted">
              {houseTierName(c.tier)} · {plural(c.members, "member")} ·{" "}
              {compact(perMember(c.tokens30d, c.members))} each in 30 days
            </small>
          </span>
          {applied === c.id ? (
            <span className="muted small">Asked ✓</span>
          ) : c.full ? (
            <span className="muted small">Full</span>
          ) : (
            <button type="button" onClick={() => onApply(c.id)}>
              Apply
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
