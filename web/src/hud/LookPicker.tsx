import { FREE_OUTFITS, itemsIn } from "@tokenmaxxing/core/shop.ts";
import { LOOK_OPTIONS, type Look, STYLE_NAMES } from "@tokenmaxxing/core/world.ts";
import { useState } from "react";
import { refreshMe, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { AvatarImage, Modal, useRun } from "./ui.tsx";

/** The free parts; glasses, hats, pets and fancier outfits are worn from the shop. */
const LABELS = { style: "Style", skin: "Skin", hair: "Hair", outfit: "Outfit" } as const;
type Part = keyof typeof LABELS;
const COUNTS: Record<Part, number> = { ...LOOK_OPTIONS, outfit: FREE_OUTFITS };

export function LookPicker() {
  const me = useHud((s) => s.me);
  const [look, setLook] = useState<Look | null>(me?.look ?? null);
  const [name, setName] = useState(me?.name ?? "");
  const { error, run } = useRun();
  const [saved, setSaved] = useState(false);
  if (!me || !look) return <Modal title="Your character">Loading…</Modal>;

  const cycle = (k: Part, d: number) => setLook({ ...look, [k]: (look[k] + d + COUNTS[k]) % COUNTS[k] });
  const label = (k: Part) =>
    k === "style"
      ? STYLE_NAMES[look.style]
      : k === "outfit" && look.outfit >= FREE_OUTFITS
        ? itemsIn(look).find((i) => i.slot === "outfit")?.name
        : `${LABELS[k]} ${look[k] + 1}`;

  return (
    <Modal title="Your character">
      <p className="muted small">
        Other people in town see it too. Glasses, hats, pets and fancier clothes are in the{" "}
        <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "shop" } })}>
          shop
        </button>
        .
      </p>
      <div className="look">
        <AvatarImage look={look} scale={8} />
        <div className="look-options">
          {(Object.keys(LABELS) as Part[]).map((k) => (
            <div key={k} className="cycle">
              <button type="button" aria-label={`Previous ${LABELS[k]}`} onClick={() => cycle(k, -1)}>
                ◀
              </button>
              <span>{label(k)}</span>
              <button type="button" aria-label={`Next ${LABELS[k]}`} onClick={() => cycle(k, 1)}>
                ▶
              </button>
            </div>
          ))}
        </div>
      </div>
      <label className="field">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
      </label>
      <button
        type="button"
        className="primary"
        onClick={run(async () => {
          await town.setLook(look);
          if (name !== me.name) await town.rename(name);
          await refreshMe();
          setSaved(true);
        })}
      >
        {saved ? "Saved" : "Save"}
      </button>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
