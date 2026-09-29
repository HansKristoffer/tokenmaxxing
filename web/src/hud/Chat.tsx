import { CHAT_MAX_LENGTH, type ChatLine, mentionsIn } from "@tokenmaxxing/core/world.ts";
import { useEffect, useRef, useState } from "react";
import { roomName, world } from "../game/world.ts";
import { conn, errorText } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { MentionInput } from "./MentionInput.tsx";
import { QuickReplies } from "./QuickReplies.tsx";
import { AvatarImage } from "./ui.tsx";

/** Who's online in this room, you first, then by name. */
const onlineHere = () =>
  [...world.avatars.values()]
    .filter((a) => a.info.online)
    .sort(
      (a, b) =>
        Number(b.info.id === world.selfId) - Number(a.info.id === world.selfId) ||
        a.info.name.localeCompare(b.info.name),
    )
    .map((a) => a.info);

/**
 * "● 3 online" with the first few faces; hover (or focus) lists everyone online in the room and their
 * company, and a name opens their card. The list is read when it opens, so it's never stale.
 */
function WhosHere({ count }: { count: number }) {
  const [people, setPeople] = useState(onlineHere);
  const refresh = () => setPeople(onlineHere());
  // biome-ignore lint/correctness/useExhaustiveDependencies: the list is read again whenever the count changes
  useEffect(refresh, [count]);
  const companies = useHud((s) => s.companies);
  const companyName = (id: number | null) =>
    id === null ? "Freelancer" : (companies.find((c) => c.id === id)?.name ?? "A company");
  return (
    <span className="whos-here">
      <button
        type="button"
        className="whos-here-chip"
        aria-label={`${count} online here`}
        onMouseEnter={refresh}
        onFocus={refresh}
      >
        <span className="online-dot" aria-hidden="true" />
        <span className="whos-here-faces" aria-hidden="true">
          {people.slice(0, 3).map((p) => (
            <AvatarImage key={p.id} look={p.look} scale={1} />
          ))}
        </span>
        {count} online
      </button>
      <ul className="panel whos-here-list" aria-label="Online here">
        {people.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => hud.set({ panel: { kind: "card", userId: p.id } })}>
              <AvatarImage look={p.look} scale={2} />
              <span>
                <strong>
                  {p.name}
                  {p.id === world.selfId && <span className="muted"> (you)</span>}
                </strong>
                <small className="muted">{companyName(p.companyId)}</small>
              </span>
              <span className="muted small">Lv{p.level}</span>
            </button>
          </li>
        ))}
      </ul>
    </span>
  );
}

/** A chat line with `@name` highlighted; mentions of me stand out more. */
function Text({ text, me }: { text: string; me: string | undefined }) {
  return (
    <span>
      {text.split(/(@[a-z0-9][a-z0-9._-]{1,31})/gi).map((part, i) =>
        i % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one immutable string
          <span key={i} className={`mention${part.slice(1).toLowerCase() === me ? " me" : ""}`}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}

export function Chat() {
  const chat = useHud((s) => s.chat);
  const room = useHud((s) => s.room);
  const here = useHud((s) => s.occupancy[s.room] ?? 0);
  const focus = useHud((s) => s.chatFocus);
  const me = useHud((s) => s.me);
  useHud((s) => s.companies);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (focus > 0) input.current?.focus();
  }, [focus]);
  // Keep the newest line in view as lines arrive.
  useEffect(() => {
    if (chat.length) list.current?.scrollTo(0, list.current.scrollHeight);
  }, [chat]);

  return (
    <div className="chat-dock">
      <QuickReplies onError={setError} />
      <section className="panel chat" aria-label="Chat">
        <header>
          <span>📍 {roomName(room)}</span>
          <WhosHere count={here} />
        </header>
        <ol ref={list}>
          {chat.length === 0 && <li className="muted">No messages yet. Say hi!</li>}
          {chat.map((l: ChatLine) => (
            <li key={l.id} className={me && mentionsIn(l.text).includes(me.name) ? "mentions-me" : ""}>
              {l.userId === 0 ? (
                <span className="author">{l.name}</span>
              ) : (
                <button
                  type="button"
                  className={`author${l.userId === me?.userId ? " me" : ""}`}
                  onClick={() => hud.set({ panel: { kind: "card", userId: l.userId } })}
                >
                  {l.name}
                </button>
              )}
              <Text text={l.text} me={me?.name} />
            </li>
          ))}
        </ol>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const t = text.trim();
            if (!t) return input.current?.blur();
            setText("");
            setError(null);
            try {
              await conn.say(t);
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          <MentionInput
            inputRef={input}
            label="Chat"
            value={text}
            onChange={setText}
            maxLength={CHAT_MAX_LENGTH}
            placeholder="Say: press Enter to chat, @ to mention"
            onEscape={(el) => el.blur()}
          />
        </form>
        {error && <p className="error small">{error}</p>}
      </section>
    </div>
  );
}
