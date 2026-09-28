import { describeMoment, type Moment, REACTIONS } from "@tokenmaxxing/core/moments.ts";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { client, errorStatus, parseResponse } from "../api.ts";
import { relTime } from "../format.ts";
import { usePoll } from "../usePoll.ts";

/** A group's timeline (race moments and chat), or everything read-only across groups. */
export function Timeline({ me, group }: { me: string; group: number | null }) {
  const feed = usePoll(
    () =>
      parseResponse(
        client.api.feed.$get({ query: { limit: "50", ...(group !== null ? { group: String(group) } : {}) } }),
      ),
    [group],
    5_000,
  );
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const moments = (feed.data?.moments ?? []) as Moment[];
  const lastId = moments.at(-1)?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only when a new item arrives
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [lastId]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      feed.reload();
    } catch (err) {
      const status = errorStatus(err);
      setError(
        status === 429
          ? "Slow down a little."
          : status === 400
            ? "Messages are 1–500 characters."
            : "That didn't work.",
      );
    }
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (group === null || !text.trim()) return;
    void act(async () => {
      await parseResponse(
        client.api.groups[":id"].messages.$post({ param: { id: String(group) }, json: { text } }),
      );
      setText("");
    });
  };
  const react = (id: number, emoji: string) =>
    act(() =>
      parseResponse(client.api.feed[":id"].reactions.$post({ param: { id: String(id) }, json: { emoji } })),
    );
  const remove = (id: number) =>
    act(() => parseResponse(client.api.feed[":id"].$delete({ param: { id: String(id) } })));

  return (
    <section className="card">
      <h2>Timeline</h2>
      <div className="timeline" ref={list}>
        {feed.data && moments.length === 0 && (
          <p className="muted">Nothing yet. Passes, wins and chat show up here.</p>
        )}
        {moments.map((m) => {
          const d = describeMoment(m, me);
          const chat = m.kind === "chat";
          const mine = chat && m.actor === me;
          return (
            <div key={m.id} className={`item ${chat ? (mine ? "msg mine" : "msg") : "sys"}`}>
              {chat ? (
                <>
                  <div className="meta">
                    {mine ? "you" : m.actor}
                    {group === null && m.groupName ? ` · ${m.groupName}` : ""} · {relTime(m.createdAt)}
                    {mine && (
                      <button type="button" className="link" onClick={() => void remove(m.id)}>
                        delete
                      </button>
                    )}
                  </div>
                  <div className="bubble">{d.body}</div>
                </>
              ) : (
                <div>
                  <strong>{d.title}</strong> <span className="muted">{d.body}</span>
                </div>
              )}
              <div className="reactions">
                {m.reactions.map((r) => (
                  <button
                    type="button"
                    key={r.emoji}
                    className={r.mine ? "pill mine" : "pill"}
                    onClick={() => void react(m.id, r.emoji)}
                  >
                    {r.emoji} {r.count}
                  </button>
                ))}
                <span className="picker">
                  {REACTIONS.filter((e) => !m.reactions.some((r) => r.emoji === e)).map((e) => (
                    <button type="button" key={e} onClick={() => void react(m.id, e)}>
                      {e}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {group === null ? (
        <p className="muted">Pick a group to chat.</p>
      ) : (
        <form className="compose" onSubmit={send}>
          <input
            value={text}
            maxLength={500}
            placeholder="Message"
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!text.trim()}>
            Send
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
