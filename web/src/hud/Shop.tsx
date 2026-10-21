import { editionById } from "@tokenmaxxing/core/editions.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { withPieces } from "@tokenmaxxing/core/office.ts";
import { petOutfit, wearPet } from "@tokenmaxxing/core/pets.ts";
import { ITEMS, type Item, MERCH, PODIUM_COINS } from "@tokenmaxxing/core/shop.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import type { BagRow } from "@tokenmaxxing/server/registry";
import { useEffect, useRef, useState } from "react";
import { itemFrame } from "../art/characters.ts";
import { objectAt } from "../art/objects.ts";
import { C } from "../art/palette.ts";
import { petFrame } from "../art/pets.ts";
import { errorText, refreshMe, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { ItemTag } from "./ItemTag.tsx";
import { lootLine, rarityClass } from "./Loot.tsx";
import { AvatarImage, Modal, Pills, useRun } from "./ui.tsx";

const TABS = [
  ["outfit", "Clothes"],
  ["glasses", "Face"],
  ["hat", "Hats"],
  ["held", "In hand"],
  ["back", "On back"],
  ["pet", "Pets"],
  ["petwear", "Pet gear"],
  ["furniture", "Furniture"],
] as const;

const PLACES = ["🥇", "🥈", "🥉"];

export function Shop() {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const [tab, setTab] = useState<Item["slot"]>("outfit");
  const [bag, setBag] = useState<BagRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const { error, run } = useRun();
  useEffect(() => {
    const fail = (e: unknown) => setFailed(errorText(e));
    void refreshWallet().catch(fail);
    void town.bag().then(setBag, fail);
  }, []);
  if (!me || !wallet) return <Modal title="🪙 Shop">{failed ?? "Loading…"}</Modal>;

  // The first one bought goes on; another is for trading.
  const buy = (item: Item) =>
    run(async () => {
      hud.set({ wallet: await town.buy(item.id) });
      setBag(await town.bag());
      if (!wallet.owned.includes(item.id)) await wearIt(item, me.look, true);
    });

  return (
    <Modal title="🪙 Shop" wide>
      <p className="wallet">
        <strong>🪙 {wallet.balance.toLocaleString()}</strong> coins
        <span className="muted"> · +{wallet.today} from today so far</span>
      </p>
      <p className="muted small">
        Every day you earn √(tokens ÷ 1M) coins: 100M tokens is 10, 1B is 31. Finish a day 1st, 2nd or 3rd for{" "}
        {PODIUM_COINS.join(", ")} more.
        {wallet.wins.length > 0 &&
          ` Lately: ${wallet.wins
            .slice(0, 5)
            .map((w) => `${PLACES[w.place - 1]} ${w.day.slice(5)}`)
            .join(" ")}`}
      </p>
      <h3>📜 Today's quests</h3>
      <ul className="members">
        {wallet.quests.map((q) => (
          <li key={q.id} className={q.done ? undefined : "muted"}>
            <span>
              {q.done ? "✓" : "○"} {q.text}
            </span>
            <span>🪙 {q.coins}</span>
          </li>
        ))}
      </ul>
      <Pills value={tab} options={TABS} onChange={setTab} />
      <ul className="shop">
        {ITEMS.filter((i) => i.slot === tab && !editionById(i.id) && !i.earned && !i.company).map((item) => {
          const owned = wallet.owned.includes(item.id);
          const wearing = isWorn(item, me.look);
          const n = bag.find((b) => b.item === item.id)?.count ?? 0;
          return (
            <li
              key={item.id}
              className={`${wearing ? "wearing" : ""}${rarityClass(item)}`.trim() || undefined}
              title={lootLine(item) ?? undefined}
            >
              <ItemImage item={item} look={me.look} />
              <span>
                {item.name}
                {n > 0 && <span className="muted"> ×{n}</span>}
              </span>
              <ItemTag item={item} />
              {item.loot && <span className={`small rarity-text-${item.loot.rarity}`}>{lootLine(item)}</span>}
              {(owned || wearing) && <WearButton item={item} look={me.look} run={run} />}
              {item.loot ? (
                !owned && (
                  <button type="button" disabled>
                    ⚔️ Raid drop
                  </button>
                )
              ) : item.level !== undefined ? (
                !owned && (
                  <button type="button" disabled>
                    🔒 Lv {item.level}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={wallet.balance < item.price}
                  onClick={buy(item)}
                >
                  🪙 {item.price}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

export const wear = async (look: Look) => {
  await town.setLook(look);
  await refreshMe();
};

/** Whether `look` wears `item`: in its slot, or as one of the company merch it wears. */
export function isWorn(item: Item, look: Look): boolean {
  if (item.slot === "furniture") return false;
  if (item.slot === "merch") return look.merch === item.companyId && (look.merchWorn & item.index) > 0;
  return look[item.slot] === item.index;
}

/**
 * `look` with `item` on (or off). Merch is one company's at a time, and a hoodie and a tee don't go
 * over each other.
 */
export function withItem(item: Item, look: Look, on: boolean): Look {
  if (item.slot === "furniture") return look;
  // A different pet starts in its original look.
  if (item.slot === "pet") return on ? wearPet(look, item.index) : { ...look, pet: 0, petVariant: 0 };
  if (item.slot !== "merch") return { ...look, [item.slot]: on ? item.index : 0 };
  const tops = MERCH.filter((m) => m.kind === "tee" || m.kind === "hoodie").reduce((n, m) => n | m.bit, 0);
  const mine = look.merch === item.companyId ? look.merchWorn : 0;
  const bits = on ? (item.index & tops ? mine & ~tops : mine) | item.index : mine & ~item.index;
  return { ...look, merch: bits ? item.companyId! : 0, merchWorn: bits };
}

const wearIt = (item: Item, look: Look, on: boolean) =>
  item.slot === "furniture" ? Promise.resolve() : wear(withItem(item, look, on));

/** Wear it, or take it off; nothing for furniture. */
export function WearButton({
  item,
  look,
  run,
}: {
  item: Item;
  look: Look;
  run: ReturnType<typeof useRun>["run"];
}) {
  if (item.slot === "furniture") return null;
  const on = isWorn(item, look);
  return (
    <button type="button" onClick={run(() => wearIt(item, look, !on))}>
      {on ? "Take off" : "Wear"}
    </button>
  );
}

/** An item as it looks: on me (or `bare`, on its own), the pet, or the piece. */
export function ItemImage({
  item,
  look,
  bare,
  worn,
}: {
  item: Item;
  look: Look;
  bare?: boolean;
  /** A pet in the look I wear it in, if I wear it (the shop sells the original). */
  worn?: boolean;
}) {
  if (item.slot === "pet") {
    const mine = worn && look.pet === item.index;
    const sprite = petFrame(
      item.index,
      false,
      false,
      mine ? look.petVariant : 0,
      mine ? petOutfit(look) : null,
    );
    return <SpriteImage sprite={sprite} stand />;
  }
  if (item.slot === "furniture") return <PieceImage ch={item.id.slice(5)} />;
  if (bare) return <SpriteImage sprite={itemFrame(item)} />;
  // Pet gear on my pet (a duck if I have none); a back item from the side, where it shows.
  if (item.slot === "petwear")
    return <SpriteImage sprite={petFrame(look.pet || 1, false, false, 0, null, item.index)} stand />;
  return (
    <AvatarImage
      look={withItem(item, look, true)}
      scale={4}
      facing={item.slot === "back" ? "right" : "down"}
    />
  );
}

const pieces = new Map<string, HTMLCanvasElement | undefined>();

/** A piece's sprite as the world draws it, put down once in an empty office. */
function pieceSprite(ch: string): HTMLCanvasElement | undefined {
  if (!pieces.has(ch)) pieces.set(ch, objectAt(withPieces([{ ch, x: 1, y: 1 }], MAPS.office), 1, 1)?.canvas);
  return pieces.get(ch);
}

/**
 * A piece as the world draws it, in a two-tile box (three for the widest). A rug is only floor, so
 * it's a swatch.
 */
export function PieceImage({ ch, scale = 2 }: { ch: string; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprite = pieceSprite(ch);
  const box = Math.max(32, sprite?.width ?? 0);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    if (!sprite) {
      g.fillStyle = C.rug;
      g.fillRect(8 * scale, 16 * scale, 16 * scale, 14 * scale);
      return;
    }
    const { width: w, height: h } = sprite;
    g.drawImage(sprite, ((box - w) / 2) * scale, (32 - h) * scale, w * scale, h * scale);
  }, [sprite, box, scale]);
  return <canvas ref={ref} width={box * scale} height={32 * scale} className="avatar" />;
}

/** A sprite at 4× in a 16×16 box: in the middle, or standing on the bottom (a pet). */
function SpriteImage({ sprite, stand }: { sprite: HTMLCanvasElement | null; stand?: boolean }) {
  const scale = 4;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g || !sprite) return;
    g.imageSmoothingEnabled = false;
    const { width: w, height: h } = sprite;
    g.drawImage(
      sprite,
      ((16 - w) / 2) * scale,
      (stand ? 16 - h : (16 - h) / 2) * scale,
      w * scale,
      h * scale,
    );
  }, [sprite, stand]);
  return <canvas ref={ref} width={16 * scale} height={16 * scale} className="avatar" />;
}
