import { compact, countdown, plural } from "@tokenmaxxing/core/format.ts";
import { BOSSES, bossAt, rewardFor } from "@tokenmaxxing/core/raid.ts";
import type { Raid } from "@tokenmaxxing/server/registry";
import { useEffect, useRef, useState } from "react";
import { bossSilhouette } from "../art/bosses.ts";
import { send } from "../game/input.ts";
import { left, opensAt } from "../game/raid.ts";
import { world } from "../game/world.ts";
import { conn } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { dayText } from "./format.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { LootSection } from "./Loot.tsx";
import { HowItWorks, Modal, Pills, Pixels, RankList, ToastButton, useFresh, useTicker } from "./ui.tsx";

/** "3d 4h", "5h 12m", "40m", "12s". */
function timeLeft(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m >= 24 * 60) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m === 0 && ms > 0) return `${Math.ceil(ms / 1000)}s`;
  return `${m}m`;
}

const share = (r: Raid) => (r.hp > 0 ? left(r) / r.hp : 0);

function HpBar({ raid }: { raid: Raid }) {
  const s = share(raid);
  return (
    // The numbers are in the text beside it.
    <div className="hp" aria-hidden="true">
      <span className={s > 0.5 ? "ok" : s > 0.2 ? "low" : "dire"} style={{ width: `${s * 100}%` }} />
    </div>
  );
}

/** In the corner, under the games: the boss, its rung and HP, and how long the town has left. */
export function RaidBox() {
  const raid = useHud((s) => s.raid);
  useTicker(raid?.prelaunch ? 1000 : 60_000, !!raid);
  if (!raid) return null;
  if (raid.prelaunch)
    return (
      <section className="panel raid-box raid-teaser-box" aria-label="Raid">
        <button type="button" className="plaque" onClick={() => hud.set({ panel: { kind: "raid" } })}>
          Something is coming ›
        </button>
        <div className="raid-clock" role="timer">
          {countdown(raid.launchAt)}
        </div>
        <p className="raid-when muted small">Mon {opensAt(raid)}</p>
      </section>
    );
  return (
    <section className="panel raid-box" aria-label="Raid">
      <button type="button" className="plaque" onClick={() => hud.set({ panel: { kind: "raid" } })}>
        Raid ›
        <small>{raid.closed ? `opens ${opensAt(raid)}` : `${timeLeft(raid.endsAt - Date.now())} left`}</small>
      </button>
      <div className="raid-line">
        <span className="who">
          {raid.boss.emoji} {raid.boss.name}
        </span>
        <small className="muted">
          {raid.kills.length > 0 && `🏆${raid.kills.length} · `}
          {raid.closed
            ? "week over"
            : raid.cleared
              ? "cleared"
              : `rung ${raid.boss.rung} · ${Math.ceil(share(raid) * 100)}%`}
        </small>
      </div>
      <HpBar raid={raid} />
    </section>
  );
}

/** Rungs shown past the current one, greyed, with what they'd pay. */
const AHEAD = 3;

/** This week's ladder: the kills, the rung being fought, and the next few. */
function Ladder({ raid }: { raid: Raid }) {
  const { rules } = raid;
  const reward = (rung: number) => rewardFor(rung, raid.level, raid.week);
  return (
    <ol className="raid-ladder">
      {raid.kills.map((k) => (
        <li key={k.rung} className="fell">
          <span className="rung">{k.rung}</span>
          <span className="who">
            🏆 {k.boss.emoji} {k.boss.name}
          </span>
          <span className="muted small">
            {dayText(k.day, { weekday: "short" })} · {k.raiders} raiders · 🪙 {k.coins}
            {k.paid && " ✓"}
          </span>
        </li>
      ))}
      {raid.cleared ? (
        <li className="now">
          <span className="who">🏁 Ladder cleared</span>
          <span className="muted small">Next one opens Monday {opensAt(raid)}</span>
        </li>
      ) : (
        <li className="now">
          <span className="rung">{raid.boss.rung}</span>
          <span className="who">
            {raid.boss.emoji} {raid.boss.name}
          </span>
          <span className="muted small">
            {compact(left(raid))} / {compact(raid.hp)} · 🪙 {reward(raid.boss.rung)}
          </span>
        </li>
      )}
      {!raid.closed &&
        !raid.cleared &&
        Array.from({ length: Math.min(AHEAD, BOSSES.length - raid.boss.rung) }, (_, i) => {
          const b = bossAt(raid.boss.rung + i + 1, raid.level);
          return (
            <li key={b.rung} className="ahead">
              <span className="rung">{b.rung}</span>
              <span className="who">
                {b.emoji} {b.name}
              </span>
              <span className="small">
                {compact(raid.hp * rules.hpGrowth ** (i + 1))} HP · 🪙 {reward(b.rung)}
              </span>
            </li>
          );
        })}
    </ol>
  );
}

