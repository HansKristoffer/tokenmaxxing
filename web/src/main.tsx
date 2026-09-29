import { createRoot } from "react-dom/client";
import { bindInput, updateSelf } from "./game/input.ts";
import { render } from "./game/render.ts";
import { advanceRemotes, world } from "./game/world.ts";
import { Hud } from "./hud/Hud.tsx";
import { connect, signIn } from "./net.ts";

const canvas = document.getElementById("world") as HTMLCanvasElement;
createRoot(document.getElementById("hud")!).render(<Hud />);

const token = await signIn();
if (token) {
  connect(token);
  bindInput(canvas);
  const frame = (now: number) => {
    if (world.selfId) {
      updateSelf(now);
      advanceRemotes(now);
      render(canvas, now);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
