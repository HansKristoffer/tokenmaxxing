import { CHAT_MAX_LENGTH, type ChatLine, mentionsIn } from "@tokenmaxxing/core/world.ts";
import { useEffect, useRef, useState } from "react";
import { roomName } from "../game/world.ts";
import { conn, errorText } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { MentionInput } from "./MentionInput.tsx";
import { QuickReplies } from "./QuickReplies.tsx";

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
          <span className="muted"> · {here} here</span>
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