/** Before the first raid: a countdown, the first boss's shadow, and what's coming. */
function Teaser({ raid }: { raid: Raid }) {
  const { rules } = raid;
  return (
    <Modal title="⚠️ Something is coming">
      <div className="raid raid-teaser">
        <div className="raid-shadow">
          {/* The first boss's shadow, big and crisp. */}
          <ItemIcon spec={{ kind: "boss", id: raid.boss.id }} size={132} className="raid-silhouette">
            <Pixels
              sprite={bossSilhouette(raid.boss.id)}
              width={132}
              height={132}
              className="raid-silhouette"
              label="A shadow, waiting"
            />
          </ItemIcon>
          <span className="raid-qqq">???</span>
        </div>
        <p className="raid-hint muted small">It has a limit. Soon, so will you.</p>
        <p className="raid-countdown" role="timer">
          {countdown(raid.launchAt)}
        </p>
        <p className="raid-status">
          The Raid Dungeon opens <strong>Monday at {opensAt(raid)}</strong>. Until then the gate in the square
          stays boarded up.
        </p>
        <p className="muted small">
          Rung 1 so far: <strong>{compact(raid.hp)} HP</strong>, {Math.round(rules.hpShare * 100)}% of
          everything the town syncs this week (at least {compact(rules.minHp)}). The more you burn now, the
          bigger it gets.
        </p>

        <h3>How it works</h3>
        <div className="muted small">
          <Rules raid={raid} />
        </div>
      </div>
    </Modal>
  );
}

/** The raid's rules, as short as they go. */
function Rules({ raid }: { raid: Raid }) {
  const { rules } = raid;
  const pct = (growth: number) => `${Math.round((growth - 1) * 100)}%`;
  return (
    <ul>
      <li>
        Every token you sync hits the boss, wherever you are, with no cap. A PR you open is a{" "}
        {compact(rules.prHit)} special attack.
      </li>
      <li>
        Five bosses a week, from Monday {opensAt(raid)}. Kill one and the next, ×{rules.hpGrowth} tougher,
        steps up at once; damage past a kill carries over.
      </li>
      <li>
        Clear all five and next week's ladder is a level up: {pct(rules.weeklyGrowth)} tougher and{" "}
        {pct(rules.rewardGrowth)} better paid. Fall short and it stays as it is.
      </li>
      <li>
        Each kill pays everyone who has hit for {compact(rules.raiderAt)}+ that week: 🪙{" "}
        {rules.rewards.join(", ")} by rung.
      </li>
      <li>
        The desks, laptops and robots in the dungeon are the show. The hits are your synced tokens, and land
        with the next sync.
      </li>
    </ul>
  );
}

type Tab = "ladder" | "loot" | "ranks";

