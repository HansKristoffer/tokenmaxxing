import type { Festive } from "@tokenmaxxing/core/festive.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { useEffect, useState, useSyncExternalStore } from "react";
import { festiveNow, festiveUrlPinned } from "../game/festive.ts";
import { festiveGreeting } from "../game/festive-palette.ts";
import { skyNow } from "../game/sky.ts";
import { graphics } from "../settings/graphics.ts";
import { storage } from "../storage.ts";
import { useHud } from "../store.ts";
import { ToastButton, useFresh } from "./ui.tsx";

const SHOWN_MS = 8000;

/** The festive theme now, refreshed every 20 s and the moment the setting or the server's pin changes. */
export function useFestive(): Festive | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, []);
  useHud((s) => s.festivePin);
  useSyncExternalStore(graphics.subscribe, () => graphics.get().overrides.seasonal);
  return festiveNow();
}

/** `data-festive="halloween"` on the page root while a theme is on, for the HUD stylesheet's accent. */
export function FestiveAccent() {
  const id = useFestive()?.id;
  useEffect(() => {
    if (id) document.documentElement.dataset.festive = id;
    else delete document.documentElement.dataset.festive;
    return () => {
      delete document.documentElement.dataset.festive;
    };
  }, [id]);
  return null;
}

/** The storage flag for a theme's toast on the world day `ms` is in. */
export const festiveSeenKey = (id: string, ms: number): string => {
  const { y, m, d } = worldWall(ms);
  return `festive-seen:${id}:${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** Once a day, on the first visit in a theme's window: "Happy Halloween", "6 sleeps to Christmas". */
export function FestiveToast() {
  const f = useFestive();
  const id = f?.id;
  const [shown, setShown] = useState<{ text: string; at: number } | null>(null);
  useEffect(() => {
    const now = festiveNow();
    if (!id || now?.id !== id) return;
    const key = festiveSeenKey(now.id, skyNow());
    // A URL pin (dev, QA) shows it every load, and leaves no flag.
    if (!festiveUrlPinned) {
      if (storage.getItem(key)) return;
      storage.setItem(key, "1");
    }
    setShown({ text: festiveGreeting(now), at: Date.now() });
  }, [id]);
  const fresh = useFresh(shown?.at, SHOWN_MS);
  if (!fresh || !shown || !f) return null;
  return (
    <ToastButton className="festive-toast" dismiss={() => setShown(null)}>
      {shown.text}
    </ToastButton>
  );
}
