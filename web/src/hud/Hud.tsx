import { isBot } from "@tokenmaxxing/core/bots.ts";
import { compact, levelTitle, plural } from "@tokenmaxxing/core/format.ts";
import { milestonesBetween } from "@tokenmaxxing/core/milestones.ts";
import { OFFICE_LEVEL } from "@tokenmaxxing/core/office.ts";
import { typedSwitch } from "hanzio";
import { useEffect, useRef, useState } from "react";
import { roomName, world } from "../game/world.ts";
import { town } from "../net.ts";
import { chatBeside, hud, useHud } from "../store.ts";
import { AppSignIn } from "./AppSignIn.tsx";
import { AppUpdate, tauri } from "./AppUpdate.tsx";
import { ArcadePanel, GamesBox, InviteToast, NewTable } from "./Arcade.tsx";
import { Bag } from "./Bag.tsx";
import { Chat } from "./Chat.tsx";
import { CompanyCard } from "./CompanyCard.tsx";
import { CompanyPanel } from "./CompanyPanel.tsx";
import { CompanyShop } from "./CompanyShop.tsx";
import { Leaderboard } from "./Leaderboard.tsx";
import { LookPicker } from "./LookPicker.tsx";
import { LootToast } from "./Loot.tsx";
import { MatchPanel } from "./Match.tsx";
import { MerchShop } from "./Merch.tsx";
import { Merchant } from "./Merchant.tsx";
import { MilestoneToast } from "./MilestoneToast.tsx";
import { MiniBoard } from "./MiniBoard.tsx";
import { Minimap } from "./Minimap.tsx";
import { DeskPanel } from "./OfficeDesks.tsx";
import { DecorPanel, OpenOfficesPanel } from "./Offices.tsx";
import { PaperPanel } from "./Paper.tsx";
import { PetLooks } from "./PetLooks.tsx";
import { PicnicBanner } from "./Picnic.tsx";
import { BotCard, PlayerCard } from "./PlayerCard.tsx";
import { RaidBox, RaidPanel, RaidToast } from "./Raid.tsx";
import { Shop } from "./Shop.tsx";
import { Sky } from "./Sky.tsx";
import { TradePanel, TradesPanel } from "./Trades.tsx";
import { Trophies } from "./Trophies.tsx";
import { Modal, ToastButton, useFresh, useRun } from "./ui.tsx";

