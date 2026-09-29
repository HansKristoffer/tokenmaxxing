import { useEffect, useState } from "react";
import { redeem } from "../net.ts";
import { tauri } from "./AppUpdate.tsx";

const MESSAGES: Record<string, string> = {
  name_taken: "That name is taken.",
  invalid_name: "Use 2–32 characters: a–z, 0–9, dot, dash or underscore.",
  rate_limited: "Too many sign-ups right now. Try again in a few minutes.",
  offline: "Can't reach the server.",
};

/**
 * The app's window with no session: it signs in through the app's account, or, when there's none yet,
 * asks for a name and signs up (app/desktop/src-tauri/src/world.rs). The page then loads again, signed in.
 */
export function AppSignIn() {
  const [needsName, setNeedsName] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const enter = async (name?: string) => {
    setBusy(true);
    setError(null);
    try {
      await redeem(await tauri!.core.invoke<string>("enter_world", { name }));
      location.reload();
    } catch (err) {
      if (err === "signed_out" || err === "unauthorized") setNeedsName(true);
      else setError((typeof err === "string" && MESSAGES[err]) || "Something went wrong.");
      setBusy(false);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the page finds it has no session
  useEffect(() => void enter(), []);

  return (
    <div className="signed-out">
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void enter(name.trim());
        }}
      >
        <p className="title">⚡ tokenmaxxing</p>
        {needsName ? (
          <>
            <p>Pick a name. It's what everyone in town sees above your character.</p>
            <input
              aria-label="Name"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={busy || !name.trim()}>
              Walk into town
            </button>
            <p className="muted small">
              Only token counts, model names and timestamps leave this Mac. Never message content.
            </p>
          </>
        ) : busy ? (
          <p className="muted">Walking into town…</p>
        ) : (
          <>
            {error && <p className="error">{error}</p>}
            <button type="button" onClick={() => void enter()}>
              Try again
            </button>
          </>
        )}
      </form>
    </div>
  );
}
