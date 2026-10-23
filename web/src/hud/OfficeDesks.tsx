import { DESKS, effectiveDesk, nextFleet } from "@tokenmaxxing/core/desks.ts";
import { useEffect, useState } from "react";
import { deskFrame } from "../art/desks.ts";
import { refreshMe, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { Modal, Pixels, useRun, WalletLine } from "./ui.tsx";

/** A setup's desk with its screens on, 4× in a box. */
const Preview = ({ tier, mode = "lit" }: { tier: number; mode?: "lit" | "off" }) => (
  <Pixels sprite={deskFrame(tier, mode)} width={64} height={88} scale={4} stand className="avatar" />
);

/**
 * Desk setups, all looks and no edge: the one I use (bought once with my coins, or earned by level, then
 * switched between for free) and the company's fleet (bought from its wallet, one tier at a time). At a
 * desk in the company's house everyone sees the better of mine and the fleet's.
 */
export function DeskPanel() {
  const wallet = useHud((s) => s.wallet);
  const co = useHud((s) => s.me?.company);
  const [mine, setMine] = useState<{ owned: string[]; using: string } | null>(null);
  const { error, run } = useRun();
  useEffect(() => {
    void refreshWallet();
    void refreshMe();
    void town.deskOwned().then(setMine);
  }, []);
  if (!wallet || !mine) return <Modal title="🖥 Desk">Loading…</Modal>;

  const reload = async () => setMine(await town.deskOwned());
  const use = (id: string) =>
    run(async () => {
      await town.setDesk(id);
      await reload();
    });
  const buy = (id: string) =>
    run(async () => {
      hud.set({ wallet: await town.buyDesk(id) });
      await town.setDesk(id);
      await reload();
    });
  const next = co ? nextFleet(co.deskFleet) : null;
  const personal = DESKS.findIndex((d) => d.id === mine.using);
  const shows = effectiveDesk(personal, co?.deskFleet);

  return (
    <Modal title="🖥 Desk" wide>
      <WalletLine balance={wallet.balance} />
      <p className="muted small">
        Just for looks: everyone sees your setup when you sit at a desk. Buy one once, then switch between
        yours for free.
      </p>
      <ul className="shop">
        {DESKS.map((d, i) => {
          const has = mine.owned.includes(d.id);
          const using = mine.using === d.id;
          return (
            <li key={d.id} className={using ? "wearing" : undefined}>
              <Preview tier={i} />
              <strong>{d.name}</strong>
              <span className="muted small">{d.blurb}</span>
              {has ? (
                <button type="button" disabled={using} onClick={use(d.id)}>
                  {using ? "In use" : "Use"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="primary"
                    disabled={wallet.balance < d.price}
                    onClick={buy(d.id)}
                  >
                    🪙 {d.price}
                  </button>
                  {d.level !== undefined && <span className="muted small">or free at Lv {d.level}</span>}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {co && (
        <>
          <h3>🏢 {co.name}: house desks</h3>
          <p className="wallet">
            <strong>{coins(co.wallet)}</strong> in the company wallet
          </p>
          <p className="muted small">
            Every desk in the house gets this setup, whoever sits there. The wallet pays and any member can
            buy the next one. In the house you see the better of yours and this.
          </p>
          <ul className="shop">
            <li className="wearing">
              <Preview tier={co.deskFleet} />
              <strong>{DESKS[co.deskFleet]?.name ?? DESKS[0]!.name}</strong>
              <span className="muted small">The house's desks now</span>
            </li>
            {next && (
              <li>
                <Preview tier={next.tier} />
                <strong>{next.setup.name}</strong>
                <button
                  type="button"
                  className="primary"
                  disabled={co.wallet < next.setup.fleet}
                  onClick={run(async () => {
                    await town.buyDeskFleet();
                    await refreshMe();
                  })}
                >
                  Buy · 🪙 {next.setup.fleet}
                </button>
              </li>
            )}
          </ul>
          {!next && <p className="muted small">The house has the best setup there is.</p>}
          <p className="muted small">At a desk in your house you show: {DESKS[shows]!.name}.</p>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
