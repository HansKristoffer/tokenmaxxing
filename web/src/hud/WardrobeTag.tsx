import { RARITY_COLOR, wardrobeInfo } from "@tokenmaxxing/core/wardrobe.ts";
import type { CSSProperties } from "react";

/** A wardrobe item's rarity, in its colour, and its line of flavour; nothing for the rest of the shop. */
export function ItemTag({ id }: { id: string }) {
  const info = wardrobeInfo(id);
  if (!info) return null;
  return (
    <span className="item-tag">
      <span className="rarity" style={{ color: RARITY_COLOR[info.rarity] }}>
        {info.rarity}
      </span>{" "}
      <span className="muted">{info.flavour}</span>
    </span>
  );
}

/** A bag square's rarity stripe along the bottom. */
export const rarityRing = (id: string): CSSProperties | undefined => {
  const info = wardrobeInfo(id);
  return (
    info && { backgroundImage: `linear-gradient(to top, ${RARITY_COLOR[info.rarity]} 3px, transparent 3px)` }
  );
};
