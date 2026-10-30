import { useEffect, useState } from "react";
import { huntNow, onHunt } from "../game/paaske.ts";
import { useHud } from "../store.ts";
import { useFestive } from "./Festive.tsx";

/**
 * Påske's egg hunt (`game/paaske.ts`): a small chip "🥚 3 / 8" in the town while the theme is on, how many of the day's
 * eight hidden eggs this browser has found, and a 🐥 once it has found all of them. Its count is in `localStorage`.
 */
export function PaaskeEggs() {
  const id = useFestive()?.id;
  const inTown = useHud((s) => s.room === "town");
  const [hunt, setHunt] = useState(() => (id === "paaske" ? huntNow() : null));
  useEffect(() => {
    if (id !== "paaske") return;
    setHunt(huntNow());
    const off = onHunt(() => setHunt(huntNow()));
    // The world day turns over while the page is open: the count starts again.
    const tick = setInterval(() => setHunt(huntNow()), 30_000);
    return () => {
      off();
      clearInterval(tick);
    };
  }, [id]);
  if (id !== "paaske" || !inTown || !hunt) return null;
  return (
    <div
      className="paaske-eggs"
      role="status"
      title="Painted eggs hidden in the town today. Walk over one to pick it up."
    >
      {hunt.done ? "🐥" : "🥚"} {hunt.found} / {hunt.total}
    </div>
  );
}
