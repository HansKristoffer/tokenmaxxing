import { DeskFleet, DeskGoods } from "./RoomGoods.tsx";
import { Modal } from "./ui.tsx";

/**
 * My room's desk: choose between the setups I own, and see the tier the company's house desks have. Nothing
 * is sold here; monitors and the house desks are bought at Møbelhuset.
 */
export function DeskPanel() {
  return (
    <Modal title="🖥 My desk" wide>
      <DeskGoods buy={false} />
      <DeskFleet buy={false} />
    </Modal>
  );
}
