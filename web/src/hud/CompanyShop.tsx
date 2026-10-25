import { COMPANY_FURNITURE } from "@tokenmaxxing/core/office.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { useState } from "react";
import { startPlace } from "../game/furniture.ts";
import { conn, refreshMe, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { PieceImage } from "./Shop.tsx";
import { TakeMeThere } from "./ShopDirectory.tsx";
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

/** Runs a purchase or put-out and keeps its notice and error. */
function useAct() {
  const [notice, setNotice] = useState<string | null>(null);
  const { error, run } = useRun();
  const act: Act = (fn) =>
    run(async () => {
      setNotice(null);
      setNotice((await fn()).notice);
      await refreshMe();
    });
  return { act, notice, error, run, setNotice };
}

/**
 * The company's catalogue, from the company wallet: only the owner buys, and only here, in Møbelhuset
 * (the Shop page's "Company" tab). It goes to the storeroom; the building puts it out.
 */
export function CompanyOrder() {
  const co = useHud((s) => s.me?.company);
  const { act, notice, error } = useAct();
  if (!co) return <p className="muted">Join a company first.</p>;
  return (
    <>
      <p className="wallet">
        <strong>{coins(co.wallet)}</strong> in the company wallet
      </p>
      <p className="muted small">
        Paid from the company wallet. What you order waits in the storeroom: put it out from your building.
      </p>
      {notice && <p className="muted">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <Catalogue pieces={COMPANY_FURNITURE.filter((f) => !f.wall)} wallet={co.wallet} act={act} />
      <h3>🖼 Posters</h3>
      <p className="muted small">Parodies, hung on the building's top wall.</p>
      <Catalogue pieces={COMPANY_FURNITURE.filter((f) => f.wall)} wallet={co.wallet} act={act} />
    </>
  );
}

/**
 * The company's storeroom: any member puts out what is stored, in the building. Ordering is done at
 * Møbelhuset, so this page only points there.
 */
export function CompanyShop() {
  const me = useHud((s) => s.me);
  const co = me?.company;
  const inside = useHud((s) => co != null && (s.room === `hq:${co.id}` || s.room === `common:${co.id}`));
  const { act, notice, error, run, setNotice } = useAct();
  if (!me || !co) return <Modal title="🛋 Company furniture">Join a company first.</Modal>;

  // Put out with a ghost to aim (`startPlace`): the piece stays in the storeroom until it is put down.
  const putOut = (item: string) => () => {
    startPlace(item, true);
  };
  const putAway = run(async () => {
    setNotice(null);
    setNotice((await conn.putAway()).notice);
    await Promise.all([refreshMe(), refreshWallet()]);
  });

  return (
    <Modal title={`🛋 ${co.name}: furniture`} wide>
      <p className="wallet">
        <strong>{coins(co.wallet)}</strong> in the company wallet
      </p>
      <p className="muted small">
        {inside
          ? "Put out what is stored; it goes down where you aim the ghost. G takes a piece back to the storeroom, Ctrl/Cmd+Z undoes."
          : "Walk into your building, or its common room upstairs, to put things out."}
      </p>
      {notice && <p className="muted">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {co.stored.length > 0 ? (
        <>
          <h3>📦 Storeroom</h3>
          <p className="muted small">
            <button type="button" disabled={!inside} onClick={act(() => town.placeAll())}>
              Place all
            </button>{" "}
            <button type="button" disabled={!inside} onClick={putAway}>
              Put everything in this room away
            </button>
          </p>
          <ul className="shop">
            {co.stored.map((s) => (
              <li key={s.item}>
                <PieceImage ch={s.item.slice(5)} />
                <span>
                  {itemById(s.item)?.name}
                  {s.count > 1 && <span className="muted"> ×{s.count}</span>}
                </span>
                <button type="button" disabled={!inside} onClick={putOut(s.item)}>
                  Put out…
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="muted">The storeroom is empty.</p>
          {inside && (
            <p className="muted small">
              <button type="button" onClick={putAway}>
                Put everything in this room away
              </button>
            </p>
          )}
        </>
      )}
      {co.isOwner ? (
        <p>
          <TakeMeThere shop="furniture" label="Order at Møbelhuset" />
          <span className="muted small"> The owner orders in the shop, under "Company".</span>
        </p>
      ) : (
        <p className="muted small">Your company's owner orders furniture at Møbelhuset.</p>
      )}
      <p className="muted small">
        <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "company" } })}>
          ← {co.name}
        </button>
      </p>
    </Modal>
  );
}
