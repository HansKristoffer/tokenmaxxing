import { compact } from "@tokenmaxxing/core/format.ts";
import { houseTierName, nextTierAt, perMember } from "@tokenmaxxing/core/world.ts";
import { type FormEvent, useEffect, useState } from "react";
import { errorText, refreshMe, town } from "../net.ts";
import { useHud } from "../store.ts";
import { Modal } from "./ui.tsx";

export function CompanyPanel() {
  const me = useHud((s) => s.me);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const run = (fn: () => Promise<unknown>) => async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    try {
      await fn();
      await refreshMe();
    } catch (err) {
      setError(errorText(err));
    }
  };
  const co = me?.company;
  const branding = co?.branding;
  // Reading a website takes a little while; keep the panel current until it's done.
  useEffect(() => {
    if (branding !== "working") return;
    const timer = setInterval(() => void refreshMe(), 3000);
    return () => clearInterval(timer);
  }, [branding]);

  if (!me) return <Modal title="Company">Loading…</Modal>;
  if (!co)
    return (
      <Modal title="🏢 Company">
        <p className="muted">
          Companies get a house in town. Members sleep there, work at its desks while their agents run, and
          share a private chat inside.
        </p>
        <CompanyForm
          label="Start a company"
          placeholder="Company name"
          onSubmit={(name) => run(() => town.createCompany(name))()}
        />
        <CompanyForm
          label="Join with a code"
          placeholder="K7QM-2XRP-9D"
          onSubmit={(code) => run(() => town.joinCompany(code))()}
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
      <p className="muted small">
        {co.plot === null ? "No free plot in town yet: you sleep at the Inn." : `Plot ${co.plot} in town.`}
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
      <h3>Invite</h3>
      <div className="invite">
        <code>{co.code}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(co.code);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {co.isOwner && (
          <button type="button" onClick={() => void run(() => town.rotateCode())()}>
            New code
          </button>
        )}
      </div>
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
