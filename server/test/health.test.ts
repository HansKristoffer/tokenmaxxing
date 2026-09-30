import { expect, test } from "bun:test";
import { healthCheck } from "../src/health.ts";

test("health reflects actor readiness and recovers after an error", async () => {
  let offline = true;
  const health = healthCheck(async () => {
    if (offline) throw new Error("db closed");
  }, "1.3.0");
  expect((await health()).status).toBe(503);
  offline = false;
  const response = await health();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, version: "1.3.0" });
});

test("stuck readiness probes time out and concurrent checks share one probe", async () => {
  let probes = 0;
  let resolve!: () => void;
  const health = healthCheck(
    () => {
      probes++;
      return new Promise<void>((r) => {
        resolve = r;
      });
    },
    "1.3.0",
    5,
  );
  const responses = await Promise.all([health(), health(), health()]);
  expect(responses.map((r) => r.status)).toEqual([503, 503, 503]);
  expect((await health()).status).toBe(503);
  expect(probes).toBe(1);
  resolve();
  await Promise.resolve();
});
