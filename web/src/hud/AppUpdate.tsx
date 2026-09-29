import { useEffect, useState } from "react";

/** The desktop app's bridge, only there in its game window: see updates.rs and world.rs in app/desktop. */
interface Tauri {
  core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> };
  event: { listen<T>(event: string, handler: (e: { payload: T }) => void): Promise<() => void> };
}
export const tauri = (window as { __TAURI__?: Tauri }).__TAURI__;

interface Status {
  current: string;
  available: string | null;
  installing: boolean;
}

/** In the app: a new version waiting to install, and the button that installs it (the app restarts). */
export function AppUpdate() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    if (!tauri) return;
    void tauri.core.invoke<Status>("update_status").then(setStatus, () => {});
    const unlisten = tauri.event.listen<Status>("app-update", (e) => setStatus(e.payload));
    return () =>
      void unlisten.then(
        (off) => off(),
        () => {},
      );
  }, []);
  if (!tauri || !status || !(status.available || status.installing)) return null;
  return (
    <button
      type="button"
      className="chip update"
      disabled={status.installing}
      title={
        status.installing
          ? "Installing the update: the app restarts in a moment"
          : `Tokenmaxxing ${status.available} is ready (you have ${status.current}). The app restarts to install it.`
      }
      onClick={() => void tauri.core.invoke("install_update").catch(() => {})}
    >
      {status.installing ? "Updating…" : `⬆ Update to ${status.available}`}
    </button>
  );
}
