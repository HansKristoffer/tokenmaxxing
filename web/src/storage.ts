/**
 * `localStorage` that never throws: private mode or blocked storage makes even touching the global
 * raise a SecurityError. Then values live in memory for the session.
 */
const memory = new Map<string, string>();

function backing(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export const storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem(key) {
    try {
      const v = backing()?.getItem(key);
      if (v !== undefined) return v;
    } catch {
      // Blocked storage throws on read: the memory copy answers instead.
    }
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    memory.set(key, value);
    try {
      backing()?.setItem(key, value);
    } catch {
      // Blocked or full storage keeps the value in memory for this session.
    }
  },
  removeItem(key) {
    memory.delete(key);
    try {
      backing()?.removeItem(key);
    } catch {
      // Blocked storage has nothing to remove: the memory copy is already gone.
    }
  },
};
