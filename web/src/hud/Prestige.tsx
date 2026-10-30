import { RUN_LEVELS } from "@tokenmaxxing/core/prestige.ts";
import type { PrestigeBadge } from "@tokenmaxxing/core/prestige-run.ts";
import { defaultLook } from "@tokenmaxxing/core/world.ts";
import { useEffect, useRef, useState } from "react";
import { prestigeState, takePrestige } from "../net.ts";
import { storage } from "../storage.ts";
import { hud, useHud } from "../store.ts";
import { PrestigeTag } from "./PrestigeTag.tsx";
import {
  badgeOf,
  type CardPrestige,
  cardPrestige,
  coinSchedule,
  KEEP,
  type PlanRow,
  RESTART,
  type RunToast,
  rewardPlan,
  runLine,
  runShare,
  runToasts,
} from "./prestige-view.ts";
import { ItemImage } from "./Shop.tsx";
import { Modal, ToastButton, useFresh, useLoad, useRun } from "./ui.tsx";

const LOOK = defaultLook(1);
const TOAST_MS = 8000;
const calloutKey = (rank: number) => `tokenmaxxing.prestigeCallout.${rank}`;

/** Prestige on my own card: the button when I can take one, or the run's progress row while I am in one. */
export function PrestigeCardRow({ level, badge }: { level: number; badge: PrestigeBadge }) {
  const p = cardPrestige(level, badge);
  const open = () => hud.set({ panel: { kind: "prestige" } });
  if (p.can)
    return (
      <p className="prestige-row">
        <button type="button" className="prestige-btn" onClick={open}>
          ✨ Prestige
        </button>
      </p>
    );
  if (!p.midRun) return null;
  return (
    <div className="prestige-row prestige-run">
      <PrestigeTag rank={badge.rank} level={badge.runLevel} />
      <div className="xp" role="img" aria-label={runLine(badge)}>
        <span className="xp-done" style={{ width: `${runShare(badge.runLevel) * 100}%` }} />
      </div>
      <p className="muted small">{runLine(badge)}</p>
    </div>
  );
}

function Reward({ row }: { row: PlanRow }) {
  return (
    <li className="prestige-reward">
      <span className="prestige-art">
        {row.item ? <ItemImage item={row.item} look={LOOK} bare /> : row.kind === "trophy" ? "🏆" : "🐾"}
      </span>
      <span>
        <strong>{row.name}</strong>
        <br />
        <span className="muted small">
          {row.label} · run level {row.level}
        </span>
      </span>
    </li>
  );
}

/** The two steps: "Prestige" asks, and only the second button starts the run. */
function Confirm({ name, onGo, busy }: { name: string; onGo: () => void; busy: boolean }) {
  const [asked, setAsked] = useState(false);
  if (!asked)
    return (
      <button type="button" className="prestige-btn" onClick={() => setAsked(true)}>
        Begin Prestige…
      </button>
    );
  return (
    <div className="prestige-confirm" role="alertdialog" aria-label="Confirm prestige">
      <p>
        <strong>Start {name}?</strong> Your run goes back to level 0. This can't be undone.
      </p>
      <button type="button" className="prestige-btn danger" disabled={busy} onClick={onGo}>
        Yes, start {name}
      </button>{" "}
      <button type="button" onClick={() => setAsked(false)}>
        Not yet
      </button>
    </div>
  );
}

