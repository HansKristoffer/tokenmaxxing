import { compact } from "@tokenmaxxing/core/format.ts";
import { useEffect, useState } from "react";
import { roomName, world } from "../game/world.ts";
import { hud, useHud } from "../store.ts";
import { AppUpdate } from "./AppUpdate.tsx";
import { ArcadePanel, GamesBox, InviteToast, NewTable } from "./Arcade.tsx";
import { Chat } from "./Chat.tsx";
import { CompanyCard } from "./CompanyCard.tsx";
import { CompanyPanel } from "./CompanyPanel.tsx";
import { Leaderboard } from "./Leaderboard.tsx";
import { LookPicker } from "./LookPicker.tsx";
import { MatchPanel } from "./Match.tsx";
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
      <div className="corner">
        <MiniBoard />
        <GamesBox />
      </div>
      <Banner />
      <Chat />
      <Minimap />
      <Dialog />
      <Panel />
      {status === "connecting" && (
        <div className="toast" role="status">
          Walking into town…
        </div>
      )}
      {status === "offline" && (
        <div className="toast" role="status">
          Reconnecting…
        </div>
      )}
      <MentionToast />
      <NoticeToast />
      <InviteToast />
      <FirstVisit />
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
  const waiting = useHud((s) => s.me?.company?.applicants.length ?? 0);
  return (
    <div className="panel stats-chip">
      <AppUpdate />
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
          aria-label={`Shop: ${wallet.balance} coins`}
          onClick={() => hud.set({ panel: { kind: "shop" } })}
        >
          🪙 <strong>{wallet.balance.toLocaleString()}</strong>
        </button>
      )}
      <button
        type="button"
        className="icon"
        title={waiting ? `Company: ${waiting} asking to join` : "Company"}
        aria-label={waiting ? `Company: ${waiting} asking to join` : "Company"}
        onClick={() => hud.set({ panel: { kind: "company" } })}
      >
        🏢{waiting > 0 && <span className="count">{waiting}</span>}
      </button>
    </div>
  );
}

const BANNER_MS = 2500;
const MENTION_MS = 8000;

/** True while something that happened `at` is less than `ms` old; re-renders when it expires. */
function useFresh(at: number | undefined, ms: number): boolean {
  const [, tick] = useState(0);
  useEffect(() => {
    if (at === undefined) return;
    const id = setTimeout(() => tick((n) => n + 1), at + ms - Date.now() + 50);
    return () => clearTimeout(id);
  }, [at, ms]);
  return at !== undefined && Date.now() - at <= ms;
}

function Banner() {
  const banner = useHud((s) => s.banner);
  if (!useFresh(banner?.at, BANNER_MS) || !banner) return null;
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
    case "companyCard":
      return <CompanyCard companyId={panel.companyId} />;
    case "company":
      return <CompanyPanel />;
    case "look":
      return <LookPicker />;
    case "shop":
      return <Shop />;
    case "arcade":
      return <ArcadePanel />;
    case "newTable":
      return <NewTable invite={panel.invite} />;
    case "match":
      return <MatchPanel id={panel.id} />;
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
            <button type="button" onClick={() => hud.set({ panel: { kind: "arcade" } })}>
              🎮 Arcade
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

const FIRST_VISIT_KEY = "tokenmaxxing.pickedCompany";

/** Right after signing up: the first time in town without a company, offer to start or join one. */
function FirstVisit() {
  const me = useHud((s) => s.me);
  useEffect(() => {
    if (!me || localStorage.getItem(FIRST_VISIT_KEY)) return;
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    if (!me.company && !me.application) hud.set({ panel: { kind: "company" } });
  }, [me]);
  return null;
}

/** A line for me from the server (a company application, or the answer to mine). */
function NoticeToast() {
  const notice = useHud((s) => s.notice);
  if (!useFresh(notice?.at, MENTION_MS) || !notice) return null;
  return (
    <button
      type="button"
      className="toast mention-toast"
      onClick={() => hud.set({ notice: null, panel: { kind: "company" } })}
    >
      🏢 {notice.text}
    </button>
  );
}

/** Someone @-mentioned me from another room. */
function MentionToast() {
  const mention = useHud((s) => s.mention);
  if (!useFresh(mention?.at, MENTION_MS) || !mention) return null;
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
