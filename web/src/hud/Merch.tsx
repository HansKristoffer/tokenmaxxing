import {
  EMPLOYEE_MERCH_DISCOUNT,
  type Item,
  itemById,
  MERCH,
  merchId,
  merchPrice,
} from "@tokenmaxxing/core/shop.ts";
import { useEffect } from "react";
import { errorText, refreshMe, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { ItemImage, isWorn, WearButton, withItem } from "./Shop.tsx";
import { Modal, useRun } from "./ui.tsx";

/** "Acme tee": merch says whose it is; everything else is its own name. */
export function merchName(item: Item): string {
  if (item.companyId === undefined) return item.name;
  const company = hud.get().companies.find((c) => c.id === item.companyId);
  return company ? `${company.name} ${item.name.toLowerCase()}` : item.name;
}

/**
 * A company's merch: a tee, a hoodie, a cap and a mug in its colours. Outsiders pay, into the company
 * wallet; its own people get `EMPLOYEE_MERCH_DISCOUNT` off (free, as it stands).
 */
export function MerchShop({ companyId }: { companyId: number }) {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const company = useHud((s) => s.companies.find((c) => c.id === companyId));
  const { error, run } = useRun();
  useEffect(() => {
    void town.wallet().then(
      (w) => hud.set({ wallet: w }),
      (e) => hud.set({ dialog: errorText(e) }),
    );
  }, []);
  if (!me || !wallet || !company)
    return <Modal title="👕 Merch">{company ? "Loading…" : "That company is gone."}</Modal>;
  const employee = me.company?.id === companyId;
  const off = Math.round(EMPLOYEE_MERCH_DISCOUNT * 100);

  const buy = (item: Item) =>
    run(async () => {
      hud.set({ wallet: await town.buy(item.id) });
      await town.setLook(withItem(item, me.look, true));
      await refreshMe();
    });

  return (
    <Modal title={`👕 ${company.name} merch`} wide>
      <p className="muted small">
        {employee
          ? off === 100
            ? "You work here: yours are free, one of each."
            : `You work here: ${off}% off, and what you pay goes into the company wallet.`
          : `Everything you pay goes into ${company.name}'s company wallet. Its people get theirs ${off === 100 ? "free" : `${off}% off`}.`}
      </p>
      <p className="wallet">
        <strong>🪙 {wallet.balance.toLocaleString()}</strong> coins
      </p>
      <ul className="shop">
        {MERCH.map((m) => {
          const item = itemById(merchId(companyId, m.kind))!;
          const owned = wallet.owned.includes(item.id);
          const price = merchPrice(m.kind, employee);
          return (
            <li key={m.kind} className={isWorn(item, me.look) ? "wearing" : undefined}>
              <span className="merch-pics">
                <ItemImage item={item} look={me.look} bare />
                <ItemImage item={item} look={me.look} />
              </span>
              <span>{merchName(item)}</span>
              {owned && <WearButton item={item} look={me.look} run={run} />}
              {!(owned && price === 0) && (
                <button
                  type="button"
                  className="primary"
                  disabled={wallet.balance < price}
                  onClick={buy(item)}
                >
                  {price === 0 ? "Free" : `🪙 ${price}`}
                  {employee && price < m.price && <s className="muted"> {m.price}</s>}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