export function PrestigePanel() {
  const { data: view, error } = useLoad(prestigeState, []);
  const { error: failed, busy, run } = useRun();
  const [done, setDone] = useState(false);
  if (error) return <Modal title="Prestige">{error}</Modal>;
  if (!view) return <Modal title="Prestige">Loading…</Modal>;
  const track = view.nextTrack;
  const go = run(async () => {
    await takePrestige();
    setDone(true);
  });
  if (done)
    return (
      <Modal title="Prestige">
        <div className="prestige-done">
          {track && <PrestigeTag rank={track.rank} />}
          <p>Welcome. Your run begins at level 0.</p>
        </div>
        <button type="button" onClick={() => hud.set({ panel: null })}>
          Close
        </button>
      </Modal>
    );
  if (!track)
    return (
      <Modal title="Prestige">
        <p>You have finished every prestige there is. More tracks will follow.</p>
      </Modal>
    );
  const name = `Prestige ${track.roman} · ${track.name}`;
  return (
    <Modal title={name} wide>
      <div className="prestige-panel" style={{ "--pt-main": track.colors.main } as React.CSSProperties}>
        <PrestigeTag rank={track.rank} size={26} />
        <p className="muted">{track.theme}</p>
        <h3>What you earn</h3>
        <ul className="prestige-rewards">
          {rewardPlan(track).map((r) => (
            <Reward key={r.kind} row={r} />
          ))}
        </ul>
        <h3>Coins</h3>
        <p className="small">
          🪙 10 a level, and{" "}
          <strong>
            {coinSchedule()
              .map((c) => `${c.coins} at ${c.level}`)
              .join(" · ")}
          </strong>
          : 2,200 a run.
        </p>
        <div className="prestige-keep">
          <section>
            <h3>You keep</h3>
            <ul>
              {KEEP.map((k) => (
                <li key={k}>✓ {k}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Restarts</h3>
            <ul>
              {RESTART.map((k) => (
                <li key={k}>↺ {k}</li>
              ))}
            </ul>
          </section>
        </div>
        {view.canPrestige ? (
          <Confirm name={name} onGo={go} busy={busy} />
        ) : (
          <p className="muted">
            Reach level 50 ({view.rank > 0 ? `run level ${view.runLevel}/${RUN_LEVELS}` : "first journey"}) to
            begin.
          </p>
        )}
        {failed && <p className="error small">{failed}</p>}
      </div>
    </Modal>
  );
}

/** My badge from the server, with the level the card needs for the first journey's cap. */
const useMine = (): { badge: PrestigeBadge; level: number } => {
  const me = useHud((s) => s.me);
  const level = useHud((s) => s.stats?.level ?? 0);
  return { badge: badgeOf(me), level };
};

/** Run level, coin and unlock toasts as my run climbs, and the one-time callout at the cap. */
export function PrestigeToasts() {
  const { badge, level } = useMine();
  const prev = useRef<PrestigeBadge | null>(null);
  const [fresh, setFresh] = useState<{ toasts: RunToast[]; at: number } | null>(null);
  const [gone, setGone] = useState(0);
  const { rank, runLevel } = badge;
  useEffect(() => {
    const before = prev.current;
    prev.current = { rank, runLevel };
    // The first badge after load is where I started, not news.
    if (!before) return;
    const toasts =
      rank > before.rank
        ? runToasts(rank, -1, runLevel)
        : rank === before.rank
          ? runToasts(rank, before.runLevel, runLevel)
          : [];
    if (toasts.length > 0) setFresh({ toasts, at: Date.now() });
  }, [rank, runLevel]);
  const open = useHud((s) => s.panel !== null);
  const shown = useFresh(fresh?.at, TOAST_MS);
  const c: CardPrestige = cardPrestige(level, badge);
  const callout = c.can && !open && !storage.getItem(calloutKey(c.next)) && gone !== c.next;
  return (
    <>
      {shown &&
        fresh?.toasts.map((t) => (
          <ToastButton key={t.key} dismiss={() => setFresh(null)}>
            {t.text}
          </ToastButton>
        ))}
      {callout && (
        <div className="toast prestige-callout" role="status">
          <button
            type="button"
            className="prestige-callout-open"
            onClick={() => {
              storage.setItem(calloutKey(c.next), "1");
              setGone(c.next);
              hud.set({ panel: { kind: "prestige" } });
            }}
          >
            ✨ <strong>You reached the top.</strong> Prestige is open: a new tag, wearables and coins. Tap to
            see what it gives.
          </button>
          <button
            type="button"
            className="prestige-callout-close"
            aria-label="Dismiss"
            onClick={() => {
              storage.setItem(calloutKey(c.next), "1");
              setGone(c.next);
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