export function Hud() {
  const status = useHud((s) => s.status);
  const beside = useHud((s) => chatBeside(s.panel));
  const room = useHud((s) => s.room);
  if (status === "signedOut" || status === "expired")
    return tauri ? <AppSignIn /> : <SignedOut expired={status === "expired"} />;
  return (
    <>
      <Hints />
      <Stats />
      <div className="corner">
        <MiniBoard />
        <GamesBox />
        <RaidBox />
      </div>
      <Banner />
      <PicnicBanner />
      {!beside && <Chat />}
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
      <div className={room === "dungeon" ? "toasts low" : "toasts"}>
        <MentionToast />
        <NoticeToast />
        <QuestToast />
        <InviteToast />
        <LevelToast />
        <RaidToast />
        <LootToast />
      </div>
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
        <dd>Jump</dd>
        <dt>E</dt>
        <dd>Interact</dd>
        <dt>G</dt>
        <dd>Take</dd>
        <dt>Right-click</dt>
        <dd>Go and take</dd>
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
      <Sky />
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
        title="Bag"
        aria-label={wallet ? `Bag: ${plural(wallet.items, "thing")}` : "Bag"}
        onClick={() => hud.set({ panel: { kind: "bag" } })}
      >
        🎒{wallet && ` ${wallet.items}`}
      </button>
      {wallet?.trading && (
        <button
          type="button"
          className="icon"
          title="Trades"
          aria-label="Trades: an offer is open"
          onClick={() => hud.set({ panel: { kind: "trades" } })}
        >
          🔁
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
      <span className="muted small"> ▼ E</span>
    </div>
  );
}

/** Esc's menu: a button per panel. */
const MENU = [
  [{ kind: "look" }, "🎨 Your character"],
  [{ kind: "shop" }, "🪙 Shop"],
  [{ kind: "bag" }, "🎒 Bag"],
  [{ kind: "trades" }, "🔁 Trades"],
  [{ kind: "arcade" }, "🎮 Arcade"],
  [{ kind: "raid" }, "⚔️ Raid"],
  [{ kind: "openOffices" }, "🚪 Open offices"],
  [{ kind: "desk" }, "🖥 Desk"],
  [{ kind: "company" }, "🏢 Company"],
  [{ kind: "leaderboard" }, "🏆 Leaderboard"],
] as const;

function Panel() {
  const panel = useHud((s) => s.panel);
  const inMyOffice = useHud((s) => s.room === `office:${world.selfId}`);
  if (!panel) return null;
  return typedSwitch(panel, "kind", {
    leaderboard: () => <Leaderboard />,
    card: (p) => (isBot(p.userId) ? <BotCard id={p.userId} /> : <PlayerCard userId={p.userId} />),
    companyCard: (p) => <CompanyCard companyId={p.companyId} />,
    company: () => <CompanyPanel />,
    companyShop: () => <CompanyShop />,
    merch: (p) => <MerchShop companyId={p.companyId} />,
    look: () => <LookPicker />,
    shop: () => <Shop />,
    merchant: () => <Merchant />,
    bag: () => <Bag />,
    petLooks: (p) => <PetLooks pet={p.pet} />,
    arcade: () => <ArcadePanel />,
    newTable: (p) => <NewTable invite={p.invite} inviteName={p.inviteName} />,
    match: (p) => <MatchPanel id={p.id} />,
    trade: (p) => <TradePanel userId={p.userId} />,
    trades: () => <TradesPanel />,
    paper: () => <PaperPanel />,
    trophies: (p) => <Trophies userId={p.userId} name={p.name} />,
    raid: () => <RaidPanel />,
    openOffices: () => <OpenOfficesPanel />,
    decor: () => <DecorPanel />,
    desk: () => <DeskPanel />,
    menu: () => (
      <Modal title="Menu">
        <nav className="menu">
          {inMyOffice && <OfficeLock />}
          {MENU.map(([open, label]) => (
            <button key={open.kind} type="button" onClick={() => hud.set({ panel: open })}>
              {label}
            </button>
          ))}
          <a href="https://github.com/HansKristoffer/tokenmaxxing" target="_blank" rel="noreferrer">
            ⌥ GitHub
          </a>
        </nav>
      </Modal>
    ),
  });
}

/** In my own office: open to visitors from my card, or only me, through the door. */
function OfficeLock() {
  const [open, setOpen] = useState(world.owner?.open ?? true);
  const { error, run } = useRun();
  return (
    <>
      <button
        type="button"
        onClick={run(async () => {
          await town.setOfficeOpen(!open);
          setOpen(!open);
        })}
      >
        {open ? "🔓 Open to visitors" : "🔒 Closed"}
      </button>
      <button type="button" onClick={() => hud.set({ panel: { kind: "decor" } })}>
        🎨 Decorate
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
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

const NOTICE_ICONS = { company: "🏢", trades: "🔁", bag: "🎒" } as const;

/** A line for me from the server (a company application, a trade); a click opens what it's about. */
function NoticeToast() {
  const notice = useHud((s) => s.notice);
  if (!useFresh(notice?.at, MENTION_MS) || !notice) return null;
  const { open } = notice;
  return (
    <ToastButton open={open && { kind: open }} dismiss={() => hud.set({ notice: null })}>
      {open && `${NOTICE_ICONS[open]} `}
      {notice.text}
    </ToastButton>
  );
}

/** My level went up while I was here; the first level after load is just where I started. */
function LevelToast() {
  const level = useHud((s) => s.stats?.level);
  const company = useHud((s) => s.me?.company);
  const seen = useRef<number | undefined>(undefined);
  const [up, setUp] = useState<{ from: number; to: number; at: number } | null>(null);
  useEffect(() => {
    if (level === undefined) return;
    if (seen.current !== undefined && level > seen.current)
      setUp({ from: seen.current, to: level, at: Date.now() });
    seen.current = level;
  }, [level]);
  if (!useFresh(up?.at, MENTION_MS) || !up) return null;
  const open = () => {
    setUp(null);
    hud.set({ panel: { kind: "bag" } });
  };
  // Every level reward is a milestone's. A big sync can pass two: the toast shows the last.
  const passed = milestonesBetween(up.from, up.to);
  if (passed.length > 0) {
    const office =
      passed[0]!.level === OFFICE_LEVEL
        ? company
          ? "Your own office is open"
          : "Join a company for your own office"
        : null;
    return <MilestoneToast milestone={passed.at(-1)!} level={up.to} office={office} onClick={open} />;
  }
  return (
    <ToastButton open={{ kind: "bag" }} dismiss={() => setUp(null)}>
      ⬆️ Level {up.to} · {levelTitle(up.to)}
    </ToastButton>
  );
}

/** Someone @-mentioned me from another room. */
function MentionToast() {
  const mention = useHud((s) => s.mention);
  if (!useFresh(mention?.at, MENTION_MS) || !mention) return null;
  const { line } = mention;
  return (
    <ToastButton open={{ kind: "card", userId: line.userId }} dismiss={() => hud.set({ mention: null })}>
      💬 <strong>{line.name}</strong> mentioned you in {roomName(line.room)}: {line.text}
    </ToastButton>
  );
}

/**
 * Quests the last wallet has done that the one before didn't. The first wallet after load
 * is the baseline, so a reload doesn't toast what's already done.
 */
function QuestToast() {
  const quests = useHud((s) => s.wallet?.quests);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<{ quests: NonNullable<typeof quests>; at: number } | null>(null);
  useEffect(() => {
    if (!quests) return;
    const done = quests.filter((q) => q.done);
    const before = seen.current;
    seen.current = new Set(done.map((q) => q.id));
    const now = before ? done.filter((q) => !before.has(q.id)) : [];
    if (now.length > 0) setFresh({ quests: now, at: Date.now() });
  }, [quests]);
  if (!useFresh(fresh?.at, MENTION_MS) || !fresh) return null;
  return (
    <ToastButton open={{ kind: "shop" }} dismiss={() => setFresh(null)}>
      {fresh.quests.map((q) => `✓ ${q.text} · 🪙 ${q.coins}`).join("  ")}
    </ToastButton>
  );
}
