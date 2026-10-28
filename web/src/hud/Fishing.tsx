import {
  BITE_WINDOW_MS,
  FISH,
  type FishCatch,
  type FishingCast,
  type FishingEntry,
  fishingPhase,
} from "@tokenmaxxing/core/fishing.ts";
import { useEffect, useRef, useState } from "react";
import { setFishingLine } from "../game/fishing-line.ts";
import { self } from "../game/world.ts";
import { conn, town } from "../net.ts";
import { Modal, useLoad, useRun, useTicker } from "./ui.tsx";

export function Fishing() {
  const { data, error: loadError } = useLoad(() => town.fishingJournal(), []);
  const [journal, setJournal] = useState<FishingEntry[] | null>(null);
  const [cast, setCast] = useState<FishingCast | null>(null);
  const [caught, setCaught] = useState<FishCatch | null>(null);
  const [message, setMessage] = useState("Borrow a rod, cast a line, and wait for the bobber to dip.");
  const { error, busy, run } = useRun();
  const live = useRef(true);
  const [skew, setSkew] = useState(0);
  useTicker(80, cast !== null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      setFishingLine(null);
      void conn.fishingCancel().catch(() => {});
    };
  }, []);
  const now = Date.now() - skew;
  const phase = cast ? fishingPhase(cast, now) : null;
  const fish = caught && FISH.find((f) => f.id === caught.fish);
  const entries = journal ?? data ?? [];
  const castLine = run(async () => {
    const me = self();
    if (!me) return;
    const reply = await conn.fishingCast(me.facing);
    if (!live.current) return;
    setCaught(null);
    if (!reply.ok) {
      setMessage(reply.message);
      return;
    }
    setSkew(Date.now() - reply.now);
    setCast(reply.cast);
    setFishingLine(reply.cast);
  });
  const reel = run(async () => {
    const reply = await conn.fishingReel();
    if (!live.current) return;
    setCast(null);
    setFishingLine(null);
    if (!reply.ok) {
      setMessage(reply.message);
      return;
    }
    setCaught(reply.catch);
    setJournal(reply.journal);
    setMessage("Added to your journal, then released back into the pond.");
  });
  return (
    <Modal title="🎣 Pond fishing">
      <p className="muted">
        Free rod and bait. Catch and release; your journal keeps every discovery and personal best.
      </p>
      <div className={`fishing-scene ${phase === "bite" ? "biting" : ""}`}>
        <span className="fishing-reeds" aria-hidden="true">
          🌾
        </span>
        <span className={`fishing-bobber ${cast ? "cast" : ""}`} aria-hidden="true" />
        <span className="fishing-catch" aria-hidden="true">
          {fish?.emoji ?? "〰"}
        </span>
      </div>
      <p role="status" aria-live="polite">
        {phase === "waiting"
          ? "Line cast. Watch the bobber…"
          : phase === "bite"
            ? "A bite! Reel it in!"
            : phase === "missed"
              ? "It got away. Cast again when you're ready."
              : fish
                ? `${fish.emoji} ${fish.name} · ${caught!.cm} cm! ${message}`
                : message}
      </p>
      {phase === "bite" && (
        <progress
          className="fishing-timer"
          aria-label="Time left to reel"
          max={BITE_WINDOW_MS}
          value={Math.max(0, cast!.endsAt - now)}
        />
      )}
      <div className="actions">
        {!cast || phase === "missed" ? (
          <button type="button" disabled={busy} onClick={castLine}>
            Cast a line
          </button>
        ) : (
          <button type="button" disabled={busy || phase !== "bite"} onClick={reel}>
            {phase === "bite" ? "Reel it in!" : "Waiting for a bite…"}
          </button>
        )}
      </div>
      {(error || loadError) && <p className="error">{error || loadError}</p>}
      <h3>
        Fishing journal · {entries.length}/{FISH.length}
      </h3>
      <ul className="fishing-journal">
        {FISH.map((f) => {
          const entry = entries.find((e) => e.fish === f.id);
          return (
            <li key={f.id}>
              <span>
                {f.emoji} {f.name}
              </span>
              <span className="muted">
                {entry ? `${entry.count} caught · best ${entry.cm} cm` : "Not caught yet"}
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
