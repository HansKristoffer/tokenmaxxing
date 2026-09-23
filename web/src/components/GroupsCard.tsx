import { useState } from "react";
import type { Me } from "../api.ts";

export function GroupsCard({ groups }: { groups: Me["groups"] }) {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = (g: Me["groups"][number]) => {
    void navigator.clipboard.writeText(`Join my tokenmaxxing group: ${g.code}`);
    setCopied(g.id);
  };
  return (
    <section className="card">
      <h2>Groups</h2>
      {groups.length === 0 && (
        <p className="muted">Create or join a group from the menu bar app to compare with friends.</p>
      )}
      {groups.map((g) => (
        <div key={g.id} className="group">
          <div>
            <div>
              {g.name} {g.isOwner && <span title="You own this group">👑</span>}
            </div>
            <div className="mono muted">
              {g.code} · {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
            </div>
          </div>
          <button type="button" className="btn" onClick={() => copy(g)}>
            {copied === g.id ? "Copied" : "Copy invite"}
          </button>
        </div>
      ))}
    </section>
  );
}
