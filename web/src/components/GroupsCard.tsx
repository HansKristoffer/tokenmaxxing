import { useState } from "react";
import { client, type Group, parseResponse } from "../api.ts";
import { usePoll } from "../usePoll.ts";

interface Props {
  groups: Group[];
  /** The signed-in user, so their own row isn't offered a remove button. */
  me: string;
  /** Reloads what a removal changes: the member counts and the leaderboard. */
  onChange: () => void;
}

export function GroupsCard({ groups, me, onChange }: Props) {
  const [copied, setCopied] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const copy = (g: Group) => {
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
        <div key={g.id}>
          <div className="group">
            <div>
              <div>
                {g.name} {g.isOwner && <span title="You own this group">👑</span>}
              </div>
              <div className="mono muted">
                {g.code} · {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
              </div>
            </div>
            <div className="group-actions">
              <button type="button" className="btn" onClick={() => copy(g)}>
                {copied === g.id ? "Copied" : "Copy invite"}
              </button>
              <button
                type="button"
                className="btn"
                aria-expanded={expanded === g.id}
                onClick={() => setExpanded(expanded === g.id ? null : g.id)}
              >
                Members
              </button>
            </div>
          </div>
          {expanded === g.id && <MemberList group={g} me={me} onChange={onChange} />}
        </div>
      ))}
    </section>
  );
}

/**
 * The group's members, with a remove control on everyone but you when you own
 * the group. Removing yourself is leaving, which the menu bar app owns, so the
 * owner's own row is never offered one. Removal asks for a second click rather
 * than a dialog, since the card reloads under the poll.
 */
function MemberList({ group, me, onChange }: { group: Group; me: string; onChange: () => void }) {
  const members = usePoll(
    () => parseResponse(client.api.groups[":id"].members.$get({ param: { id: String(group.id) } })),
    [group.id],
  );
  const [pending, setPending] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (member: string) => {
    setRemoving(member);
    setError(null);
    try {
      await parseResponse(
        client.api.groups[":id"].members[":member"].$delete({
          param: { id: String(group.id), member },
        }),
      );
      members.reload();
      onChange();
      setPending(null);
    } catch {
      setError(`Couldn't remove ${member}.`);
    } finally {
      setRemoving(null);
    }
  };

  if (!members.data) {
    return <p className="muted members-note">{members.error ? "Couldn't load members." : "Loading…"}</p>;
  }

  return (
    <>
      <ul className="members">
        {members.data.members.map((m) => (
          <li key={m.user}>
            <span>
              {m.user}
              {m.user === me && <span className="muted"> (you)</span>}
            </span>
            {group.isOwner && m.user !== me && (
              <span className="member-actions">
                {pending === m.user ? (
                  <>
                    <button
                      type="button"
                      className="link danger"
                      disabled={removing === m.user}
                      onClick={() => void remove(m.user)}
                    >
                      {removing === m.user ? "Removing…" : "Confirm"}
                    </button>
                    <button type="button" className="link" onClick={() => setPending(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="link danger" onClick={() => setPending(m.user)}>
                    Remove
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="error members-note">{error}</p>}
    </>
  );
}
