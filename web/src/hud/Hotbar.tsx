import { itemById } from "@tokenmaxxing/core/shop.ts";
import { useEffect, useState } from "react";
import { ghost } from "../game/furniture.ts";
import { slotsFit } from "../game/hotbar.ts";
import { inMyOffice, refreshBag, toggle, useHotbar } from "../game/hotbar-state.ts";
import { take } from "../game/input.ts";
import { world } from "../game/world.ts";
import { useHud } from "../store.ts";
import { merchName } from "./Merch.tsx";
import { ItemImage } from "./Shop.tsx";
import { useNarrow } from "./ui.tsx";

/**
 * The building hotbar: your furniture in up to nine slots along the bottom, in your own office (and while a
 * piece is being placed). 1-9 or a tap holds a piece (the ghost, `startPlace`), the same again lets go.
 */
export function Hotbar() {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const notice = useHud((s) => s.notice);
  const room = useHud((s) => s.room);
  const panel = useHud((s) => s.panel);
  const narrow = useNarrow();
  const { slots, counts, selected } = useHotbar();
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a changed wallet or a settled trade can mean a new bag; so can entering the office
  useEffect(() => {
    void refreshBag();
  }, [wallet, notice, room]);
  const mine = room === `office:${world.selfId}` && inMyOffice();
  const active = mine || ghost.mode !== null;
  const n = slotsFit(width, narrow ? 316 : 424);
  const shown = slots.slice(0, n);
  useEffect(() => {
    // Lifts the dialog and the piece hint clear of the bar (see the hud.css block).
    document.body.classList.toggle("hotbar-on", active && n > 0 && !panel);
    return () => document.body.classList.remove("hotbar-on");
  }, [active, n, panel]);
  if (!me || !active || n === 0 || panel) return null;
  const left = Math.max((width - n * 48) / 2, narrow ? 316 : 424);
  return (
    <div className="hotbar" style={{ left }}>
      <div className="hotbar-hint">
        <span>F pick up · M move · Esc done</span>
        {mine && (
          <button type="button" className="hotbar-pick" onClick={take}>
            Pick up
          </button>
        )}
      </div>
      <div className="hotbar-slots" role="toolbar" aria-label="Furniture hotbar">
        {shown.length === 0 && <span className="hotbar-empty">No furniture in your bag</span>}
        {shown.map((item, i) => {
          const it = itemById(item);
          if (!it) return null;
          return (
            <button
              key={item}
              type="button"
              className={`hotbar-slot${item === selected ? " on" : ""}`}
              aria-pressed={item === selected}
              aria-label={`${i + 1}: ${merchName(it)} ×${counts[item] ?? 0}`}
              title={`${merchName(it)} (${i + 1})`}
              onClick={(e) => {
                toggle(item);
                e.currentTarget.blur();
              }}
            >
              <span className="hotbar-icon">
                <ItemImage item={it} look={me.look} bare />
              </span>
              <span className="hotbar-key">{i + 1}</span>
              {(counts[item] ?? 0) > 1 && <span className="hotbar-n">{counts[item]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
