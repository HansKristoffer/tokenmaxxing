import { lapBonus, lootById, oddsText, RARITIES } from "@tokenmaxxing/core/loot.ts";
import { BOSSES, bossAt } from "@tokenmaxxing/core/raid.ts";
import { type Item, itemById } from "@tokenmaxxing/core/shop.ts";
import type { Raid } from "@tokenmaxxing/server/registry";
import { world } from "../game/world.ts";
import { hud, useHud } from "../store.ts";
import { ItemImage } from "./Shop.tsx";
import { useFresh } from "./ui.tsx";

/** How long a drop's toast stays up. */
const NEWS_MS = 10_000;
/** Toasts at once; the rest are "and N more". */
const NEWS_SHOWN = 3;

/** `rarity-legendary` and so on, for a frame in its colour (hud.css); nothing for shop items. */
export const rarityClass = (item: Item | undefined): string =>
  item?.loot ? ` rarity rarity-${item.loot.rarity}` : "";

/** "Legendary · The Rate Limit · 0.1%": what a loot item is, for tooltips. */
export function lootLine(item: Item | undefined): string | null {
  if (!item?.loot) return null;
  const { rarity, boss } = item.loot;
  const name = BOSSES.find((b) => b.id === boss)?.name ?? boss;
  return `${RARITIES[rarity].label} · from ${name} · ${oddsText(RARITIES[rarity].odds)}`;
}

/** The raid panel's Loot: the boss up now's table (ticked if I hold one), then who got what this week. */
export function LootSection({ raid }: { raid: Raid }) {
  const me = useHud((s) => s.me);
  const loot = raid.loot;
  if (!loot || !me) return null;
  const lap =
    raid.boss.level > 1 ? ` (lap ${raid.boss.level} · odds ×${lapBonus(raid.boss.level).toFixed(2)})` : "";
  return (
    <>
      <h3>
        Loot · {raid.boss.emoji} {raid.boss.name}
        {lap && <span className="muted small">{lap}</span>}
      </h3>
      {loot.boost !== 1 && <p className="muted small">🧪 Dev boost: odds ×{loot.boost}.</p>}
      <ul className="loot-table">
        {loot.table.map((t) => {
          const item = itemById(t.item)!;
          return (
            <li key={t.item} className={`rarity rarity-${t.rarity}`} title={lootById(t.item)?.blurb}>
              <ItemImage item={item} look={me.look} bare />
              <span className="who">
                {item.name}
                {t.owned && <span className="owned"> ✓</span>}
              </span>
              <span className="tier">{RARITIES[t.rarity].label}</span>
              <span className="odds">{oddsText(t.odds)}</span>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Every raider a kill pays rolls each item once, so you can get several. Rolls are fixed per week, rung,
        player and item: nobody can reroll. Loot is tradeable.
      </p>
      {loot.drops.length > 0 && (
        <>
          <h3>Dropped this week</h3>
          <ul className="loot-drops">
            {loot.drops.map((d) => {
              const item = itemById(d.item);
              const rarity = item?.loot?.rarity ?? "common";
              return (
                <li key={`${d.rung} ${d.userId} ${d.item}`}>
                  <span className="rung">{d.rung}</span>
                  <button
                    type="button"
                    className="link"
                    onClick={() => hud.set({ panel: { kind: "card", userId: d.userId } })}
                  >
                    {d.userId === world.selfId ? "you" : d.name}
                  </button>
                  <span className={`drop rarity-text-${rarity}`}>{item?.name ?? d.item}</span>
                  <span className="muted small">
                    {bossAt(d.rung).emoji} {oddsText(d.odds)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

/** What the last kill dropped, for everyone outside the dungeon: someone else's luck. Mine comes as a notice. */
export function LootToast() {
  const news = useHud((s) => s.lootNews);
  // In the dungeon it flies to their desk with their name on it instead.
  const inDungeon = useHud((s) => s.room === "dungeon");
  if (!useFresh(news?.at, NEWS_MS) || !news || inDungeon) return null;
  const theirs = news.news.filter((n) => n.userId !== world.selfId);
  if (theirs.length === 0) return null;
  const shown = theirs.slice(0, NEWS_SHOWN);
  const more = theirs.length - shown.length;
  return (
    <button
      type="button"
      className="toast mention-toast loot-toast"
      onClick={() => hud.set({ lootNews: null, panel: { kind: "raid" } })}
    >
      {shown.map((n) => {
        const item = lootById(n.item);
        return (
          <span key={`${n.userId} ${n.item}`} className={`rarity-text-${item?.rarity ?? "common"}`}>
            ✨ {n.name} got the {item?.name ?? n.item} ({oddsText(n.odds)})!
          </span>
        );
      })}
      {more > 0 && <span className="muted">…and {more} more</span>}
    </button>
  );
}
