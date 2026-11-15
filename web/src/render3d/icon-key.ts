/**
 * What tells one HUD icon from another (`icons.ts`): the same key is the same picture. Nothing of three or the
 * DOM in it, so it can be tested on its own.
 */
import type { Item } from "@tokenmaxxing/core/shop.ts";
import { merchKey } from "../art/merch.ts";
import type { AvatarFocus, IconSpec } from "./icons.ts";

/** The part of the wearer an item's picture zooms in on: where it is worn (`MERCH` bits: cap 4, mug 8). */
export function wornFocus(item: Item): AvatarFocus {
  switch (item.slot) {
    case "hat":
    case "glasses":
      return "head";
    case "outfit":
      return "torso";
    case "held":
    case "back":
      return item.slot;
    case "merch": {
      const isCap = (item.index & 4) !== 0;
      if (isCap) return "head";
      const isMug = (item.index & 8) !== 0;
      return isMug ? "held" : "torso";
    }
    default:
      return "body";
  }
}

/** What tells one icon from another: the same key is the same picture. */
export function iconKey(s: IconSpec): string {
  switch (s.kind) {
    case "piece":
      return `piece:${s.ch}`;
    case "pet": {
      const name = (s.name ?? "").trim().toLowerCase();
      const focus = s.focus ? `:${s.focus}` : "";
      return `pet:${s.pet}.${s.variant ?? 0}.${s.wear ?? 0}.${name}${focus}`;
    }
    case "avatar": {
      const look = s.look;
      const dressing = [
        look.style,
        look.skin,
        look.hair,
        look.outfit,
        look.glasses ?? 0,
        look.hat ?? 0,
        look.held ?? 0,
        look.back ?? 0,
        look.aura ?? 0,
      ];
      // Merch is dressed from the company's colours and print as they are now: a redraw is another picture.
      const merch = look.merch && look.merchWorn ? `.${look.merchWorn}:${merchKey(look.merch)}` : "";
      const focus = s.focus ?? "body";
      const facing = s.facing ?? "front";
      return `avatar:${dressing.join(".")}.${look.merch ?? 0}${merch}:${focus}:${facing}`;
    }
    case "merch": {
      const company = s.company;
      const design = company.merch
        ? `${company.merch.main}${company.merch.accent}${company.merch.rows.join("")}`
        : "";
      const roof = company.brand?.roof ?? "";
      const plaque = company.brand?.plaque ?? "";
      return `merch:${company.id}.${s.merch}:${roof}${plaque}:${company.name}:${design}`;
    }
    case "trophy":
      return `trophy:${s.id}.${s.earned === false ? 0 : 1}`;
    case "desk":
      return `desk:${s.tier}`;
    case "boss":
      return `boss:${s.id}`;
    case "case":
      // The Night Market, the first case, keeps the shorter key it had before cases had ids.
      return s.caseId && s.caseId !== "night-market" ? `case:${s.caseId}:${s.what}` : `case:${s.what}`;
  }
}
