import { describe, expect, test } from "bun:test";
import { admin, eventually, rich, signUp } from "./rivet.ts";
import { connect } from "./world-client.ts";

describe("world: desk setups", () => {
  test("a player's setup reaches everyone else's view, live and in a fresh snapshot", async () => {
    const a = await rich("desk", 200);
    const b = await signUp("desk");
    const watcher = await connect(b.token);
    await a.town.buyDesk("dual");
    await a.town.setDesk("dual");
    await eventually(() =>
      expect(watcher.events.infos.filter((i) => i.id === a.userId).at(-1)?.desk).toBe(1),
    );
    // Someone joining later is told in the snapshot; before anyone chose, it was the laptop.
    const late = await connect(a.token);
    expect(late.snap.players.find((p) => p.id === a.userId)).toMatchObject({ desk: 1 });
    expect(late.snap.players.find((p) => p.id === b.userId)).toMatchObject({ desk: 0 });
    await a.town.setDesk("laptop");
    await eventually(() =>
      expect(watcher.events.infos.filter((i) => i.id === a.userId).at(-1)?.desk).toBe(0),
    );
    await Promise.all([watcher.conn.dispose(), late.conn.dispose()]);
  });

  test("the company's fleet tier is on the wire for everyone; a non-member can't buy it", async () => {
    const owner = await signUp("fleet");
    const co = await owner.town.createCompany("Screens");
    const outsider = await signUp("fleet");
    await expect(outsider.town.buyDeskFleet()).rejects.toMatchObject({ code: "not_member" });
    await expect(owner.town.buyDeskFleet()).rejects.toMatchObject({ code: "too_poor" });
    await admin().adminSetCompanyCoins(co.id, 500);
    const bought = await owner.town.buyDeskFleet();
    expect(bought).toMatchObject({ deskFleet: 1, wallet: 200 });
    const watcher = await connect(outsider.token);
    expect(watcher.snap.companies.find((c) => c.id === co.id)?.deskFleet).toBe(1);
    await watcher.conn.dispose();
  });
});
