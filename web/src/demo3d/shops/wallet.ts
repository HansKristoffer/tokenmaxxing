/**
 * The demo wallet and the player's keepsakes: coins, what they own, the saved look and the pet, all in
 * localStorage so they survive a reload and travel with the player from room to room.
 */
import type { Look2D } from "../gear3d.ts";
import { storage } from "../../storage.ts";

const KEY = "demo3d.shops";
export const START_COINS = 500;

export interface PetChoice {
  species: string;
  variant: string;
  name: string;
  wear: number;
}

interface Saved {
  coins: number;
  owned: string[];
  look?: Look2D;
  pet?: PetChoice;
  /** Furniture that is bought and not yet in the Office. */
  decor?: { wall?: string; floor?: string };
}

function load(): Saved {
  try {
    const s = JSON.parse(storage.getItem(KEY) ?? "null") as Saved | null;
    if (s && typeof s.coins === "number" && Array.isArray(s.owned)) return s;
  } catch {
    // fall through to a fresh purse
  }
  return { coins: START_COINS, owned: [] };
}

const state: Saved = load();
const listeners = new Set<() => void>();
const save = (): void => {
  storage.setItem(KEY, JSON.stringify(state));
  for (const f of listeners) f();
};

export const wallet = {
  get coins(): number {
    return state.coins;
  },
  owns: (id: string): boolean => state.owned.includes(id),
  owned: (): readonly string[] => state.owned,
  /** Pays `price` for `id`; false when the purse is too light. */
  buy(id: string, price: number): boolean {
    if (state.owned.includes(id)) return true;
    if (state.coins < price) return false;
    state.coins -= price;
    state.owned.push(id);
    save();
    return true;
  },
  grant(id: string): void {
    if (!state.owned.includes(id)) state.owned.push(id);
    save();
  },
  reset(): void {
    state.coins = START_COINS;
    state.owned = [];
    state.look = undefined;
    state.pet = undefined;
    state.decor = undefined;
    save();
  },
  onChange(f: () => void): void {
    listeners.add(f);
  },
  get look(): Look2D | undefined {
    return state.look;
  },
  set look(l: Look2D | undefined) {
    state.look = l;
    save();
  },
  get pet(): PetChoice | undefined {
    return state.pet;
  },
  set pet(p: PetChoice | undefined) {
    state.pet = p;
    save();
  },
  get decor(): { wall?: string; floor?: string } {
    return state.decor ?? {};
  },
  set decor(d: { wall?: string; floor?: string }) {
    state.decor = d;
    save();
  },
};
