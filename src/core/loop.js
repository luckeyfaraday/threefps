import * as THREE from "three";

export class GameLoop {
  constructor(onFrame) {
    this.clock = new THREE.Clock();
    this.onFrame = onFrame;
  }

  start(renderer) {
    this.clock.start();
    renderer.setAnimationLoop(() => {
      this.onFrame(this.clock.getDelta());
    });
  }

  stop(renderer) {
    renderer.setAnimationLoop(null);
  }
}
