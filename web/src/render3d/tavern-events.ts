import { TUNES } from "@tokenmaxxing/core/tunes.ts";
import * as THREE from "three";
import type { TavernRoom } from "../demo3d/tavern3d.ts";
import { hud } from "../store.ts";
import type { LiveFrame } from "./rooms.ts";
import { jukeboxSign } from "./world-logic.ts";

const v = new THREE.Vector3();

/**
 * The Tavern's live bits on top of its boards (`live.ts`): a sign over the jukebox with the track, who put
 * it on and the skip votes (a click opens the jukebox), and the tip jar's coin, thrown when the server says
 * a toss landed. The jar no longer tosses by itself: a coin in it is somebody's.
 */
export class TavernEvents {
  private el: HTMLDivElement | null = null;
  private text = "";
  private readonly at = new THREE.Vector3();
  private placed = false;

  constructor(private readonly inn: TavernRoom) {
    if (inn.fountain) inn.fountain.auto = false;
  }

  /** A coin into the tip jar. */
  toss(): void {
    this.inn.fountain?.toss();
  }

  update(f: LiveFrame): void {
    const { jukebox } = this.inn;
    if (!this.placed) {
      jukebox.updateWorldMatrix(true, false);
      jukebox.getWorldPosition(this.at);
      this.at.y += 2.05;
      this.placed = true;
    }
    if (!this.el) {
      this.el = f.overlay.make("r3-sign link");
      this.el.addEventListener("click", () => hud.set({ panel: { kind: "jukebox" } }));
    }
    const now = hud.get().jukebox;
    const tune = now ? TUNES.find((t) => t.id === now.track) : undefined;
    const text = jukeboxSign(now, tune ? `${tune.emoji} ${tune.name}` : null);
    if (text !== this.text) {
      this.text = text;
      this.el.textContent = text;
    }
    f.overlay.place(this.el, v.copy(this.at), f.camera);
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}
