import { PET_VARIANTS, petLooks, petOutfit } from "@tokenmaxxing/core/pets.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { variantArt } from "../art/pet-variants/index.ts";
import { PET_H, PET_W, petFrame } from "../art/pets.ts";
import { hud, useHud } from "../store.ts";
import { wear } from "./Shop.tsx";
import { Modal, Pixels, useRun, useTicker } from "./ui.tsx";

const HOP_MS = 600;
const SCALE = 5;

/** A look's name: "Original", the art's name, or (while the art is missing) its id. */
export function variantName(pet: number, variant: number): string {
  if (variant === 0) return "Original";
  const id = PET_VARIANTS[pet]?.[variant - 1] ?? "";
  return variantArt(pet, variant)?.name ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** Whether a variation still has no art, so the original shows in its place. */
const comingSoon = (pet: number, variant: number): boolean =>
  variant > 0 && variantArt(pet, variant) === null;

/**
 * Every look of a pet you hold: the original and its variations, each hopping. Picking one wears the
 * pet in that look (and the pet itself, if it wasn't on).
 */
export function PetLooks({ pet }: { pet: number }) {
  const me = useHud((s) => s.me);
  const { error, run } = useRun();
  useTicker(HOP_MS);
  const item = itemById(`pet.${pet}`);
  if (!me || !item) return <Modal title="Pet looks">Loading…</Modal>;
  const hop = Math.floor(Date.now() / HOP_MS) % 2 === 1;
  const worn = me.look.pet === pet ? me.look.petVariant : -1;

  return (
    <Modal title={`${item.name} looks`} wide>
      <p className="muted small">
        <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "bag" } })}>
          ← Bag
        </button>{" "}
        All of them are yours while you hold the {item.name}.
      </p>
      <ul className="pet-looks">
        {Array.from({ length: petLooks(pet) }, (_, v) => {
          const soon = comingSoon(pet, v);
          const name = variantName(pet, v);
          return (
            <li key={PET_VARIANTS[pet]?.[v - 1] ?? "original"}>
              <button
                type="button"
                className={v === worn ? "cell wearing" : "cell"}
                aria-pressed={v === worn}
                aria-label={`${name}${soon ? ", coming soon" : ""}${v === worn ? ", wearing" : ""}`}
                onClick={run(() => wear({ ...me.look, pet, petVariant: v }))}
              >
                <Pixels
                  sprite={petFrame(pet, false, hop, v, v === worn ? petOutfit(me.look) : null)}
                  width={PET_W * SCALE}
                  height={PET_H * SCALE}
                  className="avatar"
                />
                <span className="name">{name}</span>
                {soon && <span className="soon">coming soon</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
