import { compact } from "@tokenmaxxing/core/format.ts";
import { useEffect, useState } from "react";
import { roomName, world } from "../game/world.ts";
import { hud, useHud } from "../store.ts";
import { Chat } from "./Chat.tsx";
import { CompanyPanel } from "./CompanyPanel.tsx";
import { Leaderboard } from "./Leaderboard.tsx";
import { LookPicker } from "./LookPicker.tsx";
import { MiniBoard } from "./MiniBoard.tsx";
import { Minimap } from "./Minimap.tsx";
import { PlayerCard } from "./PlayerCard.tsx";
import { Shop } from "./Shop.tsx";
import { Modal } from "./ui.tsx";

export function Hud() {
  const status = useHud((s) => s.status);
  if (status === "signedOut" || status === "expired") return <SignedOut expired={status === "expired"} />;
  return (
    <>
      <Hints />
      <Stats />
      <MiniBoard />
      <Banner />
      <Chat />
      <Minimap />
      <Dialog />
      <Panel />
      {status === "connecting" && <div className="toast">Walking into town…</div>}
      {status === "offline" && <div className="toast">Reconnecting…</div>}
      <MentionToast />
    </>
  );
}

function Hints() {
  return (
    // Just an ⓘ until hovered (or focused from the keyboard), then the whole cheat sheet.
    <div className="panel hints">
      <button type="button" className="title" aria-label="Controls">
        ⓘ<span className="hints-name"> ⚡ tokenmaxxing</span>
      </button>
      <dl>
        <dt>Arrows</dt>
        <dd>Move</dd>
        <dt>X</dt>
        <dd>Run</dd>
        <dt>Space</dt>
        <dd>Interact</dd>
        <dt>Enter</dt>
        <dd>Chat</dd>
        <dt>L</dt>
        <dd>Leaderboard</dd>
        <dt>Esc</dt>
        <dd>Menu</dd>
        <dt>+ −</dt>
        <dd>Zoom</dd>
      </dl>
    </div>
  );
}

function Stats() {
  const stats = useHud((s) => s.stats);
  const wallet = useHud((s) => s.wallet);
  return (
    <div className="panel stats-chip">
      {stats && (
        <button
          type="button"
          className="chip"
          onClick={() => hud.set({ panel: { kind: "card", userId: world.selfId } })}
        >
          <strong>{compact(stats.tokensToday)}</strong> today
          {stats.rank !== null && <span className="badge">#{stats.rank}</span>}
          <span className="badge lv">Lv{stats.level}</span>
        </button>
      )}
      {wallet && (
        <button
          type="button"
          className="chip"
          title="Shop"
          onClick={() => hud.set({ panel: { kind: "shop" } })}
        >
          🪙 <strong>{wallet.balance.toLocaleString()}</strong>
        </button>
      )}
      <button
        type="button"
        className="icon"
        title="Leaderboard (L)"
        onClick={() => hud.set({ panel: { kind: "leaderboard" } })}
      >
        🏆
      </button>
      <button
        type="button"
        className="icon"
        title="Company"
        onClick={() => hud.set({ panel: { kind: "company" } })}
      >
        🏢
      </button>
    </div>
  );
}

function Banner() {
  const banner = useHud((s) => s.banner);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => tick((n) => n + 1), 2600);
    return () => clearTimeout(id);
  }, [banner]);
  if (!banner || Date.now() - banner.at > 2500) return null;
  return <div className="banner">{banner.text}</div>;
}

function Dialog() {
  const dialog = useHud((s) => s.dialog);
  if (!dialog) return null;
  return (
    <div className="panel dialog" role="status">
      {dialog}
      <span className="muted small"> ▼ Space</span>
    </div>
  );
}

function Panel() {
  const panel = useHud((s) => s.panel);
  if (!panel) return null;
  switch (panel.kind) {
    case "leaderboard":
      return <Leaderboard />;
    case "card":
      return <PlayerCard userId={panel.userId} />;
    case "company":
      return <CompanyPanel />;
    case "look":
      return <LookPicker />;
    case "shop":
      return <Shop />;
    case "menu":
      return (
        <Modal title="Menu">
          <nav className="menu">
            <button type="button" onClick={() => hud.set({ panel: { kind: "look" } })}>
              🎨 Your character
            </button>
            <button type="button" onClick={() => hud.set({ panel: { kind: "shop" } })}>
              🪙 Shop
            </button>
            <button type="button" onClick={() => hud.set({ panel: { kind: "company" } })}>
              🏢 Company
            </button>
            <button type="button" onClick={() => hud.set({ panel: { kind: "leaderboard" } })}>
              🏆 Leaderboard
            </button>
            <a href="https://github.com/HansKristoffer/tokenmaxxing" target="_blank" rel="noreferrer">
              ⌥ GitHub
            </a>
          </nav>
        </Modal>
      );
  }
}

function SignedOut({ expired }: { expired: boolean }) {
  return (
    <div className="signed-out">
      <div className="panel">
        <p className="title">⚡ tokenmaxxing</p>
        <p>{expired ? "That link has expired." : "A tiny town for people who run AI coding agents."}</p>
        <p>
          Open the world from the <strong>tokenmaxxing</strong> menu bar app to walk in.
        </p>
        <p className="muted">
          Don't have it yet? <code>brew install --cask hanskristoffer/tap/tokenmaxxing</code>
        </p>
      </div>
    </div>
  );
}

/** Someone @-mentioned me from another room. */
function MentionToast() {
  const mention = useHud((s) => s.mention);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!mention) return;
    const id = setTimeout(() => tick((n) => n + 1), MENTION_MS + 100);
    return () => clearTimeout(id);
  }, [mention]);
  if (!mention || Date.now() - mention.at > MENTION_MS) return null;
  const { line } = mention;
  return (
    <button
      type="button"
      className="toast mention-toast"
      onClick={() => hud.set({ mention: null, panel: { kind: "card", userId: line.userId } })}
    >
      💬 <strong>{line.name}</strong> mentioned you in {roomName(line.room)}: {line.text}
    </button>
  );
}

const MENTION_MS = 8000;
