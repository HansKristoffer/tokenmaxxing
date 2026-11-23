/**
 * Actions that take this long are logged with their actor and key. RivetKit only logs `action_timed_out`
 * when one passes its 60 s limit, without saying which action it was; the line here comes when the
 * handler actually finishes, so a timed-out one still shows how long it really ran.
 */
export const SLOW_ACTION_MS = 5_000;

type Definition = { config: { actions?: Record<string, unknown> } };
type Ctx = { key?: unknown[] };

/** Logs the action when it ran at least `slowMs`; `failed` says whether it threw or rejected. */
function reportSlow(
  name: string,
  action: string,
  c: Ctx,
  start: number,
  failed: boolean,
  slowMs: number,
  log: (line: string) => void,
): void {
  const ms = Math.round(performance.now() - start);
  if (ms < slowMs) return;
  const key = c.key?.join("/") ?? "";
  const outcome = failed ? " (failed)" : "";
  log(`[slow] ${name}[${key}].${action} ${ms} ms${outcome}`);
}

/** Times every action of `definition`, in place. */
export function logSlowActions(
  name: string,
  definition: Definition,
  slowMs = SLOW_ACTION_MS,
  log: (line: string) => void = console.warn,
): void {
  const actions = definition.config.actions ?? {};
  for (const [action, handler] of Object.entries(actions)) {
    if (typeof handler !== "function") continue;
    actions[action] = (c: Ctx, ...args: unknown[]) => {
      const start = performance.now();
      let out: unknown;
      try {
        out = handler(c, ...args);
      } catch (err) {
        reportSlow(name, action, c, start, true, slowMs, log);
        throw err;
      }

      // The timing only observes the result: the caller still gets the promise itself.
      if (out instanceof Promise) {
        out.then(
          () => reportSlow(name, action, c, start, false, slowMs, log),
          () => reportSlow(name, action, c, start, true, slowMs, log),
        );
      } else {
        reportSlow(name, action, c, start, false, slowMs, log);
      }
      return out;
    };
  }
}
