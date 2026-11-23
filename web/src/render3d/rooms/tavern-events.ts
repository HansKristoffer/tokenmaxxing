import { TUNES } from "@tokenmaxxing/core/tunes.ts";
import * as THREE from "three";
import { clockFaces, clocksSign } from "../../game/clocks.ts";
import { darknessNow, lightsNow, warmthNow } from "../../game/sky.ts";
import { bandCaption, bandText } from "../../game/tavern-performance.ts";
import { hud } from "../../store.ts";
import { setPropsNight } from "../town/props.ts";
import { jukeboxSign, tavernDim } from "../town/world-logic.ts";
import { JulefrokostSpread } from "./julefrokost3d.ts";
import { KeynoteScreen } from "./keynote3d.ts";
import type { LiveFrame } from "./rooms.ts";
import { TavernBand } from "./tavern-band3d.ts";
import { setTavernNight, type TavernRoom } from "./tavern3d.ts";

// Scratch vector for world positions, reused every frame.
const scratch = new THREE.Vector3();

/**
 * The Tavern's live bits on top of its boards (`live.ts`): a sign over the jukebox with the track, who put it on and
 * the skip votes (a click opens the jukebox), a sign over the world clocks while the launch window is open, and the
 * tip jar's coin, thrown when the server says a toss landed. The jar no longer tosses by itself: a coin in it is
 * somebody's. Also the keynote watch party's screen on the west wall (`keynote3d.ts`), and the tables laid for
 * julefrokost on December's Friday and Saturday evenings (`julefrokost3d.ts`).
 */
export class TavernEvents {
  private readonly band = new TavernBand();
  private bandSign: HTMLDivElement | null = null;
  private jukeboxEl: HTMLDivElement | null = null;
  private jukeboxText = "";
  private readonly jukeboxAt = new THREE.Vector3();
  private jukeboxPlaced = false;
  private clocks: { el: HTMLDivElement; text: string; at: THREE.Vector3 } | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private base = { hemi: 1, sun: 1 };
  private readonly night = { hemi: new THREE.Color("#7f8fdc"), sun: new THREE.Color("#8d9cf0") };
  private readonly day = { hemi: new THREE.Color(), sun: new THREE.Color() };
  private lampsOn = false;

  private readonly keynote: KeynoteScreen;
  private readonly julefrokost: JulefrokostSpread;

  constructor(private readonly inn: TavernRoom) {
    inn.room.group.add(this.band.group);
    if (inn.fountain) inn.fountain.auto = false;
    this.keynote = new KeynoteScreen(inn.room);
    this.julefrokost = new JulefrokostSpread(inn.room, inn.by.get("tavern:table-long") ?? []);
  }

  /** The stage's lights, kept so the room can dim with the sky as the 2D Tavern does. */
  lights(hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight): void {
    this.hemi = hemi;
    this.sun = sun;
    this.base = { hemi: hemi.intensity, sun: sun.intensity };
    this.day.hemi.copy(hemi.color);
    this.day.sun.copy(sun.color);
  }

  /**
   * The room's light and lamps for the hour: dimmer and bluer after dark, warmer at dusk, and the candles on
   * (no real lights).
   */
  private sky(now: number): void {
    const dark = darknessNow(now);
    const dusk = warmthNow(now) * (1 - dark);
    const dim = tavernDim(dark, dusk);

    const { hemi, sun } = this;
    if (hemi && sun) {
      // How far the colours have turned to night, capped a little short of full night.
      const nightMix = Math.min(1, dark * 0.9);
      hemi.intensity = this.base.hemi * (1 - dim * 0.8);
      sun.intensity = this.base.sun * (1 - dim);
      hemi.color.copy(this.day.hemi).lerp(this.night.hemi, nightMix);
      sun.color.copy(this.day.sun).lerp(this.night.sun, nightMix);
    }

    // Lamps and windows switch on above 0.4 and off below 0.3, so they do not flicker at the edge.
    // The town's lamps (`Fx`) use the same thresholds.
    const glow = lightsNow(now);
    const turnsOn = !this.lampsOn && glow > 0.4;
    const turnsOff = this.lampsOn && glow < 0.3;
    if (!turnsOn && !turnsOff) return;

    // Past the guard the lamps change one way: on when `turnsOn`, otherwise off.
    this.lampsOn = turnsOn;
    setPropsNight(this.lampsOn);
    setTavernNight(this.lampsOn);
  }

  /** A coin into the tip jar. */
  toss(): void {
    this.inn.fountain?.toss();
  }

  update(f: LiveFrame): void {
    this.sky(f.now);
    this.band.update(f);

    // The band's sign, over the stage.
    if (!this.bandSign) {
      this.bandSign = f.overlay.make("r3-sign link");
      this.bandSign.addEventListener("click", () => hud.set({ dialog: bandText() }));
    }
    const bandLabel = bandCaption();
    if (this.bandSign.textContent !== bandLabel) this.bandSign.textContent = bandLabel;
    this.band.group.localToWorld(scratch.set(0.5, 2.3, 9.5));
    f.overlay.place(this.bandSign, scratch, f.camera, 0, 0, true);

    // The jukebox sign: the track, who put it on and the skip votes.
    const { jukebox } = this.inn;
    if (!this.jukeboxPlaced) {
      jukebox.updateWorldMatrix(true, false);
      jukebox.getWorldPosition(this.jukeboxAt);
      this.jukeboxAt.y += 2.05;
      this.jukeboxPlaced = true;
    }
    if (!this.jukeboxEl) {
      this.jukeboxEl = f.overlay.make("r3-sign link");
      this.jukeboxEl.addEventListener("click", () => hud.set({ panel: { kind: "jukebox" } }));
    }
    const playing = hud.get().jukebox;
    const tune = playing ? TUNES.find((t) => t.id === playing.track) : undefined;
    const label = jukeboxSign(playing, tune ? `${tune.emoji} ${tune.name}` : null);
    if (label !== this.jukeboxText) {
      this.jukeboxText = label;
      this.jukeboxEl.textContent = label;
    }
    f.overlay.place(this.jukeboxEl, scratch.copy(this.jukeboxAt), f.camera, 0, 0, true);

    this.clocksSign(f);
    this.keynote.update(f);
    this.julefrokost.update();
  }

  /** "🚀 Launch window · 09:12 in SF" over the clocks while SF's lamp is on; nothing while it's off. */
  private clocksSign(f: LiveFrame): void {
    const model = this.inn.by.get("tile:◷")?.[0];
    if (!model) return;

    if (!this.clocks) {
      model.updateWorldMatrix(true, false);
      const at = model.getWorldPosition(new THREE.Vector3());
      at.y += 2.75;
      this.clocks = { el: f.overlay.make("r3-sign"), text: "", at };
    }
    const clocks = this.clocks;

    const text = clocksSign(clockFaces()) ?? "";
    if (text !== clocks.text) {
      clocks.text = text;
      clocks.el.textContent = text;
    }
    if (text) {
      f.overlay.place(clocks.el, scratch.copy(clocks.at), f.camera, 0, 0, true);
    } else if (clocks.el.style.display !== "none") {
      clocks.el.style.display = "none";
    }
  }

  dispose(): void {
    setTavernNight(null);
    this.band.dispose();
    this.bandSign?.remove();
    this.bandSign = null;
    this.clocks?.el.remove();
    this.clocks = null;
    this.keynote.dispose();
    this.jukeboxEl?.remove();
    this.jukeboxEl = null;
  }
}