export function RaidPanel() {
  const raid = useHud((s) => s.raid);
  const signedIn = useHud((s) => s.me !== null);
  const [tab, setTab] = useState<Tab>("ladder");
  useTicker(raid?.prelaunch ? 1000 : 60_000, !!raid);
  if (!raid) return null;
  if (raid.prelaunch) return <Teaser raid={raid} />;
  const { rules, me } = raid;
  const tabs: (readonly [Tab, string])[] = [["ladder", "Ladder"]];
  if (raid.loot && signedIn) tabs.push(["loot", "Loot"]);
  if (raid.top.length > 0) tabs.push(["ranks", "Ranks"]);
  return (
    <Modal title={`${raid.boss.emoji} ${raid.boss.name} · Rung ${raid.boss.rung}`}>
      <div className="raid">
        <p className="raid-status">
          {raid.closed ? (
            <>
              🏁 The week is over: the town cleared <strong>{raid.kills.length}</strong>{" "}
              {raid.kills.length === 1 ? "rung" : "rungs"}. The gate opens at {opensAt(raid)} (
              {timeLeft(raid.endsAt - Date.now())}).
            </>
          ) : (
            <>
              <strong>{compact(left(raid))}</strong> of {compact(raid.hp)} HP left ·{" "}
              {timeLeft(raid.endsAt - Date.now())} to go
            </>
          )}
        </p>
        <HpBar raid={raid} />
        {me && (
          <p className="raid-me">
            {me.damage > 0 ? (
              <>
                You hit for <strong>{compact(me.damage)}</strong> this week
                {me.rank !== null && <span className="muted"> · #{me.rank} in town</span>}
                {me.damage < rules.raiderAt && (
                  <span className="muted">
                    {" "}
                    · {compact(rules.raiderAt - me.damage)} more to count as a raider
                  </span>
                )}
              </>
            ) : (
              <>Run an agent to join the fight. Every token you sync this week hits it.</>
            )}
            {me.weekCoins > 0 && <span className="muted"> · 🪙 {me.weekCoins} from kills</span>}
          </p>
        )}
        {world.room !== "dungeon" && (
          <button
            type="button"
            className="primary raid-go"
            onClick={() => {
              hud.set({ panel: null });
              world.portalPending = true;
              send(conn.enterDungeon());
            }}
          >
            ⚔️ Go to the dungeon
          </button>
        )}

        {tabs.length > 1 && <Pills value={tab} options={tabs} onChange={setTab} />}
        {tab === "ladder" && (
          <>
            <Ladder raid={raid} />
            {(raid.last || (me && me.coins > 0)) && (
              <p className="muted small">
                {raid.last &&
                  (raid.last.defeated
                    ? `Last week: ${plural(raid.last.cleared, "rung")}, up to ${raid.last.boss.emoji} ${raid.last.boss.name}, with ${raid.last.raiders} raiders. `
                    : `Last week: ${raid.last.boss.emoji} ${raid.last.boss.name} got away. `)}
                {me && me.coins > 0 && <>Raids have paid you 🪙 {me.coins}.</>}
              </p>
            )}
          </>
        )}
        {tab === "loot" && <LootSection raid={raid} />}
        {tab === "ranks" && (
          <>
            <h3>Raiders</h3>
            <div className="miniboard">
              <RankList
                rows={raid.top.map((r, i) => ({
                  id: r.userId,
                  rank: i === 0 ? "👑" : `#${i + 1}`,
                  who: r.name,
                  value: compact(r.damage),
                  open: { kind: "card", userId: r.userId },
                }))}
              />
            </div>
            {raid.companies.length > 0 && (
              <>
                <h3>Companies</h3>
                <div className="miniboard">
                  <RankList
                    rows={raid.companies.map((c, i) => ({
                      id: c.companyId,
                      rank: `#${i + 1}`,
                      who: `🏢 ${c.name}`,
                      value: compact(c.damage),
                      open: { kind: "companyCard", companyId: c.companyId },
                    }))}
                  />
                </div>
              </>
            )}
          </>
        )}
        <HowItWorks>
          <Rules raid={raid} />
        </HowItWorks>
      </div>
    </Modal>
  );
}

/**
 * A toast for each boss that fell while I was here, and one when the first raid opens. The first raid
 * after load is just where things stood.
 */
export function RaidToast() {
  const raid = useHud((s) => s.raid);
  const seen = useRef<{ week: string; kills: number; prelaunch: boolean } | null>(null);
  const [fell, setFell] = useState<{ kills: Raid["kills"]; at: number } | null>(null);
  const [opened, setOpened] = useState<{ boss: Raid["boss"]; at: number } | null>(null);
  useEffect(() => {
    if (!raid) return;
    const before = seen.current;
    if (before?.prelaunch && !raid.prelaunch) setOpened({ boss: raid.boss, at: Date.now() });
    if (before && before.week === raid.week && raid.kills.length > before.kills)
      setFell({ kills: raid.kills.slice(before.kills), at: Date.now() });
    seen.current = { week: raid.week, kills: raid.kills.length, prelaunch: raid.prelaunch };
  }, [raid]);
  const showFell = useFresh(fell?.at, 10_000);
  const showOpened = useFresh(opened?.at, 12_000);
  return (
    <>
      {showOpened && opened && (
        <ToastButton open={{ kind: "raid" }} dismiss={() => setOpened(null)} className="raid-launch-toast">
          ⚔️ The Raid Dungeon is open: {opened.boss.name} awaits.
        </ToastButton>
      )}
      {showFell &&
        fell?.kills.map((k) => (
          <ToastButton key={k.rung} open={{ kind: "raid" }} dismiss={() => setFell(null)}>
            🏆 {k.boss.name} fell!{k.paid ? ` 🪙 ${k.coins} for you` : ""}
          </ToastButton>
        ))}
    </>
  );
}
