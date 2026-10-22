import { editionById } from "@tokenmaxxing/core/editions.ts";
import { homePieceOf } from "@tokenmaxxing/core/home.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { withPieces } from "@tokenmaxxing/core/office.ts";
import { petOutfit, wearPet } from "@tokenmaxxing/core/pets.ts";
import { posterOf } from "@tokenmaxxing/core/posters.ts";
import { ITEMS, type Item, MERCH, PODIUM_COINS } from "@tokenmaxxing/core/shop.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import type { BagRow } from "@tokenmaxxing/server/registry";
import { typedSwitch } from "hanzio";
import { useEffect, useState } from "react";
import { itemFrame } from "../art/characters.ts";
import { posterSprite } from "../art/furniture-posters.ts";
import { objectAt } from "../art/objects.ts";
import { C } from "../art/palette.ts";
import { petFrame } from "../art/pets.ts";
import { errorText } from "../errors.ts";
import { refreshMe, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { ItemTag } from "./ItemTag.tsx";
import { lootLine, rarityClass } from "./Loot.tsx";
import { AvatarImage, Modal, Pills, Pixels, useRun, WalletLine } from "./ui.tsx";

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
      <WalletLine balance={wallet.balance}>
        <span className="muted"> · +{wallet.today} from today so far</span>
      </WalletLine>
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
  return typedSwitch(
    item.slot,
    {
      furniture: () => false,
      merch: () => look.merch === item.companyId && (look.merchWorn & item.index) > 0,
    },
    (slot) => look[slot] === item.index,
  );
}

/**
 * `look` with `item` on (or off). Merch is one company's at a time, and a hoodie and a tee don't go
 * over each other.
 */
export function withItem(item: Item, look: Look, on: boolean): Look {
  return typedSwitch(
    item.slot,
    {
      furniture: () => look,
      // A different pet starts in its original look.
      pet: () => (on ? wearPet(look, item.index) : { ...look, pet: 0, petVariant: 0 }),
      merch: () => {
        const tops = MERCH.filter((m) => m.kind === "tee" || m.kind === "hoodie").reduce(
          (n, m) => n | m.bit,
          0,
        );
        const mine = look.merch === item.companyId ? look.merchWorn : 0;
        const bits = on ? (item.index & tops ? mine & ~tops : mine) | item.index : mine & ~item.index;
        return { ...look, merch: bits ? item.companyId! : 0, merchWorn: bits };
      },
    },
    (slot) => ({ ...look, [slot]: on ? item.index : 0 }),
  );
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

const pieces = new Map<string, HTMLCanvasElement>();

/**
 * A piece's sprite as the world draws it, put down once in an empty office. A rug is only floor, so
 * it's a swatch, standing in the box like a piece.
 */
function pieceSprite(ch: string): HTMLCanvasElement {
  let sprite = pieces.get(ch);
  if (sprite) return sprite;
  // A poster is hung on a wall, not put down on a floor: its own picture.
  const poster = posterOf(ch);
  if (poster) {
    sprite = posterSprite(poster.art);
    pieces.set(ch, sprite);
    return sprite;
  }
  // A personal office's frame or sign is hung on the office's top wall.
  const row = homePieceOf(ch)?.wall ? 0 : 1;
  sprite = objectAt(withPieces([{ ch, x: 1, y: row }], MAPS.office), 1, row)?.canvas;
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = 16;
    const g = sprite.getContext("2d")!;
    g.fillStyle = C.rug;
    g.fillRect(0, 0, 16, 14);
  }
  pieces.set(ch, sprite);
  return sprite;
}

/** A piece as the world draws it, in a two-tile box (three for the widest). */
export function PieceImage({ ch, scale = 2 }: { ch: string; scale?: number }) {
  const sprite = pieceSprite(ch);
  const box = Math.max(32, sprite.width);
  return (
    <Pixels sprite={sprite} width={box * scale} height={32 * scale} scale={scale} stand className="avatar" />
  );
}

/** A sprite at 4× in a 16×16 box: in the middle, or standing on the bottom (a pet). */
const SpriteImage = ({ sprite, stand }: { sprite: HTMLCanvasElement | null; stand?: boolean }) => (
  <Pixels sprite={sprite} width={64} height={64} scale={4} stand={stand} className="avatar" />
);
