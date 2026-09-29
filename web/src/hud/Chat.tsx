import { CHAT_MAX_LENGTH, type ChatLine, mentionsIn } from "@tokenmaxxing/core/world.ts";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { roomName, world } from "../game/world.ts";
import { conn, errorText, town } from "../net.ts";
import { hud, useHud } from "../store.ts";

/** The `@partial` being typed at the end of the input, if any. */
const typingMention = (text: string) => /(?:^|\s)@([a-z0-9._-]*)$/i.exec(text)?.[1]?.toLowerCase() ?? null;

/** People you can see first (this room, and inside houses), then everyone else by name. */
function useSuggestions(query: string | null, myName: string | undefined): string[] {
  const [remote, setRemote] = useState<string[]>([]);
  useEffect(() => {
    setRemote([]);
    if (!query) return;
    const id = setTimeout(() => void town.searchNames(query).then(setRemote, () => {}), 150);
    return () => clearTimeout(id);
  }, [query]);
  if (query === null) return [];
  const nearby = [
    ...[...world.avatars.values()].map((a) => a.info.name),
    ...Object.values(world.houses).flatMap((list) => list.map((p) => p.name)),
  ];
  return [...new Set([...nearby, ...remote])]
    .filter((name) => name !== myName && name.startsWith(query))
    .slice(0, 6);
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
  const [picked, setPicked] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const query = typingMention(text);
  const suggestions = useSuggestions(query, me?.name);

  useEffect(() => {
    if (focus > 0) input.current?.focus();
  }, [focus]);
  // Keep the newest line in view as lines arrive.
  useEffect(() => {
    if (chat.length) list.current?.scrollTo(0, list.current.scrollHeight);
  }, [chat]);

  const pick = (name: string) => {
    setText(`${text.replace(/@[a-z0-9._-]*$/i, `@${name}`)} `);
    setPicked(0);
    input.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setPicked((i) => (i + step + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        pick(suggestions[Math.min(picked, suggestions.length - 1)]!);
        return;
      }
    }
    if (e.key === "Escape") e.currentTarget.blur();
  };

  return (
    <section className="panel chat" aria-label="Chat">
      <header>
        <span>📍 {roomName(room)}</span>
        <span className="muted"> · {here} here</span>
      </header>
      <ol ref={list}>
        {chat.length === 0 && <li className="muted">No messages yet. Say hi!</li>}
        {chat.map((l: ChatLine) => (
          <li key={l.id} className={me && mentionsIn(l.text).includes(me.name) ? "mentions-me" : ""}>
            <button
              type="button"
              className={`author${l.userId === me?.userId ? " me" : ""}`}
              onClick={() => hud.set({ panel: { kind: "card", userId: l.userId } })}
            >
              {l.name}
            </button>
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
        {suggestions.length > 0 && (
          <ul className="suggestions" aria-label="Mention someone">
            {suggestions.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={i === Math.min(picked, suggestions.length - 1)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus in the input
                    pick(name);
                  }}
                >
                  @{name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={input}
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Say: press Enter to chat, @ to mention"
          onChange={(e) => {
            setText(e.target.value);
            setPicked(0);
          }}
          onKeyDown={onKeyDown}
        />
      </form>
      {error && <p className="error small">{error}</p>}
    </section>
  );
}
