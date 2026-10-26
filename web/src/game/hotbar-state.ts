import { itemById } from "@tokenmaxxing/core/shop.ts";
import { useSyncExternalStore } from "react";
import { town } from "../net.ts";
import { cancel, ghost, ghostListeners, placedListeners, startPlace } from "./furniture.ts";
import { cycle, nextAfterPlace, orderSlots, pushRecent } from "./hotbar.ts";
import { world } from "./world.ts";

/** The hotbar's slots (furniture items) and what the bag holds; the bar and the keys both read it. */
let slots: readonly string[] = [];
let counts: Record<string, number> = {};
let recent: string[] = [];
let tick = 0;
const subs = new Set<() => void>();
const bump = () => {
  tick++;
  for (const f of subs) f();
};
ghostListeners.add(bump);

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

export const inMyOffice = () => world.selfId !== 0 && world.room === `office:${world.selfId}`;

/** The item being placed (the selected slot), or null. */
export const selected = (): string | null => (ghost.mode?.kind === "place" ? ghost.mode.item : null);

export function useHotbar(): {
  slots: readonly string[];
  counts: Record<string, number>;
  selected: string | null;
} {
  useSyncExternalStore(subscribe, () => tick);
  return { slots, counts, selected: selected() };
}

let fetching = 0;
/** Reads the bag again. The newest answer wins. */
export async function refreshBag(): Promise<void> {
  const n = ++fetching;
  const rows = await town.bag().catch(() => null);
  if (!rows || n !== fetching) return;
  counts = Object.fromEntries(rows.map((r) => [r.item, r.count]));
  slots = orderSlots(rows, recent, (i) => itemById(i)?.name ?? i);
  bump();
}

/** Holds the slot's piece, or lets go if it is already held. */
export function toggle(item: string): void {
  if (selected() === item) cancel(true);
  else startPlace(item);
}

/** Key `n` (0-based). True when it was ours (we are in our office and the slot is filled). */
export function pickSlot(n: number): boolean {
  if (!inMyOffice()) return false;
  const item = slots[n];
  if (!item) return false;
  toggle(item);
  return true;
}

/** [ ] and the wheel while a piece is held. True when it was ours. */
export function stepSlot(delta: number): boolean {
  if (!inMyOffice() || selected() === null) return false;
  const item = cycle(slots, selected(), delta);
  if (item) startPlace(item);
  return true;
}

placedListeners.add((item) => {
  const before = slots;
  recent = pushRecent(recent, item);
  void refreshBag().then(() => {
    if (ghost.mode || !inMyOffice()) return;
    const next = nextAfterPlace(before, item, counts);
    if (next) startPlace(next);
  });
});
