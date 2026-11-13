import { SHOPS, type ShopId, shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import { useState } from "react";
import { goToShopDoor } from "../game/input.ts";
import { hud, useHud } from "../store.ts";
import { SHOP_DIRECTORY } from "./shops.ts";
import { Modal } from "./ui.tsx";

/** "Take me there": starts the auto-walk to a shop's door, or says why it can't. */
export function TakeMeThere({
  shop,
  label = "Take me there",
  className = "primary",
  title,
}: {
  shop: ShopId;
  label?: string;
  className?: string;
  title?: string;
}) {
  const [gone, setGone] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className || undefined}
        title={title}
        onClick={() => {
          if (goToShopDoor(shop)) return;
          setGone(true);
        }}
      >
        {label}
      </button>
      {gone && <span className="error small"> {SHOPS[shop].name} has no door in town right now.</span>}
    </>
  );
}

/**
 * Under the panels that no longer sell (My room, My desk): where new ones are sold, with the way to the shop's
 * door or, standing in the shop already, the tab that sells them.
 */
export function BuyAtMobelhuset({ tab }: { tab: "decor" | "desk" }) {
  const here = useHud((s) => shopOfRoom(s.room) === "furniture");
  return (
    <p className="buy-at muted small">
      New ones are sold at Møbelhuset.{" "}
      {here ? (
        <button type="button" className="primary" onClick={() => hud.set({ panel: { kind: "shop", tab } })}>
          Buy in this shop
        </button>
      ) : (
        <TakeMeThere shop="furniture" label="Go there" />
      )}
    </p>
  );
}

/** The shops of the town: what each sells, and a way there. Buying is done inside them. */
export function ShopDirectory() {
  return (
    <Modal title="🧭 Shops">
      <p className="muted small">Everything is bought in person: pick a shop and walk in.</p>
      <ul className="members shops">
        {SHOP_DIRECTORY.map((s) => (
          <li key={s.id}>
            <span>
              <strong>{s.name}</strong>
              <br />
              <span className="muted small">{s.sells}</span>
            </span>
            <TakeMeThere shop={s.id} label="Go there" />
          </li>
        ))}
      </ul>
      <p className="muted small">
        What you own is in your{" "}
        <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "bag" } })}>
          Bag
        </button>
        .
      </p>
    </Modal>
  );
}
