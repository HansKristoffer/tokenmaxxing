import { compact } from "@tokenmaxxing/core/format.ts";
import { bossAt } from "@tokenmaxxing/core/raid.ts";
import type { Raid } from "@tokenmaxxing/server/registry";
import { useEffect, useRef, useState } from "react";
import { send } from "../game/input.ts";
import { left, opensAt } from "../game/raid.ts";
import { world } from "../game/world.ts";
import { conn } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { Modal, useTicker } from "./ui.tsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "3d 4h", "5h 12m", "40m". */
function timeLeft(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m >= 24 * 60) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

const weekday = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
};

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
  useTicker(60_000, !!raid);
  if (!raid) return null;
  return (
    <section className="panel raid-box" aria-label="Raid">
      <button type="button" className="miniboard-title" onClick={() => hud.set({ panel: { kind: "raid" } })}>
        ⚔️ Raid{" "}
        <span className="muted">
          · {raid.closed ? `opens ${opensAt(raid)} ›` : `${timeLeft(raid.endsAt - Date.now())} left ›`}
        </span>
      </button>
      <div className="raid-line">
        <span className="who">
          {raid.boss.emoji} {raid.boss.name}
        </span>
        <small className="muted">
          {raid.kills.length > 0 && `🏆${raid.kills.length} · `}
          {raid.closed ? "week over" : `rung ${raid.boss.rung} · ${Math.ceil(share(raid) * 100)}%`}
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
  const reward = (rung: number) => rules.rewards[rung - 1] ?? rules.rewards.at(-1)!;
  return (
    <ol className="raid-ladder">
      {raid.kills.map((k) => (
        <li key={k.rung} className="fell">
          <span className="rung">{k.rung}</span>
          <span className="who">
            🏆 {k.boss.emoji} {k.boss.name}
          </span>
          <span className="muted small">
            {weekday(k.day)} · {k.raiders} raiders · 🪙 {k.coins}
            {k.paid && " ✓"}
          </span>
        </li>
      ))}
      <li className="now">
        <span className="rung">{raid.boss.rung}</span>
        <span className="who">
          {raid.boss.emoji} {raid.boss.name}
        </span>
        <span className="muted small">
          {compact(left(raid))} / {compact(raid.hp)} · 🪙 {reward(raid.boss.rung)}
        </span>
      </li>
      {!raid.closed &&
        Array.from({ length: AHEAD }, (_, i) => {
          const b = bossAt(raid.boss.rung + i + 1);
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

export function RaidPanel() {
  const raid = useHud((s) => s.raid);
  useTicker(60_000, !!raid);
  if (!raid) return null;
  const { rules, me } = raid;
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

        <h3>The ladder</h3>
        <Ladder raid={raid} />

        {raid.top.length > 0 && (
          <>
            <h3>Top raiders</h3>
            <div className="miniboard">
              <ol>
                {raid.top.map((r, i) => (
                  <li key={r.userId}>
                    <button
                      type="button"
                      onClick={() => hud.set({ panel: { kind: "card", userId: r.userId } })}
                    >
                      <span className="rank">{i === 0 ? "👑" : `#${i + 1}`}</span>
                      <span className="who">{r.name}</span>
                      <span className="value">{compact(r.damage)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {raid.companies.length > 0 && (
          <>
            <h3>Companies</h3>
            <div className="miniboard">
              <ol>
                {raid.companies.map((c, i) => (
                  <li key={c.companyId}>
                    <button
                      type="button"
                      onClick={() => hud.set({ panel: { kind: "companyCard", companyId: c.companyId } })}
                    >
                      <span className="rank">#{i + 1}</span>
                      <span className="who">🏢 {c.name}</span>
                      <span className="value">{compact(c.damage)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        <h3>How it works</h3>
        <ul className="raid-rules muted small">
          <li>
            A new ladder opens every Monday at {opensAt(raid)}. The first ladder was set from the town's week
            before the raid opened; every week since is {Math.round((rules.weeklyGrowth - 1) * 100)}% tougher.
            Each rung has ×{rules.hpGrowth} the HP of the one before.
          </li>
          <li>
            Kill a boss and the next one steps up at once: Rate Limit, Context Window, Merge Conflict,
            Hallucination, then the four again as "II", and so on. Damage past a kill carries over.
          </li>
          <li>Every token you sync hits it, no cap.</li>
          <li>Every PR you open is a special attack for {compact(rules.prHit)}.</li>
          <li>
            In the dungeon, everyone with agents running sits at a desk, wherever they are. Their laptops and
            robot minions fire as fast as they burn tokens; that's just the show. The real hits are every
            token synced, in the dungeon or not, and land with the next sync.
          </li>
          <li>
            Every kill pays everyone with {compact(rules.raiderAt)}+ that week so far: 🪙{" "}
            {rules.rewards.slice(0, 5).join(", ")}… (×{rules.hpGrowth} a rung).
          </li>
        </ul>
        {raid.last && (
          <p className="muted small">
            Last week:{" "}
            {raid.last.defeated
              ? `${raid.last.cleared} ${raid.last.cleared === 1 ? "rung" : "rungs"}, up to ${raid.last.boss.emoji} ${raid.last.boss.name}, with ${raid.last.raiders} raiders.`
              : `${raid.last.boss.emoji} ${raid.last.boss.name} got away.`}
          </p>
        )}
        {me && me.coins > 0 && <p className="muted small">You've earned 🪙 {me.coins} from raids.</p>}
      </div>
    </Modal>
  );
}

/** A toast for each boss that fell while I was here. The first raid after load is just where things stood. */
export function RaidToast() {
  const raid = useHud((s) => s.raid);
  const seen = useRef<{ week: string; kills: number } | null>(null);
  const [fell, setFell] = useState<{ kills: Raid["kills"]; at: number } | null>(null);
  useEffect(() => {
    if (!raid) return;
    const before = seen.current;
    if (before && before.week === raid.week && raid.kills.length > before.kills)
      setFell({ kills: raid.kills.slice(before.kills), at: Date.now() });
    seen.current = { week: raid.week, kills: raid.kills.length };
  }, [raid]);
  useEffect(() => {
    if (!fell) return;
    const id = setTimeout(() => setFell(null), 10_000);
    return () => clearTimeout(id);
  }, [fell]);
  if (!fell) return null;
  return (
    <>
      {fell.kills.map((k) => (
        <button
          key={k.rung}
          type="button"
          className="toast mention-toast"
          onClick={() => {
            setFell(null);
            hud.set({ panel: { kind: "raid" } });
          }}
        >
          🏆 {k.boss.name} fell!{k.paid ? ` 🪙 ${k.coins} for you` : ""}
        </button>
      ))}
    </>
  );
}
