import { DECORS, type DecorKind } from "@tokenmaxxing/core/decor.ts";
import { directory, OFFICE_LEVEL, OFFICE_SIZES } from "@tokenmaxxing/core/office.ts";
import { useEffect, useState } from "react";
import { send, walkTo } from "../game/input.ts";
import { world } from "../game/world.ts";
import { conn, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { Modal, Pills, useLoad, useRun, WalletLine } from "./ui.tsx";

const KINDS = [
  ["wall", "Wallpaper"],
  ["floor", "Floors"],
] as const;

/** My office's wallpaper and floor: buy once, then switch between what I own for free. */
export function DecorPanel() {
  const wallet = useHud((s) => s.wallet);
  const [kind, setKind] = useState<DecorKind>("wall");
  const [owned, setOwned] = useState<string[] | null>(null);
  const [now, setNow] = useState({ wall: world.owner?.wall, floor: world.owner?.floor });
  const { error, run } = useRun();
  useEffect(() => {
    void refreshWallet();
    void town.decorOwned().then(setOwned);
  }, []);
  if (!wallet || !owned) return <Modal title="🎨 Decorate">Loading…</Modal>;

  const plain = DECORS[kind][0]!.id;
  const use = (id: string) =>
    run(async () => {
      await town.setDecor(kind, id === plain ? null : id);
      setNow((n) => ({ ...n, [kind]: id === plain ? undefined : id }));
    });
  const buy = (id: string) =>
    run(async () => {
      hud.set({ wallet: await town.buyDecor(kind, id) });
      setOwned(await town.decorOwned());
      await town.setDecor(kind, id);
      setNow((n) => ({ ...n, [kind]: id }));
    });

  return (
    <Modal title="🎨 Decorate your office" wide>
      <WalletLine balance={wallet.balance} />
      <p className="muted small">Buy one once, then change between yours whenever you like.</p>
      <Pills value={kind} options={KINDS} onChange={setKind} />
      <ul className="shop">
        {DECORS[kind].map((d) => {
          const has = owned.includes(`${kind}.${d.id}`);
          const using = (now[kind] ?? plain) === d.id;
          return (
            <li key={d.id} className={using ? "wearing" : undefined}>
              <strong>{d.name}</strong>
              <span className="muted small">{d.blurb}</span>
              {has ? (
                <button type="button" disabled={using} onClick={use(d.id)}>
                  {using ? "In use" : "Use"}
                </button>
              ) : d.level !== undefined ? (
                <button type="button" disabled>
                  🔒 Lv {d.level}
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={wallet.balance < d.price}
                  onClick={buy(d.id)}
                >
                  🪙 {d.price}
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

const SIZE_NAMES = ["Small", "Medium", "Large"] as const;

/** The board of open offices: who's welcome, and how busy they've been this week. */
export function OpenOfficesPanel() {
  const { data, error } = useLoad(() => town.openOffices(), []);
  if (error) return <Modal title="🚪 Open offices">{error}</Modal>;
  if (!data) return <Modal title="🚪 Open offices">Loading…</Modal>;
  const visit = (id: number) => () => {
    hud.set({ panel: null });
    world.portalPending = true;
    send(conn.visit(id));
  };
  return (
    <Modal title="🚪 Open offices">
      <p className="muted small">Offices their owners have left open. The busiest this week come first.</p>
      {data.length === 0 ? (
        <p className="muted">No office is open right now.</p>
      ) : (
        <ul className="members offices">
          {data.map((o) => (
            <li key={o.id}>
              <span>
                <strong>{o.name}</strong>
                <span className="muted small facts">
                  {o.company && <span>{o.company}</span>}
                  <span>
                    {SIZE_NAMES[o.tier]} {OFFICE_SIZES[o.tier]!.w}×{OFFICE_SIZES[o.tier]!.h}
                  </span>
                  <span>{o.visitors === 1 ? "1 visitor" : `${o.visitors} visitors`} this week</span>
                  {o.inside > 0 && <span>{o.inside} inside</span>}
                </span>
              </span>
              <button type="button" onClick={visit(o.id)}>
                🚪 {o.id === world.selfId ? "My office" : "Visit"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** The company house's directory board: every office in the building, and a way to its door. */
export function DirectoryPanel() {
  const rows = directory(world.doors, world.selfId);
  const walk = (x: number, y: number) => () => {
    hud.set({ panel: null });
    walkTo(x, y);
  };
  return (
    <Modal title="🚪 Office directory">
      <p className="muted small">Everyone in the building with an office, in door order.</p>
      {rows.length === 0 ? (
        <p className="muted">No one here has an office yet. Offices open at level {OFFICE_LEVEL}.</p>
      ) : (
        <ul className="members offices">
          {rows.map((r) => (
            <li key={r.userId}>
              <span>
                <strong>{r.name}</strong>{" "}
                <span className="muted small facts">
                  <span>{r.mine ? "Your office" : r.open ? "Open" : "🔒 Closed"}</span>
                </span>
              </span>
              <button type="button" disabled={!r.canEnter} onClick={walk(r.x, r.y)}>
                {r.canEnter ? "🚶 Walk there" : "🔒 Locked"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
