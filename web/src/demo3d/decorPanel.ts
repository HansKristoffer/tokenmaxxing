/** A minimal Decorate control for the demo: pick a wallpaper, a floor and an office level, live. */
import type * as THREE from "three";
import { applyDecor, FLOORS, officeSize, WALLPAPERS } from "./decor3d.ts";
import type { Room } from "./room.ts";

const LEVELS = [10, 25, 40];

export function mountDecorPanel(room: Room, target: THREE.Vector3, host = document.body): HTMLElement {
  const style = document.createElement("style");
  style.textContent = `.decor{position:fixed;left:12px;bottom:12px;width:230px;padding:8px;font:12px system-ui;color:#fff;
    background:rgba(20,22,32,.82);border-radius:8px;z-index:5}
    .decor h4{margin:0 0 6px;font-size:12px}.decor label{display:flex;justify-content:space-between;gap:6px;margin:3px 0}
    .decor select{flex:1;min-width:0}.decor .lv button{flex:1;margin-right:3px}.decor .lv button.on{background:#ffd36b}`;
  document.head.append(style);
  const el = document.createElement("div");
  el.className = "decor";
  const opts = (xs: typeof FLOORS) =>
    xs
      .map(
        (d) =>
          `<option value="${d.id}">${d.name} · ${d.level ? `Lv${d.level}` : d.price ? `${d.price}c` : "free"}</option>`,
      )
      .join("");
  el.innerHTML = `<h4>🎨 Decorate</h4>
    <label>Wall <select id="d-wall">${opts(WALLPAPERS)}</select></label>
    <label>Floor <select id="d-floor">${opts(FLOORS)}</select></label>
    <label class="lv">Size ${LEVELS.map((l) => `<button type="button" data-lv="${l}" title="${officeSize(l).w}×${officeSize(l).h}">Lv${l}</button>`).join("")}</label>`;
  host.append(el);
  const wall = el.querySelector<HTMLSelectElement>("#d-wall")!;
  const floor = el.querySelector<HTMLSelectElement>("#d-floor")!;
  const sync = () => applyDecor(room, { wall: wall.value, floor: floor.value });
  wall.onchange = floor.onchange = sync;
  for (const b of el.querySelectorAll<HTMLButtonElement>("[data-lv]"))
    b.onclick = () => {
      applyDecor(room, { level: Number(b.dataset.lv) });
      target.set(room.W / 2, target.y, room.D / 2);
      for (const o of el.querySelectorAll("[data-lv]")) o.classList.toggle("on", o === b);
    };
  return el;
}
