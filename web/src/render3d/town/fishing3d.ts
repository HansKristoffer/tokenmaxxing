import * as THREE from "three";
import { fishingLine } from "../../game/fishing-line.ts";
import { liveModel } from "../kit/kit.ts";

/** A borrowed rod, line and bobber on the real pond, while the catch panel is open. */
export class FishingLine {
  readonly group = liveModel();
  private readonly bobber = liveModel();
  private readonly points = new Float32Array(6);
  private readonly rodPoints = new Float32Array(6);
  private readonly line: THREE.Line;
  private readonly rod: THREE.Line;
  constructor() {
    this.group.name = "fishing-line";
    this.group.userData.nopick = true;
    this.group.userData.noBlock = true;
    this.group.visible = false;
    this.bobber.cyl(0.035, 0.07, "#fff0d1");
    this.bobber.cyl(0.035, 0.04, "#db655f", [0, 0.07, 0]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.points, 3));
    this.line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#fff0c8" }));
    const rodGeometry = new THREE.BufferGeometry();
    rodGeometry.setAttribute("position", new THREE.BufferAttribute(this.rodPoints, 3));
    this.rod = new THREE.Line(rodGeometry, new THREE.LineBasicMaterial({ color: "#815b37" }));
    this.line.frustumCulled = this.rod.frustumCulled = false;
    this.group.add(this.bobber, this.line, this.rod);
  }
  update(now: number, toWorld: (x: number, y: number) => [number, number], calm: boolean): void {
    const cast = fishingLine();
    this.group.visible = cast !== null;
    if (!cast) return;
    const [px, pz] = toWorld(cast.x, cast.y);
    const [wx, wz] = toWorld(cast.waterX, cast.waterY);
    const tipX = px + (wx - px) * 0.4,
      tipZ = pz + (wz - pz) * 0.4;
    const y = 0.06 + (calm ? 0 : Math.sin(now / 220) * 0.015);
    this.bobber.position.set(wx, y, wz);
    this.points.set([tipX, 1.25, tipZ, wx, y + 0.1, wz]);
    this.rodPoints.set([px, 0.65, pz, tipX, 1.25, tipZ]);
    this.line.geometry.attributes.position!.needsUpdate = true;
    this.rod.geometry.attributes.position!.needsUpdate = true;
  }
}
