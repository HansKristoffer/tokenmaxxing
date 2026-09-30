/** Coalesce readiness probes so a stuck engine never gets a backlog of health requests. */
export function healthCheck(probe: () => Promise<unknown>, version: string, timeoutMs = 5_000) {
  let pending: Promise<boolean> | undefined;
  return async (): Promise<Response> => {
    pending ??= new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      void Promise.resolve()
        .then(probe)
        .then(
          () => {
            clearTimeout(timer);
            resolve(true);
            pending = undefined;
          },
          () => {
            clearTimeout(timer);
            resolve(false);
            pending = undefined;
          },
        );
    });
    const ok = await pending;
    return Response.json({ ok, version }, { status: ok ? 200 : 503 });
  };
}
