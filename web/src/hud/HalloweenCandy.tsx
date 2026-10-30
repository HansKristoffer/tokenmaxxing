import { useSyncExternalStore } from "react";
import { bucket, spookyOn, subscribeBucket } from "../game/spooky.ts";
import { useHud } from "../store.ts";
import { useFestive } from "./Festive.tsx";

/**
 * Halloween's candy bucket (`game/spooky.ts`): a chip at the top of the screen while the theme is on, with the sweets
 * collected at the doorsteps and how many of tonight's doors have opened. Cosmetic and kept in this browser.
 */
export function HalloweenCandy() {
  const on = useFestive()?.id === "halloween";
  const room = useHud((s) => s.room);
  // Re-renders when a door opens (the version changes), and nothing else.
  useSyncExternalStore(subscribeBucket, () => bucket().version);
  if (!on || room !== "town" || !spookyOn()) return null;
  const { candy, doors, of } = bucket();
  return (
    <div className="candy-chip" title="Trick-or-treat: face a doorstep pumpkin and press E">
      <span aria-hidden>🍬</span> {candy}
      <span className="candy-doors">
        {" "}
        · 🚪 {doors}/{of}
      </span>
      {of > 0 && doors >= of ? <span aria-hidden> 👑</span> : null}
    </div>
  );
}
