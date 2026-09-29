import type { ChatLine, CompanyInfo, RoomId } from "@tokenmaxxing/core/world.ts";
import type { Me, MenuBar, Wallet } from "@tokenmaxxing/server/registry";
import { useSyncExternalStore } from "react";

export type Panel =
  | { kind: "leaderboard" }
  | { kind: "card"; userId: number }
  | { kind: "company" }
  | { kind: "look" }
  | { kind: "shop" }
  | { kind: "menu" };

/** Everything the React HUD shows. The canvas world keeps its own state in `game/world.ts`. */
export interface HudState {
  status: "connecting" | "ready" | "signedOut" | "expired" | "offline";
  me: Me | null;
  stats: MenuBar["me"] | null;
  wallet: Wallet | null;
  /** Today's top players by tokens, with me appended when I'm outside them. */
  board: MenuBar["top"];
  room: RoomId;
  occupancy: Partial<Record<RoomId, number>>;
  companies: CompanyInfo[];
  chat: ChatLine[];
  panel: Panel | null;
  /** A line of text at the bottom (inspecting things, locked doors). */
  dialog: string | null;
  /** The room name, shown briefly on entering. */
  banner: { text: string; at: number } | null;
  /** Bumped to ask the chat input to take focus. */
  chatFocus: number;
  /** A line from the server for me: someone asked to join my company, or I got in. */
  notice: { text: string; at: number } | null;
  /** The last time someone @-mentioned me from another room. */
  mention: { line: ChatLine; at: number } | null;
}

let state: HudState = {
  status: "connecting",
  me: null,
  stats: null,
  wallet: null,
  board: [],
  room: "town",
  occupancy: {},
  companies: [],
  chat: [],
  panel: null,
  dialog: null,
  banner: null,
  chatFocus: 0,
  mention: null,
  notice: null,
};
const listeners = new Set<() => void>();

export const hud = {
  get: () => state,
  set(patch: Partial<HudState> | ((s: HudState) => Partial<HudState>)) {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useHud<T>(select: (s: HudState) => T): T {
  return useSyncExternalStore(hud.subscribe, () => select(state));
}
