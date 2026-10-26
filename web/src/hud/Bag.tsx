import { editionLabel } from "@tokenmaxxing/core/merchant.ts";
import { cleanPetName, PET_NAME_MAX, petLooks, wearPet } from "@tokenmaxxing/core/pets.ts";
import { itemById, PODIUM_COINS } from "@tokenmaxxing/core/shop.ts";
import { shopForSlot } from "@tokenmaxxing/core/shoprooms.ts";
import { pieceOfDrop } from "@tokenmaxxing/core/world.ts";
import type { BagRow, Copy, Wallet } from "@tokenmaxxing/server/registry";
import { omit } from "hanzio";
import { useEffect, useRef, useState } from "react";
import { errorText } from "../errors.ts";
import { startPlace } from "../game/furniture.ts";
import { world } from "../game/world.ts";
import { conn, refreshMe, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { ItemTag, rarityRing } from "./ItemTag.tsx";
import { lootLine, rarityClass } from "./Loot.tsx";
import { merchName } from "./Merch.tsx";
import { variantName } from "./PetLooks.tsx";
import { ItemImage, isWorn, WearButton, wear } from "./Shop.tsx";
import { TakeMeThere } from "./ShopDirectory.tsx";
import { buyHint, SLOT_NOUN } from "./shops.ts";
import { Modal, useRun, WalletLine } from "./ui.tsx";

/**
 * What I hold, one square per kind with how many. Picking one shows its name, Wear, and Drop (onto
 * the floor where I am: in my own office, that's furnishing it). 🏅 is a reward: it stays with me, but
 * an earned piece (Touched grass) can furnish my own office.
 */
export function Bag() {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const notice = useHud((s) => s.notice);
  const inMyOffice = useHud((s) => s.room === `office:${world.selfId}`);
  const [bag, setBag] = useState<BagRow[] | null>(null);
  // Merchant editions' numbers (`Merchant.tsx`).
  const [copies, setCopies] = useState<Copy[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  // The pet being named (its kind), and what's typed so far.
  const [naming, setNaming] = useState<number | null>(null);
  const [petName, setPetName] = useState("");
  const { error, run } = useRun();
  const grid = useRef<HTMLUListElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a trade settling (a notice) or a changed wallet (a drop) can mean a new bag
  useEffect(() => {
    void town.bag().then(setBag, (e) => setFailed(errorText(e)));
    void town.copies().then(setCopies, () => {});
  }, [wallet, notice]);
  if (!me || !bag) return <Modal title="🎒 Bag">{failed ?? "Loading…"}</Modal>;

  // A piece of furniture is put down with a ghost to aim (`startPlace`); nothing leaves the bag until it is.
  const place = (item: string) => () => {
    startPlace(item);
  };
  const putAway = run(async () => {
    setDropped(null);
    const r = await conn.putAway();
    setDropped(r.notice);
    await Promise.all([refreshMe(), refreshWallet()]);
  });
  const drop = (item: string) =>
    run(async () => {
      setDropped(null); // a refused one shows only its error
      const r = await town.drop(item);
      setDropped(r.notice);
      if (r.drop) {
        // One fewer on 🎒, and the new wallet refetches the bag.
        hud.set((s) => ({ wallet: s.wallet && { ...s.wallet, items: s.wallet.items - 1 } }));
        // The last one takes its Drop button with it: focus goes back to the dialog, not the page.
        if (bag.find((b) => b.item === item)?.count === 1)
          grid.current?.closest<HTMLElement>("[role=dialog]")?.focus();
      }
      await refreshMe(); // a worn one comes off
    });
  // The last one dropped leaves nothing picked.
  const item = bag.some((b) => b.item === picked) ? itemById(picked!) : undefined;

  const named = cleanPetName(petName);
  // Naming a pet wears it, like picking one of its looks; an empty name clears it.
  const saveName = run(async () => {
    const rest = omit(wearPet(me.look, naming!), ["petName"]);
    await wear(named ? { ...rest, petName: named } : rest);
    setNaming(null);
  });

  return (
    <Modal title="🎒 Bag" wide>
      {wallet && <WalletInfo wallet={wallet} />}
      {bag.length === 0 ? (
        <p className="muted">Nothing yet. Things are bought in the shops.</p>
      ) : (
        <div className="bag-pick">
          {item ? (
            <>
              <strong>
                {item.level !== undefined && "🏅 "}
                {merchName(item)}
                <Numbers copies={copies} item={item.id} />
                {item.slot === "pet" && me.look.pet === item.index && me.look.petVariant > 0 && (
                  <span className="muted"> · {variantName(item.index, me.look.petVariant)}</span>
                )}
                {item.loot && (
                  <span className={`small rarity-text-${item.loot.rarity}`}> · {lootLine(item)}</span>
                )}
                <ItemTag item={item} />
              </strong>
              {item.earned && (
                <span className="muted small">
                  {item.earned}.{!inMyOffice && " Drop it in your own office."}
                </span>
              )}
              <WearButton item={item} look={me.look} run={run} />
              {(item.tradeable || (item.earned && inMyOffice)) && (
                <button
                  type="button"
                  onClick={pieceOfDrop({ item: item.id }) && inMyOffice ? place(item.id) : drop(item.id)}
                >
                  {pieceOfDrop({ item: item.id }) && inMyOffice
                    ? "Place…"
                    : inMyOffice
                      ? "Drop here"
                      : "Drop"}
                </button>
              )}
            </>
          ) : (
            <span className="muted">Pick something to wear it or drop it.</span>
          )}
        </div>
      )}
      {naming !== null && (
        <form className="bag-name" onSubmit={saveName}>
          <label>
            {itemById(`pet.${naming}`)?.name}'s name
            <input
              value={petName}
              maxLength={PET_NAME_MAX}
              placeholder="No name"
              // biome-ignore lint/a11y/noAutofocus: opened by pressing the pencil
              autoFocus
              onChange={(e) => setPetName(e.target.value)}
            />
          </label>
          <button type="submit" disabled={petName.trim() !== "" && !named}>
            Save
          </button>
          <button type="button" onClick={() => setNaming(null)}>
            Cancel
          </button>
        </form>
      )}
      {inMyOffice && (
        <p className="muted small">
          <button type="button" onClick={putAway}>
            Put everything in this room away
          </button>
        </p>
      )}
      {dropped && <p className="muted">{dropped}</p>}
      {error && <p className="error">{error}</p>}
      <ul className="bag" ref={grid}>
        {bag.map((b) => {
          const it = itemById(b.item);
          if (!it) return null;
          const wearing = isWorn(it, me.look);
          return (
            <li key={b.item}>
              <button
                type="button"
                className={`${wearing ? "cell wearing" : "cell"}${rarityClass(it)}`}
                aria-pressed={b.item === picked}
                aria-label={`${merchName(it)} ×${b.count}${wearing ? ", wearing" : ""}${it.level === undefined ? "" : ", reward"}`}
                title={it.loot ? `${merchName(it)}\n${lootLine(it)}` : merchName(it)}
                style={rarityRing(it)}
                onClick={() => setPicked(b.item)}
              >
                <ItemImage item={it} look={me.look} bare worn />
                {it.level !== undefined && <span className="medal">🏅</span>}
                {copies.some((c) => c.item === b.item) && (
                  <span className="medal">#{copies.find((c) => c.item === b.item)!.n}</span>
                )}
                {b.count > 1 && <span className="n">×{b.count}</span>}
              </button>
              {it.slot === "pet" && petLooks(it.index) > 1 && (
                <button
                  type="button"
                  className="eye"
                  aria-label={`Choose a look for the ${it.name}`}
                  title="Choose a look"
                  onClick={() => hud.set({ panel: { kind: "petLooks", pet: it.index } })}
                >
                  👁
                </button>
              )}
              {it.slot === "pet" && (
                <button
                  type="button"
                  className="eye pen"
                  aria-label={`Name the ${it.name}`}
                  title="Name it"
                  onClick={() => {
                    setPetName(me.look.petName ?? "");
                    setNaming(it.index);
                  }}
                >
                  ✏️
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <ul className="members shop-hints">
        {HINT_SLOTS.filter((slot) => !bag.some((b) => itemById(b.item)?.slot === slot)).map((slot) => (
          <li key={slot}>
            <ShopHint slot={slot} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** The slots the bag hints at, when it holds nothing of them. */
const HINT_SLOTS = ["hat", "outfit", "pet", "furniture"] as const;

/** "Buy hats at Thread & Token" with a way there, for a slot you have nothing in. */
function ShopHint({ slot }: { slot: string }) {
  const text = buyHint(slot, SLOT_NOUN[slot] ?? slot);
  const shop = shopForSlot(slot);
  if (!text || !shop) return null;
  return (
    <span className="shop-hint">
      {text} <TakeMeThere shop={shop} />
    </span>
  );
}

/** The wallet at the top of the bag: coins, how they are earned, today's quests. */
function WalletInfo({ wallet }: { wallet: Wallet }) {
  return (
    <>
      <WalletLine balance={wallet.balance}>
        <span className="muted"> · +{wallet.today} from today so far</span>
      </WalletLine>
      <p className="muted small">
        Every day you earn √(tokens ÷ 1M) coins: 100M tokens is 10, 1B is 31. Finish a day 1st, 2nd or 3rd for{" "}
        {PODIUM_COINS.join(", ")} more. Spend them in the shops.
      </p>
      {wallet.quests.length > 0 && (
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
      )}
    </>
  );
}

/** " · #3 of 20, #7 of 20": the numbers on my copies of a merchant edition. */
function Numbers({ copies, item }: { copies: Copy[]; item: string }) {
  const mine = copies.filter((c) => c.item === item);
  if (mine.length === 0) return null;
  return <span className="edition"> · {mine.map((c) => editionLabel(c.n, c)).join(", ")}</span>;
}
