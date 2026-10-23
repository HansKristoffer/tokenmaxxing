import { COMPANY_FURNITURE } from "@tokenmaxxing/core/office.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { useState } from "react";
import { refreshMe, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { PieceImage } from "./Shop.tsx";
import { Modal, useRun } from "./ui.tsx";

type Act = (fn: () => Promise<{ notice: string }>) => () => Promise<void>;

function Catalogue({
  pieces,
  wallet,
  act,
}: {
  pieces: readonly (typeof COMPANY_FURNITURE)[number][];
  wallet: number;
  act: Act;
}) {
  return (
    <ul className="shop">
      {pieces.map((f) => (
        <li key={f.ch}>
          <PieceImage ch={f.ch} />
          <span>{f.name}</span>
          <button
            type="button"
            className="primary"
            disabled={wallet < f.price}
            onClick={act(() => town.buyPiece(`furn.${f.ch}`))}
          >
            🪙 {f.price}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The company building's furniture, from the company wallet. Any member buys; whoever is in the
 * building puts it down in front of them (otherwise it waits in the storeroom); any member puts out
 * what's stored, and G takes a piece back in.
 */
export function CompanyShop() {
  const me = useHud((s) => s.me);
  const co = me?.company;
  const inside = useHud((s) => co != null && s.room === `hq:${co.id}`);
  const [notice, setNotice] = useState<string | null>(null);
  const { error, run } = useRun();
  if (!me || !co) return <Modal title="🛋 Company furniture">Join a company first.</Modal>;

  const act = (fn: () => Promise<{ notice: string }>) =>
    run(async () => {
      setNotice(null);
      setNotice((await fn()).notice);
      await refreshMe();
    });

  return (
    <Modal title={`🛋 ${co.name}: furniture`} wide>
      <p className="wallet">
        <strong>{coins(co.wallet)}</strong> in the company wallet
      </p>
      <p className="muted small">
        You spend the company wallet.
        {inside
          ? "It goes down in front of you; G takes a piece back to the storeroom."
          : "Walk into your building to put things out."}
      </p>
      {notice && <p className="muted">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {co.stored.length > 0 && (
        <>
          <h3>📦 Storeroom</h3>
          <ul className="shop">
            {co.stored.map((s) => (
              <li key={s.item}>
                <PieceImage ch={s.item.slice(5)} />
                <span>
                  {itemById(s.item)?.name}
                  {s.count > 1 && <span className="muted"> ×{s.count}</span>}
                </span>
                <button type="button" disabled={!inside} onClick={act(() => town.placePiece(s.item))}>
                  Put out
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Catalogue</h3>
      <Catalogue pieces={COMPANY_FURNITURE.filter((f) => !f.wall)} wallet={co.wallet} act={act} />
      <h3>🖼 Posters</h3>
      <p className="muted small">Parodies, hung on the building's top wall, on the free spot nearest you.</p>
      <Catalogue pieces={COMPANY_FURNITURE.filter((f) => f.wall)} wallet={co.wallet} act={act} />
      <p className="muted small">
        <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "company" } })}>
          ← {co.name}
        </button>
      </p>
    </Modal>
  );
}
