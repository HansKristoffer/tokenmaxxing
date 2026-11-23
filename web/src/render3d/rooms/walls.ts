/**
 * How far a wall moves towards its height on this tick: lowered in front of the camera, up elsewhere. The step is
 * scaled by the time that passed, not by the frame, so a slow frame catches up instead of crawling. A settle (a long
 * `dt`, as the batching probe's last tick and a room's first frame pass) puts every wall where it belongs at once,
 * rather than leaving them partway down from the probe's other directions to rise in view.
 */
export const wallEase = { k: 0.25 };

/** Sets `wallEase` for a tick `dt` seconds long. */
export function easeWalls(dt: number): void {
  wallEase.k = 1 - Math.exp(-dt * 14);
}
