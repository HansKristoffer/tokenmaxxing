import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SyncState } from "../types.ts";

export const emptyState = (): SyncState => ({ files: {}, lastSyncedAt: null });

/** A missing or corrupt file starts over from zero; the server dedups the re-read. */
export async function loadState(path: string): Promise<SyncState> {
  try {
    const raw = (await Bun.file(path).json()) as Partial<SyncState>;
    if (!raw || typeof raw.files !== "object" || raw.files === null) return emptyState();
    return { ...emptyState(), ...raw } as SyncState;
  } catch {
    return emptyState();
  }
}

/** Write-then-rename so a crash mid-write never leaves a truncated state file. */
export async function saveState(path: string, state: SyncState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(state));
  await rename(tmp, path);
}
